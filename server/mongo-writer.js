// mongo-writer.js — stops the server re-uploading the WHOLE database to
// MongoDB on every single change.
//
// The problem: writeDB() used to do `$set: { data: CACHED_DB }`, so every
// chat message, reaction, seal payout etc. sent the entire database (1 MB+
// and growing with chat history) to MongoDB Atlas. Since Aug 2025 Render
// counts traffic your service sends to an external database as outbound
// bandwidth, so a few thousand small changes = gigabytes.
//
// What this does instead:
//   • waits a few seconds and batches every change made in that window into
//     ONE write (a trailing window, so a change is never held longer than
//     `delayMs`);
//   • uploads only the parts that actually changed — each top-level key of
//     the db (chat, auditLog, games…) and each individual user under `users`
//     — using dotted-path $set / $unset;
//   • keeps the stored document byte-for-byte the same shape as before
//     ({ _id: 'db', data: {...} }), so nothing else needs to change and you
//     can switch back any time;
//   • retries failed writes, and flushNow() lets the shutdown hook land the
//     last changes before the process exits.

const SAFE_KEY = /^[A-Za-z0-9_-]+$/;

function createMongoWriter({ getCollection, getDb, delayMs = 15000, log = console }) {
  let last = null;          // Map<path, serialized JSON> of what Atlas holds
  let timer = null;
  let running = null;       // promise of the flush in progress
  let again = false;        // a change arrived while a flush was running
  const stats = { writes: 0, fullWrites: 0, bytes: 0, skipped: 0 };

  // Break the db into independently-diffable pieces.
  function units(db) {
    const out = new Map();
    for (const k of Object.keys(db || {})) {
      const v = db[k];
      if (v === undefined) continue;
      if (!SAFE_KEY.test(k)) { out.set('*', null); continue; }       // odd top-level key → full write
      if (k === 'users' && v && typeof v === 'object' && !Array.isArray(v)) {
        const names = Object.keys(v);
        if (names.every(n => SAFE_KEY.test(n))) {
          out.set('#users', '{}'); // marker: users are tracked one-by-one (not a real db key)
          for (const n of names) out.set('users.' + n, { v: v[n] });
          continue;
        }
      }
      out.set(k, { v });
    }
    return out;
  }
  // Serialize each unit once so we can compare cheaply with what's stored.
  function snapshot(db) {
    const u = units(db);
    const snap = new Map(), vals = new Map();
    let full = false;
    for (const [p, x] of u) {
      if (p === '*') { full = true; continue; }
      if (x && typeof x === 'object' && 'v' in x) { snap.set(p, JSON.stringify(x.v) ?? 'null'); vals.set(p, x.v); }
      else snap.set(p, x);                                           // the 'users' marker
    }
    return { snap, vals, full };
  }

  // Record what Atlas currently holds (call right after loading it at boot,
  // so the first flush doesn't re-upload everything).
  function prime(db) { last = snapshot(db).snap; }

  function schedule() {
    if (running) { again = true; return; }
    if (timer) return;
    timer = setTimeout(() => { timer = null; flush().catch(() => {}); }, delayMs);
  }

  async function flush() {
    if (running) { again = true; return running; }
    // Promise.resolve().then(...) so the body never runs before `running` is assigned
    running = Promise.resolve().then(async () => {
      try {
        const db = getDb();
        const col = getCollection();
        if (!db || !col) return;
        const { snap, vals, full } = snapshot(db);
        let update = null, whole = false;

        if (full || last === null) {
          whole = true;
        } else {
          const $set = {}, $unset = {};
          let n = 0;
          for (const [p, s] of snap) {
            if (p === '#users') continue;                            // marker only
            if (last.get(p) !== s) { $set['data.' + p] = vals.get(p); n++; }
          }
          for (const p of last.keys()) {
            if (p === '#users') continue;
            if (!snap.has(p)) { $unset['data.' + p] = ''; n++; }
          }
          // switching between per-user and whole-users tracking, or a parent/child path clash → just write it all
          const hadUsers = last.has('#users'), hasUsers = snap.has('#users');
          if (hadUsers !== hasUsers) whole = true;
          const paths = [...Object.keys($set), ...Object.keys($unset)];
          if (paths.some(a => paths.some(b => a !== b && b.startsWith(a + '.')))) whole = true;
          if (!whole) {
            if (n === 0) { stats.skipped++; return; }
            update = {};
            if (Object.keys($set).length) update.$set = $set;
            if (Object.keys($unset).length) update.$unset = $unset;
          }
        }

        if (whole) { update = { $set: { data: db } }; stats.fullWrites++; }
        await col.updateOne({ _id: 'db' }, update, { upsert: true });
        stats.writes++;
        stats.bytes += Buffer.byteLength(JSON.stringify(update.$set || {}));
        last = snap;                                                 // only after success → failures retry
      } catch (err) {
        log.error('Failed to persist to MongoDB:', err.message);
        again = true;
      } finally {
        running = null;
        if (again) { again = false; schedule(); }
      }
    });
    return running;
  }

  // For the shutdown hook: cancel the wait and write whatever is pending now.
  async function flushNow() {
    if (timer) { clearTimeout(timer); timer = null; }
    if (running) { try { await running; } catch {} }
    again = false;
    await flush();
  }

  return { prime, schedule, flushNow, stats };
}

module.exports = { createMongoWriter };
