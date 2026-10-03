// ── SHARED PAGE LOGIC ──────────────────────────────────────────
const $ = id => document.getElementById(id);
let CURRENT_USER = null; // { username, isAdmin } | null

// Name color by tier, highest wins: Tier 3 (red, owner-granted) beats
// Tier 1 (blue, granted by Tier 3) beats Tier 2 (yellow, cosmetic-only,
// unlocked with the Admin Panel password box). Takes either a profile-
// shaped object (isTier3/isTier1/isTier2) or a comment-shaped one
// (authorIsTier3/authorIsTier1/authorIsTier2).
function sealTierClassFor(obj) {
  if (!obj) return '';
  if (obj.isOverseer || obj.authorIsOverseer) return 'overseer-name';
  if (obj.isTier4 || obj.authorIsTier4) return 'tier4-name';
  if (obj.isTier3 || obj.authorIsTier3) return 'tier3-name';
  if (obj.isTier1 || obj.authorIsTier1) return 'tier1-name';
  if (obj.isTier2 || obj.authorIsTier2) return 'tier2-name';
  return '';
}

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
    $('user-label').classList.remove('overseer-name', 'tier4-name', 'tier3-name', 'tier1-name', 'tier2-name');
    const tierClass = sealTierClassFor(CURRENT_USER);
    if (tierClass) $('user-label').classList.add(tierClass);
    applyAvatarVisual($('user-avatar'), user, CURRENT_USER.avatarColor, CURRENT_USER.avatarImage, CURRENT_USER.avatarPosition, CURRENT_USER.ringImage);
    $('admin-btn').classList.toggle('hidden', !CURRENT_USER.isAdmin);
    if (CURRENT_USER.isTier4) { refreshEscalationBadge(); startEscalationBadgePolling(); }
    else setEscalationBadge(0);
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
    setEscalationBadge(0);
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

  const ideasLink = document.createElement('a');
  ideasLink.href = 'suggestions.html';
  ideasLink.className = 'dock-item' + (location.pathname.endsWith('suggestions.html') ? ' active' : '');
  ideasLink.innerHTML = `<span class="dock-icon">\u2726</span><span class="dock-label">Ideas</span>`;

  dock.appendChild(shopLink);
  dock.appendChild(ideasLink);
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
// Visible to any admin who can open the Admin Panel (Tier 1 or Tier 3) —
// Tier 2 carries no permissions of its own, it's just a name color, so
// there's no reason to gate who can attempt the password.
async function submitTier2Password() {
  const input = $('tier2-password');
  const status = $('tier2-status');
  status.classList.remove('hidden');
  status.textContent = 'Checking…';
  try {
    await API.unlockTier2(input.value);
    status.textContent = 'Unlocked — your name is now yellow site-wide.';
    input.value = '';
    if (CURRENT_USER) CURRENT_USER.isTier2 = true;
    refreshUI();
  } catch (ex) {
    status.textContent = ex.message;
  }
}
function setupTier2Box() {
  if ($('tier2-password')) return;
  const heading = document.querySelector('#admin-overlay h2');
  if (!heading) return;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Tier 2</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Cosmetic only — no features, just a yellow name. Know the password?</p>' +
    '<div class="banner-row">' +
    '<input type="password" id="tier2-password" placeholder="Password" style="flex:1">' +
    '<button class="btn-primary" style="width:auto;" id="tier2-submit-btn">Submit</button>' +
    '</div>' +
    '<p class="admin-hint hidden" id="tier2-status"></p>';
  heading.after(wrap);
  $('tier2-submit-btn').addEventListener('click', submitTier2Password);
  $('tier2-password').addEventListener('keydown', e => { if (e.key === 'Enter') submitTier2Password(); });
}

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
  await refreshImageUploaders();
  setupTier2Box();
  $('tier3-panel').classList.toggle('hidden', !(CURRENT_USER && CURRENT_USER.isTier3));
  if (CURRENT_USER && CURRENT_USER.isTier3) {
    setupResetSealButton();
    setupUserManagement();
    await refreshTier1Admins();
    await refreshAdminUsers();
    if (CURRENT_USER.isTier4) {
      setupTier4Tools();
      await refreshTier3Admins();
      await refreshAuditLog();
    }
    if (CURRENT_USER.isOverseer) {
      setupOverseerTools();
      await refreshMaintenance();
      await refreshOverseerPolls();
    }
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

async function refreshImageUploaders() {
  const listEl = $('image-uploaders-list');
  if (!listEl) return;
  listEl.textContent = 'Loading\u2026';
  try {
    const users = await API.getImageUploaders();
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
        try { await API.revokeImageUploader(u); await refreshImageUploaders(); } catch {}
      });
      row.appendChild(name);
      row.appendChild(revoke);
      listEl.appendChild(row);
    });
  } catch {
    listEl.textContent = 'Couldn\u2019t load the list.';
  }
}

