// ── COOKIE HELPERS ─────────────────────────────
// Keeps a per-account backup of this site's cookies in localStorage,
// so switching accounts on the same browser doesn't mix up cookie-based
// game saves. Keyed off the signed-in username from the server session
// (window.SEAL_USER, set by main.js), falling back to "guest".
function backupCookies() {
  const cookies = document.cookie.split('; ').filter(Boolean);
  const cookieObj = {};

  cookies.forEach(c => {
    const [name, ...rest] = c.split('=');
    cookieObj[name] = rest.join('=');
  });

  const user = window.SEAL_USER || 'guest';
  localStorage.setItem('seal_cookie_backup_' + user, JSON.stringify(cookieObj));
}

function restoreCookies() {
  const user = window.SEAL_USER || 'guest';
  const backup = localStorage.getItem('seal_cookie_backup_' + user);
  if (!backup) return;

  let cookieObj;
  try { cookieObj = JSON.parse(backup); } catch { return; }

  for (const name in cookieObj) {
    document.cookie = `${name}=${cookieObj[name]}; path=/; max-age=31536000`;
  }
}

// ── SMART AUTO BACKUP ──────────────────────────
let lastBackup = '';
function backupCookiesSmart() {
  if (document.cookie !== lastBackup) {
    backupCookies();
    lastBackup = document.cookie;
  }
}

// ── INIT ──────────────────────────────────────
function initCookieSync() {
  restoreCookies();
  setInterval(backupCookiesSmart, 3000);
  window.addEventListener('beforeunload', backupCookies);
}
