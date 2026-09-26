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
    $('user-label').classList.toggle('tier3-name', !!CURRENT_USER.isTier3);
    applyAvatarVisual($('user-avatar'), user, CURRENT_USER.avatarColor, CURRENT_USER.avatarImage, CURRENT_USER.avatarPosition, CURRENT_USER.ringImage);
    $('admin-btn').classList.toggle('hidden', !CURRENT_USER.isAdmin);
    ensureSettingsButton();
    ensureWalletChip();
    updateWalletChip(CURRENT_USER.seals);
    ensureNotificationBell();
    refreshNotifDot();
    startNotifPolling();
    ensureProfileNavLink();
  } else {
    $('user-info').classList.add('hidden');
    $('auth-btn').classList.remove('hidden');
    ensureProfileNavLink();
  }

  document.dispatchEvent(new CustomEvent('seal:user-ready', { detail: CURRENT_USER }));
  setupSealCustomizeButton();
}

// Renders an avatar onto any element consistently across the site —
// a custom uploaded image (respecting its saved crop position) when
// one is equipped, otherwise a colored circle with the user's initial.
// Rings render as an overlay sized relative to the avatar's own box, not
// the ring image's native resolution — this MUST match RING_HOLE_RATIO in
// server.js (see the downloadable ring template) so uploaded rings line up
// correctly at every avatar size across the site.
const RING_HOLE_RATIO = 0.72;

function applyAvatarVisual(el, username, avatarColor, avatarImage, avatarPosition, ringImage) {
  el.style.position = 'relative';
  if (avatarImage) {
    const pos = avatarPosition || { x: 50, y: 50 };
    el.style.backgroundImage = `url(${avatarImage})`;
    el.style.backgroundSize = 'cover';
    el.style.backgroundPosition = `${pos.x}% ${pos.y}%`;
    el.textContent = '';
  } else {
    el.style.backgroundImage = '';
    el.style.background = avatarColor || '';
    el.textContent = username ? username[0].toUpperCase() : '';
  }

  if (ringImage) {
    const ring = document.createElement('img');
    ring.src = ringImage;
    ring.alt = '';
    ring.className = 'avatar-ring-overlay';
    const scalePct = (100 / RING_HOLE_RATIO).toFixed(2);
    Object.assign(ring.style, {
      position: 'absolute',
      left: '50%', top: '50%',
      width: scalePct + '%', height: scalePct + '%',
      transform: 'translate(-50%, -50%)',
      pointerEvents: 'none'
    });
    el.appendChild(ring);
  }
}

// ── SEALS WALLET (header chip showing the current balance) ───────
const SEAL_ICON_SRC = 'images/seal-coin.png';
const SHOP_ICON_SRC = 'images/shop.png'

function ensureWalletChip() {
  if ($('wallet-chip')) return;
  const chip = document.createElement('a');
  chip.id = 'wallet-chip';
  chip.className = 'chip-btn wallet-chip';
  chip.href = 'shop.html';
  chip.title = 'Visit the Shop';
  chip.innerHTML = `<img src="${SEAL_ICON_SRC}" class="seal-icon" alt=""><span id="wallet-amount">0</span>`;
  const label = $('user-label');
  label.parentNode.insertBefore(chip, label.nextSibling);
}
function updateWalletChip(amount) {
  const el = $('wallet-amount');
  if (el) el.textContent = (typeof amount === 'number') ? amount : '—';
}

// ── NOTIFICATIONS (bell icon in the header) ───────────────────────
let notifPollTimer = null;

function ensureNotificationBell() {
  if ($('notif-bell-wrap')) return;
  const wrap = document.createElement('div');
  wrap.id = 'notif-bell-wrap';
  wrap.className = 'notif-bell-wrap';
  wrap.innerHTML = `
    <button class="chip-btn notif-bell-btn" id="notif-bell" title="Notifications" type="button">
      \u{1F514}<span class="notif-dot hidden" id="notif-dot"></span>
    </button>
    <div class="notif-dropdown hidden" id="notif-dropdown">
      <div class="notif-dropdown-title">Notifications</div>
      <div class="notif-list" id="notif-list"><p class="admin-hint" style="padding:14px;">Loading\u2026</p></div>
    </div>
  `;
  const chip = $('wallet-chip');
  chip.parentNode.insertBefore(wrap, chip.nextSibling);

  $('notif-bell').addEventListener('click', e => {
    e.stopPropagation();
    toggleNotifDropdown();
  });
  document.addEventListener('click', e => {
    if (!wrap.contains(e.target)) $('notif-dropdown').classList.add('hidden');
  });
}

