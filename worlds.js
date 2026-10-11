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
 * Scripting (see public/scripting.html for the author-facing API)
 *  - A world record carries `scripts`: [{ id, name, side: 'server' | 'client', enabled, source }],
 *    written in the Studio by Tier 4+ admins.
 *  - Server scripts run on the server in a sandboxed worker thread (world-scripting.js) while
 *    anyone is in the world. They can change players (speed, size, colour, teleport, freeze...),
 *    the live world (ground, spawn, objects) and message clients. None of that is saved.
 *  - Client scripts are sent to each player on join and run in a locked-down Web Worker in their
 *    browser (world-sandbox-client.js, public/js/worldScripts.js): camera, HUD, input, local
 *    effects. A client script can never change the world for other players or touch Seals.
 *  - RemoteEvents are named messages between the two: clients fire POST /api/worlds/:id/remote,
 *    scripts fire back over the world's event stream.
 */

const crypto = require('crypto');
const path = require('path');
const vmCompile = require('vm');
const { ScriptSandbox } = require('./world-scripting');

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

// What scripts may do to a player (all cosmetic or movement; never Seals or accounts).
const MIN_SCALE = 0.25;
const MAX_SCALE = 6;
const MAX_SPEED_MULT = 5;
const MAX_TITLE_CHARS = 24;
const MAX_ATTRS = 12;
const MAX_ATTR_STRING = 100;
const MAX_MESSAGE_CHARS = 200;
const ATTR_KEY_RE = /^[A-Za-z0-9_]{1,24}$/;

// Scripting limits.
const MAX_SCRIPTS = 8;
const MAX_SCRIPT_CHARS = 20000;
const MAX_SCRIPT_TOTAL_CHARS = 100000;   // keeps the join message small: every player downloads the client scripts
const MAX_SCRIPT_NAME = 30;
const SCRIPT_TICK_MS = 50;               // how often server scripts get an onTick
const SCRIPT_LOG_LINES = 300;            // kept per world for the Studio's console
const REMOTE_NAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;
const MAX_REMOTE_BYTES = 4096;
const MAX_REMOTE_ARGS = 8;
const MAX_REMOTE_DEPTH = 6;
const CLIENT_REMOTE_PER_SEC = 30;        // per player, with a burst allowance
const CLIENT_REMOTE_BURST = 60;
const SERVER_REMOTE_PER_SEC = 200;       // per world, scripts -> clients
const MAX_TEMPLATES = 20;                // clonable objects in a world's Storage
const MAX_TEMPLATE_SCRIPT_CHARS = 4000;  // one object script; it runs once per object made from the template
const MAX_TEMPLATE_SCRIPT_TOTAL = 40000;
const TEMPLATE_NAME_RE = /^[A-Za-z0-9_ -]{1,30}$/;
const MAX_TOUCH_EVENTS_PER_TICK = 40;    // object touches handed to scripts per tick; the rest wait for the next one
const MAX_DELTA_OBJECTS = 80;            // more changed objects than this and everyone gets the full layout instead

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

const OBSTACLE_KINDS = ['tree', 'rock', 'water', 'wall', 'svg'];
const MAX_OBSTACLES = 300;
const MIN_OBJECT_SIZE = 20;

/** Validates a layout sent by the Studio and returns a clean copy ({ layout } or { error }). */
function cleanLayout(raw, assetIds) {
  if (!raw || typeof raw !== 'object') return { error: 'Missing layout.' };
  if (!/^#[0-9a-f]{6}$/i.test(String(raw.ground))) return { error: 'Ground must be a #rrggbb colour.' };
  const sx = Number(raw.spawn && raw.spawn.x), sy = Number(raw.spawn && raw.spawn.y);
  if (!Number.isFinite(sx) || !Number.isFinite(sy)) return { error: 'Bad spawn point.' };
  if (!Array.isArray(raw.obstacles)) return { error: 'Missing objects.' };
  if (raw.obstacles.length > MAX_OBSTACLES) return { error: `A world can have at most ${MAX_OBSTACLES} objects.` };
  const obstacles = [];
  for (const o of raw.obstacles) {
    if (!o || !OBSTACLE_KINDS.includes(o.kind)) return { error: 'Unknown object type.' };
    if (o.kind === 'svg' && !(typeof o.asset === 'string' && assetIds && assetIds.has(o.asset))) return { error: 'An SVG object uses a design that no longer exists.' };
    const w = Math.round(Number(o.w)), h = Math.round(Number(o.h)), x = Number(o.x), y = Number(o.y);
    if (![w, h, x, y].every(Number.isFinite)) return { error: 'Bad object size or position.' };
    const cw = Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_W, w)), ch = Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_H, h));
    const clean = {
      kind: o.kind, w: cw, h: ch,
      x: Math.round(Math.max(0, Math.min(WORLD_W - cw, x))),
      y: Math.round(Math.max(0, Math.min(WORLD_H - ch, y)))
    };
    if (o.kind === 'svg') { clean.asset = o.asset; clean.solid = o.solid !== false; }
    if (typeof o.tpl === 'string' && TEMPLATE_NAME_RE.test(o.tpl)) clean.tpl = o.tpl;   // runs that template's script
    obstacles.push(clean);
  }
  return { layout: {
    ground: String(raw.ground).toLowerCase(),
    spawn: { x: Math.round(Math.max(PLAYER_RADIUS, Math.min(WORLD_W - PLAYER_RADIUS, sx))), y: Math.round(Math.max(PLAYER_RADIUS, Math.min(WORLD_H - PLAYER_RADIUS, sy))) },
    obstacles
  } };
}

/** Pushes a circle out of one rectangle (no-op when they don't overlap). */
function pushOutOfRect(p, r) {
  if (r.solid === false) return; // decoration only: drawn, but players walk through it
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

/* --------------------------------------------------------------- scripting */

function freshMods() {
  return { speed: 1, scale: 1, trail: false, frozen: false, hidden: false, title: '' };
}

function cleanText(raw, max) {
  return String(raw == null ? '' : raw).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, max);
}

function clamp(n, lo, hi) { return Math.max(lo, Math.min(hi, n)); }

