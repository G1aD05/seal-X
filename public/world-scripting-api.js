/* The script API as server scripts see it.
 *
 * This file runs INSIDE the QuickJS sandbox (see world-scripting.js), never in Node, and it is
 * evaluated once per live world, before any script the Studio author wrote. The only thing that
 * crosses the sandbox boundary is a JSON string: __host(op, json) -> json. The host (worlds.js)
 * decides what each op may do, so nothing here can reach Node, the filesystem, the network or
 * anyone's Seals.
 *
 * `node --check world-scripting-api.js` still works on it — it is one plain expression. */
(function (g) {
  'use strict';

  var callHost = g.__host;
  delete g.__host;                       // user scripts only get the friendly API below

  function H(op, a) {
    var r = JSON.parse(callHost(op, a === undefined ? 'null' : JSON.stringify(a)));
    if (r.e !== undefined) throw new Error(r.e);
    return r.v;
  }

  /* ------------------------------------------------------------- console */

  function fmt(v) {
    if (typeof v === 'string') return v;
    if (v instanceof Error) {
      var where = v.stack ? String(v.stack).split('\n')[0].trim() : '';
      return v.message + (where ? '  (' + where + ')' : '');
    }
    if (typeof v === 'function') return '[function]';
    try { var s = JSON.stringify(v); return s === undefined ? String(v) : s; } catch (e) { return String(v); }
  }
  function logger(level) {
    return function () {
      var parts = [];
      for (var i = 0; i < arguments.length; i++) parts.push(fmt(arguments[i]));
      H('log', { l: level, t: parts.join(' ') });
    };
  }
  g.console = { log: logger('log'), info: logger('info'), warn: logger('warn'), error: logger('error') };
  g.print = g.console.log;
  function report(e) { g.console.error(e); }
  // Used by the host's wrapper around each script, so an error after an `await` is reported like any other.
  Object.defineProperty(g, '__fail', { value: function (label, e) {
    var msg = e && e.message !== undefined ? e.message : e;
    H('scripterr', { l: label, m: String(msg), w: e && e.stack ? String(e.stack).split('\n')[0].trim() : '' });
  } });

  /* ------------------------------------------------------------- signals */

  function Signal() {
    var handlers = [];
    return {
      connect: function (fn) {
        if (typeof fn !== 'function') throw new TypeError('Expected a function.');
        handlers.push(fn);
        return function disconnect() { var i = handlers.indexOf(fn); if (i >= 0) handlers.splice(i, 1); };
      },
      fire: function () {
        var args = arguments;
        handlers.slice().forEach(function (fn) { try { fn.apply(null, args); } catch (e) { report(e); } });
      }
    };
  }
  var joinSignal = Signal(), leaveSignal = Signal(), tickSignal = Signal();
  var announced = {};   // players onJoin handlers have already been told about

  /* -------------------------------------------------------------- timers */
  // Driven by the host's tick (20 times a second), so timing is accurate to about 50 ms.

  var timers = {}, timerCount = 0, nextTimer = 1, clock = 0;
  function addTimer(fn, ms, repeat, extra) {
    if (typeof fn !== 'function') throw new TypeError('Expected a function.');
    if (timerCount >= 100) throw new Error('Too many timers (limit 100).');
    ms = Math.max(repeat ? 50 : 0, Number(ms) || 0);
    var id = nextTimer++;
    timers[id] = { fn: fn, at: clock + ms, every: repeat ? ms : 0, args: extra };
    timerCount++;
    return id;
  }
  function clearTimer(id) { if (timers[id]) { delete timers[id]; timerCount--; } }
  g.setTimeout = function (fn, ms) { return addTimer(fn, ms, false, Array.prototype.slice.call(arguments, 2)); };
  g.setInterval = function (fn, ms) { return addTimer(fn, ms, true, Array.prototype.slice.call(arguments, 2)); };
  g.clearTimeout = g.clearInterval = clearTimer;
  g.wait = function (ms) { return new Promise(function (resolve) { g.setTimeout(resolve, ms); }); };
  function runTimers() {
    Object.keys(timers).forEach(function (key) {
      var t = timers[key];
      if (!t || t.at > clock) return;
      if (t.every) t.at = clock + t.every; else clearTimer(key);
      try { t.fn.apply(null, t.args); } catch (e) { report(e); }
    });
  }

  /* ------------------------------------------------------------- players */

  var playerCache = {};
  function Player(name) { Object.defineProperty(this, 'name', { value: name, enumerable: true }); }
  function getPlayer(name) { return playerCache[name] || (playerCache[name] = new Player(name)); }

  var SETTABLE = { speed: 1, scale: 1, color: 1, trail: 1, frozen: 1, hidden: 1, title: 1 };
  ['x', 'y', 'speed', 'scale', 'color', 'trail', 'frozen', 'hidden', 'title'].forEach(function (k) {
    Object.defineProperty(Player.prototype, k, {
      enumerable: true,
      get: function () { var i = H('p.get', { n: this.name }); return i ? i[k] : undefined; },
      set: function (v) {
        if (!SETTABLE[k]) throw new Error('player.' + k + ' is read-only. Use player.teleport(x, y) to move a player.');
        H('p.set', { n: this.name, k: k, v: v });
      }
    });
  });
  Player.prototype.teleport = function (x, y) { H('p.tp', { n: this.name, x: x, y: y }); };
  Player.prototype.say = function (text) { H('p.say', { n: this.name, t: String(text) }); };
  Player.prototype.setAttribute = function (k, v) { H('p.attr', { n: this.name, k: String(k), v: v === undefined ? null : v }); };
  Player.prototype.getAttribute = function (k) { var i = H('p.get', { n: this.name }); return i ? i.attrs[k] : undefined; };
  Object.defineProperty(Player.prototype, 'attributes', { enumerable: true, get: function () { var i = H('p.get', { n: this.name }); return i ? i.attrs : {}; } });
  Object.defineProperty(Player.prototype, 'connected', { enumerable: true, get: function () { return !!H('p.get', { n: this.name }); } });
  Player.prototype.toString = Player.prototype.toJSON = function () { return this.name; };

  g.players = {
    all: function () { return H('players.names').map(getPlayer); },
    get: function (name) { var n = H('players.find', { n: String(name) }); return n ? getPlayer(n) : null; },
    get count() { return H('players.names').length; },
    onJoin: joinSignal.connect,
    onLeave: leaveSignal.connect
  };

  /* --------------------------------------------------------------- world */

  var objectCache = {};
  function WorldObject(id) { Object.defineProperty(this, 'id', { value: id, enumerable: true }); }
  function getObject(id) { return objectCache[id] || (objectCache[id] = new WorldObject(id)); }
  ['kind', 'x', 'y', 'w', 'h', 'asset', 'solid'].forEach(function (k) {
    Object.defineProperty(WorldObject.prototype, k, {
      enumerable: true,
      get: function () { var o = H('o.get', { id: this.id }); return o ? o[k] : undefined; },
      set: function (v) { var p = {}; p[k] = v; H('o.set', { id: this.id, p: p }); }
    });
  });
  WorldObject.prototype.set = function (props) { H('o.set', { id: this.id, p: props }); return this; };
  WorldObject.prototype.remove = function () { H('o.rm', { id: this.id }); delete objectCache[this.id]; };
  Object.defineProperty(WorldObject.prototype, 'exists', { enumerable: true, get: function () { return !!H('o.get', { id: this.id }); } });
  WorldObject.prototype.toJSON = function () { return H('o.get', { id: this.id }); };

  function info() { return H('w.info'); }
  g.world = {
    get name() { return info().name; },
    get width() { return info().width; },
    get height() { return info().height; },
    get ground() { return info().ground; },
    set ground(c) { H('w.set', { ground: c }); },
    get spawn() { return info().spawn; },
    setSpawn: function (x, y) { H('w.set', { spawn: { x: x, y: y } }); },
    objects: function () { return H('w.objs').map(function (o) { return getObject(o.id); }); },
    getObject: function (id) { return H('o.get', { id: String(id) }) ? getObject(String(id)) : null; },
    addObject: function (spec) { return getObject(H('w.addObj', spec || {}).id); },
    announce: function (text) { H('w.announce', { t: String(text) }); },
    confetti: function (x, y) { H('w.confetti', { x: x, y: y }); }
  };

  /* ------------------------------------------------------- remote events */

  var remotes = {};
  function RemoteEvent(name) {
    Object.defineProperty(this, 'name', { value: name, enumerable: true });
    this._signal = Signal();
  }
  // Runs when a client fires this event at the server. First argument is the player who sent it.
  RemoteEvent.prototype.onServerEvent = RemoteEvent.prototype.connect = RemoteEvent.prototype.on = function (fn) { return this._signal.connect(fn); };
  RemoteEvent.prototype.fireClient = function (player) {
    H('remote.fire', { n: this.name, to: String(player), a: Array.prototype.slice.call(arguments, 1) });
  };
  RemoteEvent.prototype.fireAllClients = function () {
    H('remote.fire', { n: this.name, to: null, a: Array.prototype.slice.call(arguments) });
  };
  RemoteEvent.prototype.fireOtherClients = function (player) {
    H('remote.fire', { n: this.name, to: null, except: String(player), a: Array.prototype.slice.call(arguments, 1) });
  };
  g.Remote = {
    event: function (name) {
      name = String(name);
      if (!/^[A-Za-z0-9_.-]{1,40}$/.test(name)) throw new Error('Remote event names are 1-40 letters, numbers, _ . or -');
      return remotes[name] || (remotes[name] = new RemoteEvent(name));
    }
  };

  g.onTick = tickSignal.connect;

  /* ---------------------------------------- called by the host, not by scripts */

  g.__dispatch = function (kind, json) {
    var d = JSON.parse(json);
    if (kind === 'tick') {
      clock = d.t;
      runTimers();
      tickSignal.fire(d.dt);
    } else if (kind === 'join') {
      // The host announces everyone already in the world once the scripts have loaded, and each
      // new player as they arrive. A player can be announced by both: only the first counts.
      if (announced[d.n]) return;
      announced[d.n] = true;
      joinSignal.fire(getPlayer(d.n));
    } else if (kind === 'leave') {
      if (!announced[d.n]) return;
      delete announced[d.n];
      leaveSignal.fire(getPlayer(d.n));
      delete playerCache[d.n];
    } else if (kind === 'remote') {
      var ev = remotes[d.n];
      if (ev) ev._signal.fire.apply(null, [getPlayer(d.p)].concat(d.a));
    }
  };
})(globalThis);
