'use strict';

/**
 * Seal Market — a fake-currency stock market for Seal.
 *
 * Mounted from server.js with:
 *   require('./market')(app, { readDB, writeDB, requireLogin });
 *
 * Written to match server.js exactly: db.users is an object keyed by
 * lowercase username, req.session.user is the username string, readDB()/
 * writeDB() are synchronous (the Mongo mirroring happens in the background
 * inside writeDB itself), and express.json() is already mounted globally —
 * so this file adds no body-parser middleware of its own.
 *
 * Prices move on a server-side random walk. There's no background timer —
 * instead, whichever request touches the market first after some time has
 * passed advances every stock by however many whole "ticks" have elapsed,
 * using crypto's RNG, and that new price is what everyone sees from then
 * on. Buys and sells are validated and settled the same way /api/shop/buy
 * handles Seals — the client only ever displays state it's given.
 *
 * No real money anywhere — Seals cannot be bought, and shares can only
 * ever be cashed back into Seals, never anything else.
 */

const crypto = require('crypto');

/* ---------------------------------------------------------------- tuning */

const TICK_MS = 60 * 1000;      // one price step per simulated minute
const MAX_CATCHUP_TICKS = 720;  // cap a long-idle server's catch-up (12h of ticks)
const HISTORY_LENGTH = 120;     // points kept per stock, for a sparkline
const MIN_PRICE = 1;

// Starting roster. `volatility` is the max magnitude of a single tick's
// random percent move (applied as ±volatility, uniformly).
const LISTINGS = [
  { symbol: 'SEAL', name: 'Seal Inc.',     startPrice: 240, volatility: 0.018 },
  { symbol: 'KELP', name: 'Kelp Co-op',    startPrice: 38,  volatility: 0.030 },
  { symbol: 'TIDE', name: 'Tide Energy',   startPrice: 96,  volatility: 0.022 },
  { symbol: 'ORCA', name: 'Orca Holdings', startPrice: 610, volatility: 0.015 },
  { symbol: 'PNGN', name: 'Pengu Corp',    startPrice: 14,  volatility: 0.045 },
  { symbol: 'CRAB', name: 'Crab Systems',  startPrice: 72,  volatility: 0.028 }
];

/* --------------------------------------------------------------- helpers */

/** A fair float in [0, 1) from the crypto RNG, not Math.random. */
function roll() {
  return crypto.randomInt(0, 1000000) / 1000000;
}

function round2(n) {
  return Math.round(n * 100) / 100;
}

/** Creates db.market (and any missing listings) on first use or after an update. */
function ensureMarket(db) {
  let changed = false;
  if (!db.market || typeof db.market !== 'object') {
    db.market = { stocks: {}, lastTick: Date.now() };
    changed = true;
  }
  if (!db.market.stocks || typeof db.market.stocks !== 'object') {
    db.market.stocks = {};
    changed = true;
  }
  for (const listing of LISTINGS) {
    if (!db.market.stocks[listing.symbol]) {
      db.market.stocks[listing.symbol] = {
        symbol: listing.symbol,
        name: listing.name,
        volatility: listing.volatility,
        price: listing.startPrice,
        prevClose: listing.startPrice,
        history: [listing.startPrice]
      };
      changed = true;
    }
  }
  if (typeof db.market.lastTick !== 'number') { db.market.lastTick = Date.now(); changed = true; }
  return changed;
}

function stepStock(stock) {
  const pct = (roll() - 0.5) * 2 * stock.volatility;
  const next = Math.max(MIN_PRICE, stock.price * (1 + pct));
  stock.price = round2(next);
  stock.history.push(stock.price);
  if (stock.history.length > HISTORY_LENGTH) stock.history.shift();
}

/** Advances every stock by however many whole ticks have elapsed, in one shot. */
function advanceMarket(db) {
  const now = Date.now();
  let ticks = Math.floor((now - db.market.lastTick) / TICK_MS);
  if (ticks <= 0) return false;
  ticks = Math.min(ticks, MAX_CATCHUP_TICKS);

  for (const stock of Object.values(db.market.stocks)) {
    stock.prevClose = stock.price;
    for (let i = 0; i < ticks; i++) stepStock(stock);
  }
  db.market.lastTick = now;
  return true;
}

/** Total current value of a user's shares, using whatever prices are in db.market right now. */
function holdingsValue(db, record) {
  if (!record.portfolio) return 0;
  return round2(Object.entries(record.portfolio).reduce((sum, [symbol, shares]) => {
    const stock = db.market.stocks[symbol];
    return sum + (stock ? stock.price * shares : 0);
  }, 0));
}

/** Cash + current holdings value — what other pages (profile, leaderboard) show. */
function netWorth(db, record) {
  return round2((record.seals || 0) + holdingsValue(db, record));
}

function ensurePortfolio(record) {
  if (!record.portfolio || typeof record.portfolio !== 'object') {
    record.portfolio = {};
    return true;
  }
  return false;
}