function isHexColor(v) { return typeof v === 'string' && /^#[0-9a-f]{6}$/i.test(v); }

/** Depth of a JSON-style value, stopping early once it is past `limit`. */
function jsonDepth(v, limit, d = 0) {
  if (d > limit) return d;
  if (v && typeof v === 'object') {
    let deepest = d + 1;
    for (const k of Object.keys(v)) deepest = Math.max(deepest, jsonDepth(v[k], limit, d + 1));
    return deepest;
  }
  return d;
}

/** Checks the arguments of a RemoteEvent. Returns { args } (a clean JSON copy) or { error }. */
function cleanRemoteArgs(raw) {
  if (raw === undefined || raw === null) return { args: [] };
  if (!Array.isArray(raw)) return { error: 'Remote event arguments must be a list.' };
  if (raw.length > MAX_REMOTE_ARGS) return { error: `A remote event can carry at most ${MAX_REMOTE_ARGS} values.` };
  let text;
  try { text = JSON.stringify(raw); } catch { return { error: 'Remote event values must be plain data (numbers, text, true/false, lists, objects).' }; }
  if (text === undefined || text.length > MAX_REMOTE_BYTES) return { error: `Remote event data is too big (limit ${MAX_REMOTE_BYTES} characters).` };
  if (jsonDepth(raw, MAX_REMOTE_DEPTH) > MAX_REMOTE_DEPTH) return { error: 'Remote event data is nested too deeply.' };
  return { args: JSON.parse(text) };
}

function cleanScriptName(raw, fallback) {
  return cleanText(raw, MAX_SCRIPT_NAME) || fallback;
}

/** Validates the scripts sent by the Studio and returns { scripts } or { error }. */
function cleanScripts(raw) {
  if (!Array.isArray(raw)) return { error: 'Missing scripts.' };
  if (raw.length > MAX_SCRIPTS) return { error: `A world can have at most ${MAX_SCRIPTS} scripts.` };
  const seen = new Set();
  const scripts = [];
  let total = 0;
  for (let i = 0; i < raw.length; i++) {
    const s = raw[i];
    if (!s || typeof s !== 'object') return { error: 'Bad script.' };
    if (s.side !== 'server' && s.side !== 'client') return { error: 'A script must be a server script or a client script.' };
    const source = typeof s.source === 'string' ? s.source : '';
    if (source.length > MAX_SCRIPT_CHARS) return { error: `“${cleanScriptName(s.name, 'Script ' + (i + 1))}” is too long (limit ${MAX_SCRIPT_CHARS} characters).` };
    total += source.length;
    if (total > MAX_SCRIPT_TOTAL_CHARS) return { error: `Scripts are too long in total (limit ${MAX_SCRIPT_TOTAL_CHARS} characters).` };
    let id = typeof s.id === 'string' && /^[a-z0-9]{4,16}$/.test(s.id) ? s.id : null;
    if (!id || seen.has(id)) id = crypto.randomBytes(4).toString('hex');
    seen.add(id);
    scripts.push({
      id,
      name: cleanScriptName(s.name, (s.side === 'server' ? 'Server' : 'Client') + ' script ' + (i + 1)),
      side: s.side,
      enabled: s.enabled !== false,
      source
    });
  }
  return { scripts };
}

function enabledScripts(world, side) {
  return (world.scripts || []).filter(s => s && s.enabled && s.side === side);
}

/**
 * Checks each script for syntax errors without running anything (compiling only), so the Studio
 * can point at a typo straight away. Returns [{ id, name, message }].
 */
function syntaxWarnings(scripts) {
  const out = [];
  for (const s of scripts) {
    try {
      new vmCompile.Script('(async function(){' + s.source + '\n})', { filename: s.name });
    } catch (err) {
      const line = /:(\d+)/.exec(String(err && err.stack || ''));
      out.push({ id: s.id, name: s.name, message: String(err && err.message || err).slice(0, 200), line: line ? Number(line[1]) : null });
    }
  }
  return out;
}

/** What a client script sees of a world's scripts: just the enabled client ones. */
function clientScriptList(world) {
  return enabledScripts(world, 'client').map(s => ({ id: s.id, name: s.name, source: s.source }));
}


/**
 * Validates a world's Storage: clonable objects, each with an optional script that runs once for
 * every object made from it. Returns { templates } or { error }.
 */
function cleanTemplates(raw, assetIds) {
  if (raw === undefined || raw === null) return { templates: [] };
  if (!Array.isArray(raw)) return { error: 'Bad storage.' };
  if (raw.length > MAX_TEMPLATES) return { error: `Storage can hold at most ${MAX_TEMPLATES} objects.` };
  const names = new Set();
  const templates = [];
  let total = 0;
  for (const t of raw) {
    if (!t || typeof t !== 'object') return { error: 'Bad storage item.' };
    const name = String(t.name == null ? '' : t.name).replace(/\s+/g, ' ').trim();
    if (!TEMPLATE_NAME_RE.test(name)) return { error: 'Storage names are 1-30 letters, numbers, spaces, _ or -.' };
    if (names.has(name.toLowerCase())) return { error: `Two storage items are called “${name}”.` };
    names.add(name.toLowerCase());
    if (!OBSTACLE_KINDS.includes(t.kind)) return { error: `“${name}” has an unknown object type.` };
    if (t.kind === 'svg' && !(typeof t.asset === 'string' && assetIds && assetIds.has(t.asset))) return { error: `“${name}” uses an SVG design that no longer exists.` };
    const w = Math.round(Number(t.w)), h = Math.round(Number(t.h));
    if (![w, h].every(Number.isFinite)) return { error: `“${name}” has a bad size.` };
    const script = typeof t.script === 'string' ? t.script : '';
    if (script.length > MAX_TEMPLATE_SCRIPT_CHARS) return { error: `The script in “${name}” is too long (limit ${MAX_TEMPLATE_SCRIPT_CHARS} characters).` };
    total += script.length;
    if (total > MAX_TEMPLATE_SCRIPT_TOTAL) return { error: `Storage scripts are too long in total (limit ${MAX_TEMPLATE_SCRIPT_TOTAL} characters).` };
    const clean = {
      name, kind: t.kind,
      w: Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_W, w)), h: Math.max(MIN_OBJECT_SIZE, Math.min(WORLD_H, h)),
      script
    };
    if (t.kind === 'svg') { clean.asset = t.asset; clean.solid = t.solid !== false; }
    templates.push(clean);
  }
  return { templates };
}

/** What clients may know about a template: its look, never its script. */
function templateForClient(t) {
  const o = { name: t.name, kind: t.kind, w: t.w, h: t.h };
  if (t.kind === 'svg') { o.asset = t.asset; o.solid = t.solid !== false; }
  return o;
}

function templateWarnings(templates) {
  return syntaxWarnings(templates.filter(t => t.script).map(t => ({ id: 'tpl:' + t.name, name: t.name, source: t.script })));
}