async function grantImageAccess() {
  const input = $('image-grant-username');
  const err = $('image-grant-error');
  err.classList.add('hidden');
  const username = input.value.trim();
  if (!username) return;
  try {
    await API.grantImageUploader(username);
    input.value = '';
    await refreshImageUploaders();
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
  es.addEventListener('chat-notify', e => {
    try { handleChatNotify(JSON.parse(e.data)); } catch {}
  });
  es.addEventListener('admin-notify', e => {
    try { handleAdminNotify(JSON.parse(e.data)); } catch {}
  });
  es.addEventListener('poll-new', () => { refreshPolls(); });
  es.addEventListener('poll-update', () => { refreshPolls(); if (OVERSEER_READY) refreshOverseerPolls(); });
  // An Overseer just locked the site: reload so the server shows the
  // maintenance page right away instead of on this tab's next request.
  es.addEventListener('maintenance', () => { window.location.reload(); });
}

// ── Site-wide polls (voting side) ─────────────────────────────────
// One poll modal at a time; dismissing it (without voting) is remembered
// for this browser session so it doesn't nag on every page, and a "Vote"
// chip stays in the header until the poll is answered or closed.
let OPEN_POLLS = [];
let OVERSEER_READY = false;
const pollSeenKey = id => 'seal_poll_seen_' + id;

function ensurePollChip() {
  let chip = $('poll-chip');
  if (!chip) {
    const anchor = $('notif-bell-wrap') || $('wallet-chip');
    if (!anchor || !anchor.parentNode) return null;
    chip = document.createElement('button');
    chip.id = 'poll-chip';
    chip.type = 'button';
    chip.className = 'chip-btn poll-chip hidden';
    chip.textContent = '\u{1F4CA} Vote';
    chip.addEventListener('click', () => {
      const next = OPEN_POLLS.find(p => !p.myVote);
      if (next) showPollModal(next);
    });
    anchor.parentNode.insertBefore(chip, anchor.nextSibling);
  }
  return chip;
}
function updatePollChip() {
  const chip = ensurePollChip();
  if (chip) chip.classList.toggle('hidden', !OPEN_POLLS.some(p => !p.myVote));
}
async function refreshPolls() {
  const user = CURRENT_USER && (CURRENT_USER.username || CURRENT_USER.user);
  if (!user) { OPEN_POLLS = []; updatePollChip(); return; }
  try { OPEN_POLLS = await API.getPolls(); } catch { return; }
  updatePollChip();
  // A poll that was closed/deleted while its modal was open should vanish.
  const openModal = document.querySelector('.poll-modal-overlay');
  if (openModal && !OPEN_POLLS.some(p => p.id === openModal.dataset.pollId)) openModal.remove();
  const next = OPEN_POLLS.find(p => !p.myVote && !sessionStorage.getItem(pollSeenKey(p.id)));
  if (next && !document.querySelector('.poll-modal-overlay')) showPollModal(next);
}

function renderPollResults(box, poll) {
  const total = poll.totalVotes || 0;
  const list = document.createElement('div');
  list.className = 'poll-options';
  poll.options.forEach(o => {
    const pct = total ? Math.round((o.count / total) * 100) : 0;
    const row = document.createElement('div');
    row.className = 'poll-option result' + (poll.myVote === o.id ? ' mine' : '');
    const bar = document.createElement('div');
    bar.className = 'poll-bar';
    bar.style.width = pct + '%';
    const line = document.createElement('div');
    line.className = 'poll-row';
    const label = document.createElement('span');
    label.textContent = o.text + (poll.myVote === o.id ? '  \u2713' : '');
    const num = document.createElement('span');
    num.className = 'poll-pct';
    num.textContent = `${pct}% \u00b7 ${o.count}`;
    line.appendChild(label);
    line.appendChild(num);
    row.appendChild(bar);
    row.appendChild(line);
    list.appendChild(row);
  });
  box.appendChild(list);
}

function showPollModal(poll) {
  const existing = document.querySelector('.poll-modal-overlay');
  if (existing) existing.remove();

  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay poll-modal-overlay';
  overlay.dataset.pollId = poll.id;
  const box = document.createElement('div');
  box.className = 'modal';
  overlay.appendChild(box);

  const render = p => {
    box.textContent = '';
    const close = document.createElement('button');
    close.className = 'modal-close';
    close.type = 'button';
    close.textContent = '\u2715';
    close.addEventListener('click', dismiss);
    box.appendChild(close);

    const h2 = document.createElement('h2');
    h2.textContent = 'Site poll';
    box.appendChild(h2);
    const q = document.createElement('p');
    q.className = 'poll-question';
    q.textContent = p.question;
    box.appendChild(q);

    if (p.myVote) {
      renderPollResults(box, p);
      const meta = document.createElement('p');
      meta.className = 'poll-meta';
      meta.textContent = `Thanks for voting! ${p.totalVotes} vote${p.totalVotes === 1 ? '' : 's'} so far.`;
      box.appendChild(meta);
      const actions = document.createElement('div');
      actions.className = 'poll-actions';
      const done = document.createElement('button');
      done.className = 'btn-primary';
      done.type = 'button';
      done.textContent = 'Done';
      done.addEventListener('click', () => overlay.remove());
      actions.appendChild(done);
      box.appendChild(actions);
      return;
    }

    const err = document.createElement('p');
    err.className = 'form-error hidden';
    const list = document.createElement('div');
    list.className = 'poll-options';
    p.options.forEach(o => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'poll-option';
      b.textContent = o.text;
      b.addEventListener('click', async () => {
        list.querySelectorAll('button').forEach(x => { x.disabled = true; });
        try {
          const updated = await API.votePoll(p.id, o.id);
          const i = OPEN_POLLS.findIndex(x => x.id === p.id);
          if (i >= 0) OPEN_POLLS[i] = updated;
          updatePollChip();
          render(updated);
        } catch (ex) {
          list.querySelectorAll('button').forEach(x => { x.disabled = false; });
          err.textContent = ex.message;
          err.classList.remove('hidden');
          refreshPolls();
        }
      });
      list.appendChild(b);
    });
    box.appendChild(list);
    box.appendChild(err);
    const meta = document.createElement('p');
    meta.className = 'poll-meta';
    meta.textContent = p.closesAt
      ? 'One vote per account \u00b7 closes ' + new Date(p.closesAt).toLocaleString()
      : 'One vote per account.';
    box.appendChild(meta);
  };

  function dismiss() {
    if (!poll.myVote) sessionStorage.setItem(pollSeenKey(poll.id), '1');
    overlay.remove();
  }
  overlay.addEventListener('click', e => { if (e.target === overlay) dismiss(); });
  render(poll);
  document.body.appendChild(overlay);
}

// ── DM / @mention pop-ups ──────────────────────────────────────────
// Same toast style as the incoming-sound prompt. Rapid-fire messages from
// the same person in the same place collapse into one toast with a count
// instead of stacking up. Skipped when you're already looking at that
// conversation (the bell still records it either way).
const CHAT_TOAST_BY_KEY = new Map();
const CHAT_TOAST_MS = 9000;

function openChatRoomFromToast(roomId) {
  if (typeof openRoom === 'function' && typeof CHAT_ROOM !== 'undefined') { openRoom(roomId); return; }
  location.href = 'chat.html?room=' + encodeURIComponent(roomId);
}

