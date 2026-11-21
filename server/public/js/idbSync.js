/* ─────────────────────────────────────────────────────────────────────
   IndexedDB sync — play page only.

   Games that keep their save in IndexedDB (Emscripten/Unity file systems,
   localForage, hand-rolled saves…) share this site's origin with the play
   page, so the play page can read and write their databases. Like cookies
   and localStorage, the account's copy is downloaded BEFORE the game loads
   and made the local copy; while the game runs, databases it changes are
   uploaded.

   How it fits together
   • Pull  — GET /api/idb-sync (conditional, so an unchanged save costs one
             tiny 304). Each database on the server replaces the local one
             of the same name. Local-only databases are kept and uploaded.
   • Track — IndexedDB has no change feed, so on the game's iframe we wrap
             the write methods (put/add/delete/clear, cursor update/delete,
             deleteDatabase) and note which databases a finished transaction
             touched. Writes from workers or nested frames aren't seen.
   • Push  — a few seconds after the last write, the touched databases are
             re-read, merged into the account's snapshot and uploaded with
             If-Match. If another device uploaded first (412), the newer
             snapshot is fetched and our databases are merged on top of it.
   • Safety— anything that can't be restored is never uploaded this session,
             and unsent changes survive a closed tab (kept in localStorage).

   The snapshot is JSON ({ v:1, dbs:{ name:{ v:version, stores:[…] } } }),
   gzipped in the browser; the server stores it as an opaque blob.
   ───────────────────────────────────────────────────────────────────── */