/* ------------------------------------------------------------ SVG designs */

// A design is stored as plain, validated shape data — never as raw SVG text — and turned into
// SVG (or drawn on a canvas) by our own code. That makes it impossible to smuggle script,
// external references or odd attributes in through a design.
const MAX_ASSETS = 100;
const MAX_SHAPES = 100;
const MAX_POINTS = 200;
const COLOR_RE = /^#(?:[0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i;

function paintOf(v, dflt) {
  if (v === undefined || v === null) return dflt;
  if (v === 'none') return 'none';
  return COLOR_RE.test(String(v)) ? String(v).toLowerCase() : null; // null = invalid
}
function numIn(v, lo, hi) {
  const n = Number(v);
  return Number.isFinite(n) ? Math.round(Math.max(lo, Math.min(hi, n)) * 100) / 100 : null;
}

function cleanShapes(raw) {
  if (!Array.isArray(raw)) return { error: 'Missing shapes.' };
  if (!raw.length) return { error: 'Draw at least one shape first.' };
  if (raw.length > MAX_SHAPES) return { error: `A design can have at most ${MAX_SHAPES} shapes.` };
  const out = [];
  for (const s of raw) {
    if (!s || typeof s !== 'object') return { error: 'Bad shape.' };
    const isLine = s.t === 'line';
    const fill = paintOf(s.fill, isLine ? 'none' : '#cccccc');
    const stroke = paintOf(s.stroke, 'none');
    const sw = numIn(s.sw === undefined ? 0 : s.sw, 0, 20);
    const op = numIn(s.op === undefined ? 1 : s.op, 0.05, 1);
    if (fill === null || stroke === null || sw === null || op === null) return { error: 'Bad colour or style on a shape.' };
    const base = { fill, stroke, sw, op };
    const C = v => numIn(v, -100, 500);
    if (s.t === 'rect') {
      const x = C(s.x), y = C(s.y), w = numIn(s.w, 1, 600), h = numIn(s.h, 1, 600), rx = numIn(s.rx === undefined ? 0 : s.rx, 0, 300);
      if ([x, y, w, h, rx].includes(null)) return { error: 'Bad rectangle.' };
      out.push({ t: 'rect', x, y, w, h, rx, ...base });
    } else if (s.t === 'ellipse') {
      const cx = C(s.cx), cy = C(s.cy), rx = numIn(s.rx, 0.5, 300), ry = numIn(s.ry, 0.5, 300);
      if ([cx, cy, rx, ry].includes(null)) return { error: 'Bad ellipse.' };
      out.push({ t: 'ellipse', cx, cy, rx, ry, ...base });
    } else if (s.t === 'line') {
      const x1 = C(s.x1), y1 = C(s.y1), x2 = C(s.x2), y2 = C(s.y2);
      if ([x1, y1, x2, y2].includes(null)) return { error: 'Bad line.' };
      out.push({ t: 'line', x1, y1, x2, y2, ...base });
    } else if (s.t === 'poly') {
      if (!Array.isArray(s.pts) || s.pts.length < 2 || s.pts.length > MAX_POINTS) return { error: `Polygons need 2–${MAX_POINTS} points.` };
      const pts = [];
      for (const q of s.pts) {
        const px = Array.isArray(q) ? C(q[0]) : null, py = Array.isArray(q) ? C(q[1]) : null;
        if (px === null || py === null) return { error: 'Bad polygon point.' };
        pts.push([px, py]);
      }
      out.push({ t: 'poly', pts, closed: s.closed !== false, ...base });
    } else {
      return { error: 'Unknown shape type.' };
    }
  }
  return { shapes: out };
}

