// ── COOKIE HELPERS ─────────────────────────────
// Many of the games hosted here save progress via plain browser cookies.
// Cookies never leave one browser on their own, so without this, the
// same account would have a different save on every device. This module
// backs cookies up to the server (keyed to the signed-in account) so
// they can follow you to a new device — with a localStorage copy kept
// as a same-device fallback for when the server call fails or the user
// isn't signed in.
function readLiveCookies() {
  const cookies = document.cookie.split('; ').filter(Boolean);
  const cookieObj = {};
  cookies.forEach(c => {
    const [name, ...rest] = c.split('=');
    cookieObj[name] = rest.join('=');
  });
  return cookieObj;
}

function applyCookies(cookieObj) {
  for (const name in cookieObj) {
    document.cookie = `${name}=${cookieObj[name]}; path=/; max-age=31536000`;
  }
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
  return JSON.stringify(a || {}) === JSON.stringify(b || {});
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
function initCookieSync() {
  const user = window.SEAL_USER;
  if (!user || user === 'guest') {
    // Not signed in — no account to sync against, keep the old
    // same-device-only behavior so switching browsers' guest sessions
    // at least doesn't mix cookies together.
    restoreCookiesLocal('guest');
    setInterval(() => backupCookiesLocal('guest'), 3000);
    window.addEventListener('beforeunload', () => backupCookiesLocal('guest'));
    return;
  }

  initServerCookieSync(user).then(() => {
    setInterval(pushCookiesToServer, 3000);
    window.addEventListener('beforeunload', () => backupCookiesLocal(user));
  });
}
