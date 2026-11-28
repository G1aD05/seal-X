'use strict';
// ============================================================
// ScreenLink — server-side drop-in module
// ============================================================
//
// Commands-only fork of G1aD05/screenlink's server: host creates a
// 6-digit code, a viewer joins with it, and a handful of "remote
// control" channels (open-url, sound, file transfer, input, status)
// are relayed host<->viewers over Socket.io. No screen share: there
// is no WebRTC signaling relay and no video stream.
//
// attachScreenLink(target, options) wires this onto either:
//   - a plain http.Server / https.Server (a new Socket.io Server
//     is created and attached to it), or
//   - an existing Socket.io Server instance (so it can share one
//     Socket.io instance with the rest of the site, optionally
//     under its own `namespace`).
//
// Usage:
//   const { attachScreenLink } = require('./screenlink-server');
//   const sl = attachScreenLink(server); // server = http.createServer(app)
//   // ... later, e.g. on shutdown:
//   await sl.close();
//
// Options:
//   namespace     Socket.io namespace to mount on (default: the
//                 root "/" namespace).
//   path          Socket.io engine path, only used when `target`
//                 is a bare http(s) server (default: '/socket.io').
//   hostGraceMs   how long a session survives after its host
//                 disconnects, before it's deleted and viewers are
//                 told `session:expired` (default: 10000).
//   joinAttempts  { max, windowMs } rate limit on `viewer:join`
//                 per socket, to slow down code-guessing
//                 (default: { max: 20, windowMs: 60000 }).
//
// Returns { io, namespace, sessions, stats(), close() }.

const crypto = require('crypto');
const { Server: SocketIOServer } = require('socket.io');

// ------------------------------------------------------------
// Small helpers (pure, no shared state)
// ------------------------------------------------------------

// Normalize a host-supplied allow-list into a lowercase Set, or null for
// "anyone can see/join". These are self-declared display names — there's
// no login, so this isn't identity verification, just a name match.
function normalizeAllowList(list) {
  if (!Array.isArray(list)) return null;
  const cleaned = list
    .map((s) => String(s == null ? '' : s).trim().toLowerCase())
    .filter(Boolean);
  return cleaned.length ? new Set(cleaned) : null;
}

function asPlainObject(payload) {
  return payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
}

function safeString(value, maxLen) {
  const s = typeof value === 'string' ? value : value == null ? '' : String(value);
  return typeof maxLen === 'number' ? s.slice(0, maxLen) : s;
}

// Try to normalize a URL and make sure it's http(s) — never relay
// javascript:, data:, file:, etc. to the host for it to "open".
function normalizeOpenUrl(url) {
  try {
    const u = new URL(String(url));
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return null;
    return u.toString();
  } catch {
    return null;
  }
}

function generateCode(sessions) {
  let code;
  do {
    code = String(Math.floor(100000 + Math.random() * 900000));
  } while (sessions.has(code));
  return code;
}

function findSessionById(sessions, sessionId) {
  if (!sessionId) return null;
  for (const session of sessions.values()) {
    if (session.sessionId === sessionId) return session;
  }
  return null;
}

// ------------------------------------------------------------
// attachScreenLink
// ------------------------------------------------------------