function handleChatNotify(data) {
  refreshNotifDot();
  const viewing = typeof CHAT_ROOM !== 'undefined' && CHAT_ROOM === data.roomId && !document.hidden && document.hasFocus();
  if (viewing) return;

  const key = `${data.kind}:${data.roomId}:${data.from}`;
  const prev = CHAT_TOAST_BY_KEY.get(key);
  if (prev && prev.el.isConnected) {
    prev.count += 1;
    prev.render(data);
    clearTimeout(prev.timer);
    prev.timer = setTimeout(() => { prev.el.remove(); CHAT_TOAST_BY_KEY.delete(key); }, CHAT_TOAST_MS);
    return;
  }

  const state = { count: 1, el: null, timer: null, render: null };
  const toast = showToast(el => {
    const text = document.createElement('span');
    text.className = 'toast-text';
    const excerpt = document.createElement('span');
    excerpt.className = 'toast-excerpt';

    const actions = document.createElement('div');
    actions.className = 'toast-actions';
    const open = document.createElement('button');
    open.className = 'btn-primary toast-play';
    open.textContent = data.kind === 'dm' ? 'Open DM' : 'Open chat';
    const dismiss = document.createElement('button');
    dismiss.className = 'btn-ghost toast-dismiss';
    dismiss.textContent = 'Dismiss';
    actions.appendChild(open);
    actions.appendChild(dismiss);

    el.appendChild(text);
    el.appendChild(excerpt);
    el.appendChild(actions);

    state.render = d => {
      text.textContent = '';
      const strong = document.createElement('strong');
      strong.textContent = d.from;
      text.appendChild(strong);
      const where = d.roomName ? ` in # ${d.roomName}` : '';
      text.appendChild(document.createTextNode(
        d.kind === 'dm' ? ' sent you a DM' : ` mentioned you${where}`
      ));
      if (state.count > 1) text.appendChild(document.createTextNode(` \u00b7 ${state.count} new`));
      excerpt.textContent = '\u201c' + d.excerpt + '\u201d';
    };
    state.render(data);

    const close = () => { clearTimeout(state.timer); el.remove(); CHAT_TOAST_BY_KEY.delete(key); };
    open.addEventListener('click', () => { openChatRoomFromToast(data.roomId); close(); });
    dismiss.addEventListener('click', close);
  });
  state.el = toast;
  state.timer = setTimeout(() => { toast.remove(); CHAT_TOAST_BY_KEY.delete(key); }, CHAT_TOAST_MS);
  CHAT_TOAST_BY_KEY.set(key, state);

  // Never let a flood of conversations bury the page.
  const c = ensureToastContainer();
  while (c.children.length > 4) c.firstElementChild.remove();
}

function quickToast(text, ms) {
  return showToast(t => {
    const span = document.createElement('span');
    span.className = 'toast-text';
    span.textContent = text;
    t.appendChild(span);
  }, ms || 4000);
}

// ── Admin pop-ups + the open-escalations badge ─────────────────────
function handleAdminNotify(data) {
  const adminOpen = $('admin-overlay') && !$('admin-overlay').classList.contains('hidden');
  if (data.kind === 'escalations-changed') {
    refreshEscalationBadge();
    if (adminOpen && CURRENT_USER && CURRENT_USER.isTier4) refreshAdminUsers();
    return;
  }
  if (data.kind === 'escalation-new') {
    refreshEscalationBadge();
    if (adminOpen) refreshAdminUsers();
    showToast(el => {
      const text = document.createElement('span');
      text.className = 'toast-text';
      text.textContent = '\u{1F6A9} ' + data.text;
      const actions = document.createElement('div');
      actions.className = 'toast-actions';
      const review = document.createElement('button');
      review.className = 'btn-primary toast-play';
      review.textContent = 'Review';
      const dismiss = document.createElement('button');
      dismiss.className = 'btn-ghost toast-dismiss';
      dismiss.textContent = 'Dismiss';
      actions.appendChild(review);
      actions.appendChild(dismiss);
      el.appendChild(text);
      el.appendChild(actions);
      review.addEventListener('click', () => { el.remove(); openAdmin(); });
      dismiss.addEventListener('click', () => el.remove());
    }, 12000);
    return;
  }
  if (data.kind === 'escalation-resolved') {
    refreshNotifDot();
    quickToast('\u2705 ' + data.text, 9000);
  }
}

function ensureEscalationBadge() {
  const btn = $('admin-btn');
  if (!btn) return null;
  let b = $('admin-badge');
  if (!b) {
    b = document.createElement('span');
    b.id = 'admin-badge';
    b.className = 'admin-badge hidden';
    btn.appendChild(b);
  }
  return b;
}
function setEscalationBadge(n) {
  const b = ensureEscalationBadge();
  if (!b) return;
  b.textContent = n > 9 ? '9+' : String(n);
  b.title = n === 1 ? '1 open escalation' : `${n} open escalations`;
  b.classList.toggle('hidden', !(n > 0));
}
async function refreshEscalationBadge() {
  if (!(CURRENT_USER && CURRENT_USER.isTier4)) { setEscalationBadge(0); return; }
  try {
    const { open } = await API.getEscalationCount();
    setEscalationBadge(open);
  } catch { /* keep whatever it showed */ }
}
let escBadgeTimer = null;
function startEscalationBadgePolling() {
  if (escBadgeTimer) return;
  escBadgeTimer = setInterval(refreshEscalationBadge, 60000); // fallback; live updates arrive over the notify stream
}

// ── Moderation dialog (replaces the old prompt()/confirm() chain) ──
// Resolves { reason, hours } on confirm or null on cancel/Esc/backdrop.
const MOD_REASON_TEMPLATES = [
  'Spam', 'Harassment or bullying', 'Inappropriate content',
  'Cheating or exploiting', 'Impersonation', 'Evading a previous ban', 'Breaking site rules'
];
const MOD_DURATION_PRESETS = [
  { label: '1h', hours: 1 }, { label: '6h', hours: 6 }, { label: '24h', hours: 24 },
  { label: '3d', hours: 72 }, { label: '7d', hours: 168 }, { label: '30d', hours: 720 }
];

