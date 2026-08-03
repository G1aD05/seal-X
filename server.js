// ═══════════════════════════════════════════════════════════════
//  Seal — backend
//  Real accounts, a banner that's stored on the server (so it's
//  the same for every visitor), and a game/tool library that can
//  be edited from the admin panel OR by hand-editing data/db.json.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DATA_DIR lets you point storage at a mounted persistent disk (Render,
// Fly, a VPS volume, etc.) instead of the app folder, so your data
// survives redeploys. Defaults to ./data for plain local/VPS use.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');
const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SITE_TMP_DIR = path.join(DATA_DIR, 'tmp'); // scratch space for in-progress zip uploads
const PORT = process.env.PORT || 3000;

// These live under public/ (part of the app itself, not DATA_DIR) since
// they're served as static site content — same place games/tools already
// live, just now writable by admins through the upload endpoint below.
const PUBLIC_DIR = path.join(__dirname, 'public');
const GAMES_DIR = path.join(PUBLIC_DIR, 'games');
const TOOLS_DIR = path.join(PUBLIC_DIR, 'tools');
const ICONS_DIR = path.join(PUBLIC_DIR, 'gameIcons');

// ── tiny file-backed "database" ───────────────────────────────
// Good enough for a small self-hosted site. Swap for real SQLite
// later if you outgrow it — every route below just calls readDB/writeDB.
function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(SITE_TMP_DIR, { recursive: true });
  fs.mkdirSync(GAMES_DIR, { recursive: true });
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      users: {},
      banner: { active: false, text: '', type: 'info' },
      popup: { active: false, id: null, title: '', text: '' },
      games: [],
      tools: [],
      chat: [],
      files: [],
      audioSenders: []
    }, null, 2));
  }
  if (!fs.existsSync(ADMINS_PATH)) {
    fs.writeFileSync(ADMINS_PATH, JSON.stringify([], null, 2));
  }
}
ensureDataFiles();

function readDB() {
  return JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
}
function writeDB(db) {
  fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
}
function readAdmins() {
  try { return JSON.parse(fs.readFileSync(ADMINS_PATH, 'utf8')); }
  catch { return []; }
}
function isAdmin(username) {
  if (!username) return false;
  return readAdmins().map(a => a.toLowerCase()).includes(username.toLowerCase());
}

// Sending a sound to someone is admin-only by default; admins can grant
// individual users access without making them full admins. The granted
// list lives in db.json (db.audioSenders) so it's manageable from the
// Admin Panel, unlike admins.json which is a file edit.
function canSendAudio(username) {
  if (!username) return false;
  if (isAdmin(username)) return true;
  const db = readDB();
  return (db.audioSenders || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

const app = express();
app.set('trust proxy', 1); // Render (and most hosts) sit behind a proxy — needed for secure cookies to work
app.use(express.json({ limit: '5mb' }));
app.use(session({
  secret: process.env.SESSION_SECRET || crypto.randomBytes(32).toString('hex'),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ── live banner updates (Server-Sent Events) ──────────────────
// Every connected tab keeps one open GET request; when an admin
// publishes/clears the banner we push the new value down each of
// these instead of making clients poll or refresh.
const bannerClients = new Set();
function broadcastBanner(banner) {
  const payload = `data: ${JSON.stringify(banner)}\n\n`;
  for (const res of bannerClients) res.write(payload);
}

// Same pattern for chat: keep a set of open connections, push new
// messages (or deletions) to all of them as they happen.
const chatClients = new Set();
function broadcastChat(event, payload) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of chatClients) res.write(line);
}
const lastMessageAt = new Map(); // username -> timestamp, simple per-user rate limit

// Update popups work like the banner (server-stored, pushed live) but
// render as a dismissible modal. Each publish gets a fresh id, so a new
// update reaches everyone again even if they dismissed a previous one.
const popupClients = new Set();
function broadcastPopup(popup) {
  const payload = `data: ${JSON.stringify(popup)}\n\n`;
  for (const res of popupClients) res.write(payload);
}

// Unlike the broadcast-to-everyone streams above, this one is
// per-user: it's how "someone sent you a sound" reaches the one
// person it's addressed to. The same connection also doubles as a
// presence list — a username only counts as "online" while it has
// at least one of these open.
const notifyClients = new Map(); // username -> Set of open res objects
function sendToUser(username, event, payload) {
  const targets = notifyClients.get(username);
  if (!targets || targets.size === 0) return false;
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of targets) res.write(line);
  return true;
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'Admins only.' });
  }
  next();
}

