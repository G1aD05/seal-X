/* Client scripts for Seal Worlds — the sandbox half (runs in a Web Worker).
 *
 * Served by worlds.js with `Content-Security-Policy: default-src 'none'; script-src 'unsafe-eval';
 * connect-src 'none'`, so even though a worker shares the site's origin, a script in here cannot
 * make a network request, import code, or start another worker. That is what stops a client script
 * from calling the site's API as whoever happens to be playing. On top of that this file removes
 * the browser APIs it doesn't need, and the page that owns this worker (worldScripts.js) checks
 * every message it sends back and stops the worker if it stalls.
 *
 * Scripts can: move the camera, draw a HUD, react to input, spawn local effects, read the world
 * and the other players, and send/receive RemoteEvents. Everything that matters to other players
 * (speed, size, teleports, the world itself) belongs to server scripts.
 *
 * Messages from the page: init, frame, event.  Messages to the page: out (always one per message).
 */
(function () {
  'use strict';

  var post = self.postMessage.bind(self);
  var addListener = self.addEventListener.bind(self);

  var state = { templates: [], clock: 0, me: null, myName: '', players: [], keys: {}, world: null, attrs: {}, camPos: { x: 0, y: 0 } };
  var out = null;
  function resetOut() { out = { t: 'out', ui: [], fx: [], remote: [], lobj: [], logs: [], cam: null, walkTo: null, moveEnabled: null }; }
  resetOut();

  function flush(extra) {
    if (extra) for (var k in extra) out[k] = extra[k];
    var o = out; resetOut();
    post(o);
  }

  /* ------------------------------------------------------------- console */

  var logCount = 0;
  function fmt(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) return v.message;
    if (typeof v === 'function') return '[function]';
    try { var s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
  }
  function log(level, args) {
    if (out.logs.length >= 30) return;
    var parts = [];
    for (var i = 0; i < args.length; i++) parts.push(fmt(args[i]));
    var text = parts.join(' ');
    out.logs.push({ l: level, t: text.length > 400 ? text.slice(0, 400) + '…' : text });
  }
  var con = {
    log: function () { log('log', arguments); }, info: function () { log('info', arguments); },
    warn: function () { log('warn', arguments); }, error: function () { log('error', arguments); }
  };
  function report(e) { log('error', [e && e.message !== undefined ? e.message : e]); }

  /* ------------------------------------------------------------- signals */

  function Signal() {
    var hs = [];
    return {
      connect: function (fn) {
        if (typeof fn !== 'function') throw new TypeError('Expected a function.');
        hs.push(fn);
        return function () { var i = hs.indexOf(fn); if (i >= 0) hs.splice(i, 1); };
      },
      fire: function () { var a = arguments; hs.slice().forEach(function (fn) { try { fn.apply(null, a); } catch (e) { report(e); } }); },
      size: function () { return hs.length; }
    };
  }
  var frameSig = Signal(), keyDownSig = Signal(), keyUpSig = Signal(), clickSig = Signal();
  var joinSig = Signal(), leaveSig = Signal(), attrSig = Signal(), worldSig = Signal();

  /* -------------------------------------------------------------- timers */

  var timers = {}, timerCount = 0, nextTimer = 1;
  function addTimer(fn, ms, repeat, extra) {
    if (typeof fn !== 'function') throw new TypeError('Expected a function.');
    if (timerCount >= 100) throw new Error('Too many timers (limit 100).');
    ms = Math.max(repeat ? 16 : 0, Number(ms) || 0);
    var id = nextTimer++;
    timers[id] = { fn: fn, at: state.clock + ms, every: repeat ? ms : 0, args: extra };
    timerCount++;
    return id;
  }
  function clearTimer(id) { if (timers[id]) { delete timers[id]; timerCount--; } }
  function runTimers() {
    Object.keys(timers).forEach(function (key) {
      var t = timers[key];
      if (!t || t.at > state.clock) return;
      if (t.every) t.at = state.clock + t.every; else clearTimer(key);
      try { t.fn.apply(null, t.args); } catch (e) { report(e); }
    });
  }
  function setT(fn, ms) { return addTimer(fn, ms, false, Array.prototype.slice.call(arguments, 2)); }
  function setI(fn, ms) { return addTimer(fn, ms, true, Array.prototype.slice.call(arguments, 2)); }
  function wait(ms) { return new Promise(function (resolve) { setT(resolve, ms); }); }

  /* -------------------------------------------------------------- camera */

  var cam = { mode: 'follow', follow: null, x: 0, y: 0, zoom: 1, rotation: 0, ox: 0, oy: 0, smooth: 0, clamp: true, shake: 0, shakeFor: 0 };
  function num(v, name) { v = Number(v); if (!isFinite(v)) throw new Error(name + ' must be a number.'); return v; }
  function camDirty() { out.cam = JSON.parse(JSON.stringify(cam)); cam.shake = 0; cam.shakeFor = 0; }   // a shake is one-shot
  var camera = {
    get x() { return state.camPos.x; }, set x(v) { cam.x = num(v, 'camera.x'); cam.y = state.camPos.y; cam.mode = 'free'; camDirty(); },
    get y() { return state.camPos.y; }, set y(v) { cam.y = num(v, 'camera.y'); cam.x = state.camPos.x; cam.mode = 'free'; camDirty(); },
    lookAt: function (x, y) { cam.x = num(x, 'x'); cam.y = num(y, 'y'); cam.mode = 'free'; camDirty(); },
    // Follow a player by name (default: yourself). The camera stays on them until you call lookAt or set x/y.
    follow: function (name) { cam.mode = 'follow'; cam.follow = name == null ? null : String(name); camDirty(); },
    get zoom() { return cam.zoom; }, set zoom(v) { cam.zoom = Math.max(0.25, Math.min(4, num(v, 'camera.zoom'))); camDirty(); },
    get rotation() { return cam.rotation; }, set rotation(v) { cam.rotation = num(v, 'camera.rotation') % 360; camDirty(); },
    offset: function (x, y) { cam.ox = Math.max(-2000, Math.min(2000, num(x, 'x'))); cam.oy = Math.max(-2000, Math.min(2000, num(y, 'y'))); camDirty(); },
    // 0 = the camera snaps to its target; higher numbers glide (try 5-10).
    get smooth() { return cam.smooth; }, set smooth(v) { cam.smooth = Math.max(0, Math.min(30, num(v, 'camera.smooth'))); camDirty(); },
    // true (default): the camera never shows outside the world. false lets it wander past the edges.
    get clamp() { return cam.clamp; }, set clamp(v) { cam.clamp = !!v; camDirty(); },
    shake: function (amount, seconds) { cam.shake = Math.max(0, Math.min(60, num(amount, 'amount'))); cam.shakeFor = Math.max(0, Math.min(5, num(seconds === undefined ? 0.4 : seconds, 'seconds'))); camDirty(); },
    reset: function () { cam = { mode: 'follow', follow: null, x: 0, y: 0, zoom: 1, rotation: 0, ox: 0, oy: 0, smooth: 0, clamp: true, shake: 0, shakeFor: 0 }; camDirty(); }
  };

  /* ------------------------------------------------------------------ HUD */

  var uiIds = {}, uiCount = 0, buttonFns = {};
  var ANCHORS = { 'top-left': 1, top: 1, 'top-right': 1, left: 1, center: 1, right: 1, 'bottom-left': 1, bottom: 1, 'bottom-right': 1 };
  function uiOpts(o) {
    o = o || {};
    if (o.anchor !== undefined && !ANCHORS[o.anchor]) throw new Error('anchor must be one of: ' + Object.keys(ANCHORS).join(', '));
    return { anchor: o.anchor || 'top-left', x: Number(o.x) || 0, y: Number(o.y) || 0, size: Number(o.size) || 0, color: o.color == null ? '' : String(o.color), bg: o.bg == null ? '' : String(o.bg), width: Number(o.width) || 0, height: Number(o.height) || 0 };
  }
  function uiSet(id, type, data, opts) {
    id = String(id);
    if (!/^[A-Za-z0-9_.-]{1,30}$/.test(id)) throw new Error('UI ids are 1-30 letters, numbers, _ . or -');
    if (!uiIds[id]) { if (uiCount >= 40) throw new Error('Too many HUD elements (limit 40).'); uiIds[id] = 1; uiCount++; }
    if (out.ui.length < 120) out.ui.push({ op: 'set', id: id, type: type, d: data, o: uiOpts(opts) });
  }
  var ui = {
    text: function (id, text, opts) { uiSet(id, 'text', { text: String(text).slice(0, 200) }, opts); },
    bar: function (id, value, max, opts) { uiSet(id, 'bar', { value: num(value, 'value'), max: num(max === undefined ? 1 : max, 'max') }, opts); },
    button: function (id, text, opts, onClick) {
      if (typeof opts === 'function') { onClick = opts; opts = {}; }
      if (typeof onClick !== 'function') throw new TypeError('ui.button needs a function to run when it is clicked.');
      buttonFns[String(id)] = onClick;
      uiSet(id, 'button', { text: String(text).slice(0, 60) }, opts);
    },
    remove: function (id) { id = String(id); if (uiIds[id]) { delete uiIds[id]; delete buttonFns[id]; uiCount--; out.ui.push({ op: 'rm', id: id }); } },
    clear: function () { uiIds = {}; buttonFns = {}; uiCount = 0; out.ui.push({ op: 'clear' }); },
    toast: function (text, seconds) { out.ui.push({ op: 'toast', text: String(text).slice(0, 200), sec: Math.max(0.5, Math.min(10, Number(seconds) || 3)) }); }
  };

  /* ------------------------------------------------------------- effects */

  var effects = {
    confetti: function (x, y) { if (out.fx.length < 20) out.fx.push({ k: 'confetti', x: num(x, 'x'), y: num(y, 'y') }); },
    flash: function (color, seconds) { if (out.fx.length < 20) out.fx.push({ k: 'flash', c: String(color || '#ffffff'), s: Math.max(0.05, Math.min(5, Number(seconds) || 0.3)) }); },
    floatText: function (text, x, y, color) { if (out.fx.length < 20) out.fx.push({ k: 'text', t: String(text).slice(0, 60), x: num(x, 'x'), y: num(y, 'y'), c: color ? String(color) : '#ffffff' }); }
  };

  /* --------------------------------------------------------------- input */

  var input = {
    onKeyDown: keyDownSig.connect, onKeyUp: keyUpSig.connect,
    // Receives world coordinates: where in the world was clicked.
    onClick: clickSig.connect,
    isDown: function (key) { return !!state.keys[String(key).toLowerCase()]; },
    // false stops the player walking (keys and clicks) in this browser. The server still decides everything real.
    get moveEnabled() { return moveEnabled; }, set moveEnabled(v) { moveEnabled = !!v; out.moveEnabled = moveEnabled; }
  };
  var moveEnabled = true;

  /* ------------------------------------------------------------- players */

  var KEYS = ['x', 'y', 'color', 'scale', 'speed', 'trail', 'frozen', 'hidden', 'title'];
  function snapshot(p) {
    var o = { name: p.n, x: p.x, y: p.y, color: p.c, scale: p.z || 1, speed: p.m || 1, trail: !!p.t, frozen: !!p.f, hidden: !!p.h, title: p.l || '' };
    var attrs = state.attrs[p.n] || {};
    o.attributes = JSON.parse(JSON.stringify(attrs));
    o.getAttribute = function (k) { return attrs[k]; };
    return o;
  }
  function findPlayer(name) {
    name = String(name).toLowerCase();
    for (var i = 0; i < state.players.length; i++) if (state.players[i].n.toLowerCase() === name) return state.players[i];
    return null;
  }
  var players = {
    all: function () { return state.players.map(snapshot); },
    get: function (name) { var p = findPlayer(name); return p ? snapshot(p) : null; },
    get count() { return state.players.length; },
    onJoin: joinSig.connect, onLeave: leaveSig.connect,
    // Runs as (player, name, value) whenever a server script changes someone's attribute.
    onAttributeChanged: attrSig.connect
  };
  function readOnly(k) { throw new Error('localPlayer.' + k + ' is read-only on the client. Ask the server with a RemoteEvent.'); }
  var localPlayer = {
    get name() { return state.myName; },
    get attributes() { return JSON.parse(JSON.stringify(state.attrs[state.myName] || {})); },
    getAttribute: function (k) { return (state.attrs[state.myName] || {})[k]; },
    // Walks toward a point like a click would. The server still limits real speed and obstacles.
    walkTo: function (x, y) { out.walkTo = { x: num(x, 'x'), y: num(y, 'y') }; },
    onAttributeChanged: function (fn) { return attrSig.connect(function (p, k, v) { if (p.name === state.myName) fn(k, v); }); }
  };
  KEYS.forEach(function (k) {
    Object.defineProperty(localPlayer, k, { enumerable: true, get: function () { var p = findPlayer(state.myName); return p ? snapshot(p)[k] : undefined; }, set: function () { readOnly(k); } });
  });

  /* --------------------------------------------------------------- world */

  var world = {
    get name() { return state.world ? state.world.name : ''; },
    get width() { return state.world ? state.world.width : 0; },
    get height() { return state.world ? state.world.height : 0; },
    get ground() { return state.world ? state.world.ground : ''; },
    get spawn() { return state.world ? { x: state.world.spawn.x, y: state.world.spawn.y } : null; },
    objects: function () { return state.world ? state.world.obstacles.map(function (o) { return { id: o.id, kind: o.kind, x: o.x, y: o.y, w: o.w, h: o.h }; }) : []; },
    // Runs when a server script (or the Studio) changes the world.
    onChanged: worldSig.connect
  };

  /* ------------------------------------------------------------- storage */
  // Storage holds objects designed in the Studio. Cloning one here makes a copy only this player sees:
  // it is drawn, never blocks anyone, and the server knows nothing about it. (Server scripts use
  // Storage too, and their clones are real for everybody.)

  var PLAYER_R = 14, MAX_LOCAL = 100, localObjs = {}, localCount = 0, nextLocal = 1;
  function LocalObject(id, info) {
    Object.defineProperty(this, 'id', { value: id, enumerable: true });
    this._i = info; this._enter = Signal(); this._leave = Signal(); this._inside = false; this._gone = false;
  }
  ['kind', 'x', 'y', 'w', 'h', 'solid', 'asset'].forEach(function (k) {
    Object.defineProperty(LocalObject.prototype, k, {
      enumerable: true,
      get: function () { return this._i[k]; },
      set: function (v) {
        if (this._gone) return;
        if (k === 'kind' || k === 'asset' || k === 'solid') throw new Error('Local objects keep their look: ' + k + ' is read-only.');
        this._i[k] = num(v, k); push(this);
      }
    });
  });
  LocalObject.prototype.set = function (props) {
    if (this._gone) return this;
    for (var k in props) { if (k === 'x' || k === 'y' || k === 'w' || k === 'h') this._i[k] = num(props[k], k); }
    push(this); return this;
  };
  Object.defineProperty(LocalObject.prototype, 'exists', { enumerable: true, get: function () { return !this._gone; } });
  // Runs when the local player walks into it; remove() it to make a pickup.
  LocalObject.prototype.onTouch = function (fn) { return this._enter.connect(fn); };
  LocalObject.prototype.onTouchEnd = function (fn) { return this._leave.connect(fn); };
  LocalObject.prototype.remove = function () {
    if (this._gone) return;
    this._gone = true; delete localObjs[this.id]; localCount--;
    out.lobj.push({ a: 'rm', id: this.id });
  };
  function push(o) {
    var i = o._i;
    out.lobj.push({ a: 'set', id: o.id, o: { kind: i.kind, asset: i.asset, solid: false, x: i.x, y: i.y, w: i.w, h: i.h } });
  }
  function checkLocalTouches() {
    var me = findPlayer(state.myName);
    if (!me) return;
    Object.keys(localObjs).forEach(function (id) {
      var o = localObjs[id];
      if (!o || o._gone) return;
      var i = o._i, nx = Math.max(i.x, Math.min(me.x, i.x + i.w)), ny = Math.max(i.y, Math.min(me.y, i.y + i.h));
      var hit = (me.x - nx) * (me.x - nx) + (me.y - ny) * (me.y - ny) <= PLAYER_R * PLAYER_R;
      if (hit && !o._inside) { o._inside = true; o._enter.fire(snapshot(me)); }
      else if (!hit && o._inside) { o._inside = false; o._leave.fire(snapshot(me)); }
    });
  }

  function Template(t) {
    var self = this;
    ['name', 'kind', 'w', 'h', 'asset'].forEach(function (k) { if (t[k] !== undefined) Object.defineProperty(self, k, { value: t[k], enumerable: true }); });
  }
  Template.prototype.clone = function (spec) {
    if (localCount >= MAX_LOCAL) throw new Error('Too many local objects (limit ' + MAX_LOCAL + ').');
    spec = spec || {};
    var t = this, info = { kind: t.kind, asset: t.asset, x: 0, y: 0, w: t.w, h: t.h };
    ['x', 'y', 'w', 'h'].forEach(function (k) { if (spec[k] !== undefined) info[k] = num(spec[k], k); });
    info.w = Math.max(1, Math.min(2000, info.w)); info.h = Math.max(1, Math.min(2000, info.h));
    var id = 'L' + (nextLocal++), o = new LocalObject(id, info);
    localObjs[id] = o; localCount++;
    push(o);
    return o;
  };
  var Storage = {
    get: function (name) {
      var n = String(name).toLowerCase();
      for (var i = 0; i < state.templates.length; i++) if (state.templates[i].name.toLowerCase() === n) return new Template(state.templates[i]);
      return null;
    },
    list: function () { return state.templates.map(function (t) { return new Template(t); }); }
  };

  /* ------------------------------------------------------- remote events */

  var remotes = {}, remoteBudget = 30, remoteAt = 0;
  function RemoteEvent(name) { Object.defineProperty(this, 'name', { value: name, enumerable: true }); this._sig = Signal(); }
  RemoteEvent.prototype.onClientEvent = RemoteEvent.prototype.connect = RemoteEvent.prototype.on = function (fn) { return this._sig.connect(fn); };
  RemoteEvent.prototype.fireServer = function () {
    var now = state.clock;
    remoteBudget = Math.min(60, remoteBudget + (now - remoteAt) / 1000 * 30); remoteAt = now;
    if (remoteBudget < 1) throw new Error('Too many remote events (limit about 30 per second).');
    remoteBudget -= 1;
    var args = Array.prototype.slice.call(arguments);
    var text;
    try { text = JSON.stringify(args); } catch (e) { throw new Error('Remote event values must be plain data (numbers, text, true/false, lists, objects).'); }
    if (text === undefined || text.length > 4096) throw new Error('Remote event data is too big (limit 4096 characters).');
    if (out.remote.length < 20) out.remote.push({ n: this.name, a: JSON.parse(text) });
  };
  var Remote = {
    event: function (name) {
      name = String(name);
      if (!/^[A-Za-z0-9_.-]{1,40}$/.test(name)) throw new Error('Remote event names are 1-40 letters, numbers, _ . or -');
      return remotes[name] || (remotes[name] = new RemoteEvent(name));
    }
  };

  /* ------------------------------------------------------------- startup */

  function lock() {
    // Everything below is already blocked by the CSP; removing it too means a typo gets a clear error.
    ['fetch', 'XMLHttpRequest', 'WebSocket', 'EventSource', 'importScripts', 'Worker', 'SharedWorker', 'indexedDB', 'caches',
      'postMessage', 'addEventListener', 'removeEventListener', 'close', 'onmessage', 'BroadcastChannel', 'WebTransport', 'navigator']
      .forEach(function (k) { try { delete self[k]; } catch (e) { /* not removable */ } try { self[k] = undefined; } catch (e) { /* fine */ } });
  }

  function expose() {
    var api = {
      console: con, print: con.log, setTimeout: setT, setInterval: setI, clearTimeout: clearTimer, clearInterval: clearTimer, wait: wait,
      camera: camera, ui: ui, effects: effects, input: input, localPlayer: localPlayer, players: players, world: world, Remote: Remote, Storage: Storage, ReplicatedStorage: Storage,
      onFrame: frameSig.connect
    };
    Object.keys(api).forEach(function (k) { Object.defineProperty(self, k, { value: api[k], writable: false, configurable: false, enumerable: false }); });
  }

  function runScript(s) {
    var label = String(s.name || 'script').replace(/[^\w .-]/g, '_').slice(0, 40);
    try {
      (0, eval)('(async function(){' + s.source + '\n})().catch(function(e){ console.error("' + label + ': " + (e && e.message !== undefined ? e.message : e)); });\n//# sourceURL=' + label.replace(/ /g, '_'));
    } catch (e) {
      report(new Error(label + ': ' + (e && e.message !== undefined ? e.message : e)));
    }
  }

  function setWorld(w) { state.world = w; }

  function applyFrame(m) {
    state.clock = m.t; state.me = m.me; state.myName = m.myName; state.players = m.players; state.keys = m.keys || {};
    state.camPos = m.cam || state.camPos;
    if (m.attrs) state.attrs = m.attrs;
  }

  function handleEvent(e) {
    switch (e.k) {
      case 'key': (e.down ? keyDownSig : keyUpSig).fire(String(e.key)); break;
      case 'click': clickSig.fire(e.x, e.y); break;
      case 'remote': { var ev = remotes[e.n]; if (ev) ev._sig.fire.apply(null, e.a || []); break; }
      case 'join': joinSig.fire(snapshotByName(e.n)); break;
      case 'leave': leaveSig.fire({ name: e.n }); break;
      case 'attr': {
        var a = state.attrs[e.n] || (state.attrs[e.n] = {});
        if (e.v === null) delete a[e.key]; else a[e.key] = e.v;
        attrSig.fire(snapshotByName(e.n), e.key, e.v === null ? undefined : e.v);
        break;
      }
      case 'attrs': state.attrs = e.attrs || {}; break;
      case 'world': setWorld(e.world); worldSig.fire(); break;
      case 'ui': { var fn = buttonFns[e.id]; if (fn) { try { fn(); } catch (err) { report(err); } } break; }
      default: break;
    }
  }
  function snapshotByName(n) { var p = findPlayer(n); return p ? snapshot(p) : { name: n, attributes: {}, getAttribute: function () {} }; }

  addListener('message', function (ev) {
    var m = ev.data;
    if (!m || typeof m !== 'object') return;
    try {
      if (m.t === 'init') {
        setWorld(m.world); state.myName = m.me; state.attrs = m.attrs || {}; state.templates = Array.isArray(m.templates) ? m.templates : [];
        state.players = m.players || [];
        expose(); lock();
        for (var i = 0; i < m.scripts.length; i++) runScript(m.scripts[i]);
        flush({ ready: true });
      } else if (m.t === 'frame') {
        applyFrame(m);
        runTimers();
        checkLocalTouches();
        frameSig.fire(m.dt);
        flush({ frame: m.seq });
      } else if (m.t === 'event') {
        if (m.world) setWorld(m.world);
        if (m.players) state.players = m.players;
        handleEvent(m.e);
        flush({});
      }
    } catch (err) {
      report(err); flush({});
    }
  });
})();
