'use strict';

/**
 * Seal Flip — a fake-currency betting game for Seal.
 *
 * Mounted from server.js with:
 *   require('./gamble')(app, { readDB, writeDB, requireLogin });
 *
 * Written to match this server.js exactly: db.users is an object keyed by
 * lowercase username, req.session.user is the username string, readDB()/
 * writeDB() are synchronous (the Mongo mirroring happens in the background
 * inside writeDB itself), and express.json() is already mounted globally —
 * so this file adds no body-parser middleware of its own.
 *
 * The server decides everything: the bet is validated, the roll uses
 * crypto's RNG, and the balance is checked and written the same way
 * /api/shop/buy does it. The page only ever animates a result it's told.
 *
 * No real money anywhere — Seals cannot be bought.
 */

const crypto = require('crypto');

/* ---------------------------------------------------------------- tuning */

const MIN_BET = 1;
const MAX_BET = 100;

// Total Seals a single account may stake per UTC day. The main guardrail:
// caps the worst possible day at -500, so a bad run can't eat a whole
// shop-cosmetics grind.
const DAILY_WAGER_CAP = 500;

// Minimum gap between two bets from the same account, in ms.
const COOLDOWN_MS = 1200;

// House edge. 0.025 means every payout returns 97.5% of the stake on
// average, whichever multiplier is picked — no option is a trap.
const HOUSE_EDGE = 0.025;

const MULTIPLIERS = [2, 3, 5, 10];

/** Win chance for a multiplier, e.g. 2x wins 48.75% of the time. */
function chanceFor(multiplier) {
  return (1 - HOUSE_EDGE) / multiplier;
}

/* --------------------------------------------------------------- helpers */

/** A fair float in [0, 1) from the crypto RNG, not Math.random. */
function roll() {
  return crypto.randomInt(0, 1000000) / 1000000;
}

/** UTC day key, so the cap resets at the same moment for everyone. */
function today() {
  return new Date().toISOString().slice(0, 10);
}

/** Reads (and lazily resets) a user's daily gambling counters. */
function dailyStats(record) {
  const day = today();
  if (!record.flip || record.flip.day !== day) {
    record.flip = { day, wagered: 0, net: 0, bets: 0, lastBetAt: 0 };
  }
  return record.flip;
}

function publicState(record) {
  const stats = dailyStats(record);
  return {
    seals: record.seals,
    wageredToday: stats.wagered,
    netToday: stats.net,
    betsToday: stats.bets,
    remainingToday: Math.max(0, DAILY_WAGER_CAP - stats.wagered),
    limits: {
      minBet: MIN_BET,
      maxBet: MAX_BET,
      dailyWagerCap: DAILY_WAGER_CAP,
      cooldownMs: COOLDOWN_MS
    },
    multipliers: MULTIPLIERS.map((m) => ({
      multiplier: m,
      chance: Number(chanceFor(m).toFixed(6))
    }))
  };
}

/* ----------------------------------------------------------------- mount */

/**
 * @param {import('express').Express} app
 * @param {{ readDB: Function, writeDB: Function, requireLogin: Function }} deps
 */
module.exports = function mountFlip(app, deps) {
  const { readDB, writeDB, requireLogin } = deps || {};
  if (typeof readDB !== 'function' || typeof writeDB !== 'function' || typeof requireLogin !== 'function') {
    throw new Error('mountFlip needs { readDB, writeDB, requireLogin } from server.js');
  }

  app.get('/api/flip/state', requireLogin, (req, res) => {
    const db = readDB();
    const record = db.users[req.session.user.toLowerCase()];
    if (!record) return res.status(404).json({ error: 'Account not found.' });
    res.json(publicState(record));
  });

  app.post('/api/flip/bet', requireLogin, (req, res) => {
    const { bet: rawBet, multiplier: rawMultiplier } = req.body || {};
    const bet = Math.floor(Number(rawBet));
    const multiplier = Math.floor(Number(rawMultiplier));

    if (!Number.isFinite(bet) || bet < MIN_BET || bet > MAX_BET) {
      return res.status(400).json({ error: `Bet between ${MIN_BET} and ${MAX_BET} Seals.` });
    }
    if (!MULTIPLIERS.includes(multiplier)) {
      return res.status(400).json({ error: 'Pick one of the listed payouts.' });
    }

    const db = readDB();
    const record = db.users[req.session.user.toLowerCase()];
    if (!record) return res.status(404).json({ error: 'Account not found.' });

    const stats = dailyStats(record);
    const now = Date.now();

    if (now - (stats.lastBetAt || 0) < COOLDOWN_MS) {
      return res.status(429).json({ error: 'One bet at a time — wait a moment.', state: publicState(record) });
    }
    if (bet > record.seals) {
      return res.status(400).json({ error: "You don't have that many Seals.", state: publicState(record) });
    }
    if (stats.wagered + bet > DAILY_WAGER_CAP) {
      const left = Math.max(0, DAILY_WAGER_CAP - stats.wagered);
      return res.status(429).json({
        error: left ? `You can stake ${left} more Seals today.` : "That's the daily limit. Come back tomorrow.",
        state: publicState(record)
      });
    }

    // Roll. The server decides; the page only animates what it's told.
    const chance = chanceFor(multiplier);
    const r = roll();
    const won = r < chance;
    const payout = won ? Math.floor(bet * multiplier) : 0;
    const delta = payout - bet;

    record.seals += delta;
    stats.wagered += bet;
    stats.net += delta;
    stats.bets += 1;
    stats.lastBetAt = now;

    writeDB(db);

    res.json({
      won,
      bet,
      multiplier,
      payout,
      delta,
      rollPercent: Number((r * 100).toFixed(2)),
      winPercent: Number((chance * 100).toFixed(2)),
      state: publicState(record)
    });
  });
};