// ── auth ────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Usernames can only contain letters, numbers, underscores, and hyphens (3–20 characters).' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const db = readDB();
  const key = username.toLowerCase();
  if (db.users[key]) return res.status(409).json({ error: 'Username already taken.' });

  db.users[key] = {
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString()
  };
  writeDB(db);

  req.session.user = username;
  res.json({ username, isAdmin: isAdmin(username), canSendAudio: canSendAudio(username) });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });

  const db = readDB();
  const record = db.users[username.toLowerCase()];
  if (!record || !bcrypt.compareSync(password, record.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  req.session.user = record.username;
  res.json({ username: record.username, isAdmin: isAdmin(record.username), canSendAudio: canSendAudio(record.username) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ username: req.session.user, isAdmin: isAdmin(req.session.user), canSendAudio: canSendAudio(req.session.user) });
});

// ── global banner ─────────────────────────────────────────────
app.get('/api/banner', (req, res) => {
  res.json(readDB().banner);
});

app.post('/api/banner', requireAdmin, (req, res) => {
  const { text, type } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Banner text is required.' });
  const db = readDB();
  db.banner = { active: true, text: text.trim(), type: type || 'info' };
  writeDB(db);
  broadcastBanner(db.banner);
  res.json(db.banner);
});

app.delete('/api/banner', requireAdmin, (req, res) => {
  const db = readDB();
  db.banner = { active: false, text: '', type: 'info' };
  writeDB(db);
  broadcastBanner(db.banner);
  res.json(db.banner);
});

// Live stream: every open tab holds this connection open and gets
// pushed the new banner the instant an admin changes it — no
// refresh, no polling.
app.get('/api/banner/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(readDB().banner)}\n\n`);

  bannerClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    bannerClients.delete(res);
  });
});

// ── update popup (dismissible, shown once per browser per publish) ──
app.get('/api/popup', (req, res) => {
  res.json(readDB().popup);
});

app.post('/api/popup', requireAdmin, (req, res) => {
  const { title, text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Popup text is required.' });
  const db = readDB();
  db.popup = {
    active: true,
    id: crypto.randomUUID(), // new id = every visitor sees it again, even if they dismissed the last one
    title: (title || '').trim() || 'Update',
    text: text.trim()
  };
  writeDB(db);
  broadcastPopup(db.popup);
  res.json(db.popup);
});

app.delete('/api/popup', requireAdmin, (req, res) => {
  const db = readDB();
  db.popup = { active: false, id: null, title: '', text: '' };
  writeDB(db);
  broadcastPopup(db.popup);
  res.json(db.popup);
});

app.get('/api/popup/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(readDB().popup)}\n\n`);

  popupClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    popupClients.delete(res);
  });
});

// ── chat ───────────────────────────────────────────────────────
// Simple site-wide chat room. Anyone can read; only signed-in users
// can post; messages carry the server-known username so no one can
// spoof who said what. History is capped so db.json doesn't grow forever.
const CHAT_HISTORY_LIMIT = 200;
const CHAT_RATE_LIMIT_MS = 800;
const CHAT_MAX_LENGTH = 500;

app.get('/api/chat/messages', (req, res) => {
  const db = readDB();
  res.json(db.chat || []);
});