(function () {
  'use strict';

  const SUPPORTED = !!(window.indexedDB && typeof indexedDB.databases === 'function' &&
                       window.CompressionStream && window.DecompressionStream && window.fetch);
  const MAX_BYTES = 20 * 1024 * 1024;      // compressed size; the server enforces the same cap
  const ENCODE_BUDGET = 120 * 1024 * 1024; // refuse to build a snapshot bigger than this in memory
  const DEBOUNCE_MS = 4000;                // quiet time after the last write before uploading
  const MAX_WAIT_MS = 20000;               // …but never wait longer than this during constant writes
  const PULL_DEADLINE_MS = 20000;          // don't hold up the game load forever

  // Databases that are caches, ad/analytics storage, or the site's own — not saves.
  const SKIP_DB = [/^firebase/i, /^workbox/i, /^google/i, /^gtm/i, /^_?pbjs/i, /^poki/i,
                   /cache/i, /^seal_/i, /^screenlink/i, /^__/];
  const syncable = name => typeof name === 'string' && !SKIP_DB.some(re => re.test(name));

  // ── state ──────────────────────────────────────────────────────
  let user = null;
  let ready = false;            // true only after a successful pull — never upload before that
  let etag = null;              // ETag of the server snapshot `current` was built from
  let current = null;           // name -> encoded database; null until the full snapshot is known
  const dirty = new Set();      // databases changed since the last successful upload
  const removed = new Set();    // databases the game deleted since the last successful upload
  const noPush = new Set();     // databases we couldn't restore — never overwrite the server's copy
  const tooBig = new Set();
  let timer = null, firstDirtyAt = 0, pushing = false, retryMs = 5000, aborted = false;

  const lsKey = k => 'seal_idb_' + k + '_' + String(user).toLowerCase();
  const log = (...a) => { try { console.log('[idb-sync]', ...a); } catch (e) {} };

  function savePending() {
    try {
      if (!dirty.size && !removed.size) localStorage.removeItem(lsKey('pending'));
      else localStorage.setItem(lsKey('pending'), JSON.stringify({ dirty: [...dirty], removed: [...removed] }));
    } catch (e) {}
  }
  function loadPending() {
    try {
      const p = JSON.parse(localStorage.getItem(lsKey('pending')) || 'null');
      return { dirty: (p && p.dirty) || [], removed: (p && p.removed) || [] };
    } catch (e) { return { dirty: [], removed: [] }; }
  }

  // ── gzip helpers ───────────────────────────────────────────────
  async function pipe(bytes, stream) {
    const out = new Response(new Blob([bytes]).stream().pipeThrough(stream));
    return new Uint8Array(await out.arrayBuffer());
  }
  const gzip = text => pipe(new TextEncoder().encode(text), new CompressionStream('gzip'));
  const gunzip = async buf => new TextDecoder().decode(await pipe(buf, new DecompressionStream('gzip')));

  // ── value <-> JSON ─────────────────────────────────────────────
  // IndexedDB stores structured-clone values (Blobs, typed arrays, Dates,
  // Maps…) that JSON can't hold. Anything special becomes { $t: tag, … };
  // a plain object that happens to own a "$t" key is wrapped so it can
  // never be mistaken for one.
  const TYPED = ['Int8Array', 'Uint8Array', 'Uint8ClampedArray', 'Int16Array', 'Uint16Array',
                 'Int32Array', 'Uint32Array', 'Float32Array', 'Float64Array',
                 'BigInt64Array', 'BigUint64Array', 'DataView'];
  let budget = 0;

  function toB64(u8) {
    budget += u8.length;
    if (budget > ENCODE_BUDGET) throw new Error('too-big');
    let s = '';
    for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
    return btoa(s);
  }
  function fromB64(b64) {
    const bin = atob(b64);
    const u8 = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
    return u8;
  }
  const tagOf = v => Object.prototype.toString.call(v).slice(8, -1);

  async function enc(v, path) {
    if (v === null || typeof v === 'boolean' || typeof v === 'string') return v;
    switch (typeof v) {
      case 'number':
        if (Number.isFinite(v) && !Object.is(v, -0)) return v;
        return { $t: 'n', v: Object.is(v, -0) ? '-0' : String(v) };
      case 'undefined': return { $t: 'u' };
      case 'bigint': return { $t: 'bi', v: v.toString() };
      case 'function': case 'symbol': throw new Error('unsupported value');
    }
    const tag = tagOf(v);
    if (tag === 'Date') return { $t: 'd', v: isNaN(v.getTime()) ? null : v.getTime() };
    if (tag === 'ArrayBuffer') return { $t: 'ab', d: toB64(new Uint8Array(v)) };
    if (ArrayBuffer.isView(v)) {
      return { $t: 'ta', c: tag, d: toB64(new Uint8Array(v.buffer, v.byteOffset, v.byteLength)) };
    }
    if (tag === 'Blob') return { $t: 'bl', type: v.type, d: toB64(new Uint8Array(await v.arrayBuffer())) };
    if (tag === 'File') {
      return { $t: 'f', name: v.name, type: v.type, lm: v.lastModified, d: toB64(new Uint8Array(await v.arrayBuffer())) };
    }
    if (tag === 'RegExp') return { $t: 're', s: v.source, f: v.flags };

    path = path || new Set();
    if (path.has(v)) throw new Error('circular value');
    path.add(v);
    try {
      if (Array.isArray(v)) {
        const out = [];
        for (let i = 0; i < v.length; i++) out.push(await enc(v[i], path));
        return out;
      }
      if (tag === 'Map') {
        const out = [];
        for (const [k, val] of v) out.push([await enc(k, path), await enc(val, path)]);
        return { $t: 'm', v: out };
      }
      if (tag === 'Set') {
        const out = [];
        for (const val of v) out.push(await enc(val, path));
        return { $t: 's', v: out };
      }
      if (tag !== 'Object') throw new Error('unsupported value (' + tag + ')');
      const out = {};
      for (const k of Object.keys(v)) setKey(out, k, await enc(v[k], path));
      return Object.prototype.hasOwnProperty.call(out, '$t') ? { $t: 'o', v: out } : out;
    } finally { path.delete(v); }
  }

  function setKey(obj, k, val) {
    if (k === '__proto__') Object.defineProperty(obj, k, { value: val, enumerable: true, writable: true, configurable: true });
    else obj[k] = val;
  }
  function bytesOf(x) { return fromB64(x.d); }
  function dec(x) {
    if (x === null || typeof x !== 'object') return x;
    if (Array.isArray(x)) return x.map(dec);
    switch (x.$t) {
      case undefined: break;
      case 'n': return x.v === '-0' ? -0 : Number(x.v);
      case 'u': return undefined;
      case 'bi': return BigInt(x.v);
      case 'd': return new Date(x.v === null ? NaN : x.v);
      case 'ab': return bytesOf(x).buffer;
      case 'ta': {
        if (!TYPED.includes(x.c)) throw new Error('bad typed array');
        const buf = bytesOf(x).buffer;
        return x.c === 'DataView' ? new DataView(buf) : new window[x.c](buf);
      }
      case 'bl': return new Blob([bytesOf(x)], { type: x.type });
      case 'f': return new File([bytesOf(x)], x.name, { type: x.type, lastModified: x.lm });
      case 're': return new RegExp(x.s, x.f);
      case 'm': return new Map(x.v.map(([k, v]) => [dec(k), dec(v)]));
      case 's': return new Set(x.v.map(dec));
      case 'o': { const out = {}; for (const k of Object.keys(x.v)) setKey(out, k, dec(x.v[k])); return out; }
      default: throw new Error('unknown tag ' + x.$t);
    }
    const out = {};
    for (const k of Object.keys(x)) setKey(out, k, dec(x[k]));
    return out;
  }

  // ── reading / writing one database ─────────────────────────────
  function openDb(name) {
    return new Promise((resolve, reject) => {
      const r = indexedDB.open(name); // no version: open whatever exists
      // If it vanished in the meantime, opening would CREATE an empty one — don't.
      r.onupgradeneeded = () => { try { r.transaction.abort(); } catch (e) {} };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('open failed'));
    });
  }

  async function readDb(name) {
    const db = await openDb(name);
    try {
      const names = Array.from(db.objectStoreNames);
      const meta = [], rows = {};
      if (names.length) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(names, 'readonly');
          tx.oncomplete = resolve;
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('read aborted'));
          names.forEach(sn => {
            const store = tx.objectStore(sn);
            meta.push({
              name: sn, keyPath: store.keyPath, autoIncrement: store.autoIncrement,
              indexes: Array.from(store.indexNames).map(i => {
                const ix = store.index(i);
                return { name: ix.name, keyPath: ix.keyPath, unique: ix.unique, multiEntry: ix.multiEntry };
              })
            });
            const list = rows[sn] = [];
            // no awaits in here: a transaction closes as soon as it has nothing pending
            store.openCursor().onsuccess = e => {
              const c = e.target.result;
              if (c) { list.push([c.key, c.value]); c.continue(); }
            };
          });
        });
      }
      return { version: db.version, meta, rows };
    } finally { db.close(); }
  }

  async function encodeDb(name) {
    const { version, meta, rows } = await readDb(name);
    const stores = [];
    for (const m of meta) {
      const out = [];
      for (const [k, v] of rows[m.name]) out.push([await enc(k), await enc(v)]);
      stores.push({ ...m, rows: out });
    }
    return { v: version, stores };
  }

  function deleteDb(name) {
    return new Promise((resolve, reject) => {
      const r = indexedDB.deleteDatabase(name);
      // blocked = another tab of the site still has it open
      const t = setTimeout(() => reject(new Error('blocked')), 4000);
      r.onsuccess = () => { clearTimeout(t); resolve(); };
      r.onerror = () => { clearTimeout(t); reject(r.error || new Error('delete failed')); };
    });
  }

  async function restoreDb(name, spec) {
    // decode first, so a bad record can't leave us with a deleted database
    const stores = spec.stores.map(s => ({ ...s, rows: s.rows.map(([k, v]) => [dec(k), dec(v)]) }));
    await deleteDb(name);
    const db = await new Promise((resolve, reject) => {
      const r = indexedDB.open(name, spec.v);
      r.onupgradeneeded = () => {
        stores.forEach(s => {
          const opts = {};
          if (s.keyPath !== null && s.keyPath !== undefined) opts.keyPath = s.keyPath;
          if (s.autoIncrement) opts.autoIncrement = true;
          const os = r.result.createObjectStore(s.name, opts);
          s.indexes.forEach(ix => os.createIndex(ix.name, ix.keyPath, { unique: ix.unique, multiEntry: ix.multiEntry }));
        });
      };
      r.onsuccess = () => resolve(r.result);
      r.onerror = () => reject(r.error || new Error('create failed'));
    });
    try {
      const withRows = stores.filter(s => s.rows.length);
      if (withRows.length) {
        await new Promise((resolve, reject) => {
          const tx = db.transaction(withRows.map(s => s.name), 'readwrite');
          tx.oncomplete = resolve;
          tx.onerror = tx.onabort = () => reject(tx.error || new Error('write aborted'));
          withRows.forEach(s => {
            const os = tx.objectStore(s.name);
            const inline = os.keyPath !== null;
            s.rows.forEach(([k, v]) => { if (inline) os.put(v); else os.put(v, k); });
          });
        });
      }
    } finally { db.close(); }
  }

  const localNames = async () => (await indexedDB.databases()).map(d => d.name).filter(syncable);

  // ── server I/O ─────────────────────────────────────────────────
  async function fetchSnapshot(ifNoneMatch) {
    const headers = ifNoneMatch ? { 'If-None-Match': ifNoneMatch } : {};
    const res = await fetch('/api/idb-sync', { headers, credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 204) return { none: true };
    if (res.status === 304) return { notModified: true };
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = JSON.parse(await gunzip(await res.arrayBuffer()));
    return { etag: res.headers.get('ETag'), dbs: (data && data.dbs) || {} };
  }

  async function putSnapshot(map, ifMatch) {
    const gz = await gzip(JSON.stringify({ v: 1, dbs: map }));
    if (gz.byteLength > MAX_BYTES) { const e = new Error('too-big'); e.tooBig = true; throw e; }
    const headers = { 'Content-Type': 'application/octet-stream' };
    if (ifMatch) headers['If-Match'] = ifMatch; else headers['If-None-Match'] = '*';
    const res = await fetch('/api/idb-sync', { method: 'PUT', headers, body: gz, credentials: 'same-origin', cache: 'no-store' });
    if (res.status === 412) return { conflict: true };
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return { etag: (await res.json()).etag };
  }

  // ── pull (before the game loads) ───────────────────────────────
  async function pullInner() {
    const pending = loadPending();
    const hasPending = pending.dirty.length || pending.removed.length;
    const stored = localStorage.getItem(lsKey('etag'));
    const snap = await fetchSnapshot(stored && !hasPending ? stored : null);

    if (snap.notModified) {
      // Same snapshot this device already holds — nothing to restore.
      // `current` is fetched lazily if we ever need to upload.
      etag = stored;
      current = null;
      ready = true;
      return;
    }

    const server = snap.none ? {} : snap.dbs;
    current = server;
    etag = snap.none ? null : snap.etag;
    pending.dirty.forEach(n => { if (syncable(n)) dirty.add(n); });
    pending.removed.forEach(n => { if (syncable(n)) removed.add(n); });

    let allRestored = true;
    for (const name of Object.keys(server)) {
      if (aborted) { allRestored = false; break; }
      if (!syncable(name) || dirty.has(name) || removed.has(name)) continue; // unsent local changes win
      try { await restoreDb(name, server[name]); }
      catch (err) { allRestored = false; noPush.add(name); log('could not restore', name, err.message); }
    }

    // Databases that only exist on this device get uploaded too.
    (await localNames()).forEach(n => { if (!(n in server) && !removed.has(n)) dirty.add(n); });

    if (!aborted) ready = true;
    if (allRestored && !aborted && etag) { try { localStorage.setItem(lsKey('etag'), etag); } catch (e) {} }
    else { try { localStorage.removeItem(lsKey('etag')); } catch (e) {} }
    savePending();
    if (ready && (dirty.size || removed.size)) schedule(0);
  }

  async function pull(username) {
    if (!SUPPORTED || !username || username === 'guest') return;
    user = username;
    aborted = false;
    try {
      await Promise.race([
        pullInner(),
        new Promise(resolve => setTimeout(() => { aborted = true; resolve(); }, PULL_DEADLINE_MS))
      ]);
      if (aborted) log('pull took too long — continuing without it');
    } catch (err) {
      ready = false;
      log('pull failed, sync is off for this session:', err.message);
    }
  }

  // ── tracking the game's writes ─────────────────────────────────
  function markDirty(name) {
    if (!ready || !syncable(name) || noPush.has(name)) return;
    removed.delete(name);
    dirty.add(name);
    savePending();
    schedule(DEBOUNCE_MS);
  }
  function markRemoved(name) {
    if (!ready || !syncable(name)) return;
    dirty.delete(name);
    removed.add(name);
    savePending();
    schedule(DEBOUNCE_MS);
  }
  function schedule(delay) {
    if (!firstDirtyAt) firstDirtyAt = Date.now();
    clearTimeout(timer);
    const wait = Math.max(0, Math.min(delay, firstDirtyAt + MAX_WAIT_MS - Date.now()));
    timer = setTimeout(flush, wait);
  }

  function patchWindow(w) {
    try {
      if (!w || !w.IDBObjectStore || w.__sealIdbPatched) return;
      w.__sealIdbPatched = true;
      const txSeen = new WeakSet();
      const watchTx = (tx, name) => {
        if (!tx || !name || txSeen.has(tx)) return;
        txSeen.add(tx);
        // mark when the write has actually committed, so the re-read sees it
        tx.addEventListener('complete', () => markDirty(name));
      };
      const storeDb = store => { try { return store.transaction.db.name; } catch (e) { return null; } };
      const OS = w.IDBObjectStore.prototype;
      ['put', 'add', 'delete', 'clear'].forEach(m => {
        const orig = OS[m];
        OS[m] = function () {
          const r = orig.apply(this, arguments);
          try { watchTx(this.transaction, storeDb(this)); } catch (e) {}
          return r;
        };
      });
      const CU = w.IDBCursor && w.IDBCursor.prototype;
      if (CU) ['update', 'delete'].forEach(m => {
        const orig = CU[m];
        CU[m] = function () {
          const r = orig.apply(this, arguments);
          try {
            const src = this.source;
            const store = src.transaction ? src : src.objectStore; // store or index
            watchTx(store.transaction, storeDb(store));
          } catch (e) {}
          return r;
        };
      });
      const F = w.IDBFactory && w.IDBFactory.prototype;
      if (F) {
        const orig = F.deleteDatabase;
        F.deleteDatabase = function (name) {
          const r = orig.apply(this, arguments);
          try { r.addEventListener('success', () => markRemoved(String(name))); } catch (e) {}
          return r;
        };
      }
    } catch (e) { /* a frame we can't touch — its IndexedDB just won't sync */ }
  }

  // ── push ───────────────────────────────────────────────────────
  async function flush() {
    timer = null;
    if (!ready || pushing || (!dirty.size && !removed.size)) return;
    pushing = true;
    const names = [...dirty], gone = [...removed];
    dirty.clear(); removed.clear(); firstDirtyAt = 0;
    try {
      budget = 0;
      const updates = {};
      for (const n of names) {
        if (tooBig.has(n) || noPush.has(n)) continue;
        try { updates[n] = await encodeDb(n); }
        catch (err) {
          if (err.message === 'too-big') { tooBig.add(n); log(n, 'is too large to sync'); }
          else log('skipping', n, '-', err.message); // e.g. deleted meanwhile or an unsupported value
        }
      }

      if (!Object.keys(updates).length && !gone.length) { savePending(); return; } // nothing usable to send

      if (current === null) {                   // first upload after a 304: learn the server's side now
        const snap = await fetchSnapshot(null);
        current = snap.none ? {} : snap.dbs;
        etag = snap.none ? null : snap.etag;
      }

      for (let attempt = 0; attempt < 3; attempt++) {
        const next = { ...current, ...updates };
        gone.forEach(n => { delete next[n]; });
        const res = await putSnapshot(next, etag);
        if (res.conflict) {                      // another device uploaded first — merge on top of theirs
          const snap = await fetchSnapshot(null);
          current = snap.none ? {} : snap.dbs;
          etag = snap.none ? null : snap.etag;
          continue;
        }
        current = next;
        etag = res.etag;
        try { localStorage.setItem(lsKey('etag'), etag); } catch (e) {}
        retryMs = 5000;
        log('synced', Object.keys(updates).join(', ') || '(removals)');
        break;
      }
      savePending();
    } catch (err) {
      if (err.tooBig) log('save data is over the sync limit; not uploading');
      else {
        names.forEach(n => dirty.add(n)); gone.forEach(n => removed.add(n));   // try again later
        savePending();
        retryMs = Math.min(retryMs * 2, 120000);
        schedule(retryMs);
        log('upload failed, will retry:', err.message);
      }
    } finally {
      pushing = false;
      if (dirty.size || removed.size) { if (!timer) schedule(DEBOUNCE_MS); }
    }
  }

  function start() {
    if (!SUPPORTED) return;
    const attach = f => {
      const go = () => patchWindow(f.contentWindow);
      f.addEventListener('load', go);
      try { if (f.contentDocument && f.contentDocument.readyState === 'complete') go(); } catch (e) {}
    };
    document.querySelectorAll('iframe').forEach(attach);
    // upload as soon as the page is hidden/closing rather than waiting out the debounce
    const flushNow = () => { if (dirty.size || removed.size) { clearTimeout(timer); flush(); } };
    document.addEventListener('visibilitychange', () => { if (document.hidden) flushNow(); });
    window.addEventListener('pagehide', flushNow);
  }

  window.IDBSync = { supported: SUPPORTED, pull, start, _t: { enc, dec, encodeDb, restoreDb, readDb } };
})();
