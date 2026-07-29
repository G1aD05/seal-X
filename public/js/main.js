// ── SHARED PAGE LOGIC ──────────────────────────────────────────
const $ = id => document.getElementById(id);
let CURRENT_USER = null; // { username, isAdmin } | null

// ── AUTH MODAL ──────────────────────────────────────────────────
function openAuth() { $('auth-overlay').classList.remove('hidden'); }
function closeAuth() { $('auth-overlay').classList.add('hidden'); clearAuthErrors(); }

function switchTab(tab) {
  document.querySelectorAll('.tab-btn').forEach((b, i) => b.classList.toggle('active', (tab === 'login' ? 0 : 1) === i));
  document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
  $('tab-' + tab).classList.add('active');
}

function clearAuthErrors() {
  ['login-error', 'reg-error'].forEach(id => { $(id).classList.add('hidden'); $(id).textContent = ''; });
}
function showError(id, msg) { $(id).textContent = msg; $(id).classList.remove('hidden'); }

async function login() {
  const user = $('login-user').value.trim();
  const pass = $('login-pass').value;
  if (!user || !pass) return showError('login-error', 'Please fill in all fields.');
  try {
    CURRENT_USER = await API.login(user, pass);
    await refreshUI();
    if (typeof restoreCookies === 'function') restoreCookies();
    closeAuth();
  } catch (e) { showError('login-error', e.message); }
}

async function register() {
  const user = $('reg-user').value.trim();
  const pass = $('reg-pass').value;
  const pass2 = $('reg-pass2').value;
  if (!user || !pass || !pass2) return showError('reg-error', 'Please fill in all fields.');
  if (pass !== pass2) return showError('reg-error', 'Passwords do not match.');
  try {
    CURRENT_USER = await API.register(user, pass);
    await refreshUI();
    closeAuth();
  } catch (e) { showError('reg-error', e.message); }
}

async function logout() {
  await API.logout();
  CURRENT_USER = null;
  refreshUI();
}

async function refreshUI() {
  try { CURRENT_USER = await API.session(); }
  catch { CURRENT_USER = { user: null }; }

  const user = CURRENT_USER && (CURRENT_USER.username || CURRENT_USER.user);
  window.SEAL_USER = user || 'guest';
  if (user) {
    $('user-info').classList.remove('hidden');
    $('auth-btn').classList.add('hidden');
    $('user-label').textContent = user;
    $('user-avatar').textContent = user[0].toUpperCase();
    $('admin-btn').classList.toggle('hidden', !CURRENT_USER.isAdmin);
  } else {
    $('user-info').classList.add('hidden');
    $('auth-btn').classList.remove('hidden');
  }

  document.dispatchEvent(new CustomEvent('seal:user-ready', { detail: CURRENT_USER }));
}

// ── ADMIN PANEL (global banner + update popup) ────────────────────
async function openAdmin() {
  try {
    const banner = await API.getBanner();
    $('admin-banner-text').value = banner.text || '';
    $('admin-banner-type').value = banner.type || 'info';
  } catch {}
  try {
    const popup = await API.getPopup();
    $('admin-popup-title').value = popup.title || '';
    $('admin-popup-text').value = popup.text || '';
  } catch {}
  $('admin-overlay').classList.remove('hidden');
}
function closeAdmin() { $('admin-overlay').classList.add('hidden'); }

async function publishBanner() {
  const text = $('admin-banner-text').value.trim();
  const type = $('admin-banner-type').value;
  if (!text) return;
  await API.setBanner(text, type);
  await loadBanner();
  closeAdmin();
}
async function clearBanner() {
  await API.clearBanner();
  $('global-banner').className = 'global-banner hidden';
  document.body.classList.remove('has-banner');
  closeAdmin();
}

async function publishPopup() {
  const title = $('admin-popup-title').value.trim();
  const text = $('admin-popup-text').value.trim();
  if (!text) return;
  await API.setPopup(title, text);
  closeAdmin();
}
async function clearPopup() {
  await API.clearPopup();
  $('popup-overlay').classList.add('hidden');
  closeAdmin();
}

// ── BANNER (pulled from the server, so every visitor sees the same one) ──
function showGlobalBanner({ text, type }) {
  $('banner-text').textContent = text;
  $('global-banner').className = 'global-banner banner-' + (type || 'info');
  document.body.classList.add('has-banner');
}
function closeBanner() {
  $('global-banner').classList.add('hidden');
  document.body.classList.remove('has-banner');
}
async function loadBanner() {
  try {
    const banner = await API.getBanner();
    if (banner && banner.active && banner.text) showGlobalBanner(banner);
  } catch {}
}

