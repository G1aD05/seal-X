// ── COOKIE HELPERS ─────────────────────────────
// Many of the games hosted here save progress via plain browser cookies.
// Cookies never leave one browser on their own, so without this, the
// same account would have a different save on every device. This module
// backs cookies up to the server (keyed to the signed-in account) so
// they can follow you to a new device — with a localStorage copy kept
// as a same-device fallback for when the server call fails or the user
// isn't signed in.

// Ad / analytics scripts (Google Analytics, Poki's ad SDK, header-bidding
// libraries, ...) drop dozens of cookies and localStorage keys that are
// rewritten on every load and aren't game saves. Syncing them just fills the
// size budget with noise, so they're skipped. Seal's own per-device settings
// (seal_*, screenlink_*) are skipped too — they shouldn't follow you around.
const SYNC_SKIP_PATTERNS = [
  /^_ga/, /^_gid$/, /^_gat/, /^__gads$/, /^__gpi$/, /^_gcl/, /^_fbp$/, /^_fbc$/,
  /^_lr_/, /^_lr[A-Z]/, /^pbjs/, /^poki_/, /^cto_/, /^_cc_id$/, /^panoramaId/,
  /^cbLDBex$/, /^__qca$/, /^_pubcid/, /^_sharedid/, /^idl_env/, /^__tcfapi/,
  /^IDE$/, /^test_cookie$/, /^ajs_/, /^amplitude/, /^_hjSession/, /^_clck$/, /^_clsk$/
];
const SYNC_SKIP_STORAGE_PREFIXES = ['seal_', 'screenlink_'];

function shouldSyncCookie(name) {
  return !SYNC_SKIP_PATTERNS.some(re => re.test(name));
}
function shouldSyncStorageKey(key) {
  if (SYNC_SKIP_STORAGE_PREFIXES.some(p => key.startsWith(p))) return false;
  return !SYNC_SKIP_PATTERNS.some(re => re.test(key));
}
function filterCookies(obj) {
  const out = {};
  for (const name in (obj || {})) if (shouldSyncCookie(name)) out[name] = obj[name];
  return out;
}

function readLiveCookies() {
  const cookies = document.cookie.split('; ').filter(Boolean);
  const cookieObj = {};
  cookies.forEach(c => {
    const [name, ...rest] = c.split('=');
    if (shouldSyncCookie(name)) cookieObj[name] = rest.join('=');
  });
  return cookieObj;
}

function applyCookies(cookieObj) {
  for (const name in cookieObj) {
    if (!shouldSyncCookie(name)) continue;
    document.cookie = `${name}=${cookieObj[name]}; path=/; max-age=31536000`;
  }
}

// Makes this browser's cookies match `cookieObj` exactly: anything not in it
// is expired, everything in it is written. (HttpOnly cookies such as the
// login session are invisible to JS, so they're never touched here.)
function replaceCookies(cookieObj) {
  const incoming = cookieObj || {};
  const live = readLiveCookies();
  for (const name in live) {
    if (!(name in incoming)) {
      document.cookie = `${name}=; path=/; max-age=0; expires=Thu, 01 Jan 1970 00:00:00 GMT`;
    }
  }
  applyCookies(incoming);
}

function localBackupKey(user) {
  return 'seal_cookie_backup_' + user;
}

function backupCookiesLocal(user) {
  localStorage.setItem(localBackupKey(user), JSON.stringify(readLiveCookies()));
}

function restoreCookiesLocal(user) {
  const backup = localStorage.getItem(localBackupKey(user));
  if (!backup) return;
  try { applyCookies(JSON.parse(backup)); } catch {}
}

function cookiesEqual(a, b) {
  return JSON.stringify(filterCookies(a)) === JSON.stringify(filterCookies(b));
}

// ── SERVER SYNC (signed-in users only) ─────────────────────────────
let cookieSyncUser = null;
let lastPushedSnapshot = '';

async function pushCookiesToServer() {
  const live = readLiveCookies();
  const snapshot = JSON.stringify(live);
  if (snapshot === lastPushedSnapshot) return;
  lastPushedSnapshot = snapshot;
  backupCookiesLocal(cookieSyncUser);
  try { await API.setCookieSync(live); } catch {}
}

