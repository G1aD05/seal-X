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
    if (!res.ok) {
      // A Tier 3 admin can ban/suspend/force-logout someone (or reset
      // their password) while that person is actively browsing — the
      // server invalidates the session immediately, but the client
      // only finds out on its next request. When that happens, don't
      // just fail the one action silently: tell them and reset the
      // page so the UI matches reality instead of still showing them
      // as signed in.
      // The site was switched to maintenance mode while this tab was open:
      // reload once so the server hands back the maintenance page.
      if (res.status === 503 && data.maintenance && !window.__maintReload) {
        window.__maintReload = true;
        window.location.reload();
      }
      if ((res.status === 401 || res.status === 403) &&
          typeof CURRENT_USER !== 'undefined' && CURRENT_USER &&
          /banned|suspended|signed out remotely/i.test(data.error || '')) {
        CURRENT_USER = null;
        alert(data.error);
        window.location.reload();
      }
      throw new Error(data.error || 'Something went wrong.');
    }
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

  chatHistory(room) { return this._req('/api/chat/messages?room=' + encodeURIComponent(room || 'general')); },
  chatSend(text, room, imageUrl) { return this._req('/api/chat/messages', { method: 'POST', body: JSON.stringify({ text, room: room || 'general', imageUrl: imageUrl || undefined }) }); },
  gifStatus() { return this._req('/api/gifs/status'); },
  gifSearch(q, pos) {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (pos) params.set('pos', pos);
    return this._req('/api/gifs/search?' + params.toString());
  },
  async chatUploadImage(file) {
    const fd = new FormData();
    fd.append('image', file);
    const res = await fetch('/api/chat/images', { method: 'POST', credentials: 'same-origin', body: fd });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error || 'Upload failed.');
    return data.url;
  },
  chatDelete(id) { return this._req(`/api/chat/messages/${encodeURIComponent(id)}`, { method: 'DELETE' }); },

  // ── Chat rooms + friends (DMs are just rooms between two friends) ──
  getChatRooms() { return this._req('/api/chat/rooms'); },
  createChatRoom(name) { return this._req('/api/chat/rooms', { method: 'POST', body: JSON.stringify({ name }) }); },
  deleteChatRoom(id) { return this._req(`/api/chat/rooms/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  getFriends() { return this._req('/api/friends'); },
  sendFriendRequest(username) { return this._req('/api/friends/request', { method: 'POST', body: JSON.stringify({ username }) }); },
  acceptFriend(username) { return this._req('/api/friends/accept', { method: 'POST', body: JSON.stringify({ username }) }); },
  declineFriend(username) { return this._req('/api/friends/decline', { method: 'POST', body: JSON.stringify({ username }) }); },
  removeFriend(username) { return this._req(`/api/friends/${encodeURIComponent(username)}`, { method: 'DELETE' }); },

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
  grantGameReward(gameId, key, amount, label) {
    return this._req('/api/rewards/grant', { method: 'POST', body: JSON.stringify({ gameId, key, amount, label }) });
  },
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
  listSuggestions() { return this._req('/api/suggestions'); },
  addSuggestion(title, body) { return this._req('/api/suggestions', { method: 'POST', body: JSON.stringify({ title, body }) }); },
  voteSuggestion(id) { return this._req(`/api/suggestions/${encodeURIComponent(id)}/vote`, { method: 'POST' }); },
  updateSuggestion(id, patch) { return this._req(`/api/suggestions/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) }); },
  deleteSuggestion(id) { return this._req(`/api/suggestions/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  getImageUploaders() { return this._req('/api/admin/image-uploaders'); },
  grantImageUploader(username) { return this._req('/api/admin/image-uploaders', { method: 'POST', body: JSON.stringify({ username }) }); },
  revokeImageUploader(username) { return this._req(`/api/admin/image-uploaders/${encodeURIComponent(username)}`, { method: 'DELETE' }); },
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

  // ── Tier 2 (cosmetic only — password box in the Admin Panel) ──────
  unlockTier2(password) { return this._req('/api/admin/tier2', { method: 'POST', body: JSON.stringify({ password }) }); },

  // ── User Management (Tier 3 only) ─────────────────────────────────
  getAdminUsers() { return this._req('/api/admin/users'); },
  banUser(username, reason) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/ban`, { method: 'POST', body: JSON.stringify({ reason }) }); },
  unbanUser(username) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/unban`, { method: 'POST' }); },
  jailUser(username, reason) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/jail`, { method: 'POST', body: JSON.stringify({ reason }) }); },
  unjailUser(username) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/unjail`, { method: 'POST' }); },
  suspendUser(username, reason, hours) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/suspend`, { method: 'POST', body: JSON.stringify({ reason, hours }) }); },
  unsuspendUser(username) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/unsuspend`, { method: 'POST' }); },
  muteUser(username, reason) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/mute`, { method: 'POST', body: JSON.stringify({ reason }) }); },
  unmuteUser(username) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/unmute`, { method: 'POST' }); },
  forceLogoutUser(username) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/force-logout`, { method: 'POST' }); },
  getPolls() { return this._req('/api/polls'); },
  votePoll(id, optionId) { return this._req(`/api/polls/${encodeURIComponent(id)}/vote`, { method: 'POST', body: JSON.stringify({ optionId }) }); },
  getOverseerPolls() { return this._req('/api/overseer/polls'); },
  createPoll(question, options, hours) { return this._req('/api/overseer/polls', { method: 'POST', body: JSON.stringify({ question, options, hours }) }); },
  closePoll(id) { return this._req(`/api/overseer/polls/${encodeURIComponent(id)}/close`, { method: 'POST' }); },
  deletePoll(id) { return this._req(`/api/overseer/polls/${encodeURIComponent(id)}`, { method: 'DELETE' }); },
  getMaintenance() { return this._req('/api/overseer/maintenance'); },
  setMaintenance(enabled, message, exemptTier4) { return this._req('/api/overseer/maintenance', { method: 'POST', body: JSON.stringify({ enabled, message, exemptTier4 }) }); },
  getTier3Admins() { return this._req('/api/admin/tier3-admins'); },
  grantTier3Admin(username) { return this._req('/api/admin/tier3-admins', { method: 'POST', body: JSON.stringify({ username }) }); },
  revokeTier3Admin(username) { return this._req(`/api/admin/tier3-admins/${encodeURIComponent(username)}`, { method: 'DELETE' }); },
  getAuditLog(q) { return this._req('/api/admin/audit-log?limit=200' + (q ? '&q=' + encodeURIComponent(q) : '')); },
  escalateUser(username, reason, action) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/escalate`, { method: 'POST', body: JSON.stringify({ reason, action }) }); },
  getEscalationCount() { return this._req('/api/admin/escalations/count'); },
  getEscalations() { return this._req('/api/admin/escalations'); },
  dismissEscalation(id, note) { return this._req(`/api/admin/escalations/${encodeURIComponent(id)}/dismiss`, { method: 'POST', body: JSON.stringify({ note }) }); },
  resetUserPassword(username, newPassword) { return this._req(`/api/admin/users/${encodeURIComponent(username)}/reset-password`, { method: 'POST', body: JSON.stringify({ newPassword }) }); },
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
  getStorageSync() { return this._req('/api/storage-sync'); },
  setStorageSync(data, opts = {}) { return this._req('/api/storage-sync', { method: 'PUT', body: JSON.stringify({ data }), ...opts }); },
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