function openModerationModal(opts) {
  return new Promise(resolve => {
    let hours = opts.duration ? (opts.defaultHours || 24) : null;

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay mod-modal-overlay';
    const box = document.createElement('div');
    box.className = 'modal mod-modal';
    overlay.appendChild(box);

    const h2 = document.createElement('h2');
    h2.textContent = opts.title;
    box.appendChild(h2);
    if (opts.subtitle) {
      const sub = document.createElement('p');
      sub.className = 'modal-subtitle';
      sub.textContent = opts.subtitle;
      box.appendChild(sub);
    }

    const label = text => {
      const l = document.createElement('label');
      l.className = 'field-label';
      l.textContent = text;
      return l;
    };

    if (opts.duration) {
      box.appendChild(label('Duration'));
      const row = document.createElement('div');
      row.className = 'mod-chip-row';
      const custom = document.createElement('input');
      custom.type = 'number';
      custom.min = '1';
      custom.step = '1';
      custom.placeholder = 'Custom (hours)';
      custom.className = 'mod-custom-hours';
      const presetBtns = MOD_DURATION_PRESETS.map(p => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mod-chip' + (p.hours === hours ? ' selected' : '');
        b.textContent = p.label;
        b.addEventListener('click', () => {
          hours = p.hours;
          custom.value = '';
          presetBtns.forEach(x => x.classList.toggle('selected', x === b));
        });
        row.appendChild(b);
        return b;
      });
      custom.addEventListener('input', () => {
        const v = parseFloat(custom.value);
        hours = v > 0 ? v : null;
        presetBtns.forEach(x => x.classList.remove('selected'));
      });
      box.appendChild(row);
      box.appendChild(custom);
    }

    box.appendChild(label(opts.reasonLabel || 'Reason'));
    const textarea = document.createElement('textarea');
    textarea.rows = 3;
    textarea.maxLength = 300;
    textarea.placeholder = opts.reasonRequired ? 'Required' : 'Optional';
    if (opts.templates !== false) {
      const chips = document.createElement('div');
      chips.className = 'mod-chip-row';
      MOD_REASON_TEMPLATES.forEach(t => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = 'mod-chip';
        b.textContent = t;
        b.addEventListener('click', () => {
          // Templates stack ("Spam; Harassment or bullying"); clicking one
          // that's already in the box does nothing.
          const cur = textarea.value.trim();
          if (!cur) textarea.value = t;
          else if (!cur.includes(t)) textarea.value = (cur + '; ' + t).slice(0, 300);
          textarea.focus();
        });
        chips.appendChild(b);
      });
      box.appendChild(chips);
    }
    box.appendChild(textarea);
    if (opts.reasonHint) {
      const hint = document.createElement('p');
      hint.className = 'admin-hint';
      hint.textContent = opts.reasonHint;
      box.appendChild(hint);
    }

    const err = document.createElement('p');
    err.className = 'form-error hidden';
    box.appendChild(err);

    const actions = document.createElement('div');
    actions.className = 'mod-actions';
    const cancel = document.createElement('button');
    cancel.type = 'button';
    cancel.className = 'btn-ghost';
    cancel.textContent = 'Cancel';
    const confirmBtn = document.createElement('button');
    confirmBtn.type = 'button';
    confirmBtn.className = 'btn-primary' + (opts.danger ? ' mod-danger' : '');
    confirmBtn.textContent = opts.confirmLabel || 'Confirm';
    actions.appendChild(cancel);
    actions.appendChild(confirmBtn);
    box.appendChild(actions);

    function close(result) {
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
      resolve(result);
    }
    function submit() {
      const reason = textarea.value.trim();
      err.classList.add('hidden');
      if (opts.duration && !(hours > 0)) {
        err.textContent = 'Pick a duration or enter a positive number of hours.';
        err.classList.remove('hidden');
        return;
      }
      if (opts.reasonRequired && !reason) {
        err.textContent = 'Add a short reason first.';
        err.classList.remove('hidden');
        return;
      }
      close({ reason, hours });
    }
    function onKey(e) {
      if (e.key === 'Escape') { e.stopPropagation(); close(null); }
      else if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); submit(); }
    }

    cancel.addEventListener('click', () => close(null));
    confirmBtn.addEventListener('click', submit);
    overlay.addEventListener('click', e => { if (e.target === overlay) close(null); });
    document.addEventListener('keydown', onKey, true);

    document.body.appendChild(overlay);
    textarea.focus();
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
  if (target === document.body || target === document.documentElement) return;

  // The nav dock (Home / Games / Tools / etc.) is made entirely of <a>
  // links — drag it as one unit whenever the click lands anywhere
  // inside it, rather than grabbing whichever individual link/icon got
  // clicked.
  const dockEl = target.closest && target.closest('.dock');
  const el = dockEl || target;

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

// Registered on the *capture* phase so it runs before any link's
// navigation, any button's onclick, or any other listener on the page —
// while editing, nothing on the site should do its normal thing except
// our own toolbar. This is what actually stops "click a thing while
// dragging, get redirected" — preventDefault() on mousedown alone
// doesn't reliably stop the click's own default action.
function sealEditClickGuard(e) {
  if (!SEAL_EDIT_ACTIVE) return;
  if (e.target.closest && e.target.closest('.seal-customize-ui')) return;
  e.preventDefault();
  e.stopPropagation();
}

