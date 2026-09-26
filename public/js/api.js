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
  whitelist()  { return this._req('/api/whitelist'); },
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
  revokeAudioSender(username) { return this._req(`/api/admin/audio-senders/${encodeURIComponent(username)}`, { method: 'DELETE' }); },

  // ── Seals (currency), shop, profiles ──────────────────────────
  dailyStatus() { return this._req('/api/seals/daily'); },
  claimDaily() { return this._req('/api/seals/daily', { method: 'POST' }); },
  pingPlaytime(gameId, gameName) {
    const body = (gameId && gameName) ? JSON.stringify({ gameId, gameName }) : undefined;
    return this._req('/api/seals/playtime-ping', { method: 'POST', body });
  },
  stopPlaying() { return this._req('/api/now-playing/stop', { method: 'POST' }); },
  getShop() { return this._req('/api/shop'); },
  buyItem(itemId) { return this._req('/api/shop/buy', { method: 'POST', body: JSON.stringify({ itemId }) }); },
  getProfile(username) { return this._req(`/api/profile/${encodeURIComponent(username)}`); },
  updateProfile(patch) { return this._req('/api/profile/me', { method: 'PUT', body: JSON.stringify(patch) }); },
  leaderboard() { return this._req('/api/leaderboard'); },
  getBadges() { return this._req('/api/badges'); },
  async uploadRing(label, price, file) {
    const fd = new FormData();
    fd.append('label', label);
    fd.append('price', price);
    fd.append('image', file);
    const res = await fetch('/api/rings', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data;
  },
  deleteRing(id) { return this._req(`/api/rings/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  getRingUploaders() { return this._req('/api/admin/ring-uploaders'); },
  grantRingUploader(username) { return this._req('/api/admin/ring-uploaders', { method: 'POST', body: JSON.stringify({ username }) }); },
  revokeRingUploader(username) { return this._req(`/api/admin/ring-uploaders/${encodeURIComponent(username)}`, { method: 'DELETE' }); },

  // ── Admin tiers (Tier 3 only for grant/revoke/give-seals) ────────
  getTier1Admins() { return this._req('/api/admin/tier1-admins'); },
  grantTier1Admin(username) { return this._req('/api/admin/tier1-admins', { method: 'POST', body: JSON.stringify({ username }) }); },
  revokeTier1Admin(username) { return this._req(`/api/admin/tier1-admins/${encodeURIComponent(username)}`, { method: 'DELETE' }); },
  giveSeals(username, amount) { return this._req('/api/admin/give-seals', { method: 'POST', body: JSON.stringify({ username, amount }) }); },

  // ── Seal Customize (Tier 3 only for saving/resetting) ─────────────
  getCustomize() { return this._req('/api/customize'); },
  saveCustomize(background, elements) {
    return this._req('/api/customize', { method: 'POST', body: JSON.stringify({ background, elements }) });
  },
  resetCustomize() { return this._req('/api/customize/reset', { method: 'POST' }); },
  async uploadAvatarImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/profile/avatar-image', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data;
  },
  async uploadBannerImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/profile/banner-image', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data;
  },

  getCookieSync() { return this._req('/api/cookie-sync'); },
  setCookieSync(data) { return this._req('/api/cookie-sync', { method: 'PUT', body: JSON.stringify({ data }) }); },
  getNotifications() { return this._req('/api/notifications'); },
  markNotificationsRead() { return this._req('/api/notifications/read-all', { method: 'POST' }); },

  getComments(username) { return this._req(`/api/profile/${encodeURIComponent(username)}/comments`); },
  postComment(username, text) {
    return this._req(`/api/profile/${encodeURIComponent(username)}/comments`, { method: 'POST', body: JSON.stringify({ text }) });
  },
  deleteComment(username, commentId) {
    return this._req(`/api/profile/${encodeURIComponent(username)}/comments/${encodeURIComponent(commentId)}`, { method: 'DELETE' });
  },

  // ── Market (Seals stock market) ─────────────────────────────────
  getMarketState() { return this._req('/api/market/state'); },
  buyStock(symbol, shares) {
    return this._req('/api/market/buy', { method: 'POST', body: JSON.stringify({ symbol, shares }) });
  },
  sellStock(symbol, shares) {
    return this._req('/api/market/sell', { method: 'POST', body: JSON.stringify({ symbol, shares }) });
  }
};