async function refreshNotifDot() {
  try {
    const list = await API.getNotifications();
    const dot = $('notif-dot');
    if (dot) dot.classList.toggle('hidden', !list.some(n => !n.read));
  } catch {}
}

function startNotifPolling() {
  if (notifPollTimer) return;
  notifPollTimer = setInterval(refreshNotifDot, 45000);
}

async function toggleNotifDropdown() {
  const dd = $('notif-dropdown');
  const opening = dd.classList.contains('hidden');
  dd.classList.toggle('hidden');
  if (!opening) return;

  try {
    const list = await API.getNotifications();
    renderNotifList(list);
    if (list.some(n => !n.read)) {
      await API.markNotificationsRead();
      $('notif-dot').classList.add('hidden');
    }
  } catch {
    $('notif-list').innerHTML = '<p class="admin-hint" style="padding:14px;">Couldn\u2019t load notifications.</p>';
  }
}

function renderNotifList(list) {
  const el = $('notif-list');
  if (!list.length) {
    el.innerHTML = '<p class="admin-hint" style="padding:14px;">No notifications yet.</p>';
    return;
  }
  el.innerHTML = list.slice(0, 25).map(n => `
    <div class="notif-row${n.read ? '' : ' notif-unread'}">
      <div class="notif-text">${escapeHtml(n.text)}</div>
      <div class="notif-time">${timeAgo(n.createdAt)}</div>
    </div>
  `).join('');
}

function timeAgo(iso) {
  const diffMs = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

// Adds a "Profile" link to the nav dock once, pointing at the signed-in
// user's own profile (or generically to profile.html if signed out —
// the page itself prompts sign-in).
function ensureProfileNavLink() {
  const dock = document.querySelector('.dock');
  if (!dock || dock.dataset.hasProfileLink) return;
  const shopLink = document.createElement('a');
  shopLink.href = 'shop.html';
  shopLink.className = 'dock-item' + (location.pathname.endsWith('shop.html') ? ' active' : '');
  shopLink.innerHTML = `<img src="${SHOP_ICON_SRC}" class="dock-img" alt=""><span class="dock-label">Shop</span>`;

  const profileLink = document.createElement('a');
  profileLink.className = 'dock-item' + (location.pathname.endsWith('profile.html') ? ' active' : '');
  profileLink.innerHTML = `<span class="dock-icon">◔</span><span class="dock-label">Profile</span>`;
  profileLink.href = 'profile.html';

  dock.appendChild(shopLink);
  dock.appendChild(profileLink);
  dock.dataset.hasProfileLink = '1';
}

// Settings only makes sense once signed in (sending audio/uploading
// needs an account), so the button is added to the DOM here instead
// of living in every page's static HTML.
function ensureSettingsButton() {
  if ($('settings-btn')) return;
  const btn = document.createElement('button');
  btn.id = 'settings-btn';
  btn.className = 'chip-btn';
  btn.textContent = '⚙ Settings';
  btn.onclick = openSettings;
  const adminBtn = $('admin-btn');
  adminBtn.parentNode.insertBefore(btn, adminBtn);
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
  await refreshAudioSenders();
  await refreshRingUploaders();
  $('tier3-panel').classList.toggle('hidden', !(CURRENT_USER && CURRENT_USER.isTier3));
  if (CURRENT_USER && CURRENT_USER.isTier3) {
    setupResetSealButton();
    await refreshTier1Admins();
  }
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

// ── ADMIN: sound-sending permissions (admins always have access;
// this grants it to specific ordinary users without making them admins) ──
async function refreshAudioSenders() {
  const listEl = $('audio-senders-list');
  if (!listEl) return;
  listEl.textContent = 'Loading…';
  try {
    const users = await API.getAudioSenders();
    listEl.innerHTML = '';
    if (!users.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-hint';
      empty.textContent = 'No one\u2019s been granted access yet.';
      listEl.appendChild(empty);
      return;
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      const name = document.createElement('span');
      name.textContent = u;
      const revoke = document.createElement('button');
      revoke.className = 'chip-btn';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', async () => {
        try { await API.revokeAudioSender(u); await refreshAudioSenders(); } catch {}
      });
      row.appendChild(name);
      row.appendChild(revoke);
      listEl.appendChild(row);
    });
  } catch {
    listEl.textContent = 'Couldn\u2019t load the list.';
  }
}

