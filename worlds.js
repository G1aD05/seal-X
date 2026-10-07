'use strict';

/**
 * Seal Worlds — a small Roblox-style multiplayer game for Seal.
 *
 * Mounted from server.js with:
 *   require('./worlds')(app, { readDB, writeDB, requireLogin, requireTier4,
 *                               isTier4, audit, avatarColor });
 *
 * How it works
 *  - A "world" is a saved record in db.worlds (id, name, template, creator).
 *    Only Tier 4+ admins can create or delete worlds, for now. The layout
 *    (size, ground colour, obstacles) comes from a hard-coded template, so
 *    there is no world-editor yet.
 *  - Everyone signed in can join any world. Joining opens a Server-Sent
 *    Events stream (same pattern as chat); the live players of a world exist
 *    only in memory and vanish when their stream closes.
 *  - The server is authoritative. Clients send the position they want to move
 *    to; the server limits it to the player's speed, keeps them inside the
 *    world and out of obstacles, and broadcasts a snapshot ten times a second.
 *  - Dev products are repeatable purchases paid for in Seals. The server
 *    checks the balance and applies the effect; the client only displays it.
 *
 * Future scripting: world records carry a `script` field (null for now) so a
 * scripting language can attach to a world later without a data migration.
 */

const crypto = require('crypto');
const path = require('path');

/* ---------------------------------------------------------------- tuning */

const WORLD_W = 1600;
const WORLD_H = 1000;
const PLAYER_RADIUS = 14;
const BASE_SPEED = 180;            // px per second
const MAX_PLAYERS_PER_WORLD = 16;
const MAX_WORLDS = 30;
const TICK_MS = 100;               // snapshot rate (10/s)
const MOVE_MIN_INTERVAL_MS = 40;   // ignore move spam faster than this
const MAX_MOVE_DT_S = 1.0;         // a long gap never earns more than this much travel (bounds a teleport after idling; walls still apply)
const SPEED_TOLERANCE = 1.25;      // slack for network jitter
const COLLISION_STEP = 8;          // px; keeps fast moves from tunnelling through thin walls
const MAX_EFFECT_STACK_MS = 15 * 60 * 1000;

/* ------------------------------------------------------------- templates */

// Obstacles are axis-aligned rectangles that block movement. `kind` only
// tells the client how to draw them.
const TEMPLATES = {
  meadow: {
    label: 'Meadow',
    ground: '#2f6b3a',
    spawn: { x: 800, y: 500 },
    obstacles: [
      { kind: 'tree', x: 300,  y: 200, w: 60, h: 60 },
      { kind: 'tree', x: 1250, y: 260, w: 60, h: 60 },
      { kind: 'tree', x: 500,  y: 720, w: 60, h: 60 },
      { kind: 'tree', x: 1100, y: 780, w: 60, h: 60 },
      { kind: 'tree', x: 200,  y: 600, w: 60, h: 60 },
      { kind: 'tree', x: 1400, y: 540, w: 60, h: 60 },
      { kind: 'rock', x: 700,  y: 300, w: 100, h: 70 },
      { kind: 'rock', x: 900,  y: 650, w: 120, h: 80 },
      { kind: 'water', x: 1050, y: 120, w: 260, h: 160 }
    ]
  },
  beach: {
    label: 'Beach',
    ground: '#d9c27a',
    spawn: { x: 800, y: 600 },
    obstacles: [
      { kind: 'water', x: 0,   y: 820, w: 1600, h: 180 },
      { kind: 'water', x: 600, y: 300, w: 300,  h: 200 },
      { kind: 'tree',  x: 250, y: 250, w: 60,   h: 60 },
      { kind: 'tree',  x: 1300, y: 400, w: 60,  h: 60 },
      { kind: 'tree',  x: 1100, y: 650, w: 60,  h: 60 },
      { kind: 'tree',  x: 380,  y: 640, w: 60,  h: 60 },
      { kind: 'rock',  x: 1150, y: 150, w: 110, h: 70 },
      { kind: 'rock',  x: 150,  y: 450, w: 90,  h: 70 }
    ]
  },
  blank: {
    label: 'Blank (build it in the Studio)',
    ground: '#3b6e4f',
    spawn: { x: 800, y: 500 },
    obstacles: []
  },
  arena: {
    label: 'Arena',
    ground: '#3a3f4b',
    spawn: { x: 800, y: 180 },
    obstacles: [
      { kind: 'wall', x: 400,  y: 250, w: 80,  h: 80 },
      { kind: 'wall', x: 1120, y: 250, w: 80,  h: 80 },
      { kind: 'wall', x: 400,  y: 670, w: 80,  h: 80 },
      { kind: 'wall', x: 1120, y: 670, w: 80,  h: 80 },
      { kind: 'wall', x: 740,  y: 440, w: 120, h: 120 }
    ]
  }
};