// Live updates: the server pushes the banner down this connection
// the instant an admin changes it, so every open tab updates with
// no refresh and no polling. Falls back to a one-off fetch if the
// browser doesn't support SSE (effectively none in practice).
function subscribeBanner() {
  if (typeof EventSource === 'undefined') return loadBanner();

  const applyBanner = banner => {
    if (banner && banner.active && banner.text) showGlobalBanner(banner);
    else closeBanner();
  };

  const es = new EventSource('/api/banner/stream');
  es.onmessage = e => {
    try { applyBanner(JSON.parse(e.data)); } catch {}
  };
  // EventSource auto-reconnects on drop; nothing else to do here.
}

// ── UPDATE POPUP (dismissible — once closed, that specific update
// never shows again on this browser, until the admin publishes a new one) ──
const POPUP_DISMISSED_KEY = 'seal_dismissed_popup_id';

function showPopupModal(popup) {
  $('popup-title').textContent = popup.title || 'Update';
  $('popup-text').textContent = popup.text;
  $('popup-overlay').classList.remove('hidden');
}
function dismissPopup() {
  const id = $('popup-overlay').dataset.popupId;
  if (id) localStorage.setItem(POPUP_DISMISSED_KEY, id);
  $('popup-overlay').classList.add('hidden');
}
function maybeShowPopup(popup) {
  if (!popup || !popup.active || !popup.id || !popup.text) return;
  if (localStorage.getItem(POPUP_DISMISSED_KEY) === popup.id) return;
  $('popup-overlay').dataset.popupId = popup.id;
  showPopupModal(popup);
}

function subscribePopup() {
  if (typeof EventSource === 'undefined') {
    API.getPopup().then(maybeShowPopup).catch(() => {});
    return;
  }
  const es = new EventSource('/api/popup/stream');
  es.onmessage = e => {
    try { maybeShowPopup(JSON.parse(e.data)); } catch {}
  };
}

// ── CLOAK ───────────────────────────────────────────────────────
const CLOAK_HTML = `
  <style>
    html,body{margin:0;padding:0;height:100%;overflow:auto;scrollbar-width:none;-ms-overflow-style:none;}
    html::-webkit-scrollbar,body::-webkit-scrollbar{display:none;}
    iframe{width:100vw;height:100vh;border:none;}
    #homeBtn{position:absolute;top:20px;right:20px;padding:10px 20px;font-size:16px;border:none;border-radius:5px;background-color:#444;color:white;cursor:pointer;z-index:10;}
  </style>
  <button id="homeBtn">Home</button>
  <iframe id="gameFrame" src="index.html"></iframe>
  <script>document.getElementById('homeBtn').onclick=function(){document.getElementById('gameFrame').src='index.html';};<\/script>
`;
function setupCloak() {
  const btn = $('cloak');
  if (!btn) return;
  btn.addEventListener('click', () => {
    const win = window.open('about:blank', '_blank');
    win.document.write(CLOAK_HTML);
    const iframe = win.document.getElementById('gameFrame');
    iframe.onload = () => {
      const doc = iframe.contentDocument || iframe.contentWindow.document;
      const inner = doc.querySelector('#cloak');
      if (inner) inner.remove();
    };
  });
}

// ── MODAL DISMISS ─────────────────────────────────────────────
function setupOverlayDismiss() {
  ['auth-overlay', 'admin-overlay'].forEach(id => {
    const el = $(id);
    if (!el) return;
    el.addEventListener('click', e => { if (e.target === el) el.classList.add('hidden'); });
  });
  // The popup overlay dismisses through dismissPopup() (records it as seen)
  // rather than the generic hide-on-outside-click used by the other modals.
  const popupEl = $('popup-overlay');
  if (popupEl) popupEl.addEventListener('click', e => { if (e.target === popupEl) dismissPopup(); });
}

// ── INIT (call once per page) ────────────────────────────────────
async function initSealPage() {
  setupCloak();
  setupOverlayDismiss();
  await refreshUI();
  if (typeof initCookieSync === 'function') initCookieSync();
  subscribeBanner();
  subscribePopup();
}