async function grantAudioAccess() {
  const input = $('audio-grant-username');
  const err = $('audio-grant-error');
  err.classList.add('hidden');
  const username = input.value.trim();
  if (!username) return;
  try {
    await API.grantAudioSender(username);
    input.value = '';
    await refreshAudioSenders();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

async function refreshRingUploaders() {
  const listEl = $('ring-uploaders-list');
  if (!listEl) return;
  listEl.textContent = 'Loading…';
  try {
    const users = await API.getRingUploaders();
    listEl.innerHTML = '';
    if (!users.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-hint';
      empty.textContent = 'No one\u2019s been granted access yet.';
      listEl.appendChild(empty);
      return;
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      const name = document.createElement('span');
      name.textContent = u;
      const revoke = document.createElement('button');
      revoke.className = 'chip-btn';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', async () => {
        try { await API.revokeRingUploader(u); await refreshRingUploaders(); } catch {}
      });
      row.appendChild(name);
      row.appendChild(revoke);
      listEl.appendChild(row);
    });
  } catch {
    listEl.textContent = 'Couldn\u2019t load the list.';
  }
}

async function grantRingAccess() {
  const input = $('ring-grant-username');
  const err = $('ring-grant-error');
  err.classList.add('hidden');
  const username = input.value.trim();
  if (!username) return;
  try {
    await API.grantRingUploader(username);
    input.value = '';
    await refreshRingUploaders();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

// ── ADMIN (Tier 3 only): grant/revoke Tier 1 admin ─────────────────
async function refreshTier1Admins() {
  const listEl = $('tier1-admins-list');
  if (!listEl) return;
  listEl.textContent = 'Loading…';
  try {
    const users = await API.getTier1Admins();
    listEl.innerHTML = '';
    if (!users.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-hint';
      empty.textContent = 'No Tier 1 admins yet.';
      listEl.appendChild(empty);
      return;
    }
    users.forEach(u => {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      const name = document.createElement('span');
      name.textContent = u;
      const revoke = document.createElement('button');
      revoke.className = 'chip-btn';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', async () => {
        try { await API.revokeTier1Admin(u); await refreshTier1Admins(); } catch {}
      });
      row.appendChild(name);
      row.appendChild(revoke);
      listEl.appendChild(row);
    });
  } catch {
    listEl.textContent = 'Couldn\u2019t load the list.';
  }
}

