// ── API HELPERS ─────────────────────────────────────────────────
// Every call goes to the same origin the page is served from, so
// this works whether you host on localhost, a VPS, or behind a
// domain — no URLs to edit.
const API = {
  async _req(path, opts = {}) {
    const res = await fetch(path, {
      credentials: 'same-origin',
      headers: { 'Content-Type': 'application/json' },
      ...opts
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Something went wrong.');
    return data;
  },

  session()  { return this._req('/api/session'); },
  register(username, password) {
    return this._req('/api/register', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  login(username, password) {
    return this._req('/api/login', { method: 'POST', body: JSON.stringify({ username, password }) });
  },
  logout() { return this._req('/api/logout', { method: 'POST' }); },

  getBanner() { return this._req('/api/banner'); },
  setBanner(text, type) { return this._req('/api/banner', { method: 'POST', body: JSON.stringify({ text, type }) }); },
  clearBanner() { return this._req('/api/banner', { method: 'DELETE' }); },

  getPopup() { return this._req('/api/popup'); },
  setPopup(title, text) { return this._req('/api/popup', { method: 'POST', body: JSON.stringify({ title, text }) }); },
  clearPopup() { return this._req('/api/popup', { method: 'DELETE' }); },

  list(collection) { return this._req(`/api/${collection}`); },
  add(collection, entry) { return this._req(`/api/${collection}`, { method: 'POST', body: JSON.stringify(entry) }); },
  remove(collection, id) { return this._req(`/api/${collection}/${encodeURIComponent(id)}`, { method: 'DELETE' }); },

  chatHistory() { return this._req('/api/chat/messages'); },
  chatSend(text) { return this._req('/api/chat/messages', { method: 'POST', body: JSON.stringify({ text }) }); },
  chatDelete(id) { return this._req(`/api/chat/messages/${encodeURIComponent(id)}`, { method: 'DELETE' }); },

  listFiles() { return this._req('/api/files'); },
  async uploadFile(file) {
    const fd = new FormData();
    fd.append('file', file);
    const res = await fetch('/api/files', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data;
  },
  deleteFile(id) { return this._req(`/api/files/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  fileDownloadUrl(id) { return `/api/files/${encodeURIComponent(id)}/download`; },

  onlineUsers() { return this._req('/api/presence/online'); },
  sendAudio(toUsername, fileId) {
    return this._req('/api/audio/send', { method: 'POST', body: JSON.stringify({ toUsername, fileId }) });
  },

  getAudioSenders() { return this._req('/api/admin/audio-senders'); },
  grantAudioSender(username) { return this._req('/api/admin/audio-senders', { method: 'POST', body: JSON.stringify({ username }) }); },
  revokeAudioSender(username) { return this._req(`/api/admin/audio-senders/${encodeURIComponent(username)}`, { method: 'DELETE' }); }
};