app.post('/api/chat/messages', requireLogin, (req, res) => {
  const text = (req.body && req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is empty.' });
  if (text.length > CHAT_MAX_LENGTH) return res.status(400).json({ error: `Messages are limited to ${CHAT_MAX_LENGTH} characters.` });

  const now = Date.now();
  const last = lastMessageAt.get(req.session.user) || 0;
  if (now - last < CHAT_RATE_LIMIT_MS) return res.status(429).json({ error: 'Slow down a little.' });
  lastMessageAt.set(req.session.user, now);

  const message = {
    id: crypto.randomUUID(),
    username: req.session.user,
    isAdmin: isAdmin(req.session.user),
    text,
    ts: now
  };

  const db = readDB();
  db.chat = db.chat || [];
  db.chat.push(message);
  if (db.chat.length > CHAT_HISTORY_LIMIT) db.chat = db.chat.slice(-CHAT_HISTORY_LIMIT);
  writeDB(db);

  broadcastChat('message', message);
  res.status(201).json(message);
});

app.delete('/api/chat/messages/:id', requireAdmin, (req, res) => {
  const db = readDB();
  db.chat = (db.chat || []).filter(m => m.id !== req.params.id);
  writeDB(db);
  broadcastChat('delete', { id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/chat/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');

  chatClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    chatClients.delete(res);
  });
});

// ── presence + per-user notifications ─────────────────────────
// Signed-in users open this once and it stays connected while they're
// on the site; that's how "online now" is determined and how a
// targeted push (like an incoming sound) reaches one specific person.
app.get('/api/notify/stream', requireLogin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');

  const user = req.session.user;
  if (!notifyClients.has(user)) notifyClients.set(user, new Set());
  notifyClients.get(user).add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = notifyClients.get(user);
    if (set) {
      set.delete(res);
      if (set.size === 0) notifyClients.delete(user);
    }
  });
});

app.get('/api/presence/online', requireLogin, (req, res) => {
  res.json([...notifyClients.keys()].filter(u => u !== req.session.user));
});

// ── file library (public browse/download; upload requires sign-in) ──
// Blocklist of executable-ish extensions — this is a shared-hosting
// safety floor, not content moderation. Everything else is allowed.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.ps1', '.jar', '.apk', '.sh',
  '.dll', '.app', '.deb', '.rpm', '.iso', '.bin', '.cpl'
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, UPLOADS_DIR),
    filename: (req, file, cb) => {
      const ext = path.extname(file.originalname).toLowerCase();
      cb(null, crypto.randomUUID() + ext);
    }
  }),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) return cb(new Error('That file type isn\'t allowed.'));
    cb(null, true);
  }
});

app.get('/api/files', (req, res) => {
  res.json(readDB().files || []);
});

app.post('/api/files', requireLogin, (req, res) => {
  upload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const entry = {
      id: crypto.randomUUID(),
      name: req.file.originalname,
      storedName: req.file.filename,
      size: req.file.size,
      mime: req.file.mimetype,
      uploader: req.session.user,
      ts: Date.now()
    };
    const db = readDB();
    db.files = db.files || [];
    db.files.push(entry);
    writeDB(db);
    res.status(201).json(entry);
  });
});

app.get('/api/files/:id/download', (req, res) => {
  const file = (readDB().files || []).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  res.download(path.join(UPLOADS_DIR, file.storedName), file.name);
});

app.delete('/api/files/:id', requireLogin, (req, res) => {
  const db = readDB();
  const file = (db.files || []).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (file.uploader !== req.session.user && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'You can only remove your own uploads.' });
  }
  db.files = db.files.filter(f => f.id !== req.params.id);
  writeDB(db);
  fs.unlink(path.join(UPLOADS_DIR, file.storedName), () => {}); // best-effort, ignore errors
  res.json({ ok: true });
});