function attachScreenLink(target, options = {}) {
  const hostGraceMs = Number.isFinite(options.hostGraceMs) ? options.hostGraceMs : 10000;
  const joinAttemptsMax = options.joinAttempts && Number.isFinite(options.joinAttempts.max)
    ? options.joinAttempts.max
    : 20;
  const joinAttemptsWindowMs = options.joinAttempts && Number.isFinite(options.joinAttempts.windowMs)
    ? options.joinAttempts.windowMs
    : 60000;

  const isExistingIo = target instanceof SocketIOServer;

  let io = null;
  if (isExistingIo) {
    io = target;
  } else {
    io = new SocketIOServer(target, {
      path: options.path || '/socket.io',
      cors: { origin: '*', methods: ['GET', 'POST'] },
      transports: ['websocket', 'polling'],
      pingTimeout: 60000,
      pingInterval: 25000,
      upgradeTimeout: 30000,
      ...(typeof options.allowRequest === 'function' ? { allowRequest: options.allowRequest } : {}),
    });
  }

  // `ns` is always a Namespace-like object with .on('connection'),
  // .to(room).emit(...) and .sockets (a Map of id -> socket).
  const ns = options.namespace ? io.of(options.namespace) : io.sockets;

  // Session store, scoped to this attach call so multiple instances
  // (e.g. different namespaces) never share state.
  //
  // code -> {
  //   sessionId, hostId, viewers: Set<socketId>, passwordHash,
  //   public, label, allowedViewers, disconnectTimer
  // }
  const sessions = new Map();

  function buildPublicList(viewerName) {
    const nameLower = safeString(viewerName).trim().toLowerCase();
    const list = [];
    for (const [code, session] of sessions) {
      if (!session.public) continue;
      if (session.allowedViewers && !session.allowedViewers.has(nameLower)) continue;
      list.push({ code, label: session.label || 'Anonymous', viewers: session.viewers.size, hasPassword: !!session.passwordHash });
    }
    return list;
  }

  function broadcastPublicList() {
    for (const socket of ns.sockets.values()) {
      socket.emit('public:list', buildPublicList(socket.data.viewerName));
    }
  }

  function sendToHost(session, event, data) {
    if (!session || !session.hostId) return false;
    const host = ns.sockets.get(session.hostId);
    if (!host) {
      session.hostId = null;
      return false;
    }
    if (data === undefined) host.emit(event);
    else host.emit(event, data);
    return true;
  }

  function setViewerName(socket, name) {
    if (typeof name === 'string' && name.trim()) {
      socket.data.viewerName = name.trim().slice(0, 40);
    }
    return socket.data.viewerName || '';
  }

  // Only the socket currently recorded as a session's host may trigger
  // host-only broadcasts — otherwise a viewer could spoof host events.
  function requireHostOf(socket) {
    const code = socket.data.code;
    if (!code) return null;
    const session = sessions.get(code);
    if (!session || session.hostId !== socket.id) return null;
    return session;
  }

  function checkJoinRateLimit(socket) {
    const now = Date.now();
    let rl = socket.data.joinRate;
    if (!rl || now - rl.start > joinAttemptsWindowMs) {
      rl = { start: now, count: 0 };
      socket.data.joinRate = rl;
    }
    rl.count += 1;
    return rl.count <= joinAttemptsMax;
  }

  function clearSessionsOwnedBy(socketId) {
    for (const [code, session] of sessions) {
      if (session.hostId === socketId) sessions.delete(code);
    }
  }

  function handleConnection(socket) {
    socket.data.role = null;
    socket.data.code = null;

    // ---------------- HOST: CREATE ----------------
    socket.on('host:create', (payload) => {
      const { passwordHash } = asPlainObject(payload);

      clearSessionsOwnedBy(socket.id);

      const sessionId = crypto.randomUUID();
      const code = generateCode(sessions);

      sessions.set(code, {
        sessionId,
        hostId: socket.id,
        viewers: new Set(),
        passwordHash: passwordHash || null,
        public: false,
        label: 'Anonymous',
        allowedViewers: null,
        disconnectTimer: null,
      });

      socket.join('host:' + code);
      socket.data.role = 'host';
      socket.data.code = code;
      socket.data.sessionId = sessionId;

      socket.emit('host:code', { code, sessionId, hasPassword: !!passwordHash });
    });

    // ---------------- HOST: SET ACCESS RESTRICTIONS ----------------
    socket.on('host:set-restrictions', (payload) => {
      const { allowedViewers } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      session.allowedViewers = normalizeAllowList(allowedViewers);
      broadcastPublicList();
    });

    // ---------------- HOST: SET PUBLIC ----------------
    socket.on('host:set-public', (payload) => {
      const { isPublic, label } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      session.public = !!isPublic;
      session.label = (typeof label === 'string' && label.trim()) ? safeString(label, 60) : 'Anonymous';
      broadcastPublicList();
    });

    // ---------------- HOST: REFRESH ----------------
    // Keeps the code if the session already has viewers (so no one
    // currently connected gets orphaned); rotates to a fresh code
    // when it doesn't, e.g. before advertising it to someone new.
    socket.on('host:refresh', () => {
      const code = socket.data.code;
      const session = sessions.get(code);
      if (!session || session.hostId !== socket.id) return;

      if (session.viewers.size > 0) {
        socket.emit('host:code', { code, sessionId: session.sessionId, hasPassword: !!session.passwordHash });
        return;
      }

      sessions.delete(code);
      const newCode = generateCode(sessions);
      sessions.set(newCode, session);
      socket.leave('host:' + code);
      socket.join('host:' + newCode);
      socket.data.code = newCode;
      socket.emit('host:code', { code: newCode, sessionId: session.sessionId, hasPassword: !!session.passwordHash });
      broadcastPublicList();
    });

    // ---------------- HOST: RECONNECT ----------------
    socket.on('host:join', (payload) => {
      const { sessionId } = asPlainObject(payload);
      const session = findSessionById(sessions, sessionId);
      if (!session) {
        socket.emit('session:expired');
        return;
      }

      if (session.disconnectTimer) {
        clearTimeout(session.disconnectTimer);
        session.disconnectTimer = null;
      }

      let code = null;
      for (const [c, s] of sessions) {
        if (s === session) { code = c; break; }
      }
      if (!code) return;

      session.hostId = socket.id;
      socket.data.role = 'host';
      socket.data.code = code;
      socket.data.sessionId = sessionId;
      socket.join('host:' + code);

      socket.emit('host:code', { code, sessionId, hasPassword: !!session.passwordHash });

      for (const viewerId of session.viewers) {
        socket.emit('viewer:joined', { viewerId });
      }
    });

    // ---------------- VIEWER: JOIN ----------------
    socket.on('viewer:join', (payload) => {
      const { code: rawCode, passwordHash, name } = asPlainObject(payload);
      const code = safeString(rawCode);
      const viewerName = setViewerName(socket, name);

      if (!checkJoinRateLimit(socket)) {
        socket.emit('viewer:error', { message: 'Too many attempts, please wait.' });
        return;
      }

      const session = sessions.get(code);
      if (!session) {
        socket.emit('viewer:error', { message: 'Code not found.' });
        return;
      }

      if (session.passwordHash) {
        if (!passwordHash || passwordHash !== session.passwordHash) {
          socket.emit('viewer:error', { message: 'Incorrect password.', wrongPassword: true });
          return;
        }
      }

      if (session.allowedViewers && !session.allowedViewers.has(viewerName.toLowerCase())) {
        socket.emit('viewer:error', { message: 'You are not authorized to view this broadcast.' });
        return;
      }

      session.viewers.add(socket.id);
      socket.join('viewers:' + code);
      socket.data.role = 'viewer';
      socket.data.code = code;
      socket.data.hostId = session.hostId;

      sendToHost(session, 'viewer:joined', { viewerId: socket.id });
      socket.emit('viewer:ok', { hostId: session.hostId });
      broadcastPublicList();
    });

    // ---------------- VIEWER: GET / JOIN PUBLIC ----------------
    socket.on('viewer:get-public', (payload) => {
      const { name } = asPlainObject(payload);
      const viewerName = setViewerName(socket, name);
      socket.emit('public:list', buildPublicList(viewerName));
    });

    socket.on('viewer:join-public', (payload) => {
      const { code: rawCode, name } = asPlainObject(payload);
      const code = safeString(rawCode);
      const viewerName = setViewerName(socket, name);

      if (!checkJoinRateLimit(socket)) {
        socket.emit('viewer:error', { message: 'Too many attempts, please wait.' });
        return;
      }

      const session = sessions.get(code);
      if (!session || !session.public) {
        socket.emit('viewer:error', { message: 'This broadcast is no longer public.' });
        return;
      }

      // The public list has no password field, so a password-protected
      // session can't be joined this way — fall back to viewer:join.
      if (session.passwordHash) {
        socket.emit('viewer:error', { message: 'This broadcast requires a password.', wrongPassword: true });
        return;
      }

      if (session.allowedViewers && !session.allowedViewers.has(viewerName.toLowerCase())) {
        socket.emit('viewer:error', { message: 'You are not authorized to view this broadcast.' });
        return;
      }

      session.viewers.add(socket.id);
      socket.join('viewers:' + code);
      socket.data.role = 'viewer';
      socket.data.code = code;
      socket.data.hostId = session.hostId;

      sendToHost(session, 'viewer:joined', { viewerId: socket.id });
      socket.emit('viewer:ok', { hostId: session.hostId });
      broadcastPublicList();
    });

    // ---------------- OPEN URL (viewer -> host) ----------------
    socket.on('cmd:open-url', (payload) => {
      const p = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;

      const url = normalizeOpenUrl(p.url);
      if (!url) return; // bad or non-http(s) URL (e.g. javascript:) — dropped silently

      const out = { viewerId: socket.id, url };
      if (p.mode !== undefined) out.mode = p.mode;
      if (p.width !== undefined) out.width = p.width;
      if (p.height !== undefined) out.height = p.height;
      if (p.left !== undefined) out.left = p.left;
      if (p.top !== undefined) out.top = p.top;
      if (p.windowTarget !== undefined) out.windowTarget = p.windowTarget;

      sendToHost(session, 'cmd:open-url', out);
    });

    socket.on('cmd:close-tab', (payload) => {
      const { tabId } = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:close-tab', { tabId });
    });

    // ---------------- SOUND (viewer -> host) ----------------
    socket.on('cmd:sound-start', (payload) => {
      const { mimeType, volume, totalChunks } = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:sound-start', { mimeType, volume: volume || 1, totalChunks });
    });
    socket.on('cmd:sound-chunk', (payload) => {
      const { chunk, index } = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:sound-chunk', { chunk, index });
    });
    socket.on('cmd:sound-end', () => {
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:sound-end');
    });
    socket.on('cmd:stop-sound', () => {
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:stop-sound');
    });

    // ---------------- FILE TRANSFER (viewer -> host) ----------------
    socket.on('cmd:file-start', (payload) => {
      const { name, size, mimeType, totalChunks } = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:file-start', { name, size, mimeType, totalChunks });
    });
    socket.on('cmd:file-chunk', (payload) => {
      const { chunk, index } = asPlainObject(payload);
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:file-chunk', { chunk, index });
    });
    socket.on('cmd:file-end', () => {
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:file-end');
    });

    // ---------------- INPUT (viewer -> host) ----------------
    socket.on('cmd:input', (payload) => {
      const session = sessions.get(socket.data.code);
      if (!session) return;
      sendToHost(session, 'cmd:input', asPlainObject(payload));
    });

    // ---------------- HOST -> VIEWERS (host-only, spoof-guarded) ----------------
    socket.on('host:tab-opened', (payload) => {
      const { tabId, url, mode } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:tab-opened', { tabId, url, mode });
    });
    socket.on('host:tab-closed', (payload) => {
      const { tabId } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:tab-closed', { tabId });
    });
    socket.on('host:ext-status', (payload) => {
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:ext-status', asPlainObject(payload));
    });
    socket.on('host:info', (payload) => {
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:info', asPlainObject(payload));
    });
    socket.on('host:info-response', (payload) => {
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:info-response', asPlainObject(payload));
    });
    socket.on('host:sound-progress', (payload) => {
      const { current, duration } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:sound-progress', { current, duration });
    });
    socket.on('host:sound-ended', () => {
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:sound-ended');
    });
    socket.on('host:file-received', (payload) => {
      const { name } = asPlainObject(payload);
      const session = requireHostOf(socket);
      if (!session) return;
      ns.to('viewers:' + socket.data.code).emit('host:file-received', { name });
    });

    // ---------------- PING ----------------
    socket.on('ping', () => socket.emit('pong'));

    // ---------------- DISCONNECT ----------------
    socket.on('disconnect', () => {
      const { role, code } = socket.data || {};
      if (!code) return;

      if (role === 'host') {
        const session = sessions.get(code);
        if (!session || session.hostId !== socket.id) return;

        session.hostId = null;
        ns.to('viewers:' + code).emit('host:disconnected');
        broadcastPublicList();

        session.disconnectTimer = setTimeout(() => {
          const current = sessions.get(code);
          if (!current) return;
          if (current.hostId) {
            current.disconnectTimer = null;
            return;
          }
          sessions.delete(code);
          ns.to('viewers:' + code).emit('session:expired');
          broadcastPublicList();
        }, hostGraceMs);
        return;
      }

      if (role === 'viewer') {
        const session = sessions.get(code);
        if (!session) return;
        session.viewers.delete(socket.id);
        sendToHost(session, 'viewer:left', { viewerId: socket.id });
        broadcastPublicList();
      }
    });
  }

  ns.on('connection', handleConnection);

  return {
    io,
    namespace: ns,
    sessions,
    stats() {
      return [...sessions.entries()].map(([code, s]) => ({
        code,
        sessionId: s.sessionId,
        hostId: s.hostId,
        viewers: s.viewers.size,
        public: s.public,
        label: s.label,
      }));
    },
    close() {
      // Never closes the underlying http.Server / Socket.io Server —
      // the caller owns that lifecycle. This just stops ScreenLink
      // from doing anything further: pending grace timers are
      // cancelled and no more connections are handled.
      for (const session of sessions.values()) {
        if (session.disconnectTimer) clearTimeout(session.disconnectTimer);
      }
      sessions.clear();
      ns.off('connection', handleConnection);
      return Promise.resolve();
    },
  };
}

module.exports = { attachScreenLink };