function cleanAsset(body) {
  const name = String((body && body.name) == null ? '' : body.name).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim();
  if (name.length < 1 || name.length > 30) return { error: 'Design names must be 1–30 characters.' };
  const w = numIn(body && body.w, 10, 400), h = numIn(body && body.h, 10, 400);
  if (w === null || h === null) return { error: 'Bad design size.' };
  const r = cleanShapes(body && body.shapes);
  if (r.error) return r;
  return { asset: { name, w: Math.round(w), h: Math.round(h), shapes: r.shapes } };
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
  const live = new Map();          // worldId -> room (see worldRoom)
  const playerWorld = new Map();   // userKey -> worldId
  const scriptLogs = new Map();    // worldId -> { seq, lines }: the Studio's console; outlives the room so you can read what happened
  let tickTimer = null;
  let scriptTimer = null;

  /*
   * A room is one world while at least one person is in it.
   *   clients   open event streams           players   userKey -> player
   *   layout    the world as it is right now: the saved layout plus whatever scripts have changed
   *   dirty     object changes not yet sent to clients (sent on the next script tick)
   *   sandbox   the running server scripts, or null
   */
  function worldRoom(world) {
    let room = live.get(world.id);
    if (!room) {
      room = {
        id: world.id, name: world.name,
        clients: new Set(), players: new Map(),
        layout: null, nextObjId: 1, dirty: null,
        sandbox: null, startedAt: Date.now(), lastScriptTick: Date.now(),
        departed: new Map(), remoteWindow: { at: 0, n: 0 },
        templates: [], watch: new Set(), touching: new Map()
      };
      room.layout = roomLayout(room, layoutFor(world));
      live.set(world.id, room);
    }
    return room;
  }

  // Copies a saved layout into a room, giving every object an id that scripts can refer to.
  function roomLayout(room, l) {
    room.nextObjId = 1;
    return {
      width: WORLD_W, height: WORLD_H, ground: l.ground,
      spawn: { x: l.spawn.x, y: l.spawn.y },
      // SVG designs keep their `asset` and `solid` flag: they are what the client draws and what blocks players.
      obstacles: l.obstacles.map(o => {
        const c = { id: 'o' + room.nextObjId++, kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h };
        if (o.kind === 'svg') { c.asset = o.asset; c.solid = o.solid !== false; }
        if (o.tpl) c.tpl = o.tpl;
        return c;
      })
    };
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
      const e = { n: p.name, x: round1(p.x), y: round1(p.y), c: p.color, b: fx.big ? 1 : 0, t: (fx.trail || p.mods.trail) ? 1 : 0, s: fx.speed ? 1 : 0 };
      // Only present when a script changed them, so an unscripted world sends exactly what it used to.
      if (p.mods.scale !== 1) e.z = round2(p.mods.scale);
      if (p.mods.speed !== 1) e.m = round2(p.mods.speed);
      if (p.mods.frozen) e.f = 1;
      if (p.mods.hidden) e.h = 1;
      if (p.mods.title) e.l = p.mods.title;
      players.push(e);
    }
    return players;
  }

  function attributesOf(room) {
    const out = {};
    for (const p of room.players.values()) if (Object.keys(p.attrs).length) out[p.name] = p.attrs;
    return out;
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

  /* ----- server scripts: running them ----- */

  function pushLog(worldId, level, text) {
    let log = scriptLogs.get(worldId);
    if (!log) { log = { seq: 0, lines: [] }; scriptLogs.set(worldId, log); }
    log.lines.push({ seq: ++log.seq, at: Date.now(), level, text: String(text).slice(0, 500) });
    if (log.lines.length > SCRIPT_LOG_LINES) log.lines.splice(0, log.lines.length - SCRIPT_LOG_LINES);
  }

  function stopScripts(room) {
    if (room.sandbox) { room.sandbox.dispose(); room.sandbox = null; }
  }

  // (Re)starts a room's server scripts from the world's saved scripts. Players already inside are
  // not announced again: scripts see them through players.all() when they start.
  function startScripts(room, world) {
    stopScripts(room);
    room.templates = (world.templates || []).map(t => Object.assign({}, t));
    room.watch = new Set();
    room.touching = new Map();
    const scripts = enabledScripts(world, 'server');
    // Objects placed in the Studio that use a Storage item with a script each get their own copy of it.
    const placed = room.layout.obstacles.filter(o => o.tpl && templateScript(room, o.tpl));
    if (!scripts.length && !placed.length) return;
    pushLog(room.id, 'info', `Starting ${scripts.length} server script${scripts.length === 1 ? '' : 's'}` + (placed.length ? ` and ${placed.length} object script${placed.length === 1 ? '' : 's'}` : '') + '…');
    try {
      const sb = new ScriptSandbox({
        scripts,
        host: (op, a) => scriptHost(room, op, a),
        log: (level, text) => pushLog(room.id, level, text),
        onDead: () => { if (room.sandbox === sb) room.sandbox = null; },
        // Object scripts start, then everyone already here is announced to onJoin.
        onReady: () => {
          for (const o of placed.slice()) startObjectScript(room, o);
          for (const p of room.players.values()) dispatchScript(room, 'join', { n: p.name });
        }
      });
      room.sandbox = sb;
      room.startedAt = Date.now();
      room.lastScriptTick = room.startedAt;
    } catch (err) {
      pushLog(room.id, 'error', 'Server scripts could not start: ' + (err && err.message ? err.message : err));
      return;
    }
    ensureScriptTicker();
  }

  function findTemplate(room, name) {
    const n = String(name == null ? '' : name).toLowerCase();
    return (room.templates || []).find(t => t.name.toLowerCase() === n) || null;
  }
  function templateScript(room, name) {
    const t = findTemplate(room, name);
    return t && t.script ? t.script : '';
  }
  // Hands one object its script. The script runs with `object` set to that object.
  function startObjectScript(room, o) {
    const t = findTemplate(room, o.tpl);
    if (t && t.script) dispatchScript(room, 'objscript', { id: o.id, name: t.name, src: t.script });
  }

  function dispatchScript(room, kind, payload) {
    if (room.sandbox && !room.sandbox.dead) room.sandbox.dispatch(kind, payload);
  }

  // Runs while any live world has server scripts: sends them an onTick and then sends clients
  // whatever the scripts changed in the world since the last tick.
  function ensureScriptTicker() {
    if (scriptTimer) return;
    scriptTimer = setInterval(() => {
      let any = false;
      const now = Date.now();
      for (const room of live.values()) {
        const sb = room.sandbox;
        if (!sb || sb.dead) continue;
        any = true;
        const dt = Math.min(0.25, (now - room.lastScriptTick) / 1000);
        room.lastScriptTick = now;
        sb.dispatch('tick', { t: now - room.startedAt, dt });
        checkTouches(room);
        flushDirty(room);
      }
      if (!any) { clearInterval(scriptTimer); scriptTimer = null; }
    }, SCRIPT_TICK_MS);
  }

  /* ----- server scripts: changing the live world ----- */

  function fullLayoutEvent(room) {
    return { name: room.name, ground: room.layout.ground, spawn: room.layout.spawn, obstacles: room.layout.obstacles, assets: assetsFor(readDB(), room.layout.obstacles, room.templates) };
  }

  function markDirty(room) {
    if (!room.dirty) room.dirty = { set: new Set(), del: new Set(), ground: false, spawn: false };
    return room.dirty;
  }

  // Sends clients only what changed. Past a handful of changes, one full layout is cheaper than a long list.
  function flushDirty(room) {
    const d = room.dirty;
    if (!d) return;
    room.dirty = null;
    const changed = [...d.set].map(id => room.layout.obstacles.find(o => o.id === id)).filter(Boolean);
    // A full layout also carries the SVG designs it uses, which a delta doesn't, so any change
    // to an SVG object is sent that way.
    if (changed.length > MAX_DELTA_OBJECTS || d.del.size > MAX_DELTA_OBJECTS || changed.some(o => o.kind === 'svg')) {
      broadcast(room.id, 'layout', fullLayoutEvent(room));
    } else {
      const delta = { set: changed, del: [...d.del] };
      if (d.ground) delta.ground = room.layout.ground;
      if (d.spawn) delta.spawn = room.layout.spawn;
      broadcast(room.id, 'delta', delta);
    }
    // Anyone standing where an object just appeared is pushed out of it.
    for (const p of room.players.values()) {
      for (const o of changed) pushOutOfRect(p, o);
      clampToWorld(p);
    }
  }

  // Tells object scripts when a player starts or stops overlapping an object they asked to watch.
  // Solid or not doesn't matter: a coin is something you walk through.
  function checkTouches(room) {
    if (!room.watch.size) return;
    let budget = MAX_TOUCH_EVENTS_PER_TICK;
    for (const id of [...room.watch]) {
      const o = findObject(room, id);
      if (!o) { room.watch.delete(id); room.touching.delete(id); continue; }
      let inside = room.touching.get(id);
      if (!inside) { inside = new Set(); room.touching.set(id, inside); }
      for (const [key, p] of room.players) {
        if (budget <= 0 || !room.watch.has(id) || !room.sandbox || room.sandbox.dead) return;
        const nx = clamp(p.x, o.x, o.x + o.w), ny = clamp(p.y, o.y, o.y + o.h);
        const hit = (p.x - nx) * (p.x - nx) + (p.y - ny) * (p.y - ny) <= PLAYER_RADIUS * PLAYER_RADIUS;
        const was = inside.has(key);
        if (hit && !was) { inside.add(key); budget--; dispatchScript(room, 'touch', { id, n: p.name }); }
        else if (!hit && was) { inside.delete(key); budget--; dispatchScript(room, 'touchend', { id, n: p.name }); }
      }
      for (const key of [...inside]) if (!room.players.has(key)) inside.delete(key);
    }
  }

  function findPlayer(room, name) {
    return room.players.get(String(name).toLowerCase()) || null;
  }

  function describePlayer(p) {
    return {
      name: p.name, x: round1(p.x), y: round1(p.y), color: p.color,
      speed: p.mods.speed, scale: p.mods.scale, trail: p.mods.trail, frozen: p.mods.frozen, hidden: p.mods.hidden, title: p.mods.title,
      attrs: Object.assign({}, p.attrs)
    };
  }

  function requirePlayer(room, name) {
    const p = findPlayer(room, name);
    if (!p) throw new Error('That player is not in the world.');
    return p;
  }

  function setPlayerMod(room, a) {
    const p = requirePlayer(room, a.n);
    const v = a.v;
    switch (a.k) {
      case 'speed': {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error('speed must be a number (1 is normal).');
        p.mods.speed = round2(clamp(n, 0, MAX_SPEED_MULT));
        return;
      }
      case 'scale': {
        const n = Number(v);
        if (!Number.isFinite(n)) throw new Error('scale must be a number (1 is normal).');
        p.mods.scale = round2(clamp(n, MIN_SCALE, MAX_SCALE));
        return;
      }
      case 'color':
        if (v === null) p.color = p.baseColor;
        else if (isHexColor(v)) p.color = v.toLowerCase();
        else throw new Error('color must look like "#ff8800" (or null for the default).');
        return;
      case 'trail': p.mods.trail = !!v; return;
      case 'frozen': p.mods.frozen = !!v; return;
      case 'hidden': p.mods.hidden = !!v; return;
      case 'title': p.mods.title = cleanText(v, MAX_TITLE_CHARS); return;
      default: throw new Error('Unknown player property.');
    }
  }

  function setPlayerAttr(room, a) {
    const p = requirePlayer(room, a.n);
    const k = String(a.k);
    if (!ATTR_KEY_RE.test(k)) throw new Error('Attribute names are 1-24 letters, numbers or _.');
    const v = a.v;
    if (v === null || v === undefined) {
      delete p.attrs[k];
    } else {
      if (!(k in p.attrs) && Object.keys(p.attrs).length >= MAX_ATTRS) throw new Error(`A player can have at most ${MAX_ATTRS} attributes.`);
      if (typeof v === 'number' && Number.isFinite(v)) p.attrs[k] = v;
      else if (typeof v === 'boolean') p.attrs[k] = v;
      else if (typeof v === 'string') p.attrs[k] = v.slice(0, MAX_ATTR_STRING);
      else throw new Error('Attributes can be numbers, text or true/false.');
    }
    broadcast(room.id, 'attr', { n: p.name, k, v: k in p.attrs ? p.attrs[k] : null });
  }

  function teleportPlayer(room, a) {
    const p = requirePlayer(room, a.n);
    const x = Number(a.x), y = Number(a.y);
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('teleport needs two numbers: x and y.');
    p.x = x; p.y = y;
    clampToWorld(p);
    for (const o of room.layout.obstacles) pushOutOfRect(p, o);
    clampToWorld(p);
    // The player's own browser predicts its movement, so tell it where it now is. Moves it sent
    // before it heard about this carry the old epoch and are ignored.
    p.epoch++;
    p.lastMoveAt = Date.now();
    send(p.res, 'tp', { x: round1(p.x), y: round1(p.y), e: p.epoch });
  }

  function findObject(room, id) {
    return room.layout.obstacles.find(o => o.id === String(id)) || null;
  }

  const OBJECT_DEFAULTS = { kind: 'rock', x: 0, y: 0, w: 60, h: 60 };
  // Builds a valid object from what a script gave (falling back to `current`, then to defaults).
  function scriptObject(spec, current) {
    const pick = k => (spec && Object.prototype.hasOwnProperty.call(spec, k)) ? spec[k] : (current ? current[k] : OBJECT_DEFAULTS[k]);
    const kind = pick('kind');
    if (!OBSTACLE_KINDS.includes(kind)) throw new Error(`Unknown object type “${cleanText(kind, 20)}”. Use one of: ${OBSTACLE_KINDS.join(', ')}.`);
    let asset = null;
    if (kind === 'svg') {
      asset = pick('asset');
      if (typeof asset !== 'string' || !assetIdSet(readDB()).has(asset)) throw new Error('An svg object needs asset: the id of one of your SVG designs.');
    }
    const w = Math.round(Number(pick('w'))), h = Math.round(Number(pick('h'))), x = Number(pick('x')), y = Number(pick('y'));
    if (![w, h, x, y].every(Number.isFinite)) throw new Error('Object size and position must be numbers.');
    const cw = clamp(w, MIN_OBJECT_SIZE, WORLD_W), ch = clamp(h, MIN_OBJECT_SIZE, WORLD_H);
    const out = { kind, w: cw, h: ch, x: Math.round(clamp(x, 0, WORLD_W - cw)), y: Math.round(clamp(y, 0, WORLD_H - ch)) };
    if (kind === 'svg') { out.asset = asset; out.solid = pick('solid') !== false; }
    return out;
  }

  function takeRoomRemote(room) {
    const now = Date.now(), w = room.remoteWindow;
    if (now - w.at >= 1000) { w.at = now; w.n = 0; }
    return ++w.n <= SERVER_REMOTE_PER_SEC;
  }

  // The door between a world's server scripts and the world. Every script call arrives here as
  // (op, plain JSON); this is where it is checked and applied. Throwing sends the message back to
  // the script as an ordinary exception. Anything not listed below simply doesn't exist for scripts.
  function scriptHost(room, op, a) {
    a = a || {};
    switch (op) {
      case 'players.names': return [...room.players.values()].map(p => p.name);
      case 'players.find': { const p = findPlayer(room, a.n); return p ? p.name : null; }
      case 'p.get': {
        const p = findPlayer(room, a.n);
        // Someone who just left is still readable for a moment, so onLeave handlers can see them.
        return p ? describePlayer(p) : (room.departed.get(String(a.n).toLowerCase()) || null);
      }
      case 'p.set': return setPlayerMod(room, a);
      case 'p.tp': return teleportPlayer(room, a);
      case 'p.attr': return setPlayerAttr(room, a);
      case 'p.say': send(requirePlayer(room, a.n).res, 'msg', { text: cleanText(a.t, MAX_MESSAGE_CHARS) }); return;

      case 'w.info': return { name: room.name, width: WORLD_W, height: WORLD_H, ground: room.layout.ground, spawn: Object.assign({}, room.layout.spawn) };
      case 'w.set': {
        if (a.ground !== undefined) {
          if (!isHexColor(a.ground)) throw new Error('ground must look like "#2f6b3a".');
          room.layout.ground = a.ground.toLowerCase();
          markDirty(room).ground = true;
        }
        if (a.spawn !== undefined) {
          const x = Number(a.spawn && a.spawn.x), y = Number(a.spawn && a.spawn.y);
          if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('setSpawn needs two numbers: x and y.');
          room.layout.spawn = { x: Math.round(clamp(x, PLAYER_RADIUS, WORLD_W - PLAYER_RADIUS)), y: Math.round(clamp(y, PLAYER_RADIUS, WORLD_H - PLAYER_RADIUS)) };
          markDirty(room).spawn = true;
        }
        return;
      }
      case 'w.objs': return room.layout.obstacles.map(o => Object.assign({}, o));
      case 'o.get': { const o = findObject(room, a.id); return o ? Object.assign({}, o) : null; }
      case 'w.addObj': {
        if (room.layout.obstacles.length >= MAX_OBSTACLES) throw new Error(`A world can have at most ${MAX_OBSTACLES} objects.`);
        const o = Object.assign({ id: 'o' + room.nextObjId++ }, scriptObject(a, null));
        room.layout.obstacles.push(o);
        markDirty(room).set.add(o.id);
        return Object.assign({}, o);
      }
      case 'o.set': {
        const o = findObject(room, a.id);
        if (!o) throw new Error('That object no longer exists.');
        const next = scriptObject(a.p, o);
        if (next.kind !== 'svg') { delete o.asset; delete o.solid; }
        Object.assign(o, next);
        markDirty(room).set.add(o.id);
        return;
      }
      case 'o.rm': {
        const i = room.layout.obstacles.findIndex(o => o.id === String(a.id));
        if (i === -1) return;
        room.watch.delete(String(a.id)); room.touching.delete(String(a.id));
        room.layout.obstacles.splice(i, 1);
        const d = markDirty(room);
        d.set.delete(String(a.id));
        d.del.add(String(a.id));
        return;
      }
      case 'o.watch': {
        if (!findObject(room, a.id)) throw new Error('That object no longer exists.');
        if (a.on === false) { room.watch.delete(String(a.id)); room.touching.delete(String(a.id)); }
        else room.watch.add(String(a.id));
        return;
      }
      case 'tpl.list': return room.templates.map(t => Object.assign(templateForClient(t), { hasScript: !!t.script }));
      case 'tpl.clone': {
        const t = findTemplate(room, a.n);
        if (!t) throw new Error(`There is no “${cleanText(a.n, 30)}” in Storage.`);
        if (room.layout.obstacles.length >= MAX_OBSTACLES) throw new Error(`A world can have at most ${MAX_OBSTACLES} objects.`);
        const spec = a.spec && typeof a.spec === 'object' ? a.spec : {};
        // The template gives the look; the caller decides where it goes (and may resize it).
        const base = { kind: t.kind, w: t.w, h: t.h, x: 0, y: 0 };
        if (t.kind === 'svg') { base.asset = t.asset; base.solid = t.solid !== false; }
        const merged = Object.assign({}, base);
        for (const k of ['x', 'y', 'w', 'h']) if (Object.prototype.hasOwnProperty.call(spec, k)) merged[k] = spec[k];
        if (t.kind === 'svg' && Object.prototype.hasOwnProperty.call(spec, 'solid')) merged.solid = spec.solid;
        const o = Object.assign({ id: 'o' + room.nextObjId++ }, scriptObject(merged, null), { tpl: t.name });
        room.layout.obstacles.push(o);
        markDirty(room).set.add(o.id);
        return { obj: Object.assign({}, o), script: t.script || '' };
      }
      case 'w.announce': broadcast(room.id, 'msg', { text: cleanText(a.t, MAX_MESSAGE_CHARS) }); return;
      case 'w.confetti': {
        const x = Number(a.x), y = Number(a.y);
        if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('confetti needs two numbers: x and y.');
        broadcast(room.id, 'fx', { type: 'confetti', n: null, x: round1(clamp(x, 0, WORLD_W)), y: round1(clamp(y, 0, WORLD_H)) });
        return;
      }
      case 'remote.fire': {
        const name = String(a.n);
        if (!REMOTE_NAME_RE.test(name)) throw new Error('Remote event names are 1-40 letters, numbers, _ . or -');
        const r = cleanRemoteArgs(a.a);
        if (r.error) throw new Error(r.error);
        if (!takeRoomRemote(room)) throw new Error(`Too many remote events (limit ${SERVER_REMOTE_PER_SEC} per second).`);
        const payload = { n: name, a: r.args };
        if (a.to === null || a.to === undefined) {
          const except = a.except == null ? null : String(a.except).toLowerCase();
          for (const p of room.players.values()) if (!except || p.name.toLowerCase() !== except) send(p.res, 'remote', payload);
        } else {
          const p = findPlayer(room, a.to);
          if (p) send(p.res, 'remote', payload);
        }
        return;
      }
      default: throw new Error('Unknown script call: ' + String(op).slice(0, 40));
    }
  }

  // Throws the saved layout back in, resets scripted changes, restarts server scripts and tells
  // clients to do the same. Used whenever the Studio saves a world that has people in it.
  function reloadRoom(room, world) {
    room.name = world.name;
    room.layout = roomLayout(room, layoutFor(world));
    room.dirty = null;
    for (const p of room.players.values()) {
      p.mods = freshMods();
      p.attrs = {};
      p.color = p.baseColor;
      clampToWorld(p);
      for (const o of room.layout.obstacles) pushOutOfRect(p, o);
      clampToWorld(p);
    }
    broadcast(room.id, 'layout', fullLayoutEvent(room));
    broadcast(room.id, 'attrs', { attrs: {} });
    broadcast(room.id, 'scripts', { scripts: clientScriptList(world), templates: (world.templates || []).map(templateForClient), assets: assetsFor(readDB(), room.layout.obstacles, world.templates) });
    startScripts(room, world);
  }

  // Forgets a room once nobody is in it. Its scripts get a moment so the last onLeave can run.
  function closeRoom(room) {
    live.delete(room.id);
    const sb = room.sandbox;
    room.sandbox = null;
    if (sb) setTimeout(() => sb.dispose(), 1500).unref();
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
    if (p) {
      dispatchScript(room, 'leave', { n: p.name });
      room.departed.set(key, describePlayer(p));
      setTimeout(() => room.departed.delete(key), 3000).unref();
    }
    room.players.delete(key);
    if (res) room.clients.delete(res);
    playerWorld.delete(key);
    if (!room.clients.size && !room.players.size) closeRoom(room);
    else broadcast(worldId, 'left', { n: p ? p.name : key });
  }

  function assetList(db) { return Array.isArray(db.worldAssets) ? db.worldAssets : (db.worldAssets = []); }
  function assetIdSet(db) { return new Set(assetList(db).map(a => a.id)); }
  // Only the designs a layout actually uses travel to players.
  function assetsFor(db, obstacles, templates) {
    const used = new Set(obstacles.filter(o => o.kind === 'svg').map(o => o.asset));
    for (const t of templates || []) if (t.kind === 'svg') used.add(t.asset);   // clones can appear at any time
    const out = {};
    for (const a of assetList(db)) if (used.has(a.id)) out[a.id] = a;
    return out;
  }
  function layoutEvent(db, world) {
    const l = layoutFor(world);
    return { name: world.name, ground: l.ground, spawn: l.spawn, obstacles: l.obstacles, assets: assetsFor(db, l.obstacles, world.templates) };
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
      custom: !!w.layout,
      scripted: (w.scripts || []).some(s => s && s.enabled) || (w.templates || []).some(t => t && t.script)
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
      scripts: []
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
      stopScripts(room);
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
      assets: assetList(db),
      limits: { width: WORLD_W, height: WORLD_H, maxObstacles: MAX_OBSTACLES, minSize: MIN_OBJECT_SIZE, radius: PLAYER_RADIUS, kinds: OBSTACLE_KINDS },
      templates: Object.fromEntries(Object.entries(TEMPLATES).map(([id, t]) => [id, { label: t.label, ground: t.ground, spawn: t.spawn, obstacles: t.obstacles }]))
    });
  });

  // Saves a layout (and optionally a new name). Players inside the world get it live.
  app.put('/api/worlds/:id/layout', requireTier4, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    const r = cleanLayout(req.body && req.body.layout, assetIdSet(db));
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

    // Players inside get the new layout; scripted changes are reset and scripts restart.
    const room = live.get(world.id);
    if (room) reloadRoom(room, world);
    res.json({ ok: true, world: publicWorld(world) });
  });

  /* ----- scripts (Tier 4+) ----- */

  app.get('/api/worlds/:id/scripts', requireTier4, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    res.json({
      scripts: world.scripts || [],
      templates: world.templates || [],
      warnings: syntaxWarnings(world.scripts || []).concat(templateWarnings(world.templates || [])),
      limits: { maxScripts: MAX_SCRIPTS, maxChars: MAX_SCRIPT_CHARS, maxTotalChars: MAX_SCRIPT_TOTAL_CHARS, maxName: MAX_SCRIPT_NAME, maxTemplates: MAX_TEMPLATES, maxTemplateChars: MAX_TEMPLATE_SCRIPT_CHARS },
      running: !!(live.get(world.id) && live.get(world.id).sandbox)
    });
  });

  // Saves the world's scripts. Anyone inside gets the new client scripts and the server scripts restart.
  app.put('/api/worlds/:id/scripts', requireTier4, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });
    const r = cleanScripts(req.body && req.body.scripts);
    if (r.error) return res.status(400).json({ error: r.error });
    // Storage travels with the scripts; leaving it out keeps what is already saved.
    let templates = world.templates || [];
    if (req.body && req.body.templates !== undefined) {
      const tr = cleanTemplates(req.body.templates, assetIdSet(db));
      if (tr.error) return res.status(400).json({ error: tr.error });
      templates = tr.templates;
    }
    world.scripts = r.scripts;
    world.templates = templates;
    world.scriptsBy = req.session.user;
    world.scriptsAt = new Date().toISOString();
    audit(db, req.session.user, 'edit-world-scripts', world.name, `${r.scripts.length} scripts`);
    writeDB(db);
    pushLog(world.id, 'info', 'Scripts saved by ' + req.session.user + '.');
    const room = live.get(world.id);
    if (room) reloadRoom(room, world);
    res.json({ ok: true, scripts: world.scripts, templates: world.templates, warnings: syntaxWarnings(world.scripts).concat(templateWarnings(world.templates)), world: publicWorld(world) });
  });

  // The Studio's console: server script output since line `after`.
  app.get('/api/worlds/:id/script-log', requireTier4, (req, res) => {
    const log = scriptLogs.get(req.params.id) || { seq: 0, lines: [] };
    const after = Number(req.query.after) || 0;
    const room = live.get(req.params.id);
    res.json({ seq: log.seq, lines: log.lines.filter(l => l.seq > after), running: !!(room && room.sandbox), players: room ? room.players.size : 0 });
  });

  // The page that runs client scripts is served with a locked-down CSP: no network of any kind,
  // no nested workers, no imports. This is what stops a script from calling the site's API as the player.
  app.get('/js/world-sandbox-client.js', (req, res) => {
    res.set({
      'Content-Security-Policy': "default-src 'none'; script-src 'unsafe-eval'; connect-src 'none'",
      'Content-Type': 'application/javascript; charset=utf-8',
      'Cache-Control': 'no-cache'
    });
    res.sendFile(path.join(__dirname, 'public', 'js', 'world-sandbox-client.js'));
  });

  /* ----- SVG designs (Tier 4+) ----- */

  app.get('/api/studio/assets', requireTier4, (req, res) => {
    res.json({ assets: assetList(readDB()) });
  });

  app.post('/api/studio/assets', requireTier4, (req, res) => {
    const r = cleanAsset(req.body);
    if (r.error) return res.status(400).json({ error: r.error });
    const db = readDB();
    if (assetList(db).length >= MAX_ASSETS) return res.status(400).json({ error: `There can be at most ${MAX_ASSETS} designs. Delete one first.` });
    const asset = { id: crypto.randomBytes(5).toString('hex'), ...r.asset, createdBy: req.session.user, updatedAt: new Date().toISOString() };
    assetList(db).push(asset);
    audit(db, req.session.user, 'create-svg-design', asset.name, `${asset.shapes.length} shapes`);
    writeDB(db);
    res.status(201).json({ asset, assets: assetList(db) });
  });

  // Editing a design updates every world that uses it, including players inside right now.
  app.put('/api/studio/assets/:id', requireTier4, (req, res) => {
    const db = readDB();
    const asset = assetList(db).find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: 'No such design.' });
    const r = cleanAsset(req.body);
    if (r.error) return res.status(400).json({ error: r.error });
    Object.assign(asset, r.asset, { updatedAt: new Date().toISOString(), updatedBy: req.session.user });
    audit(db, req.session.user, 'edit-svg-design', asset.name, `${asset.shapes.length} shapes`);
    writeDB(db);
    for (const w of db.worlds) {
      const room = live.get(w.id);
      // For a live world send what is running now (scripted changes included), not just the saved layout.
      if (room && room.layout.obstacles.some(o => o.kind === 'svg' && o.asset === asset.id)) broadcast(w.id, 'layout', fullLayoutEvent(room));
    }
    res.json({ asset, assets: assetList(db) });
  });

  app.delete('/api/studio/assets/:id', requireTier4, (req, res) => {
    const db = readDB();
    const list = assetList(db);
    const asset = list.find(a => a.id === req.params.id);
    if (!asset) return res.status(404).json({ error: 'No such design.' });
    const users = db.worlds.filter(w => layoutFor(w).obstacles.some(o => o.kind === 'svg' && o.asset === asset.id) || (w.templates || []).some(t => t.kind === 'svg' && t.asset === asset.id));
    if (users.length) return res.status(409).json({ error: `“${asset.name}” is used in ${users.length} world${users.length === 1 ? '' : 's'} (${users.slice(0, 3).map(w => w.name).join(', ')}${users.length > 3 ? '…' : ''}). Remove it there first.` });
    db.worldAssets = list.filter(a => a.id !== asset.id);
    audit(db, req.session.user, 'delete-svg-design', asset.name, '');
    writeDB(db);
    res.json({ ok: true, assets: db.worldAssets });
  });

  /* ----- joining a world (the live stream) ----- */

  app.get('/api/worlds/:id/stream', requireLogin, (req, res) => {
    const db = readDB();
    const world = worldById(db, req.params.id);
    if (!world) return res.status(404).json({ error: 'No such world.' });

    const record = db.users[req.session.user.toLowerCase()];
    const key = record.username.toLowerCase();
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
    // Fetched only now: replacing your own old connection above can empty and close this very room.
    const room = worldRoom(world);
    if (room.players.size >= MAX_PLAYERS_PER_WORLD) {
      return res.status(409).json({ error: 'That world is full.' });
    }

    res.writeHead(200, {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      'Connection': 'keep-alive',
      'X-Accel-Buffering': 'no'
    });
    res.write(': connected\n\n');

    const layout = room.layout;
    const base = avatarColor(record);
    const player = {
      name: record.username,
      x: layout.spawn.x + (Math.random() - 0.5) * 60,
      y: layout.spawn.y + (Math.random() - 0.5) * 60,
      color: base, baseColor: base,
      mods: freshMods(), attrs: {}, epoch: 0,
      lastMoveAt: Date.now(),
      remoteTokens: CLIENT_REMOTE_BURST, remoteAt: Date.now(),
      res
    };
    clampToWorld(player);
    for (const o of layout.obstacles) pushOutOfRect(player, o);

    room.players.set(key, player);
    room.clients.add(res);
    playerWorld.set(key, world.id);

    const now = Date.now();
    send(res, 'hello', {
      you: { name: player.name, x: round1(player.x), y: round1(player.y), e: player.epoch },
      world: { id: world.id, name: world.name, width: WORLD_W, height: WORLD_H, ground: layout.ground, spawn: layout.spawn, obstacles: layout.obstacles, assets: assetsFor(db, layout.obstacles, world.templates) },
      templates: (world.templates || []).map(templateForClient),
      attrs: attributesOf(room),
      scripts: clientScriptList(world),
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
    if (!room.scriptsStarted) { room.scriptsStarted = true; startScripts(room, world); }
    dispatchScript(room, 'join', { n: player.name });

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
      return res.json({ x: round1(player.x), y: round1(player.y), e: player.epoch });
    }
    const dt = Math.min((now - player.lastMoveAt) / 1000, MAX_MOVE_DT_S);
    player.lastMoveAt = now;

    // A script teleported this player: moves the browser sent before it heard about it are stale.
    if (req.body && req.body.e !== undefined && Number(req.body.e) !== player.epoch) {
      return res.json({ x: round1(player.x), y: round1(player.y), e: player.epoch });
    }
    if (player.mods.frozen) return res.json({ x: round1(player.x), y: round1(player.y), e: player.epoch });

    const db = readDB();
    const fx = effectsOf(db.users[key], now);
    const speed = BASE_SPEED * (fx.speed ? SPEED_BOOST_MULTIPLIER : 1) * player.mods.speed;
    const maxDist = speed * dt * SPEED_TOLERANCE + 1;

    stepToward(player, tx, ty, maxDist, found.room.layout.obstacles);
    res.json({ x: round1(player.x), y: round1(player.y), e: player.epoch });
  });

  /* ----- remote events: client -> server scripts ----- */

  app.post('/api/worlds/:id/remote', requireLogin, (req, res) => {
    const found = livePlayer(req, req.params.id);
    if (!found || !found.player) return res.status(409).json({ error: 'You are not in that world.' });
    const { player, room } = found;
    const name = String(req.body && req.body.n);
    if (!REMOTE_NAME_RE.test(name)) return res.status(400).json({ error: 'Bad event name.' });
    const r = cleanRemoteArgs(req.body && req.body.a);
    if (r.error) return res.status(400).json({ error: r.error });

    // Per-player token bucket so one browser can't flood the scripts.
    const now = Date.now();
    player.remoteTokens = Math.min(CLIENT_REMOTE_BURST, player.remoteTokens + (now - player.remoteAt) / 1000 * CLIENT_REMOTE_PER_SEC);
    player.remoteAt = now;
    if (player.remoteTokens < 1) return res.status(429).json({ error: 'Too many remote events; slow down.' });
    player.remoteTokens -= 1;

    // Players can never name someone else as the sender: it is always the signed-in player.
    dispatchScript(room, 'remote', { n: name, p: player.name, a: r.args });
    res.json({ ok: true });
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