/* ---------------------------------------------------------- dev products */

// Repeatable purchases, paid in Seals. `effect` products last for
// `durationMs` (buying again extends them); `instant` ones just fire once.
const PRODUCTS = [
  { id: 'speed-boost',   label: 'Speed Boost',   desc: 'Run 1.6× faster for 2 minutes.',      price: 15, effect: 'speed', durationMs: 2 * 60 * 1000 },
  { id: 'big-seal',      label: 'Big Seal',      desc: 'Grow to double size for 3 minutes.',        price: 10, effect: 'big',   durationMs: 3 * 60 * 1000 },
  { id: 'rainbow-trail', label: 'Rainbow Trail', desc: 'Leave a rainbow trail for 5 minutes.',      price: 25, effect: 'trail', durationMs: 5 * 60 * 1000 },
  { id: 'confetti',      label: 'Confetti Burst', desc: 'Throw confetti that everyone in the world sees.', price: 5, instant: 'confetti' }
];
const SPEED_BOOST_MULTIPLIER = 1.6;

/* --------------------------------------------------------------- helpers */

function round1(n) { return Math.round(n * 10) / 10; }
function round2(n) { return Math.round(n * 100) / 100; }

function cleanWorldName(raw) {
  // Strip control characters and collapse whitespace.
  return String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
}

// A world uses its own saved layout (made in the Studio) when it has one, otherwise its template's.
function layoutFor(world) {
  const t = TEMPLATES[world.template] || TEMPLATES.meadow;
  const l = world.layout;
  if (l && Array.isArray(l.obstacles)) {
    return { width: WORLD_W, height: WORLD_H, ground: l.ground || t.ground, spawn: l.spawn || t.spawn, obstacles: l.obstacles };
  }
  return { width: WORLD_W, height: WORLD_H, ground: t.ground, spawn: t.spawn, obstacles: t.obstacles };
}

const OBSTACLE_KINDS = ['tree', 'rock', 'water', 'wall'];
const MAX_OBSTACLES = 300;
const MIN_OBJECT_SIZE = 20;

/** Validates a layout sent by the Studio and returns a clean copy ({ layout } or { error }). */
function cleanLayout(raw) {
  if (!raw || typeof raw !== 'object') return { error: 'Missing layout.' };
  if (!/^#[0-9a-f]{6}$/i.test(String(raw.ground))) return { error: 'Ground must be a #rrggbb colour.' };
  const sx = Number(raw.spawn && raw.spawn.x), sy = Number(raw.spawn && raw.spawn.y);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return { error: 'Bad spawn point.' };
  if (!Array.isArray(raw.obstacles)) return { error: 'Missing objects.' };
  if (raw.obstacles.length > MAX_OBSTACLES) return { error: `A world can have at most ${MAX_OBSTACLES} objects.` };
  const obstacles = [];
  for (const o of raw.obstacles) {
    if (!o || !OBSTACLE_KINDS.includes(o.kind)) return { error: 'Unknown object type.' };
    const w = Math.round(Number(o.w)), h = Math.round(Number(o.h)), x = Number(o.x), y = Number(o.y);
    if (![w, h, x, y].every(Number.isFinite)) return { error: 'Bad object size or position.' };
    const cw = Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_W, w)), ch = Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_H, h));
    obstacles.push({
      kind: o.kind, w: cw, h: ch,
      x: Math.round(Math.max(0, Math.min(WORLD_W - cw, x))),
      y: Math.round(Math.max(0, Math.min(WORLD_H - ch, y)))
    });
  }
  return { layout: {
    ground: String(raw.ground).toLowerCase(),
    spawn: { x: Math.round(Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, sx))), y: Math.round(Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, sy))) },
    obstacles
  } };
}

