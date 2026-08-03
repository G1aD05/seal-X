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
    ensureSettingsButton();
  } else {
    $('user-info').classList.add('hidden');
    $('auth-btn').classList.remove('hidden');
  }

  document.dispatchEvent(new CustomEvent('seal:user-ready', { detail: CURRENT_USER }));
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
}