async function grantTier1Admin() {
  const input = $('tier1-grant-username');
  const err = $('tier1-grant-error');
  err.classList.add('hidden');
  const username = input.value.trim();
  if (!username) return;
  try {
    await API.grantTier1Admin(username);
    input.value = '';
    await refreshTier1Admins();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

// ── ADMIN (Tier 3 only): give Seals directly to an account ─────────
async function giveSealsSubmit() {
  const userInput = $('give-seals-username');
  const amountInput = $('give-seals-amount');
  const err = $('give-seals-error');
  const success = $('give-seals-success');
  err.classList.add('hidden');
  success.classList.add('hidden');
  const username = userInput.value.trim();
  const amount = parseFloat(amountInput.value);
  if (!username || !amount || amount <= 0) {
    err.textContent = 'Enter a username and a positive amount.';
    err.classList.remove('hidden');
    return;
  }
  try {
    const result = await API.giveSeals(username, amount);
    success.textContent = `Gave ${amount} Seals to ${result.username} \u2014 new balance: ${result.seals}.`;
    success.classList.remove('hidden');
    userInput.value = '';
    amountInput.value = '';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
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

// ── DATA BACKUP (download is a plain link to /api/admin/backup — this
// just handles the restore side, since that needs a file read + POST) ──
async function restoreBackup(file) {
  const err = $('admin-restore-error');
  err.classList.add('hidden');
  if (!file) return;
  if (!confirm('This replaces ALL current data (accounts, games, tools, chat, banner, popup) with what\'s in this file. Continue?')) {
    $('admin-restore-file').value = '';
    return;
  }
  try {
    const text = await file.text();
    const parsed = JSON.parse(text);
    await API._req('/api/admin/restore', { method: 'POST', body: JSON.stringify(parsed) });
    alert('Restored. Reloading…');
    location.reload();
  } catch (e) {
    err.textContent = e.message || 'Could not restore that file.';
    err.classList.remove('hidden');
  } finally {
    $('admin-restore-file').value = '';
  }
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

// ── escaping helper — anything from another user (usernames, filenames)
// goes through here before it's ever inserted via innerHTML ──────
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// ── SETTINGS: send audio to an online user + public file library +
// personal preferences. The modal is built once, on demand, and
// appended to <body> — so it doesn't need to be duplicated into
// every page's HTML. ──────────────────────────────────────────────
const AUTOPLAY_KEY = 'seal_autoplay_audio';

function buildSettingsModal() {
  if ($('settings-overlay')) return;
  const wrap = document.createElement('div');
  wrap.id = 'settings-overlay';
  wrap.className = 'modal-overlay hidden';
  wrap.innerHTML = `
    <div class="modal settings-modal">
      <button class="modal-close" onclick="closeSettings()">✕</button>
      <h2>Settings</h2>
      <div class="modal-tabs">
        <button class="tab-btn active" data-tab="audio" onclick="switchSettingsTab('audio')">Send Audio</button>
        <button class="tab-btn" data-tab="files" onclick="switchSettingsTab('files')">Files</button>
        <button class="tab-btn" data-tab="prefs" onclick="switchSettingsTab('prefs')">Preferences</button>
      </div>

      <div id="settings-tab-audio" class="tab-content active">
        <div id="audio-permitted">
          <label class="field-label">Send a sound to someone online</label>
          <select id="audio-target"></select>
          <select id="audio-file"></select>
          <p class="admin-hint">Only audio files show up here — upload one on the Files tab first if you don't see it.</p>
          <p class="form-error hidden" id="audio-send-error"></p>
          <button class="btn-primary" onclick="sendAudioNow()">Send Sound</button>
        </div>
        <p id="audio-denied" class="admin-hint hidden">Sending sounds is admin-only right now. Ask an admin to grant you access from their Admin Panel → Sound Permissions.</p>
      </div>

      <div id="settings-tab-files" class="tab-content">
        <label class="field-label">Upload a file</label>
        <input type="file" id="file-upload-input">
        <p class="admin-hint">Max 25MB. Shared publicly — anyone visiting the site can see and download it.</p>
        <p class="form-error hidden" id="file-upload-error"></p>
        <div class="admin-divider"></div>
        <label class="field-label">Library</label>
        <div id="file-list" class="file-list"></div>
      </div>

      <div id="settings-tab-prefs" class="tab-content">
        <label class="check settings-check">
          <input type="checkbox" id="autoplay-toggle" checked onchange="toggleAutoplay()">
          Auto-play sounds people send me (skips the confirmation prompt)
        </label>
        <p class="admin-hint">This only affects your own browser — no one else can turn this on for you.</p>
      </div>
    </div>
  `;
  document.body.appendChild(wrap);
  wrap.addEventListener('click', e => { if (e.target === wrap) closeSettings(); });
  if (localStorage.getItem(AUTOPLAY_KEY) === null) {
  localStorage.setItem(AUTOPLAY_KEY, '1');
}

$('autoplay-toggle').checked =
  localStorage.getItem(AUTOPLAY_KEY) === '1';
  $('file-upload-input').addEventListener('change', handleFileUploadChange);
}

function switchSettingsTab(tab) {
  document.querySelectorAll('#settings-overlay .tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  document.querySelectorAll('#settings-overlay .tab-content').forEach(t => t.classList.remove('active'));
  $('settings-tab-' + tab).classList.add('active');
}

async function openSettings() {
  buildSettingsModal();
  $('settings-overlay').classList.remove('hidden');

  const permitted = !!(CURRENT_USER && (CURRENT_USER.isAdmin || CURRENT_USER.canSendAudio));
  $('audio-permitted').classList.toggle('hidden', !permitted);
  $('audio-denied').classList.toggle('hidden', permitted);

  const tasks = [refreshFileList()];
  if (permitted) tasks.push(refreshOnlineUsers());
  await Promise.all(tasks);
}
function closeSettings() {
  const el = $('settings-overlay');
  if (el) el.classList.add('hidden');
}

async function refreshOnlineUsers() {
  const sel = $('audio-target');
  const current = sel.value;
  sel.innerHTML = '<option value="">Loading…</option>';
  try {
    const users = await API.onlineUsers();
    sel.innerHTML = users.length
      ? users.map(u => `<option value="${escapeHtml(u)}">${escapeHtml(u)}</option>`).join('')
      : '<option value="">No one else is online right now</option>';
    if (users.includes(current)) sel.value = current;
  } catch {
    sel.innerHTML = '<option value="">Couldn\u2019t load online users</option>';
  }
}

function formatBytes(n) {
  if (n < 1024) return n + ' B';
  if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
  return (n / 1024 / 1024).toFixed(1) + ' MB';
}

function renderFileRow(f) {
  const row = document.createElement('div');
  row.className = 'file-item';

  const meta = document.createElement('div');
  meta.className = 'file-meta';
  const name = document.createElement('span');
  name.className = 'file-name';
  name.textContent = f.name;
  const sub = document.createElement('span');
  sub.className = 'file-sub';
  sub.textContent = `${formatBytes(f.size)} · ${f.uploader}`;
  meta.appendChild(name);
  meta.appendChild(sub);

  const actions = document.createElement('div');
  actions.className = 'file-actions';
  const dl = document.createElement('a');
  dl.className = 'btn-ghost file-download';
  dl.href = API.fileDownloadUrl(f.id);
  dl.textContent = 'Download';
  actions.appendChild(dl);

  const canDelete = CURRENT_USER && (CURRENT_USER.username === f.uploader || CURRENT_USER.isAdmin);
  if (canDelete) {
    const del = document.createElement('button');
    del.className = 'chip-btn file-delete';
    del.textContent = '✕';
    del.addEventListener('click', async () => {
      if (!confirm(`Remove "${f.name}"?`)) return;
      try { await API.deleteFile(f.id); await refreshFileList(); } catch {}
    });
    actions.appendChild(del);
  }

  row.appendChild(meta);
  row.appendChild(actions);
  return row;
}

async function refreshFileList() {
  const listEl = $('file-list');
  const audioSel = $('audio-file');
  listEl.textContent = 'Loading…';
  try {
    const files = await API.listFiles();
    listEl.innerHTML = '';
    if (!files.length) {
      const empty = document.createElement('p');
      empty.className = 'admin-hint';
      empty.textContent = 'No files shared yet.';
      listEl.appendChild(empty);
    } else {
      files.slice().reverse().forEach(f => listEl.appendChild(renderFileRow(f)));
    }
    const audioFiles = files.filter(f => f.mime && f.mime.startsWith('audio/'));
    audioSel.innerHTML = audioFiles.length
      ? audioFiles.map(f => `<option value="${f.id}">${escapeHtml(f.name)}</option>`).join('')
      : '<option value="">Upload an audio file first</option>';
  } catch {
    listEl.textContent = 'Couldn\u2019t load the file library.';
  }
}

async function handleFileUploadChange(e) {
  const file = e.target.files[0];
  if (!file) return;
  const err = $('file-upload-error');
  err.classList.add('hidden');
  if (file.size > 25 * 1024 * 1024) {
    err.textContent = 'That file is over 25MB.';
    err.classList.remove('hidden');
    e.target.value = '';
    return;
  }
  try {
    await API.uploadFile(file);
    e.target.value = '';
    await refreshFileList();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

async function sendAudioNow() {
  const to = $('audio-target').value;
  const fileId = $('audio-file').value;
  const err = $('audio-send-error');
  err.classList.add('hidden');
  if (!to) { err.textContent = 'Pick someone online first.'; err.classList.remove('hidden'); return; }
  if (!fileId) { err.textContent = 'Pick an audio file first.'; err.classList.remove('hidden'); return; }
  try {
    await API.sendAudio(to, fileId);
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

function toggleAutoplay() {
  localStorage.setItem(AUTOPLAY_KEY, $('autoplay-toggle').checked ? '1' : '0');
}

// ── TOASTS (incoming-sound prompts, and quick confirmations) ─────
function ensureToastContainer() {
  let c = $('toast-container');
  if (!c) {
    c = document.createElement('div');
    c.id = 'toast-container';
    c.className = 'toast-container';
    document.body.appendChild(c);
  }
  return c;
}
function showToast(build, autoDismissMs) {
  const c = ensureToastContainer();
  const t = document.createElement('div');
  t.className = 'toast';
  build(t);
  c.appendChild(t);
  if (autoDismissMs) setTimeout(() => t.remove(), autoDismissMs);
  return t;
}

function playIncomingAudio(data) {
  const audio = new Audio(data.url);
  audio.play().catch(() => {});
  showToast(t => {
    t.textContent = '';
    const span = document.createElement('span');
    span.className = 'toast-text';
    span.textContent = `▶ Playing a sound from ${data.from}`;
    t.appendChild(span);
  }, 4000);
}

function handleIncomingAudio(data) {
  if (localStorage.getItem(AUTOPLAY_KEY) === '1') { playIncomingAudio(data); return; }

  const t = showToast(el => {
    const text = document.createElement('span');
    text.className = 'toast-text';
    const strong = document.createElement('strong');
    strong.textContent = data.from;
    text.appendChild(strong);
    text.appendChild(document.createTextNode(` sent you a sound: ${data.fileName}`));

    const actions = document.createElement('div');
    actions.className = 'toast-actions';
    const play = document.createElement('button');
    play.className = 'btn-primary toast-play';
    play.textContent = 'Play';
    const dismiss = document.createElement('button');
    dismiss.className = 'btn-ghost toast-dismiss';
    dismiss.textContent = 'Dismiss';
    actions.appendChild(play);
    actions.appendChild(dismiss);

    el.appendChild(text);
    el.appendChild(actions);

    play.addEventListener('click', () => { playIncomingAudio(data); el.remove(); });
    dismiss.addEventListener('click', () => el.remove());
  });
  return t;
}

// Only signed-in users get a notification channel — it's how a
// targeted "someone sent you a sound" reaches this specific browser.
function subscribeNotify() {
  const user = CURRENT_USER && (CURRENT_USER.username || CURRENT_USER.user);
  if (!user || typeof EventSource === 'undefined') return;
  const es = new EventSource('/api/notify/stream');
  es.addEventListener('incoming-audio', e => {
    try { handleIncomingAudio(JSON.parse(e.data)); } catch {}
  });
}

// ── SEAL CUSTOMIZE ──────────────────────────────────────────────────
// A Tier 3-only, site-wide WYSIWYG layer: drag any element around, set
// a background, and it's live for every visitor (same broadcast-to-
// everyone SSE pattern as the banner) until a Tier 3 admin resets it.
//
// Elements are addressed by an nth-child CSS path built from <body>
// down to the exact element that was grabbed — e.g.
// "body > main:nth-child(3) > div:nth-child(2)" — which is also a
// valid document.querySelector() string, so applying a saved layout is
// just "for each key, querySelector it and translate() it". This
// only works reliably for elements whose position in the DOM doesn't
// change between edits (headers, sections, cards) — dragging something
// inside a list that grows/shrinks (chat messages, live stock cards)
// can drift if the list's length differs later.
let SEAL_CUSTOM_STATE = { background: null, elements: {} };
let SEAL_EDIT_ACTIVE = false;
let SEAL_DRAG = null; // { el, key, startX, startY, baseDx, baseDy, dx, dy }

// Some elements (the nav dock, the chat scroll-to-bottom button) already
// have their own CSS transform — usually translateX(-50%) to center
// themselves. Overwriting that with our drag offset would un-center
// them, so this captures each element's original transform exactly once
// (before we ever touch it) and every offset we apply afterward gets
// layered on top of it instead of replacing it.
function sealBaseTransform(el) {
  if (el.dataset.sealBaseTransform === undefined) {
    const computed = getComputedStyle(el).transform;
    el.dataset.sealBaseTransform = (computed && computed !== 'none') ? computed : '';
  }
  return el.dataset.sealBaseTransform;
}
function sealApplyOffset(el, dx, dy) {
  const base = sealBaseTransform(el);
  el.style.transform = (base ? base + ' ' : '') + `translate(${dx}px, ${dy}px)`;
}

function sealPathFor(el) {
  if (!el || el === document.body) return 'body';
  const parts = [];
  let node = el;
  while (node && node.parentElement && node !== document.body) {
    const parent = node.parentElement;
    const index = Array.prototype.indexOf.call(parent.children, node) + 1;
    parts.unshift(node.tagName.toLowerCase() + ':nth-child(' + index + ')');
    node = parent;
  }
  return 'body > ' + parts.join(' > ');
}

function applySealCustomize(state) {
  SEAL_CUSTOM_STATE = (state && typeof state === 'object')
    ? { background: state.background || null, elements: (state.elements && typeof state.elements === 'object') ? state.elements : {} }
    : { background: null, elements: {} };

  const bg = SEAL_CUSTOM_STATE.background;
  if (bg && bg.value) {
    if (bg.type === 'image') {
      document.body.style.backgroundImage = `url("${bg.value}")`;
      document.body.style.backgroundSize = 'cover';
      document.body.style.backgroundPosition = 'center';
      document.body.style.backgroundAttachment = 'fixed';
      document.body.style.backgroundColor = '';
    } else {
      document.body.style.backgroundImage = '';
      document.body.style.backgroundColor = bg.value;
    }
  } else {
    document.body.style.backgroundImage = '';
    document.body.style.backgroundColor = '';
  }

  document.querySelectorAll('.seal-custom-el').forEach(el => {
    el.style.transform = '';
    el.classList.remove('seal-custom-el');
  });
  Object.entries(SEAL_CUSTOM_STATE.elements).forEach(([key, offset]) => {
    if (!offset || (!offset.dx && !offset.dy)) return;
    try {
      const el = document.querySelector(key);
      if (el) {
        sealApplyOffset(el, offset.dx, offset.dy);
        el.classList.add('seal-custom-el');
      }
    } catch { /* saved selector doesn't resolve on this page/DOM state — skip it */ }
  });
}

// Everyone — signed in or not — gets this, so Seal Customize changes
// show up for any visitor, live, with no refresh needed.
function subscribeCustomize() {
  if (typeof EventSource === 'undefined') {
    API.getCustomize().then(applySealCustomize).catch(() => {});
    return;
  }
  const es = new EventSource('/api/customize/stream');
  es.onmessage = e => {
    try { applySealCustomize(JSON.parse(e.data)); } catch {}
  };
}

function sealSetStatus(text) {
  const status = $('seal-tb-status');
  if (status) status.textContent = text;
}

function sealEditMouseDown(e) {
  if (!SEAL_EDIT_ACTIVE) return;
  const target = e.target;
  if (target.closest && target.closest('.seal-customize-ui')) return;

  // The nav dock (Home / Games / Tools / etc.) is made entirely of <a>
  // links, so the "don't hijack clickable elements" rule below would
  // make the whole bar undraggable. Drag it as one unit instead
  // whenever the click lands anywhere inside it, rather than trying to
  // grab whichever individual link got clicked.
  const dockEl = target.closest && target.closest('.dock');
  const el = dockEl || target;

  if (!dockEl && ['INPUT', 'TEXTAREA', 'SELECT', 'BUTTON', 'A'].includes(target.tagName)) return;
  if (el === document.body || el === document.documentElement) return;
  e.preventDefault();
  const key = sealPathFor(el);
  const existing = SEAL_CUSTOM_STATE.elements[key] || { dx: 0, dy: 0 };
  SEAL_DRAG = { el, key, startX: e.clientX, startY: e.clientY, baseDx: existing.dx || 0, baseDy: existing.dy || 0, dx: existing.dx || 0, dy: existing.dy || 0 };
  el.classList.add('seal-dragging');
}
function sealEditMouseMove(e) {
  if (!SEAL_DRAG) return;
  SEAL_DRAG.dx = SEAL_DRAG.baseDx + (e.clientX - SEAL_DRAG.startX);
  SEAL_DRAG.dy = SEAL_DRAG.baseDy + (e.clientY - SEAL_DRAG.startY);
  sealApplyOffset(SEAL_DRAG.el, SEAL_DRAG.dx, SEAL_DRAG.dy);
}
function sealEditMouseUp() {
  if (!SEAL_DRAG) return;
  SEAL_DRAG.el.classList.remove('seal-dragging');
  SEAL_DRAG.el.classList.add('seal-custom-el');
  SEAL_CUSTOM_STATE.elements[SEAL_DRAG.key] = { dx: SEAL_DRAG.dx, dy: SEAL_DRAG.dy };
  SEAL_DRAG = null;
  sealSetStatus('Unsaved changes — click Save changes to publish them.');
}

async function sealSaveCustomize() {
  sealSetStatus('Saving…');
  try {
    await API.saveCustomize(SEAL_CUSTOM_STATE.background, SEAL_CUSTOM_STATE.elements);
    sealSetStatus('Saved — everyone sees this now.');
  } catch (ex) {
    sealSetStatus('Save failed: ' + ex.message);
  }
}
function sealApplyColorBg() {
  const input = $('seal-tb-color');
  SEAL_CUSTOM_STATE.background = { type: 'color', value: input.value };
  applySealCustomize(SEAL_CUSTOM_STATE);
  sealSetStatus('Background updated — click Save changes to publish it.');
}
function sealApplyImageBg() {
  const input = $('seal-tb-image');
  const url = input.value.trim();
  if (!url) return;
  SEAL_CUSTOM_STATE.background = { type: 'image', value: url };
  applySealCustomize(SEAL_CUSTOM_STATE);
  sealSetStatus('Background updated — click Save changes to publish it.');
}
function sealClearBg() {
  SEAL_CUSTOM_STATE.background = null;
  applySealCustomize(SEAL_CUSTOM_STATE);
  sealSetStatus('Background cleared — click Save changes to publish it.');
}

function buildCustomizeToolbar() {
  const bar = document.createElement('div');
  bar.className = 'seal-customize-toolbar seal-customize-ui';
  bar.id = 'seal-customize-toolbar';
  bar.innerHTML =
    '<span class="seal-tb-label">Drag anything to move it</span>' +
    '<input type="color" id="seal-tb-color" value="#12161d">' +
    '<button type="button" id="seal-tb-color-btn">Set color</button>' +
    '<input type="text" id="seal-tb-image" placeholder="Background image URL">' +
    '<button type="button" id="seal-tb-image-btn">Set image</button>' +
    '<button type="button" id="seal-tb-clear-btn">Clear background</button>' +
    '<button type="button" class="seal-tb-save" id="seal-tb-save-btn">Save changes</button>' +
    '<button type="button" class="seal-tb-exit" id="seal-tb-exit-btn">Exit</button>' +
    '<span class="seal-tb-status" id="seal-tb-status"></span>';
  document.body.appendChild(bar);
  $('seal-tb-color-btn').addEventListener('click', sealApplyColorBg);
  $('seal-tb-image-btn').addEventListener('click', sealApplyImageBg);
  $('seal-tb-clear-btn').addEventListener('click', sealClearBg);
  $('seal-tb-save-btn').addEventListener('click', sealSaveCustomize);
  $('seal-tb-exit-btn').addEventListener('click', toggleSealEditMode);
}

function toggleSealEditMode() {
  SEAL_EDIT_ACTIVE = !SEAL_EDIT_ACTIVE;
  document.body.classList.toggle('seal-edit-mode', SEAL_EDIT_ACTIVE);
  const btn = $('seal-customize-btn');
  if (btn) btn.classList.toggle('active', SEAL_EDIT_ACTIVE);

  if (SEAL_EDIT_ACTIVE) {
    if (!$('seal-customize-toolbar')) buildCustomizeToolbar();
    $('seal-customize-toolbar').classList.remove('hidden');
  } else {
    const bar = $('seal-customize-toolbar');
    if (bar) bar.classList.add('hidden');
  }
}

// Called on every refreshUI() so the button appears/disappears the
// instant someone signs in/out as Tier 3 — no page reload needed.
function setupSealCustomizeButton() {
  const isTier3 = !!(CURRENT_USER && CURRENT_USER.isTier3);
  let btn = $('seal-customize-btn');
  if (!isTier3) {
    if (btn) btn.remove();
    const bar = $('seal-customize-toolbar');
    if (bar) bar.remove();
    if (SEAL_EDIT_ACTIVE) toggleSealEditMode();
    return;
  }
  if (btn) return;
  btn = document.createElement('button');
  btn.type = 'button';
  btn.id = 'seal-customize-btn';
  btn.className = 'seal-customize-btn seal-customize-ui';
  btn.innerHTML = '\uD83C\uDFA8 Seal Customize';
  btn.addEventListener('click', toggleSealEditMode);
  document.body.appendChild(btn);

  document.addEventListener('mousedown', sealEditMouseDown);
  document.addEventListener('mousemove', sealEditMouseMove);
  document.addEventListener('mouseup', sealEditMouseUp);
}

// Tier 3 only: injects the "Reset Seal" button into the Admin Panel's
// Tier 3 section (same #tier3-panel container the give-Seals form lives
// in) the first time the panel opens for a Tier 3 admin.
async function resetSealCustomize() {
  const status = $('reset-seal-status');
  if (status) { status.textContent = 'Resetting…'; status.classList.remove('hidden'); }
  try {
    await API.resetCustomize();
    if (status) status.textContent = 'Site is back to normal.';
  } catch (ex) {
    if (status) { status.textContent = ex.message; status.classList.remove('hidden'); }
  }
}
function setupResetSealButton() {
  const panel = $('tier3-panel');
  if (!panel || $('reset-seal-btn')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Seal Customize</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Undo every drag and background change made with Seal Customize and put the site back to normal for everyone.</p>' +
    '<button class="btn-primary" style="width:auto;" id="reset-seal-btn">Reset Seal</button>' +
    '<p class="admin-hint hidden" id="reset-seal-status"></p>';
  panel.appendChild(wrap);
  $('reset-seal-btn').addEventListener('click', resetSealCustomize);
}

// ── ADMIN: upload a game/tool folder (.zip) or icon straight onto
// the server, from the Admin Panel ────────────────────────────────
async function handleSiteFileUpload(e) {
  const file = e.target.files[0];
  if (!file) return;
  const err = $('sitefile-error');
  const ok = $('sitefile-success');
  err.classList.add('hidden');
  ok.classList.add('hidden');
  try {
    const fd = new FormData();
    fd.append('file', file);
    fd.append('type', $('sitefile-type').value);
    const name = $('sitefile-name').value.trim();
    if (name) fd.append('name', name);

    const res = await fetch('/api/admin/site-files', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');

    ok.textContent = `Added at: ${data.path} — paste this into the Add Game/Tool form's URL or Thumbnail field.`;
    ok.classList.remove('hidden');
    e.target.value = '';
    $('sitefile-name').value = '';
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}
function setupSiteFileUpload() {
  const input = $('sitefile-input');
  if (!input || input.dataset.wired) return;
  input.dataset.wired = '1';
  input.addEventListener('change', handleSiteFileUpload);
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
  setupSiteFileUpload();
  await refreshUI();
  if (typeof initCookieSync === 'function') initCookieSync();
  subscribeBanner();
  subscribePopup();
  subscribeNotify();
  subscribeCustomize();
}