// Last-chance push as the page closes, so progress made in the final few
// seconds before leaving still reaches the server (keepalive lets the
// request outlive the page).
function pushCookiesOnExit() {
  if (!cookieSyncUser) return;
  const live = readLiveCookies();
  const snapshot = JSON.stringify(live);
  backupCookiesLocal(cookieSyncUser);
  if (snapshot === lastPushedSnapshot) return;
  lastPushedSnapshot = snapshot;
  API._req('/api/cookie-sync', { method: 'PUT', keepalive: true, body: JSON.stringify({ data: live }) }).catch(() => {});
}

// ── localStorage SYNC (play page only) ─────────────────────────────
// Many games keep their save in localStorage, not cookies. Same-origin games
// run in an iframe that shares this page's localStorage, so the play page can
// pull the account's copy down before the game loads and push changes back
// while it's played. Games hosted on other domains keep their own storage on
// that domain and can't be reached from here.
const STORAGE_SYNC_MAX_BYTES = 3 * 1024 * 1024;
let storageSyncReady = false;   // true only after a successful pull — never push stale data over the server's
let lastPushedStorage = '';
let warnedStorageTooBig = false;

function readLiveStorage() {
  const out = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key !== null && shouldSyncStorageKey(key)) out[key] = localStorage.getItem(key);
    }
  } catch {}
  return out;
}

// Makes this browser's (syncable) localStorage match `obj` exactly.
function replaceStorage(obj) {
  const incoming = {};
  for (const k in (obj || {})) {
    if (shouldSyncStorageKey(k) && typeof obj[k] === 'string') incoming[k] = obj[k];
  }
  try {
    const live = readLiveStorage();
    for (const k in live) if (!(k in incoming)) localStorage.removeItem(k);
    for (const k in incoming) {
      if (localStorage.getItem(k) !== incoming[k]) {
        try { localStorage.setItem(k, incoming[k]); } catch (e) { console.warn('[sync] could not write', k, e); }
      }
    }
  } catch {}
}

async function pushStorageToServer(opts = {}) {
  if (!storageSyncReady || !cookieSyncUser) return;
  const live = readLiveStorage();
  const snapshot = JSON.stringify(live);
  if (snapshot === lastPushedStorage) return;
  if (snapshot.length > STORAGE_SYNC_MAX_BYTES) {
    if (!warnedStorageTooBig) { console.warn('[sync] save data is over the sync limit; not syncing it'); warnedStorageTooBig = true; }
    return;
  }
  lastPushedStorage = snapshot;
  try { await API.setStorageSync(live, opts); } catch { lastPushedStorage = ''; } // retry on the next tick
}

// Download the account's saved localStorage and make this device's match it.
// If the account has nothing saved yet, this device's data becomes the start.
async function pullServerStorage(user) {
  cookieSyncUser = user;
  let res;
  try { res = await API.getStorageSync(); } catch { return; } // offline: leave local storage alone, don't push
  if (res && res.data && typeof res.data === 'object') {
    replaceStorage(res.data);
    lastPushedStorage = JSON.stringify(readLiveStorage());
    storageSyncReady = true;
  } else {
    lastPushedStorage = '';
    storageSyncReady = true;
    await pushStorageToServer();
  }
}

function pushStorageOnExit() {
  if (!storageSyncReady) return;
  const snapshot = JSON.stringify(readLiveStorage());
  if (snapshot === lastPushedStorage) return;
  // keepalive requests are capped at ~64KB; larger saves rely on the
  // regular 3-second pushes and the visibility-change push below.
  if (snapshot.length > 60000) return;
  pushStorageToServer({ keepalive: true });
}

function formatSyncTime(iso) {
  if (!iso) return 'never';
  return new Date(iso).toLocaleString();
}

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  return `${(n / 1024).toFixed(1)} KB`;
}