// ── send a sound to a specific online user ────────────────────────
// Admin-only by default; admins can grant individual users access
// (see the audio-senders endpoints below) without making them full
// admins. The recipient decides what happens next (confirm-first or
// auto-play) via their own client-side preference — this endpoint
// only delivers the notification, it never plays anything itself.
app.post('/api/audio/send', requireLogin, (req, res) => {
  if (!canSendAudio(req.session.user)) {
    return res.status(403).json({ error: 'Sending sounds is admin-only right now. Ask an admin to grant you access in Settings.' });
  }

  const { toUsername, fileId } = req.body || {};
  if (!toUsername || !fileId) return res.status(400).json({ error: 'Missing recipient or file.' });
  if (toUsername.toLowerCase() === req.session.user.toLowerCase()) {
    return res.status(400).json({ error: "You can't send a sound to yourself." });
  }

  const file = (readDB().files || []).find(f => f.id === fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (!file.mime || !file.mime.startsWith('audio/')) {
    return res.status(400).json({ error: 'That file isn\'t audio.' });
  }

  const delivered = sendToUser(toUsername, 'incoming-audio', {
    from: req.session.user,
    fileId: file.id,
    fileName: file.name,
    url: `/api/files/${file.id}/download`
  });
  if (!delivered) return res.status(404).json({ error: `${toUsername} isn't online right now.` });
  res.json({ ok: true });
});

// ── admin: grant/revoke audio-sending access ──────────────────────
app.get('/api/admin/audio-senders', requireAdmin, (req, res) => {
  res.json(readDB().audioSenders || []);
});

app.post('/api/admin/audio-senders', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[username.trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  db.audioSenders = db.audioSenders || [];
  if (!db.audioSenders.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.audioSenders.push(record.username);
    writeDB(db);
  }
  res.status(201).json(db.audioSenders);
});

app.delete('/api/admin/audio-senders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  db.audioSenders = (db.audioSenders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  writeDB(db);
  res.json(db.audioSenders);
});

// ── games & tools (same shape, two collections) ──────────────────
function collectionRoutes(name) {
  app.get(`/api/${name}`, (req, res) => {
    res.json(readDB()[name]);
  });

  app.post(`/api/${name}`, requireAdmin, (req, res) => {
    const { name: gName, url, desc, tag, thumb, isNew } = req.body || {};
    if (!gName || !url) return res.status(400).json({ error: 'Name and URL are required.' });
    const db = readDB();
    const id = gName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || crypto.randomUUID();
    const entry = { id, name: gName, url, desc: desc || '', tag: tag || 'Misc', thumb: thumb || '', new: !!isNew };
    db[name] = db[name].filter(g => g.id !== id); // replace if same id
    db[name].push(entry);
    writeDB(db);
    res.status(201).json(entry);
  });

  app.delete(`/api/${name}/:id`, requireAdmin, (req, res) => {
    const db = readDB();
    db[name] = db[name].filter(g => g.id !== req.params.id);
    writeDB(db);
    res.json({ ok: true });
  });
}
collectionRoutes('games');
collectionRoutes('tools');