/** Pushes a circle out of one rectangle (no-op when they don't overlap). */
function pushOutOfRect(p, r) {
  const nx = Math.max(r.x, Math.min(p.x, r.x + r.w));
  const ny = Math.max(r.y, Math.min(p.y, r.y + r.h));
  let dx = p.x - nx, dy = p.y - ny;
  const d2 = dx * dx + dy * dy;
  if (d2 >= PLAYER_RADIUS * PLAYER_RADIUS) return;
  if (d2 > 0.0001) {
    const d = Math.sqrt(d2);
    p.x = nx + (dx / d) * PLAYER_RADIUS;
    p.y = ny + (dy / d) * PLAYER_RADIUS;
    return;
  }
  // Centre is inside the rectangle: leave through the nearest side.
  const left = p.x - r.x, right = r.x + r.w - p.x, top = p.y - r.y, bottom = r.y + r.h - p.y;
  const m = Math.min(left, right, top, bottom);
  if (m === left) p.x = r.x - PLAYER_RADIUS;
  else if (m === right) p.x = r.x + r.w + PLAYER_RADIUS;
  else if (m === top) p.y = r.y - PLAYER_RADIUS;
  else p.y = r.y + r.h + PLAYER_RADIUS;
}

function clampToWorld(p) {
  p.x = Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, p.x));
  p.y = Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, p.y));
}

/**
 * Moves `p` toward (tx, ty) by at most `maxDist`, in small steps so it can
 * neither jump over a thin obstacle nor end up inside one. Mutates p.
 */
function stepToward(p, tx, ty, maxDist, obstacles) {
  let dx = tx - p.x, dy = ty - p.y;
  const dist = Math.hypot(dx, dy);
  if (!(dist > 0)) return;
  const travel = Math.min(dist, maxDist);
  dx /= dist; dy /= dist;
  const steps = Math.max(1, Math.ceil(travel / COLLISION_STEP));
  const stepLen = travel / steps;
  for (let i = 0; i < steps; i++) {
    p.x += dx * stepLen;
    p.y += dy * stepLen;
    clampToWorld(p);
    for (const o of obstacles) pushOutOfRect(p, o);
    clampToWorld(p);
  }
}

function effectsOf(record, now) {
  const fx = (record && record.worldFx) || {};
  return {
    speed: (fx.speed || 0) > now,
    big:   (fx.big   || 0) > now,
    trail: (fx.trail || 0) > now
  };
}

/* ----------------------------------------------------------------- mount */

/**
 * @param {import('express').Express} app
 */