function publicMarket(db) {
  return Object.values(db.market.stocks).map(s => ({
    symbol: s.symbol,
    name: s.name,
    price: s.price,
    prevClose: s.prevClose,
    changePercent: s.prevClose ? Number((((s.price - s.prevClose) / s.prevClose) * 100).toFixed(2)) : 0,
    history: s.history
  }));
}

function publicPortfolio(db, record) {
  const holdings = Object.entries(record.portfolio)
    .filter(([, shares]) => shares > 0)
    .map(([symbol, shares]) => {
      const stock = db.market.stocks[symbol];
      const price = stock ? stock.price : 0;
      return { symbol, shares, price, value: round2(price * shares) };
    });
  const holdingsValue = round2(holdings.reduce((sum, h) => sum + h.value, 0));
  return {
    seals: record.seals,
    holdings,
    holdingsValue,
    netWorth: round2(record.seals + holdingsValue)
  };
}

/* ----------------------------------------------------------------- mount */

/**
 * @param {import('express').Express} app
 * @param {{ readDB: Function, writeDB: Function, requireLogin: Function }} deps
 */
module.exports = function mountMarket(app, deps) {
  const { readDB, writeDB, requireLogin } = deps || {};
  if (typeof readDB !== 'function' || typeof writeDB !== 'function' || typeof requireLogin !== 'function') {
    throw new Error('mountMarket needs { readDB, writeDB, requireLogin } from server.js');
  }

  // Public: anyone can watch prices move. Portfolio is only included
  // when signed in.
  app.get('/api/market/state', (req, res) => {
    const db = readDB();
    const marketChanged = ensureMarket(db);
    const ticked = advanceMarket(db);
    const record = req.session.user ? db.users[req.session.user.toLowerCase()] : null;
    const portfolioChanged = record ? ensurePortfolio(record) : false;
    if (marketChanged || ticked || portfolioChanged) writeDB(db);

    res.json({
      stocks: publicMarket(db),
      portfolio: record ? publicPortfolio(db, record) : null,
      tickMs: TICK_MS
    });
  });

  app.post('/api/market/buy', requireLogin, (req, res) => {
    const { symbol: rawSymbol, shares: rawShares } = req.body || {};
    const symbol = String(rawSymbol || '').toUpperCase();
    const shares = Math.floor(Number(rawShares));

    const db = readDB();
    ensureMarket(db);
    advanceMarket(db);

    const stock = db.market.stocks[symbol];
    if (!stock) return res.status(404).json({ error: 'Unknown stock.' });
    if (!Number.isFinite(shares) || shares < 1) {
      return res.status(400).json({ error: 'Enter a whole number of shares.' });
    }

    const record = db.users[req.session.user.toLowerCase()];
    ensurePortfolio(record);

    const cost = round2(stock.price * shares);
    if (cost > record.seals) {
      return res.status(400).json({ error: "You don't have enough Seals for that." });
    }

    record.seals = round2(record.seals - cost);
    record.portfolio[symbol] = (record.portfolio[symbol] || 0) + shares;

    writeDB(db);
    res.json({
      symbol, shares, price: stock.price, cost,
      stocks: publicMarket(db),
      portfolio: publicPortfolio(db, record)
    });
  });

  app.post('/api/market/sell', requireLogin, (req, res) => {
    const { symbol: rawSymbol, shares: rawShares } = req.body || {};
    const symbol = String(rawSymbol || '').toUpperCase();
    const shares = Math.floor(Number(rawShares));

    const db = readDB();
    ensureMarket(db);
    advanceMarket(db);

    const stock = db.market.stocks[symbol];
    if (!stock) return res.status(404).json({ error: 'Unknown stock.' });
    if (!Number.isFinite(shares) || shares < 1) {
      return res.status(400).json({ error: 'Enter a whole number of shares.' });
    }

    const record = db.users[req.session.user.toLowerCase()];
    ensurePortfolio(record);
    const owned = record.portfolio[symbol] || 0;
    if (shares > owned) {
      return res.status(400).json({ error: `You only own ${owned} share${owned === 1 ? '' : 's'} of ${symbol}.` });
    }

    const proceeds = round2(stock.price * shares);
    record.seals = round2(record.seals + proceeds);
    record.portfolio[symbol] = owned - shares;
    if (record.portfolio[symbol] <= 0) delete record.portfolio[symbol];

    writeDB(db);
    res.json({
      symbol, shares, price: stock.price, proceeds,
      stocks: publicMarket(db),
      portfolio: publicPortfolio(db, record)
    });
  });
};

// Exposed so other parts of the server (readDB's init pass, profile pages,
// the leaderboard) can read market data without re-implementing this logic.
module.exports.ensureMarket = ensureMarket;
module.exports.holdingsValue = holdingsValue;
module.exports.netWorth = netWorth;