// ── backup (so you can get at db.json without needing Render's
// paid-only Shell tab, or any shell at all) ──────────────────────
app.get('/api/admin/backup', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="seal-backup-${stamp}.json"`);
  res.json(readDB());
});

// Restore from a previously downloaded backup. Overwrites everything —
// users, games, tools, chat, banner, popup — with what's in the file.
app.post('/api/admin/restore', requireAdmin, (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'That doesn\'t look like a valid backup file.' });
  }
  const required = ['users', 'banner', 'popup', 'games', 'tools', 'chat'];
  if (!required.every(k => k in incoming)) {
    return res.status(400).json({ error: 'That backup file is missing expected fields.' });
  }
  if (!('files' in incoming)) incoming.files = []; // older backups won't have this yet
  if (!('audioSenders' in incoming)) incoming.audioSenders = [];
  writeDB(incoming);
  res.json({ ok: true });
});

// ── export the whole site ──────────────────────────────────────
// Everything under public/ (games, tools, icons, the app itself) plus
// the data backup, streamed as one .zip. Streaming means it doesn't
// buffer the whole thing in memory first, so this is fine even with
// a large games/ folder.
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="seal-site-export-${stamp}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => {
    console.error('Export failed:', err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  archive.directory(PUBLIC_DIR, 'public');
  archive.file(DB_PATH, { name: 'data/db.json' });
  archive.file(ADMINS_PATH, { name: 'data/admins.json' });
  if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'data/uploads');

  archive.finalize();
});

// ── add game/tool files directly on the server ────────────────────
// Upload a .zip of a game/tool's files (extracted into a fresh
// folder) or a single image (for gameIcons). This writes real files
// into public/ — same trust level as editing data/db.json by hand,
// so it's admin-only, and every path is validated to stay inside its
// target directory (no zip-slip, no ../ escapes).
const MAX_SITE_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB — admin-only, not public-facing
const MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // zip-bomb guard

const siteFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SITE_TMP_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname))
  }),
  limits: { fileSize: MAX_SITE_UPLOAD_BYTES }
});

function safeSlug(name, fallback) {
  const slug = (name || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}
function safeFileName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'file') + ext;
}

// Extracts a zip into destDir, refusing to write anything outside it
// (zip-slip) and refusing archives that would unpack to something huge.
function extractZipSafely(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  let totalSize = 0;
  const destResolved = path.resolve(destDir);
  for (const entry of entries) {
    totalSize += entry.header.size;
    const resolved = path.resolve(path.join(destDir, entry.entryName));
    if (resolved !== destResolved && !resolved.startsWith(destResolved + path.sep)) {
      throw new Error('That archive contains an unsafe file path and was rejected.');
    }
  }
  if (totalSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
    throw new Error('That archive is too large once extracted (500MB limit).');
  }

  fs.mkdirSync(destDir, { recursive: true });
  zip.extractAllTo(destDir, true);
}

app.post('/api/admin/site-files', requireAdmin, (req, res) => {
  siteFileUpload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const type = (req.body.type || '').trim();
    const nameField = (req.body.name || '').trim();
    const tempPath = req.file.path;
    const cleanup = () => fs.unlink(tempPath, () => {});

    try {
      if (type === 'games' || type === 'tools') {
        const baseDir = type === 'games' ? GAMES_DIR : TOOLS_DIR;
        if (!/\.zip$/i.test(req.file.originalname)) {
          cleanup();
          return res.status(400).json({ error: 'Games and tools need a .zip of the folder\'s files.' });
        }
        const folderName = safeSlug(nameField || req.file.originalname.replace(/\.zip$/i, ''), 'item-' + crypto.randomUUID().slice(0, 8));
        const destDir = path.join(baseDir, folderName);
        if (fs.existsSync(destDir)) {
          cleanup();
          return res.status(409).json({ error: `"${folderName}" already exists there — pick a different name.` });
        }
        extractZipSafely(tempPath, destDir);
        cleanup();
        return res.status(201).json({ path: `${type}/${folderName}` });
      }

      if (type === 'gameIcons') {
        const fileName = safeFileName(nameField ? nameField + path.extname(req.file.originalname) : req.file.originalname);
        let destPath = path.join(ICONS_DIR, fileName);
        if (fs.existsSync(destPath)) {
          const ext = path.extname(fileName);
          destPath = path.join(ICONS_DIR, `${path.basename(fileName, ext)}-${crypto.randomUUID().slice(0, 6)}${ext}`);
        }
        fs.copyFileSync(tempPath, destPath);
        cleanup();
        return res.status(201).json({ path: `gameIcons/${path.basename(destPath)}` });
      }

      cleanup();
      return res.status(400).json({ error: 'Unknown upload type.' });
    } catch (ex) {
      cleanup();
      return res.status(400).json({ error: ex.message || 'Could not process that upload.' });
    }
  });
});

// ── static site ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Seal is running at http://localhost:${PORT}`);
});
