/* ============================================================
   ScreenLink UI — client for server/screenlink-server.js
   ============================================================
   Two independent Socket.IO connections to this same origin:
     hostSocket   — this tab acting as a host (receives commands)
     viewerSocket — this tab acting as a viewer (sends commands)
   Protocol is documented at the top of screenlink-server.js.
   Nothing here talks to any other ScreenLink deployment.
*/
(function () {
  'use strict';

  function $(id) { return document.getElementById(id); }
  function pad2(n) { return String(n).padStart(2, '0'); }
  function nowStamp() {
    const d = new Date();
    return pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds());
  }
  function randomId() {
    if (window.crypto && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  async function sha256Hex(text) {
    if (!text) return '';
    if (!(window.crypto && crypto.subtle)) return text; // best-effort fallback (e.g. non-secure context)
    const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
    return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
  }

  // Binary-safe, chunk-friendly base64 (avoids blowing the call stack on
  // large typed arrays via a naive String.fromCharCode(...bytes) spread).
  function bytesToBase64(bytes) {
    let binary = '';
    const CHUNK = 0x8000;
    for (let i = 0; i < bytes.length; i += CHUNK) {
      binary += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(binary);
  }
  function base64ToBytes(b64) {
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
    return bytes;
  }

  const CHUNK_BYTES = 16 * 1024;

  function log(containerId, text, cls) {
    const el = $(containerId);
    if (!el) return;
    const empty = el.querySelector('.sl-log-empty');
    if (empty) empty.remove();
    const row = document.createElement('div');
    row.className = 'sl-log-row' + (cls ? ' ' + cls : '');
    row.innerHTML = '<span class="sl-log-time">' + nowStamp() + '</span>';
    row.appendChild(document.createTextNode(text));
    el.appendChild(row);
    // cap log length so it can't grow forever in a long session
    while (el.children.length > 80) el.removeChild(el.firstChild);
  }

  function setHidden(id, hidden) {
    const el = $(id);
    if (el) el.classList.toggle('hidden', !!hidden);
  }

  // ============================================================
  // HOST
  // ============================================================
  const Host = {
    socket: null,
    code: null,
    sessionId: null,
    autorun: true,
    tabs: new Map(),     // tabId -> window reference
    tabWatchers: new Map(), // tabId -> interval id
    sound: { audio: null, chunks: [], total: 0, mimeType: null },
    file: { chunks: [], total: 0, name: null, mimeType: null, size: 0 },
    viewers: new Set(),
  };

  function hostLog(text, cls) { log('sl-host-log', text, cls); }

  function ensureHostSocket() {
    if (Host.socket) return Host.socket;
    const socket = window.io();
    Host.socket = socket;

    socket.on('connect', () => {
      const saved = loadHostSession();
      if (saved && saved.sessionId && !Host.code) {
        socket.emit('host:join', { sessionId: saved.sessionId });
      }
    });

    socket.on('host:code', (payload) => {
      const { code, sessionId, hasPassword } = payload || {};
      Host.code = code;
      Host.sessionId = sessionId;
      saveHostSession(sessionId);
      $('sl-host-code').textContent = code;
      setHidden('sl-host-idle', true);
      setHidden('sl-host-active', false);
      hostLog('Hosting started. Code ' + code + (hasPassword ? ' (password protected)' : '') + '.');
      updateHostStatusLine();
    });

    socket.on('session:expired', () => {
      clearHostSession();
      hostLog('Session expired.', 'sl-log-action');
      resetHostUI();
    });

    socket.on('viewer:joined', ({ viewerId }) => {
      Host.viewers.add(viewerId);
      renderHostViewers();
      updateHostStatusLine();
      hostLog('Viewer connected (' + viewerId.slice(0, 6) + ').');
    });
    socket.on('viewer:left', ({ viewerId }) => {
      Host.viewers.delete(viewerId);
      renderHostViewers();
      updateHostStatusLine();
      hostLog('Viewer disconnected (' + viewerId.slice(0, 6) + ').');
    });

    socket.on('cmd:open-url', (payload) => {
      hostLog('Open URL requested: ' + payload.url + (payload.mode ? ' (' + payload.mode + ')' : ''));
      if (Host.autorun) executeOpenUrl(payload);
    });
    socket.on('cmd:close-tab', ({ tabId }) => {
      hostLog('Close tab requested.');
      executeCloseTab(tabId);
    });

    socket.on('cmd:input', (payload) => {
      hostLog('Input: ' + describeInput(payload));
      if (Host.autorun) executeInput(payload);
    });

    socket.on('cmd:sound-start', (payload) => {
      Host.sound = { audio: null, chunks: new Array(payload.totalChunks || 0), total: payload.totalChunks || 0, mimeType: payload.mimeType, volume: payload.volume || 1, received: 0 };
      hostLog('Incoming sound…');
    });
    socket.on('cmd:sound-chunk', ({ chunk, index }) => {
      if (!Host.sound.chunks) return;
      Host.sound.chunks[index] = base64ToBytes(chunk);
      Host.sound.received = (Host.sound.received || 0) + 1;
    });
    socket.on('cmd:sound-end', () => {
      if (!Host.sound.chunks) return;
      hostLog('Sound received' + (Host.autorun ? ', playing…' : ' (auto-run off, not played).'));
      if (Host.autorun) playReceivedSound();
    });
    socket.on('cmd:stop-sound', () => {
      stopHostSound();
      hostLog('Stop sound requested.');
    });

    socket.on('cmd:file-start', (payload) => {
      Host.file = { chunks: new Array(payload.totalChunks || 0), total: payload.totalChunks || 0, name: payload.name || 'file', mimeType: payload.mimeType || 'application/octet-stream', size: payload.size || 0 };
      hostLog('Incoming file: ' + Host.file.name);
    });
    socket.on('cmd:file-chunk', ({ chunk, index }) => {
      if (!Host.file.chunks) return;
      Host.file.chunks[index] = base64ToBytes(chunk);
    });
    socket.on('cmd:file-end', () => {
      if (!Host.file.chunks) return;
      const name = Host.file.name;
      if (Host.autorun) {
        downloadReceivedFile();
        hostLog('File saved: ' + name, 'sl-log-action');
      } else {
        hostLog('File fully received (auto-run off, not saved): ' + name);
      }
      socket.emit('host:file-received', { name });
    });

    socket.on('disconnect', () => {
      hostLog('Disconnected from server.');
    });

    return socket;
  }

  function describeInput(payload) {
    if (!payload) return '(empty)';
    if (payload.key !== undefined) return 'key "' + payload.key + '"';
    if (payload.value !== undefined) return 'text "' + String(payload.value).slice(0, 60) + '"';
    try { return JSON.stringify(payload).slice(0, 80); } catch { return '(unreadable)'; }
  }

  function executeOpenUrl(payload) {
    const tabId = randomId();
    let win = null;
    if (payload.mode === 'popup') {
      const w = payload.width || 480, h = payload.height || 360;
      const left = payload.left != null ? payload.left : Math.max(0, (screen.width - w) / 2);
      const top = payload.top != null ? payload.top : Math.max(0, (screen.height - h) / 2);
      win = window.open(payload.url, payload.windowTarget || '_blank', 'popup=yes,width=' + w + ',height=' + h + ',left=' + left + ',top=' + top);
    } else {
      win = window.open(payload.url, payload.windowTarget || '_blank');
    }
    if (!win) {
      hostLog('Could not open tab (likely blocked by the browser).', 'sl-log-action');
      return;
    }
    Host.tabs.set(tabId, win);
    const watcher = setInterval(() => {
      if (win.closed) {
        clearInterval(watcher);
        Host.tabWatchers.delete(tabId);
        if (Host.tabs.has(tabId)) {
          Host.tabs.delete(tabId);
          Host.socket.emit('host:tab-closed', { tabId });
        }
      }
    }, 1000);
    Host.tabWatchers.set(tabId, watcher);
    Host.socket.emit('host:tab-opened', { tabId, url: payload.url, mode: payload.mode || 'tab' });
    hostLog('Opened: ' + payload.url, 'sl-log-action');
  }

  function executeCloseTab(tabId) {
    const win = Host.tabs.get(tabId);
    if (win && !win.closed) win.close();
    Host.tabs.delete(tabId);
    const watcher = Host.tabWatchers.get(tabId);
    if (watcher) { clearInterval(watcher); Host.tabWatchers.delete(tabId); }
    Host.socket.emit('host:tab-closed', { tabId });
  }

  function executeInput(payload) {
    if (!payload) return;
    if (payload.key !== undefined) {
      const opts = { key: payload.key, bubbles: true, cancelable: true };
      document.dispatchEvent(new KeyboardEvent('keydown', opts));
      document.dispatchEvent(new KeyboardEvent('keyup', opts));
    }
    // Free-text input has no safe generic target to type into, so it's
    // surfaced in the activity log above rather than synthesized.
  }

  function playReceivedSound() {
    try {
      const bytes = concatChunks(Host.sound.chunks);
      const blob = new Blob([bytes], { type: Host.sound.mimeType || 'audio/webm' });
      const url = URL.createObjectURL(blob);
      stopHostSound();
      const audio = new Audio(url);
      audio.volume = Math.min(1, Math.max(0, Host.sound.volume || 1));
      Host.sound.audio = audio;
      audio.addEventListener('timeupdate', () => {
        Host.socket.emit('host:sound-progress', { current: audio.currentTime, duration: audio.duration || 0 });
      });
      audio.addEventListener('ended', () => {
        Host.socket.emit('host:sound-ended');
        URL.revokeObjectURL(url);
      });
      audio.play().catch((e) => hostLog('Could not play sound: ' + e.message));
    } catch (e) {
      hostLog('Could not assemble sound: ' + e.message);
    }
  }

  function stopHostSound() {
    if (Host.sound.audio) {
      try { Host.sound.audio.pause(); } catch {}
      Host.sound.audio = null;
    }
  }

  function downloadReceivedFile() {
    try {
      const bytes = concatChunks(Host.file.chunks);
      const blob = new Blob([bytes], { type: Host.file.mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = Host.file.name || 'file';
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10000);
    } catch (e) {
      hostLog('Could not save file: ' + e.message);
    }
  }

  function concatChunks(chunks) {
    let total = 0;
    for (const c of chunks) if (c) total += c.length;
    const out = new Uint8Array(total);
    let offset = 0;
    for (const c of chunks) { if (!c) continue; out.set(c, offset); offset += c.length; }
    return out;
  }

  function renderHostViewers() {
    const list = $('sl-host-viewer-list');
    $('sl-host-viewer-count').textContent = String(Host.viewers.size);
    if (!Host.viewers.size) { list.innerHTML = '<p class="sl-empty">No one connected yet.</p>'; return; }
    list.innerHTML = '';
    for (const id of Host.viewers) {
      const row = document.createElement('div');
      row.className = 'granted-user-row';
      row.textContent = 'Viewer ' + id.slice(0, 6);
      list.appendChild(row);
    }
  }

  function updateHostStatusLine() {
    const dot = $('sl-host-dot');
    const text = $('sl-host-status-text');
    if (Host.viewers.size > 0) {
      dot.classList.add('on'); dot.classList.remove('off');
      text.textContent = Host.viewers.size === 1 ? '1 viewer connected' : Host.viewers.size + ' viewers connected';
    } else {
      dot.classList.remove('on', 'off');
      text.textContent = 'Waiting for a viewer…';
    }
  }

  function resetHostUI() {
    Host.code = null; Host.sessionId = null; Host.viewers.clear();
    for (const [, win] of Host.tabs) { try { if (!win.closed) win.close(); } catch {} }
    Host.tabs.clear();
    for (const [, w] of Host.tabWatchers) clearInterval(w);
    Host.tabWatchers.clear();
    stopHostSound();
    setHidden('sl-host-idle', false);
    setHidden('sl-host-active', true);
  }

  function saveHostSession(sessionId) {
    try { localStorage.setItem('screenlink_host_session', sessionId); } catch {}
  }
  function loadHostSession() {
    try {
      const sessionId = localStorage.getItem('screenlink_host_session');
      return sessionId ? { sessionId } : null;
    } catch { return null; }
  }
  function clearHostSession() {
    try { localStorage.removeItem('screenlink_host_session'); } catch {}
  }

  function wireHostControls() {
    $('sl-host-start').addEventListener('click', async () => {
      const pass = $('sl-host-pass').value;
      const passwordHash = pass ? await sha256Hex(pass) : null;
      const socket = ensureHostSocket();
      if (socket.connected) socket.emit('host:create', { passwordHash });
      else socket.once('connect', () => socket.emit('host:create', { passwordHash }));
    });

    $('sl-host-copy').addEventListener('click', async () => {
      const code = $('sl-host-code').textContent;
      try { await navigator.clipboard.writeText(code); hostLog('Code copied.'); }
      catch { /* clipboard may be unavailable; code is still visible on screen */ }
    });

    $('sl-host-apply').addEventListener('click', () => {
      if (!Host.socket) return;
      const names = $('sl-host-allow').value.split(/[,\n]/).map((s) => s.trim()).filter(Boolean);
      Host.socket.emit('host:set-restrictions', { allowedViewers: names });
      const isPublic = $('sl-host-public').checked;
      const label = $('sl-host-label').value;
      Host.socket.emit('host:set-public', { isPublic, label });
      hostLog('Access settings applied.');
    });

    $('sl-host-public').addEventListener('change', () => {
      if (!Host.socket || !Host.code) return;
      Host.socket.emit('host:set-public', { isPublic: $('sl-host-public').checked, label: $('sl-host-label').value });
    });

    $('sl-host-refresh').addEventListener('click', () => {
      if (!Host.socket) return;
      Host.socket.emit('host:refresh');
    });

    $('sl-host-autorun').addEventListener('change', () => {
      Host.autorun = $('sl-host-autorun').checked;
    });

    $('sl-host-send-info').addEventListener('click', () => {
      if (!Host.socket) return;
      const message = $('sl-host-info').value.trim();
      if (!message) return;
      Host.socket.emit('host:info', { message });
      hostLog('Status sent to viewers: "' + message + '"');
      $('sl-host-info').value = '';
    });

    $('sl-host-stop').addEventListener('click', () => {
      if (Host.socket) { Host.socket.disconnect(); Host.socket = null; }
      clearHostSession();
      resetHostUI();
    });
  }

  // ============================================================
  // VIEWER
  // ============================================================
  const Viewer = {
    socket: null,
    hostId: null,
    joined: false,
    tabs: new Map(), // tabId -> {url, mode}
  };

  function viewerLog(text, cls) { log('sl-viewer-log', text, cls); }

  function ensureViewerSocket() {
    if (Viewer.socket) return Viewer.socket;
    const socket = window.io();
    Viewer.socket = socket;

    socket.on('viewer:ok', ({ hostId }) => {
      Viewer.hostId = hostId;
      Viewer.joined = true;
      setHidden('sl-viewer-idle', true);
      setHidden('sl-viewer-active', false);
      setHidden('sl-viewer-error', true);
      viewerLog('Joined session.', 'sl-log-action');
    });

    socket.on('viewer:error', (payload) => {
      const msg = (payload && payload.message) || 'Could not join.';
      const err = $('sl-viewer-error');
      err.textContent = msg;
      err.classList.remove('hidden');
      if (payload && payload.wrongPassword) $('sl-viewer-pass').focus();
    });

    socket.on('public:list', (list) => renderPublicList(list || []));

    socket.on('host:disconnected', () => {
      $('sl-viewer-dot').classList.remove('on'); $('sl-viewer-dot').classList.add('off');
      $('sl-viewer-status-text').textContent = 'Host disconnected — waiting to reconnect…';
      viewerLog('Host disconnected.', 'sl-log-action');
    });

    socket.on('session:expired', () => {
      viewerLog('Session ended.', 'sl-log-action');
      resetViewerUI();
    });

    socket.on('host:tab-opened', ({ tabId, url, mode }) => {
      Viewer.tabs.set(tabId, { url, mode });
      renderViewerTabs();
      viewerLog('Opened on host: ' + url);
    });
    socket.on('host:tab-closed', ({ tabId }) => {
      Viewer.tabs.delete(tabId);
      renderViewerTabs();
    });

    socket.on('host:info', (payload) => {
      $('sl-viewer-host-info').textContent = (payload && payload.message) ? 'Host: ' + payload.message : '';
      viewerLog('Host status: ' + ((payload && payload.message) || JSON.stringify(payload)));
    });
    socket.on('host:info-response', (payload) => {
      viewerLog('Host info: ' + JSON.stringify(payload));
    });

    socket.on('host:sound-progress', ({ current, duration }) => {
      const pct = duration ? Math.min(100, (current / duration) * 100) : 0;
      setHidden('sl-viewer-sound-progress', false);
      $('sl-viewer-sound-bar').style.width = pct + '%';
    });
    socket.on('host:sound-ended', () => {
      $('sl-viewer-sound-bar').style.width = '0%';
      setHidden('sl-viewer-sound-progress', true);
      viewerLog('Sound finished.');
    });
    socket.on('host:file-received', ({ name }) => {
      viewerLog('Host received file: ' + name, 'sl-log-action');
    });

    return socket;
  }

  function renderPublicList(list) {
    const el = $('sl-public-list');
    if (!list.length) { el.innerHTML = '<p class="sl-empty">No public sessions right now.</p>'; return; }
    el.innerHTML = '';
    for (const item of list) {
      const row = document.createElement('div');
      row.className = 'granted-user-row sl-list-row';
      const main = document.createElement('div');
      main.className = 'sl-list-main';
      main.innerHTML = '<div>' + escapeHtml(item.label || 'Anonymous') + (item.hasPassword ? ' <i data-icon="lock" data-size="11"></i>' : '') + '</div>' +
        '<div class="sl-list-sub">' + item.viewers + ' connected</div>';
      const btn = document.createElement('button');
      btn.className = 'btn-ghost';
      btn.type = 'button';
      btn.textContent = 'Join';
      btn.addEventListener('click', () => joinPublic(item.code, item.hasPassword));
      row.appendChild(main);
      row.appendChild(btn);
      el.appendChild(row);
      if (window.sealHydrateIcons) window.sealHydrateIcons(row);
    }
  }

  function escapeHtml(s) {
    return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }

  function joinPublic(code, hasPassword) {
    const name = ($('sl-viewer-name').value || window.SEAL_USER || 'guest').trim();
    saveViewerName(name);
    const socket = ensureViewerSocket();
    if (hasPassword) {
      // The public list can't carry a password check, so route through
      // the code field for a normal password-aware join.
      $('sl-viewer-code').value = code;
      $('sl-viewer-error').classList.remove('hidden');
      $('sl-viewer-error').textContent = 'This session needs a password — enter it above and press Join.';
      $('sl-viewer-pass').focus();
      return;
    }
    const emit = () => socket.emit('viewer:join-public', { code, name });
    if (socket.connected) emit(); else socket.once('connect', emit);
  }

  function renderViewerTabs() {
    const el = $('sl-viewer-tabs-list');
    if (!Viewer.tabs.size) { el.innerHTML = '<p class="sl-empty">None yet.</p>'; return; }
    el.innerHTML = '';
    for (const [tabId, info] of Viewer.tabs) {
      const row = document.createElement('div');
      row.className = 'granted-user-row sl-list-row';
      const main = document.createElement('div');
      main.className = 'sl-list-main';
      main.innerHTML = '<div class="sl-list-sub">' + escapeHtml(info.url) + '</div>';
      const btn = document.createElement('button');
      btn.className = 'btn-ghost'; btn.type = 'button'; btn.textContent = 'Close';
      btn.addEventListener('click', () => Viewer.socket && Viewer.socket.emit('cmd:close-tab', { tabId }));
      row.appendChild(main); row.appendChild(btn);
      el.appendChild(row);
    }
  }

  function resetViewerUI() {
    Viewer.joined = false; Viewer.hostId = null; Viewer.tabs.clear();
    setHidden('sl-viewer-idle', false);
    setHidden('sl-viewer-active', true);
  }

  function saveViewerName(name) {
    try { localStorage.setItem('screenlink_viewer_name', name); } catch {}
  }
  function loadViewerName() {
    try { return localStorage.getItem('screenlink_viewer_name') || ''; } catch { return ''; }
  }

  async function sendFileInChunks(file, emitStart, emitChunk, emitEnd, progressBarId, progressWrapId) {
    const totalChunks = Math.max(1, Math.ceil(file.size / CHUNK_BYTES));
    emitStart(totalChunks);
    setHidden(progressWrapId, false);
    const bar = $(progressBarId);
    for (let i = 0; i < totalChunks; i++) {
      const slice = file.slice(i * CHUNK_BYTES, (i + 1) * CHUNK_BYTES);
      const buf = await slice.arrayBuffer();
      const b64 = bytesToBase64(new Uint8Array(buf));
      emitChunk(b64, i);
      if (bar) bar.style.width = (((i + 1) / totalChunks) * 100) + '%';
      // Yield so chunk emits don't block the UI thread on large files.
      await new Promise((r) => setTimeout(r, 0));
    }
    emitEnd();
    setTimeout(() => setHidden(progressWrapId, true), 600);
  }

  function wireViewerControls() {
    const savedName = loadViewerName();
    if (savedName) $('sl-viewer-name').value = savedName;

    $('sl-viewer-join').addEventListener('click', async () => {
      const code = $('sl-viewer-code').value.trim();
      const pass = $('sl-viewer-pass').value;
      const name = ($('sl-viewer-name').value || window.SEAL_USER || 'guest').trim();
      if (!/^\d{6}$/.test(code)) {
        const err = $('sl-viewer-error'); err.textContent = 'Enter the 6-digit code.'; err.classList.remove('hidden');
        return;
      }
      saveViewerName(name);
      const passwordHash = pass ? await sha256Hex(pass) : undefined;
      const socket = ensureViewerSocket();
      const emit = () => socket.emit('viewer:join', { code, passwordHash, name });
      if (socket.connected) emit(); else socket.once('connect', emit);
    });

    $('sl-viewer-list-refresh').addEventListener('click', () => {
      const name = ($('sl-viewer-name').value || window.SEAL_USER || 'guest').trim();
      const socket = ensureViewerSocket();
      const emit = () => socket.emit('viewer:get-public', { name });
      if (socket.connected) emit(); else socket.once('connect', emit);
    });

    $('sl-viewer-open-url').addEventListener('click', () => {
      if (!Viewer.socket) return;
      const url = $('sl-viewer-url').value.trim();
      if (!url) return;
      const mode = $('sl-viewer-url-mode').value;
      Viewer.socket.emit('cmd:open-url', { url, mode, width: 480, height: 360 });
      viewerLog('Requested open: ' + url);
      $('sl-viewer-url').value = '';
    });

    document.querySelectorAll('.sl-key-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        if (!Viewer.socket) return;
        Viewer.socket.emit('cmd:input', { key: btn.getAttribute('data-key') });
        viewerLog('Sent key: ' + btn.getAttribute('data-key'));
      });
    });
    $('sl-viewer-send-text').addEventListener('click', () => {
      if (!Viewer.socket) return;
      const value = $('sl-viewer-text').value;
      if (!value) return;
      Viewer.socket.emit('cmd:input', { type: 'text', value });
      viewerLog('Sent text: "' + value + '"');
      $('sl-viewer-text').value = '';
    });

    $('sl-viewer-file').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !Viewer.socket) return;
      await sendFileInChunks(
        file,
        (totalChunks) => Viewer.socket.emit('cmd:file-start', { name: file.name, size: file.size, mimeType: file.type, totalChunks }),
        (chunk, index) => Viewer.socket.emit('cmd:file-chunk', { chunk, index }),
        () => { Viewer.socket.emit('cmd:file-end'); viewerLog('File sent: ' + file.name, 'sl-log-action'); },
        'sl-viewer-file-bar', 'sl-viewer-file-progress'
      );
      e.target.value = '';
    });

    $('sl-viewer-sound').addEventListener('change', async (e) => {
      const file = e.target.files[0];
      if (!file || !Viewer.socket) return;
      const volume = Number($('sl-viewer-volume').value) / 100;
      await sendFileInChunks(
        file,
        (totalChunks) => Viewer.socket.emit('cmd:sound-start', { mimeType: file.type, volume, totalChunks }),
        (chunk, index) => Viewer.socket.emit('cmd:sound-chunk', { chunk, index }),
        () => { Viewer.socket.emit('cmd:sound-end'); viewerLog('Sound sent: ' + file.name, 'sl-log-action'); },
        'sl-viewer-sound-bar', 'sl-viewer-sound-progress'
      );
      e.target.value = '';
    });
    $('sl-viewer-stop-sound').addEventListener('click', () => {
      if (Viewer.socket) Viewer.socket.emit('cmd:stop-sound');
    });

    $('sl-viewer-leave').addEventListener('click', () => {
      if (Viewer.socket) { Viewer.socket.disconnect(); Viewer.socket = null; }
      resetViewerUI();
    });
  }

  // ============================================================
  // INIT
  // ============================================================
  function init() {
    if (typeof window.io !== 'function') {
      hostLog('Could not load the realtime connection.');
      viewerLog('Could not load the realtime connection.');
      return;
    }
    wireHostControls();
    wireViewerControls();
    renderHostViewers();

    // If a host session survived a page reload, reclaim it.
    if (loadHostSession()) ensureHostSocket();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