module.exports = function mountWorlds(app, deps) {
  const { readDB, writeDB, requireLogin, requireTier4, isTier4, audit, avatarColor } = deps || {};
  const burn = typeof (deps && deps.burn) === 'function' ? deps.burn : null; // optional: burn(db, kind, amount) records Seals removed from the economy
  for (const [k, v] of Object.entries({ readDB, writeDB, requireLogin, requireTier4, isTier4, audit, avatarColor })) {
    if (typeof v !== 'function') throw new Error(`mountWorlds needs ${k} from server.js`);
  }

  // Live, in-memory state. Nothing here is persisted.
  const live = new Map();          // worldId -> { clients: Set<res>, players: Map<userKey, player> }
  const playerWorld = new Map();   // userKey -> worldId
  let tickTimer = null;

  function worldRoom(worldId) {
    let room = live.get(worldId);
    if (!room) { room = { clients: new Set(), players: new Map() }; live.set(worldId, room); }
    return room;
  }

  function send(res, event, payload) {
    try { res.write(`event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`); } catch { /* connection gone */ }
  }
  function broadcast(worldId, event, payload) {
    const room = live.get(worldId);
    if (!room) return;
    for (const res of room.clients) send(res, event, payload);
  }

  function snapshot(worldId) {
    const room = live.get(worldId);
    const db = readDB();
    const now = Date.now();
    const players = [];
    for (const [key, p] of room.players) {
      const fx = effectsOf(db.users[key], now);
      players.push({ n: p.name, x: round1(p.x), y: round1(p.y), c: p.color, b: fx.big ? 1 : 0, t: fx.trail ? 1 : 0, s: fx.speed ? 1 : 0 });
    }
    return players;
  }

  function ensureTicker() {
    if (tickTimer) return;
    tickTimer = setInterval(() => {
      let anyone = false;
      for (const [worldId, room] of live) {
        if (!room.clients.size) continue;
        anyone = true;
        broadcast(worldId, 'state', { players: snapshot(worldId) });
      }
      if (!anyone) { clearInterval(tickTimer); tickTimer = null; }
    }, TICK_MS);
  }

  function removePlayer(key, res) {
    const worldId = playerWorld.get(key);
    if (!worldId) return;
    const room = live.get(worldId);
    if (!room) { playerWorld.delete(key); return; }
    const p = room.players.get(key);
    // Only remove if this is still the connection that owns the slot — a
    // newer join from another tab must not be wiped by the old one closing.
    if (p && res && p.res !== res) return;
    room.players.delete(key);
    if (res) room.clients.delete(res);
    playerWorld.delete(key);
    if (!room.clients.size && !room.players.size) live.delete(worldId);
    else broadcast(worldId, 'left', { n: p ? p.name : key });
  }

  function worldById(db, id) {
    return db.worlds.find(w => w.id === id) || null;
  }

  function publicWorld(w) {
    const room = live.get(w.id);
    return {
      id: w.id,
      name: w.name,
      template: w.template,
      createdBy: w.createdBy,
      createdAt: w.createdAt,
      players: room ? room.players.size : 0,
      maxPlayers: MAX_PLAYERS_PER_WORLD,
      ground: layoutFor(w).ground,
      custom: !!w.layout
    };
  }

  /* ----- lobby ----- */

  // Public, like the games list: anyone can see which worlds exist.
  app.get('/api/worlds', (req, res) => {
    const db = readDB();
    res.json({
      worlds: db.worlds.map(publicWorld),
      templates: Object.entries(TEMPLATES).map(([id, t]) => ({ id, label: t.label })),
      canCreate: !!(req.session.user && isTier4(req.session.user)),
      maxPlayers: MAX_PLAYERS_PER_WORLD
    });
  });

  // Tier 4+ only, for now. A world is just a name and a template.
  app.post('/api/worlds', requireTier4, (req, res) => {
    const name = cleanWorldName(req.body && req.body.name);
    const template = String((req.body && req.body.template) || 'meadow');
    if (name.length < 3 || name.length > 30) {
      return res.status(400).json({ error: 'World names must be 3–30 characters.' });
    }
    if (!TEMPLATES[template]) return res.status(400).json({ error: 'Unknown world template.' });

    const db = readDB();
    if (db.worlds.length >= MAX_WORLDS) {
      return res.status(400).json({ error: `There can be at most ${MAX_WORLDS} worlds. Delete one first.` });
    }
    if (db.worlds.some(w => w.name.toLowerCase() === name.toLowerCase())) {
      return res.status(409).json({ error: 'A world with that name already exists.' });
    }
    const world = {
      id: crypto.randomBytes(5).toString('hex'),
      name,
      template,
      createdBy: req.session.user,
      createdAt: new Date().toISOString(),
      script: null // reserved for the future scripting language
    };
    db.worlds.push(world);
    audit(db, req.session.user, 'create-world', name, `template: ${template}`);
    writeDB(db);
    res.json(publicWorld(world));
  });

  app.delete('/api/worlds/:id', requireTier4, (req, res) => {
    const db = readDB();
    const idx = db.worlds.findIndex(w => w.id === req.params.id);
    if (idx === -1) return res.status(404).json({ error: 'No such world.' });
    const [world] = db.worlds.splice(idx, 1);
    audit(db, req.session.user, 'delete-world', world.name, '');
    writeDB(db);

    const room = live.get(world.id);
    if (room) {
      broadcast(world.id, 'closed', { reason: 'This world was deleted.' });
      for (const [key] of room.players) playerWorld.delete(key);
      for (const client of room.clients) { try { client.end(); } catch { /* already closed */ } }
      live.delete(world.id);
    }
    res.json({ ok: true });
  });

  /* ----- World Studio (Tier 4+) ----- */

  // The page itself is gated too (the API below is the real lock).
  app.get('/studio.html', (req, res) => {
    if (!(req.session.user && isTier4(req.session.user))) return res.redirect('/worlds.html');
    res.sendFile(path.join(__dirname, 'public', 'studio.html'));
  });

  app.get('/api/worlds/:id/layout', requireTier4, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    res.json({
      world: publicWorld(world),
      layout: layoutFor(world),
      limits: { width: WORLD_W, height: WORLD_H, maxObstacles: MAX_OBSTACLES, minSize: MIN_OBJECT_SIZE, radius: PLAYER_RADIUS, kinds: OBSTACLE_KINDS },
      templates: Object.fromEntries(Object.entries(TEMPLATES).map(([id, t]) => [id, { label: t.label, ground: t.ground, spawn: t.spawn, obstacles: t.obstacles }]))
    });
  });

  // Saves a layout (and optionally a new name). Players inside the world get it live.
  app.put('/api/worlds/:id/layout', requireTier4, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    const r = cleanLayout(req.body && req.body.layout);
    if (r.error) return res.status(400).json({ error: r.error });
    if (req.body && req.body.name !== undefined) {
      const name = cleanWorldName(req.body.name);
      if (name.length < 3 || name.length > 30) return res.status(400).json({ error: 'World names must be 3–30 characters.' });
      if (db.worlds.some(w => w.id !== world.id && w.name.toLowerCase() === name.toLowerCase())) {
        return res.status(409).json({ error: 'A world with that name already exists.' });
      }
      world.name = name;
    }
    world.layout = r.layout;
    world.layoutBy = req.session.user;
    world.layoutAt = new Date().toISOString();
    audit(db, req.session.user, 'edit-world', world.name, `${r.layout.obstacles.length} objects`);
    writeDB(db);

    const room = live.get(world.id);
    if (room) {
      // Anyone now standing inside a new obstacle is nudged out; everyone gets the new layout.
      for (const p of room.players.values()) {
        clampToWorld(p);
        for (const o of r.layout.obstacles) pushOutOfRect(p, o);
      }
      broadcast(world.id, 'layout', { name: world.name, ground: r.layout.ground, spawn: r.layout.spawn, obstacles: r.layout.obstacles });
    }
    res.json({ ok: true, world: publicWorld(world) });
  });

  /* ----- joining a world (the live stream) ----- */

  app.get('/api/worlds/:id/stream', requireLogin, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });

    const record = db.users[req.session.user.toLowerCase()];
    const key = record.username.toLowerCase();
    const room = worldRoom(world.id);

    // One world per account: a second join (another tab, another world)
    // replaces the first.
    const existingWorldId = playerWorld.get(key);
    if (existingWorldId) {
      const oldRoom = live.get(existingWorldId);
      const old = oldRoom && oldRoom.players.get(key);
      if (old) {
        send(old.res, 'kicked', { reason: 'You joined a world from somewhere else.' });
        const oldRes = old.res;
        removePlayer(key, oldRes);
        try { oldRes.end(); } catch { /* already closed */ }
      } else {
        playerWorld.delete(key);
      }
    }
    if (room.players.size >= MAX_PLAYERS_PER_WORLD) {
      if (!room.clients.size && !room.players.size) live.delete(world.id);
      return res.status(409).json({ error: 'That world is full.' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');

    const layout = layoutFor(world);
    const player = {
      name: record.username,
      x: layout.spawn.x + (Math.random() - 0.5) * 60,
      y: layout.spawn.y + (Math.random() - 0.5) * 60,
      color: avatarColor(record),
      lastMoveAt: Date.now(),
      res
    };
    clampToWorld(player);
    for (const o of layout.obstacles) pushOutOfRect(player, o);

    room.players.set(key, player);
    room.clients.add(res);
    playerWorld.set(key, world.id);

    const now = Date.now();
    send(res, 'hello', {
      you: { name: player.name, x: round1(player.x), y: round1(player.y) },
      world: { id: world.id, name: world.name, ...layout },
      radius: PLAYER_RADIUS,
      baseSpeed: BASE_SPEED,
      boostMultiplier: SPEED_BOOST_MULTIPLIER,
      players: snapshot(world.id),
      seals: record.seals,
      effects: effectsOf(record, now),
      products: PRODUCTS.map(p => ({ id: p.id, label: p.label, desc: p.desc, price: p.price }))
    });
    broadcast(world.id, 'joined', { n: player.name });
    ensureTicker();

    const keepAlive = setInterval(() => { try { res.write(': ping\n\n'); } catch { /* closing */ } }, 25000);
    req.on('close', () => {
      clearInterval(keepAlive);
      removePlayer(key, res);
    });
  });

  /* ----- movement ----- */

  function livePlayer(req, worldId) {
    const key = req.session.user.toLowerCase();
    if (playerWorld.get(key) !== worldId) return null;
    const room = live.get(worldId);
    return room ? { key, player: room.players.get(key), room } : null;
  }

  app.post('/api/worlds/:id/move', requireLogin, (req, res) => {
    const found = livePlayer(req, req.params.id);
    if (!found || !found.player) return res.status(409).json({ error: 'You are not in that world.' });
    const { key, player } = found;

    const tx = Number(req.body && req.body.x), ty = Number(req.body && req.body.y);
    if (!Number.isFinite(tx) || !Number.isFinite(ty)) return res.status(400).json({ error: 'Bad position.' });

    const now = Date.now();
    if (now - player.lastMoveAt < MOVE_MIN_INTERVAL_MS) {
      return res.json({ x: round1(player.x), y: round1(player.y) });
    }
    const dt = Math.min((now - player.lastMoveAt) / 1000, MAX_MOVE_DT_S);
    player.lastMoveAt = now;

    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    const fx = effectsOf(db.users[key], now);
    const speed = BASE_SPEED * (fx.speed ? SPEED_BOOST_MULTIPLIER : 1);
    const maxDist = speed * dt * SPEED_TOLERANCE + 1;

    stepToward(player, tx, ty, maxDist, layoutFor(world).obstacles);
    res.json({ x: round1(player.x), y: round1(player.y) });
  });

  /* ----- dev products ----- */

  app.post('/api/worlds/products/:productId/buy', requireLogin, (req, res) => {
    const product = PRODUCTS.find(p => p.id === req.params.productId);
    if (!product) return res.status(404).json({ error: 'Unknown product.' });

    const key = req.session.user.toLowerCase();
    const worldId = playerWorld.get(key);
    const room = worldId && live.get(worldId);
    const player = room && room.players.get(key);
    if (!player) return res.status(409).json({ error: 'Join a world to buy products.' });

    const db = readDB();
    const record = db.users[key];
    if (record.seals < product.price) return res.status(400).json({ error: 'Not enough Seals.' });

    const now = Date.now();
    if (product.effect) {
      if (!record.worldFx || typeof record.worldFx !== 'object') record.worldFx = {};
      const base = Math.max(now, record.worldFx[product.effect] || 0);
      if (base - now >= MAX_EFFECT_STACK_MS) {
        return res.status(400).json({ error: 'You already have the maximum time on that.' });
      }
      record.worldFx[product.effect] = Math.min(base + product.durationMs, now + MAX_EFFECT_STACK_MS);
    }
    record.seals = round2(record.seals - product.price);
    if (!record.worldStats || typeof record.worldStats !== 'object') record.worldStats = { purchases: 0, sealsSpent: 0 };
    record.worldStats.purchases += 1;
    record.worldStats.sealsSpent = round2(record.worldStats.sealsSpent + product.price);
    if (burn) burn(db, 'worldProducts', product.price);
    writeDB(db);

    if (product.instant === 'confetti') {
      broadcast(worldId, 'fx', { type: 'confetti', n: player.name, x: round1(player.x), y: round1(player.y) });
    }
    res.json({ seals: record.seals, effects: effectsOf(record, now) });
  });
};

module.exports.TEMPLATES = TEMPLATES;
module.exports.PRODUCTS = PRODUCTS;
