// ═══════════════════════════════════════════════════════════════
//  Seal — backend
//  Real accounts, a banner that's stored on the server (so it's
//  the same for every visitor), and a game/tool library that can
//  be edited from the admin panel OR by hand-editing data/db.json.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const session = require('express-session');
const bcrypt = require('bcryptjs');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DATA_DIR lets you point storage at a mounted persistent disk (Render,
// Fly, a VPS volume, etc.) instead of the app folder, so your data
// survives redeploys. Defaults to ./data for plain local/VPS use.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');
const PORT = process.env.PORT || 3000;

// ── tiny file-backed "database" ───────────────────────────────
// Good enough for a small self-hosted site. Swap for real SQLite
// later if you outgrow it — every route below just calls readDB/writeDB.
function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify({
      users: {},
      banner: { active: false, text: '', type: 'info' },
      popup: { active: false, id: null, title: '', text: '' },
      games: [],
      tools: [],
      chat: []
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

const app = express();
app.set('trust proxy', 1); // Render (and most hosts) sit behind a proxy — needed for secure cookies to work
app.use(express.json());
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
  res.json({ username, isAdmin: isAdmin(username) });
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
  res.json({ username: record.username, isAdmin: isAdmin(record.username) });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  res.json({ username: req.session.user, isAdmin: isAdmin(req.session.user) });
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

// ── static site ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

app.listen(PORT, () => {
  console.log(`Seal is running at http://localhost:${PORT}`);
});