// Offsets are saved against a DOM path, so after the page's markup changes
// (a new button is added, a hidden one appears) an old saved offset can end
// up nudging a different element than the one that was originally dragged.
// These two buttons clear saved offsets so the layout snaps back to the
// stylesheet's. Nothing is published until "Save changes" is clicked.
function sealResetHeaderPositions() {
  const header = document.querySelector('.site-header');
  let cleared = 0;
  Object.keys(SEAL_CUSTOM_STATE.elements).forEach(key => {
    let el = null;
    try { el = document.querySelector(key); } catch { /* unresolvable selector — leave it */ }
    if (el && header && header.contains(el)) { delete SEAL_CUSTOM_STATE.elements[key]; cleared++; }
  });
  applySealCustomize(SEAL_CUSTOM_STATE);
  sealSetStatus(cleared
    ? `Header reset (${cleared} moved item${cleared === 1 ? '' : 's'} cleared) — click Save changes to publish it.`
    : 'Nothing in the header has been moved.');
}
function sealResetAllPositions() {
  const n = Object.keys(SEAL_CUSTOM_STATE.elements).length;
  if (n && !confirm(`Put all ${n} moved element${n === 1 ? '' : 's'} back in their original spots?`)) return;
  SEAL_CUSTOM_STATE.elements = {};
  applySealCustomize(SEAL_CUSTOM_STATE);
  sealSetStatus(n ? 'All positions reset — click Save changes to publish it.' : 'Nothing has been moved.');
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
    '<button type="button" id="seal-tb-reset-header-btn" title="Put the top bar buttons (Admin, Cloak, Sign out, etc.) back where they belong">Reset header</button>' +
    '<button type="button" id="seal-tb-reset-all-btn" title="Undo every moved element on the site">Reset all positions</button>' +
    '<button type="button" class="seal-tb-save" id="seal-tb-save-btn">Save changes</button>' +
    '<button type="button" class="seal-tb-exit" id="seal-tb-exit-btn">Exit</button>' +
    '<span class="seal-tb-status" id="seal-tb-status"></span>';
  document.body.appendChild(bar);
  $('seal-tb-color-btn').addEventListener('click', sealApplyColorBg);
  $('seal-tb-image-btn').addEventListener('click', sealApplyImageBg);
  $('seal-tb-clear-btn').addEventListener('click', sealClearBg);
  $('seal-tb-reset-header-btn').addEventListener('click', sealResetHeaderPositions);
  $('seal-tb-reset-all-btn').addEventListener('click', sealResetAllPositions);
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
  document.addEventListener('click', sealEditClickGuard, true);
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

// ── User Management (Tier 3 only) ──────────────────────────────────
// A searchable, sortable table of every account plus per-row actions:
// ban, temporarily suspend, mute (chat + guestbook), force sign-out
// everywhere, and set a new password for someone. Backend enforces all
// of this (this is just the UI for it) and refuses to ban/suspend a
// Tier 3 account.
let ADMIN_USERS_CACHE = [];
let ADMIN_USERS_SORT = { key: 'username', dir: 'asc' };
let ADMIN_USERS_FILTER = '';

function setupUserManagement() {
  const panel = $('tier3-panel');
  if (!panel || $('admin-users-search')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="admin-divider"></div>' +
    '<label class="field-label">User Management</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Search, sort, and moderate any account. Tier 3 admins can mute users and escalate problem users (including other Tier 3s) to a Tier 4 admin, who handles bans and suspensions. Tier 4 accounts can\u2019t be banned or suspended.</p>' +
    '<div id="admin-escalations" class="admin-escalations"></div>' +
    '<input type="text" id="admin-users-search" class="admin-users-search" placeholder="Search by username\u2026">' +
    '<div class="admin-users-table-wrap">' +
    '<table class="admin-users-table">' +
    '<thead><tr>' +
    '<th data-key="username">User</th>' +
    '<th data-key="isAdmin">Tier</th>' +
    '<th data-key="seals">Seals</th>' +
    '<th data-key="netWorth">Net worth</th>' +
    '<th data-key="createdAt">Joined</th>' +
    '<th data-key="status">Status</th>' +
    '<th>Actions</th>' +
    '</tr></thead>' +
    '<tbody id="admin-users-tbody"></tbody>' +
    '</table>' +
    '</div>';
  panel.appendChild(wrap);

  $('admin-users-search').addEventListener('input', e => {
    ADMIN_USERS_FILTER = e.target.value.trim().toLowerCase();
    renderAdminUsersTable();
  });
  wrap.querySelectorAll('th[data-key]').forEach(th => {
    th.addEventListener('click', () => {
      const key = th.dataset.key;
      if (ADMIN_USERS_SORT.key === key) {
        ADMIN_USERS_SORT.dir = ADMIN_USERS_SORT.dir === 'asc' ? 'desc' : 'asc';
      } else {
        ADMIN_USERS_SORT = { key, dir: 'asc' };
      }
      renderAdminUsersTable();
    });
  });
}

async function refreshAdminUsers() {
  try {
    ADMIN_USERS_CACHE = await API.getAdminUsers();
    renderAdminUsersTable();
    await refreshEscalations();
    if (CURRENT_USER && CURRENT_USER.isTier4) await refreshAuditLog();
  } catch { /* table just stays empty — the rest of the admin panel still works */ }
}

function adminUserStatusLabel(u) {
  if (u.banned) return 'banned';
  if (u.suspendedUntil && new Date(u.suspendedUntil).getTime() > Date.now()) return 'suspended';
  if (u.muted) return 'muted';
  return 'active';
}
function adminUserSortValue(u, key) {
  if (key === 'isAdmin') return (u.isOverseer ? 5 : u.isTier4 ? 4 : u.isTier3 ? 3 : u.isTier1 ? 2 : u.isTier2 ? 1 : 0);
  if (key === 'status') return adminUserStatusLabel(u);
  if (key === 'createdAt') return u.createdAt || '';
  return u[key];
}

function renderAdminUsersTable() {
  const tbody = $('admin-users-tbody');
  if (!tbody) return;

  let rows = ADMIN_USERS_CACHE.filter(u => !ADMIN_USERS_FILTER || u.username.toLowerCase().includes(ADMIN_USERS_FILTER));
  const { key, dir } = ADMIN_USERS_SORT;
  rows = rows.slice().sort((a, b) => {
    const av = adminUserSortValue(a, key), bv = adminUserSortValue(b, key);
    const cmp = typeof av === 'number' ? av - bv : String(av).localeCompare(String(bv));
    return dir === 'asc' ? cmp : -cmp;
  });

  document.querySelectorAll('.admin-users-table th[data-key]').forEach(th => {
    th.classList.toggle('sorted', th.dataset.key === key);
    th.dataset.dir = dir === 'asc' ? '\u2191' : '\u2193';
  });

  tbody.innerHTML = rows.map(u => {
    const tierClass = sealTierClassFor(u);
    const status = adminUserStatusLabel(u);
    const joined = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : '\u2014';
    const viewerIsTier4 = !!(CURRENT_USER && CURRENT_USER.isTier4);
    const viewerIsOverseer = !!(CURRENT_USER && CURRENT_USER.isOverseer);
    const tierLabel = u.isOverseer ? 'Overseer' : u.isTier4 ? 'Tier 4' : u.isTier3 ? 'Tier 3' : u.isTier1 ? 'Tier 1' : u.isTier2 ? 'Tier 2' : '\u2014';

    const actions = [];
    const btn = (action, label, cls) => `<button type="button"${cls ? ` class="${cls}"` : ''} data-action="${action}" data-user="${escapeAdminAttr(u.username)}">${label}</button>`;
    // Bans and suspensions are Tier 4 only; Tier 3 escalates instead
    // (and can escalate another Tier 3 too). Banning/suspending a Tier 4
    // takes an Overseer, and nobody can ban or suspend an Overseer.
    const isSelf = !!(CURRENT_USER && CURRENT_USER.username && CURRENT_USER.username.toLowerCase() === u.username.toLowerCase());
    const canModerate = viewerIsTier4 && !u.isOverseer && (!u.isTier4 || viewerIsOverseer);
    if (canModerate) {
      actions.push(u.banned ? btn('unban', 'Unban') : btn('ban', 'Ban', 'danger'));
      actions.push(status === 'suspended' ? btn('unsuspend', 'Unsuspend') : btn('suspend', 'Suspend'));
    } else if (!viewerIsTier4 && !u.isTier4 && !u.banned && !isSelf) {
      if (u.escalated) actions.push('<span class="esc-status">Escalated</span>');
      else {
        actions.push(btn('escalate-suspend', 'Escalate suspension'));
        actions.push(btn('escalate-ban', 'Escalate ban'));
      }
    }
    if (isSelf || !u.isTier4 || viewerIsOverseer) {
      actions.push(u.muted ? btn('unmute', 'Unmute') : btn('mute', 'Mute'));
      actions.push(btn('force-logout', 'Force logout'));
      actions.push(btn('reset-password', 'Reset password'));
    }

    return `<tr>
      <td class="${tierClass}">${escapeAdminHtml(u.username)}</td>
      <td>${tierLabel}</td>
      <td>${u.seals}</td>
      <td>${u.netWorth}</td>
      <td>${joined}</td>
      <td><span class="admin-status-badge ${status}">${status}</span></td>
      <td><div class="admin-users-actions">${actions.join('')}</div></td>
    </tr>`;
  }).join('');

  tbody.querySelectorAll('button[data-action]').forEach(btn => {
    btn.addEventListener('click', () => handleAdminUserAction(btn.dataset.action, btn.dataset.user));
  });
}

function escapeAdminHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function escapeAdminAttr(s) { return escapeAdminHtml(s); }

async function handleAdminUserAction(action, username) {
  try {
    if (action === 'ban') {
      const res = await openModerationModal({
        title: `Ban ${username}`,
        subtitle: 'They\u2019ll be signed out everywhere and can\u2019t log back in.',
        reasonHint: 'Shown to them when they try to log in.',
        confirmLabel: 'Ban', danger: true
      });
      if (!res) return;
      await API.banUser(username, res.reason);
    } else if (action === 'escalate-ban' || action === 'escalate-suspend') {
      const kind = action === 'escalate-ban' ? 'ban' : 'suspension';
      const res = await openModerationModal({
        title: `Escalate ${username} for a ${kind}`,
        subtitle: 'A Tier 4 admin will review this.',
        reasonLabel: 'Why?', reasonRequired: true,
        reasonHint: 'Briefly describe what they did \u2014 Tier 4 sees this.',
        confirmLabel: 'Escalate'
      });
      if (!res) return;
      await API.escalateUser(username, res.reason, action === 'escalate-ban' ? 'ban' : 'suspend');
      quickToast(`${username} was escalated to Tier 4 for a ${kind}.`);
    } else if (action === 'unban') {
      await API.unbanUser(username);
    } else if (action === 'suspend') {
      const res = await openModerationModal({
        title: `Suspend ${username}`,
        subtitle: 'They\u2019ll be signed out now and can sign back in when it ends.',
        duration: true, defaultHours: 24,
        reasonHint: 'Shown to them when they try to log in.',
        confirmLabel: 'Suspend'
      });
      if (!res) return;
      await API.suspendUser(username, res.reason, res.hours);
    } else if (action === 'unsuspend') {
      await API.unsuspendUser(username);
    } else if (action === 'mute') {
      const res = await openModerationModal({
        title: `Mute ${username}`,
        subtitle: 'They can\u2019t post in chat or the guestbook until unmuted.',
        confirmLabel: 'Mute'
      });
      if (!res) return;
      await API.muteUser(username, res.reason);
    } else if (action === 'unmute') {
      await API.unmuteUser(username);
    } else if (action === 'force-logout') {
      if (!confirm(`Sign ${username} out everywhere right now?`)) return;
      await API.forceLogoutUser(username);
    } else if (action === 'reset-password') {
      const newPassword = prompt(`New password for ${username} (min 6 characters):`, '');
      if (!newPassword) return;
      await API.resetUserPassword(username, newPassword);
      alert(`Password updated for ${username}. They've been signed out everywhere and will need the new password next time.`);
    }
    await refreshAdminUsers();
  } catch (ex) {
    alert(ex.message);
  }
}

// Escalation queue. Tier 4 sees every open escalation with Ban / Dismiss;
// Tier 3 sees the status of the ones they filed.
async function refreshEscalations() {
  const box = $('admin-escalations');
  if (!box) return;
  let list = [];
  try { list = await API.getEscalations(); } catch { box.innerHTML = ''; return; }
  const isT4 = !!(CURRENT_USER && CURRENT_USER.isTier4);
  if (isT4) setEscalationBadge(list.filter(e => e.status === 'open').length);
  const shown = isT4 ? list.filter(e => e.status === 'open') : list.slice(0, 10);
  if (!shown.length) {
    box.innerHTML = isT4 ? '<p class="modal-subtitle">No open escalations.</p>' : '';
    return;
  }
  box.innerHTML = '<label class="field-label">' + (isT4 ? 'Escalations' : 'Your escalations') + '</label>' + shown.map(e => `
    <div class="admin-escalation">
      <div class="esc-head"><b>${escapeAdminHtml(e.target)}</b> \u2014 by ${escapeAdminHtml(e.escalatedBy)} \u00b7 ${new Date(e.createdAt).toLocaleString()} \u00b7 <span class="esc-status">${escapeAdminHtml(e.status)}</span> \u00b7 requests: <b>${e.action === 'suspend' ? 'suspension' : 'ban'}</b></div>
      <div class="esc-reason">${escapeAdminHtml(e.reason)}</div>
      ${isT4 && e.status === 'open' ? `<div class="admin-users-actions">
        <button type="button" class="danger" data-esc-action="ban" data-user="${escapeAdminAttr(e.target)}">Ban</button>
        <button type="button" data-esc-action="suspend" data-user="${escapeAdminAttr(e.target)}">Suspend</button>
        <button type="button" data-esc-action="dismiss" data-id="${escapeAdminAttr(e.id)}">Dismiss</button>
      </div>` : ''}
    </div>`).join('');
  box.querySelectorAll('button[data-esc-action]').forEach(b => {
    b.addEventListener('click', async () => {
      try {
        if (b.dataset.escAction === 'ban' || b.dataset.escAction === 'suspend') {
          await handleAdminUserAction(b.dataset.escAction, b.dataset.user);
          return;
        }
        const res = await openModerationModal({
          title: 'Dismiss escalation',
          subtitle: 'The Tier 3 who filed it will be told it was dismissed.',
          reasonLabel: 'Note (optional)', templates: false,
          confirmLabel: 'Dismiss'
        });
        if (!res) return;
        await API.dismissEscalation(b.dataset.id, res.reason);
        await refreshAdminUsers();
      } catch (ex) { alert(ex.message); }
    });
  });
}

// ── Overseer tools: maintenance lockout + site polls ───────────────
function setupOverseerTools() {
  const panel = $('tier3-panel');
  if (!panel || $('maintenance-toggle')) return;
  OVERSEER_READY = true;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Overseer \u2014 Maintenance mode</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Locks everyone out of the site except Overseers (you always get in). Locked-out visitors see your message and the page reloads itself when you switch it off.</p>' +
    '<div class="overseer-box">' +
    '<div class="overseer-status" id="maintenance-status">Loading\u2026</div>' +
    '<textarea id="maintenance-message" rows="2" maxlength="300" placeholder="Message shown to visitors (e.g. Back in about 20 minutes)"></textarea>' +
    '<label class="overseer-check"><input type="checkbox" id="maintenance-tier4"> Let Tier 4 admins stay in too</label>' +
    '<p class="form-error hidden" id="maintenance-error"></p>' +
    '<button class="btn-primary" style="width:auto;" id="maintenance-toggle" type="button">Enable maintenance</button>' +
    '</div>' +
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Overseer \u2014 Site polls</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Signed-in users get a pop-up with the poll; one vote per account.</p>' +
    '<div class="overseer-box">' +
    '<input type="text" id="poll-question" maxlength="200" placeholder="Question" style="margin-bottom:8px;">' +
    '<div id="poll-option-inputs"></div>' +
    '<div class="overseer-row">' +
    '<button class="btn-ghost" style="width:auto;" id="poll-add-option" type="button">+ Add option</button>' +
    '<input type="number" id="poll-hours" min="1" max="2160" placeholder="Closes after (hours, optional)">' +
    '</div>' +
    '<p class="form-error hidden" id="poll-error"></p>' +
    '<button class="btn-primary" style="width:auto;" id="poll-create" type="button">Create poll</button>' +
    '</div>' +
    '<div id="overseer-polls-list"></div>';
  panel.appendChild(wrap);

  const optBox = $('poll-option-inputs');
  const addOption = () => {
    if (optBox.children.length >= 8) return;
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.maxLength = 80;
    inp.placeholder = 'Option ' + (optBox.children.length + 1);
    inp.style.marginBottom = '6px';
    optBox.appendChild(inp);
  };
  addOption(); addOption();
  $('poll-add-option').addEventListener('click', addOption);
  $('poll-create').addEventListener('click', createPollFromForm);
  $('maintenance-toggle').addEventListener('click', toggleMaintenance);
}

let MAINTENANCE_STATE = { enabled: false };
async function refreshMaintenance() {
  const status = $('maintenance-status');
  if (!status) return;
  try {
    MAINTENANCE_STATE = await API.getMaintenance();
    const m = MAINTENANCE_STATE;
    status.classList.toggle('on', m.enabled);
    status.textContent = m.enabled
      ? `\u{1F6A7} ON \u2014 since ${new Date(m.startedAt).toLocaleString()} by ${m.startedBy}` + (m.forcedOff ? ' (currently overridden by DISABLE_MAINTENANCE)' : '')
      : 'Off \u2014 the site is open to everyone.';
    $('maintenance-message').value = m.message || '';
    $('maintenance-tier4').checked = !!m.exemptTier4;
    $('maintenance-toggle').textContent = m.enabled ? 'Update message / settings' : 'Enable maintenance';
    $('maintenance-toggle').classList.remove('btn-danger-solid');
    // A second button for turning it off only appears while it's on.
    let off = $('maintenance-off');
    if (m.enabled && !off) {
      off = document.createElement('button');
      off.id = 'maintenance-off';
      off.type = 'button';
      off.className = 'btn-ghost';
      off.style.cssText = 'width:auto;margin-left:8px;';
      off.textContent = 'Disable maintenance';
      off.addEventListener('click', () => applyMaintenance(false));
      $('maintenance-toggle').after(off);
    } else if (!m.enabled && off) off.remove();
  } catch { status.textContent = 'Couldn\u2019t load maintenance state.'; }
}
function toggleMaintenance() {
  if (!MAINTENANCE_STATE.enabled) {
    const t4 = $('maintenance-tier4').checked;
    const who = t4 ? 'everyone except Overseers and Tier 4 admins' : 'everyone except Overseers';
    if (!confirm(`Lock out ${who} right now? Anyone on the site will be sent to the maintenance page immediately.`)) return;
  }
  applyMaintenance(true);
}
async function applyMaintenance(enabled) {
  const err = $('maintenance-error');
  err.classList.add('hidden');
  try {
    await API.setMaintenance(enabled, $('maintenance-message').value, $('maintenance-tier4').checked);
    await refreshMaintenance();
    if (typeof refreshAuditLog === 'function') refreshAuditLog();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
}

async function createPollFromForm() {
  const err = $('poll-error');
  err.classList.add('hidden');
  const options = [...$('poll-option-inputs').querySelectorAll('input')].map(i => i.value.trim()).filter(Boolean);
  const hours = $('poll-hours').value.trim();
  try {
    await API.createPoll($('poll-question').value.trim(), options, hours ? Number(hours) : null);
    $('poll-question').value = '';
    $('poll-hours').value = '';
    $('poll-option-inputs').querySelectorAll('input').forEach(i => { i.value = ''; });
    await refreshOverseerPolls();
    if (typeof refreshAuditLog === 'function') refreshAuditLog();
  } catch (ex) { err.textContent = ex.message; err.classList.remove('hidden'); }
}

async function refreshOverseerPolls() {
  const listEl = $('overseer-polls-list');
  if (!listEl) return;
  let polls = [];
  try { polls = await API.getOverseerPolls(); } catch { return; }
  listEl.textContent = '';
  if (!polls.length) {
    const p = document.createElement('p');
    p.className = 'admin-hint';
    p.textContent = 'No polls yet.';
    listEl.appendChild(p);
    return;
  }
  polls.forEach(poll => {
    const item = document.createElement('div');
    item.className = 'poll-admin-item';
    const head = document.createElement('div');
    head.className = 'poll-admin-head';
    head.textContent = poll.question;
    const sub = document.createElement('div');
    sub.className = 'poll-admin-sub';
    sub.textContent = `${poll.closed ? 'Closed' : 'Open'} \u00b7 ${poll.totalVotes} vote${poll.totalVotes === 1 ? '' : 's'} \u00b7 by ${poll.createdBy}` +
      (!poll.closed && poll.closesAt ? ` \u00b7 closes ${new Date(poll.closesAt).toLocaleString()}` : '');
    item.appendChild(head);
    item.appendChild(sub);
    renderPollResults(item, poll);
    const actions = document.createElement('div');
    actions.className = 'admin-users-actions';
    if (!poll.closed) {
      const close = document.createElement('button');
      close.type = 'button';
      close.textContent = 'Close poll';
      close.addEventListener('click', async () => {
        try { await API.closePoll(poll.id); await refreshOverseerPolls(); refreshAuditLog && refreshAuditLog(); } catch (ex) { alert(ex.message); }
      });
      actions.appendChild(close);
    }
    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger';
    del.textContent = 'Delete';
    del.addEventListener('click', async () => {
      if (!confirm('Delete this poll and its votes?')) return;
      try { await API.deletePoll(poll.id); await refreshOverseerPolls(); refreshAuditLog && refreshAuditLog(); } catch (ex) { alert(ex.message); }
    });
    actions.appendChild(del);
    item.appendChild(actions);
    listEl.appendChild(item);
  });
}

// ── Tier 4 tools: in-app Tier 3 management + audit log ─────────────
function setupTier4Tools() {
  const panel = $('tier3-panel');
  if (!panel || $('tier3-grant-username')) return;
  const wrap = document.createElement('div');
  wrap.innerHTML =
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Tier 3 Admins</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Tier 4 only. Grant or revoke Tier 3 here without a redeploy. Admins marked \u201cowner\u201d come from ADMIN_USERNAMES / admins.json and can only be removed there.</p>' +
    '<div class="banner-row">' +
    '<input type="text" id="tier3-grant-username" placeholder="Username" style="flex:1">' +
    '<button class="btn-primary" style="width:auto;" id="tier3-grant-btn">Grant</button>' +
    '</div>' +
    '<p class="form-error hidden" id="tier3-grant-error" style="margin-bottom:10px;"></p>' +
    '<div id="tier3-admins-list" class="granted-user-list"></div>' +
    '<div class="admin-divider"></div>' +
    '<label class="field-label">Audit Log</label>' +
    '<p class="modal-subtitle" style="margin-bottom:12px;">Every moderation and permission action, newest first (latest 200).</p>' +
    '<div class="banner-row">' +
    '<input type="text" id="audit-log-search" class="admin-users-search" placeholder="Filter by who, action, target\u2026" style="flex:1;margin-bottom:0;">' +
    '<button class="btn-primary" style="width:auto;" id="audit-log-refresh">Refresh</button>' +
    '</div>' +
    '<div class="admin-users-table-wrap" style="margin-top:10px;">' +
    '<table class="admin-users-table"><thead><tr>' +
    '<th>When</th><th>Who</th><th>Action</th><th>Target</th><th>Details</th>' +
    '</tr></thead><tbody id="audit-log-tbody"></tbody></table>' +
    '</div>';
  panel.appendChild(wrap);

  $('tier3-grant-btn').addEventListener('click', grantTier3Admin);
  $('tier3-grant-username').addEventListener('keydown', e => { if (e.key === 'Enter') grantTier3Admin(); });
  $('audit-log-refresh').addEventListener('click', refreshAuditLog);
  let auditTimer = null;
  $('audit-log-search').addEventListener('input', () => {
    clearTimeout(auditTimer);
    auditTimer = setTimeout(refreshAuditLog, 250);
  });
}

async function refreshTier3Admins() {
  const listEl = $('tier3-admins-list');
  if (!listEl) return;
  try {
    const { granted, configured } = await API.getTier3Admins();
    listEl.innerHTML = '';
    const grantedLower = new Set(granted.map(u => u.toLowerCase()));
    const ownerOnly = configured.filter(u => !grantedLower.has(u.toLowerCase()));
    if (!granted.length && !ownerOnly.length) {
      listEl.innerHTML = '<p class="admin-hint">No Tier 3 admins yet.</p>';
      return;
    }
    granted.forEach(u => {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      const name = document.createElement('span');
      name.textContent = u;
      const revoke = document.createElement('button');
      revoke.className = 'chip-btn';
      revoke.textContent = 'Revoke';
      revoke.addEventListener('click', async () => {
        if (!confirm(`Remove Tier 3 from ${u}?`)) return;
        try { await API.revokeTier3Admin(u); await refreshTier3Admins(); await refreshAdminUsers(); }
        catch (ex) { alert(ex.message); }
      });
      row.appendChild(name);
      row.appendChild(revoke);
      listEl.appendChild(row);
    });
    ownerOnly.forEach(u => {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      const name = document.createElement('span');
      name.textContent = u;
      const tag = document.createElement('span');
      tag.className = 'owner-tag';
      tag.textContent = 'owner';
      row.appendChild(name);
      row.appendChild(tag);
      listEl.appendChild(row);
    });
  } catch {
    listEl.textContent = 'Couldn\u2019t load the list.';
  }
}

async function grantTier3Admin() {
  const input = $('tier3-grant-username');
  const err = $('tier3-grant-error');
  err.classList.add('hidden');
  const username = input.value.trim();
  if (!username) return;
  try {
    await API.grantTier3Admin(username);
    input.value = '';
    await refreshTier3Admins();
    await refreshAdminUsers();
  } catch (ex) {
    err.textContent = ex.message;
    err.classList.remove('hidden');
  }
}

async function refreshAuditLog() {
  const tbody = $('audit-log-tbody');
  if (!tbody) return;
  const search = $('audit-log-search');
  try {
    const rows = await API.getAuditLog(search ? search.value.trim() : '');
    tbody.innerHTML = rows.length ? rows.map(e => `<tr>
      <td>${new Date(e.at).toLocaleString()}</td>
      <td>${escapeAdminHtml(e.actor || '\u2014')}</td>
      <td>${escapeAdminHtml(e.action)}</td>
      <td>${escapeAdminHtml(e.target || '\u2014')}</td>
      <td class="audit-detail">${escapeAdminHtml(e.detail || '')}</td>
    </tr>`).join('') : '<tr><td colspan="5">Nothing logged yet.</td></tr>';
  } catch { /* leave the table as-is */ }
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
  refreshPolls();
}