// Shown only when this device's live cookies genuinely differ from what
// the server has on file for this account — i.e. an actual conflict,
// not just "first time syncing this device."
function showSyncConflictPopup(localCookies, serverSync) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'cookie-sync-overlay';
    const localSize = JSON.stringify(localCookies).length;
    overlay.innerHTML = `
      <div class="modal">
        <h2>Which save data do you want to keep?</h2>
        <p class="modal-subtitle">
          This device's game saves don't match what's synced to your account —
          probably because you played on another device since last time. Pick
          one; the other will be overwritten.
        </p>
        <div class="sync-choice-row">
          <button class="sync-choice-btn" id="sync-keep-local">
            <strong>Use This Device</strong>
            <span>${formatBytes(localSize)} of save data</span>
          </button>
          <button class="sync-choice-btn" id="sync-keep-remote">
            <strong>Use Synced Data</strong>
            <span>${formatBytes(serverSync.byteSize || 0)} · last saved ${formatSyncTime(serverSync.updatedAt)}</span>
          </button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#sync-keep-local').addEventListener('click', async () => {
      overlay.remove();
      lastPushedSnapshot = ''; // force the next push through, since local is now authoritative
      await pushCookiesToServer();
      resolve();
    });
    overlay.querySelector('#sync-keep-remote').addEventListener('click', async () => {
      applyCookies(serverSync.data);
      overlay.remove();
      lastPushedSnapshot = JSON.stringify(serverSync.data);
      backupCookiesLocal(cookieSyncUser);
      resolve();
    });
  });
}

// Used on the play page: every time a game is opened, pull the account's
// cookies down from the server and make this device's cookies match them,
// with no prompt. If the server has nothing yet, this device's cookies
// become the account's starting point.
async function pullServerCookies(user) {
  cookieSyncUser = user;
  let serverSync = null;
  try { serverSync = await API.getCookieSync(); } catch {
    restoreCookiesLocal(user); // server unreachable — keep same-device behavior
    return;
  }
  if (serverSync && serverSync.data && typeof serverSync.data === 'object') {
    replaceCookies(serverSync.data);
    lastPushedSnapshot = JSON.stringify(readLiveCookies());
    backupCookiesLocal(user);
  } else {
    lastPushedSnapshot = '';
    await pushCookiesToServer();
  }
}

async function initServerCookieSync(user) {
  cookieSyncUser = user;
  const liveCookies = readLiveCookies();
  const hasLocalData = Object.keys(liveCookies).length > 0;

  let serverSync = null;
  try { serverSync = await API.getCookieSync(); } catch {
    // Offline or the request failed — fall back to same-device-only
    // behavior rather than blocking on a server round-trip.
    restoreCookiesLocal(user);
    return;
  }

  if (!serverSync) {
    // Nothing synced yet for this account — this device's data becomes
    // the starting point, no conflict to resolve.
    lastPushedSnapshot = JSON.stringify(liveCookies);
    await pushCookiesToServer();
  } else if (!hasLocalData) {
    // This device has no cookies of its own yet, so there's nothing of
    // this device's to lose — just adopt the synced data silently.
    applyCookies(serverSync.data);
    lastPushedSnapshot = JSON.stringify(serverSync.data);
    backupCookiesLocal(user);
  } else if (!cookiesEqual(liveCookies, serverSync.data)) {
    await showSyncConflictPopup(liveCookies, serverSync);
  } else {
    lastPushedSnapshot = JSON.stringify(liveCookies);
  }
}

// ── INIT ──────────────────────────────────────
// Pass { replace: true } (the play page does) to always download the
// account's cookies from the server and overwrite this device's, instead
// of asking when they differ. Returns a promise that resolves once the
// initial sync is done, so callers can wait before loading a game.
function initCookieSync(opts = {}) {
  const user = window.SEAL_USER;
  if (!user || user === 'guest') {
    // Not signed in — no account to sync against, keep the old
    // same-device-only behavior so switching browsers' guest sessions
    // at least doesn't mix cookies together.
    restoreCookiesLocal('guest');
    setInterval(() => backupCookiesLocal('guest'), 3000);
    window.addEventListener('beforeunload', () => backupCookiesLocal('guest'));
    return Promise.resolve();
  }

  const initial = opts.replace
    ? Promise.all([
        pullServerCookies(user),
        pullServerStorage(user),
        window.IDBSync ? window.IDBSync.pull(user) : null   // IndexedDB saves (see idbSync.js)
      ])
    : initServerCookieSync(user);
  return initial.then(() => {
    setInterval(pushCookiesToServer, 3000);
    window.addEventListener('beforeunload', pushCookiesOnExit);
    window.addEventListener('pagehide', pushCookiesOnExit);
    if (opts.replace) {
      // localStorage is only synced from the play page (replace mode), so a
      // stale copy on some other page can never overwrite the account's save.
      if (window.IDBSync) window.IDBSync.start();
      setInterval(pushStorageToServer, 3000);
      window.addEventListener('beforeunload', pushStorageOnExit);
      window.addEventListener('pagehide', pushStorageOnExit);
      document.addEventListener('visibilitychange', () => { if (document.hidden) pushStorageToServer(); });
    }
  });
}
