/* Language service for Seal world scripts: completions, hover docs, signature help and diagnostics.
 *
 * It follows the Language Server Protocol's ideas (completion / hover / signatureHelp / diagnostics, with
 * zero-based offsets in and plain results out) but runs right in the page, so it needs no server and
 * can't see anything outside the text you give it. The Studio's editor wires it up (see studio.html).
 *
 * It knows the script API (server and client) from the tables below, and works out what a name refers to
 * with a light scan of the script: `const p = players.get('x')`, `players.onJoin(p => …)`,
 * `for (const o of world.objects())`, `Storage.get('Coin').clone()` and so on. It is a guide, not a type
 * checker: when it can't tell what something is it stays quiet rather than guess.
 *
 *   var svc = ScriptLSP.create({ side: 'server' | 'client' | 'object', storage: ['Coin'], remotes: ['Collect'] });
 *   svc.completions(text, offset) -> { from, items: [{ label, kind, detail, doc, insert }] } | null
 *   svc.hover(text, offset)       -> { from, to, title, doc } | null
 *   svc.signature(text, offset)   -> { label, params: [..], active, doc } | null
 *   svc.diagnostics(text)         -> [{ from, to, line, col, severity: 'error' | 'warning', message }]
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.ScriptLSP = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  /* ------------------------------------------------------------- the API */

  function P(type, doc, o) { return Object.assign({ k: 'prop', type: type, doc: doc || '' }, o); }
  function RO(type, doc) { return P(type, doc, { ro: true }); }
  // sig: '(x: number, y?: number, ...rest)'; ret: type name ('Player', 'Player[]', 'void'); cb: types of the callback's parameters.
  function M(sig, ret, doc, o) { return Object.assign({ k: 'method', sig: sig, ret: ret || 'void', doc: doc || '' }, o); }

  var SERVER = {}, CLIENT = {};

  SERVER.Player = {
    name: RO('string', 'The player\'s name.'),
    x: RO('number', 'Where they are (read-only). Use player.teleport(x, y) to move them.'),
    y: RO('number', 'Where they are (read-only). Use player.teleport(x, y) to move them.'),
    speed: P('number', 'Walking speed multiplier, 0 to 5. 1 is normal.'),
    scale: P('number', 'Size multiplier, 0.25 to 6. Only changes how big they look.'),
    color: P('string', 'Body colour like "#ff8800", or null for their own colour.'),
    title: P('string', 'Text shown over their head (24 characters).'),
    trail: P('boolean', 'A rainbow trail behind them.'),
    frozen: P('boolean', 'true stops them walking.'),
    hidden: P('boolean', 'true hides them from everyone else.'),
    connected: RO('boolean', 'false once they have left.'),
    attributes: RO('object', 'All their attributes as an object.'),
    teleport: M('(x: number, y: number)', 'void', 'Moves the player.'),
    say: M('(text: string)', 'void', 'Shows a message to just this player.'),
    setAttribute: M('(key: string, value: number | string | boolean | null)', 'void', 'Stores your own data on the player (max 12). null removes it. Everyone\'s browser can read it.'),
    getAttribute: M('(key: string)', 'any', 'Reads one of the player\'s attributes.')
  };
  SERVER.Players = {
    all: M('()', 'Player[]', 'Everyone in the world.'),
    get: M('(name: string)', 'Player', 'Finds a player by name, or null.'),
    count: RO('number', 'How many players are in the world.'),
    onJoin: M('(fn: (player) => void)', 'void', 'Runs for every player: those already here and each new one.', { cb: ['Player'] }),
    onLeave: M('(fn: (player) => void)', 'void', 'Runs when a player leaves.', { cb: ['Player'] })
  };
  SERVER.WorldObject = {
    id: RO('string', 'Unique id of this object.'),
    kind: P('string', 'tree, rock, water, wall or svg.'),
    x: P('number', 'Left edge. Set it to move the object.'),
    y: P('number', 'Top edge. Set it to move the object.'),
    w: P('number', 'Width.'),
    h: P('number', 'Height.'),
    asset: P('string', 'For svg objects: the id of the SVG design.'),
    solid: P('boolean', 'For svg objects: false lets players walk through it.'),
    template: RO('string', 'Name of the Storage item this was copied from, or null.'),
    exists: RO('boolean', 'false once the object has been removed.'),
    set: M('(props: object)', 'WorldObject', 'Changes several properties at once: obj.set({ x: 5, y: 9 }).'),
    remove: M('()', 'void', 'Deletes the object for everyone.'),
    onTouch: M('(fn: (player) => void)', 'void', 'Runs when a player walks into this object (solid or not).', { cb: ['Player'] }),
    onTouchEnd: M('(fn: (player) => void)', 'void', 'Runs when a player stops touching this object.', { cb: ['Player'] })
  };
  SERVER.World = {
    name: RO('string', 'The world\'s name.'),
    width: RO('number', 'World width.'),
    height: RO('number', 'World height.'),
    spawn: RO('object', 'Where players appear: { x, y }. Change it with world.setSpawn(x, y).'),
    ground: P('string', 'Ground colour like "#2f6b3a".'),
    setSpawn: M('(x: number, y: number)', 'void', 'Moves the spawn point.'),
    objects: M('()', 'WorldObject[]', 'The objects in the world right now.'),
    getObject: M('(id: string)', 'WorldObject', 'Finds an object by id, or null.'),
    addObject: M('(spec: { kind, x, y, w, h, asset?, solid? })', 'WorldObject', 'Makes a new object. svg objects also need asset: the id of one of your SVG designs.'),
    announce: M('(text: string)', 'void', 'Shows a message to everyone.'),
    confetti: M('(x: number, y: number)', 'void', 'Confetti for everyone.')
  };
  SERVER.Template = {
    name: RO('string', 'The item\'s name in Storage.'),
    kind: RO('string', 'tree, rock, water, wall or svg.'),
    w: RO('number', 'Default width.'), h: RO('number', 'Default height.'),
    asset: RO('string', 'The SVG design it uses, if any.'),
    solid: RO('boolean', 'Whether copies block players.'),
    hasScript: RO('boolean', 'Whether copies run an object script.'),
    clone: M('(spec?: { x, y, w?, h?, solid? })', 'WorldObject', 'Puts a real copy in the world for everyone and starts its script.')
  };
  SERVER.Storage = {
    get: M('(name: string)', 'Template', 'The Storage item with that name, or null.'),
    list: M('()', 'Template[]', 'Every Storage item.')
  };
  SERVER.RemoteEvent = {
    name: RO('string', 'The event\'s name.'),
    onServerEvent: M('(fn: (player, ...args) => void)', 'void', 'Runs when a client fires this event. `player` is who really sent it, so never trust the arguments.', { cb: ['Player'] }),
    fireClient: M('(player, ...args)', 'void', 'Sends to one player\'s client scripts.'),
    fireAllClients: M('(...args)', 'void', 'Sends to every player\'s client scripts.'),
    fireOtherClients: M('(player, ...args)', 'void', 'Sends to everyone except one player.')
  };
  SERVER.Remote = { event: M('(name: string)', 'RemoteEvent', 'A RemoteEvent for sending messages between server and client scripts. Use the same name on both sides.') };

  CLIENT.PlayerView = {
    name: RO('string', 'The player\'s name.'),
    x: RO('number', 'Where they are.'), y: RO('number', 'Where they are.'),
    color: RO('string', 'Body colour.'), scale: RO('number', 'Size multiplier.'), speed: RO('number', 'Speed multiplier.'),
    trail: RO('boolean', 'Has a trail.'), frozen: RO('boolean', 'Frozen by the server.'), hidden: RO('boolean', 'Hidden by the server.'),
    title: RO('string', 'Text over their head.'),
    attributes: RO('object', 'All their attributes.'),
    getAttribute: M('(key: string)', 'any', 'Reads one of their attributes.')
  };
  CLIENT.LocalPlayer = Object.assign({}, CLIENT.PlayerView, {
    walkTo: M('(x: number, y: number)', 'void', 'Walks toward a point like a click would. The server still decides how far you really get.'),
    onAttributeChanged: M('(fn: (key, value) => void)', 'void', 'Runs when a server script changes one of YOUR attributes.', { cb: ['string', 'any'] })
  });
  CLIENT.Players = {
    all: M('()', 'PlayerView[]', 'Everyone in the world.'),
    get: M('(name: string)', 'PlayerView', 'Finds a player by name, or null.'),
    count: RO('number', 'How many players are in the world.'),
    onJoin: M('(fn: (player) => void)', 'void', 'Runs when a player joins.', { cb: ['PlayerView'] }),
    onLeave: M('(fn: (player) => void)', 'void', 'Runs when a player leaves.', { cb: ['PlayerView'] }),
    onAttributeChanged: M('(fn: (player, key, value) => void)', 'void', 'Runs when a server script changes anyone\'s attribute.', { cb: ['PlayerView', 'string', 'any'] })
  };
  CLIENT.ObjectView = {
    id: RO('string', 'Object id.'), kind: RO('string', 'Object type.'),
    x: RO('number', 'Left edge.'), y: RO('number', 'Top edge.'), w: RO('number', 'Width.'), h: RO('number', 'Height.')
  };
  CLIENT.World = {
    name: RO('string', 'The world\'s name.'), width: RO('number', 'World width.'), height: RO('number', 'World height.'),
    ground: RO('string', 'Ground colour.'), spawn: RO('object', 'Spawn point { x, y }.'),
    objects: M('()', 'ObjectView[]', 'The objects in the world (read-only).'),
    onChanged: M('(fn: () => void)', 'void', 'Runs when a server script or the Studio changes the world.')
  };
  CLIENT.LocalObject = {
    id: RO('string', 'Id of this local copy.'), kind: RO('string', 'Object type.'),
    x: P('number', 'Left edge.'), y: P('number', 'Top edge.'), w: P('number', 'Width.'), h: P('number', 'Height.'),
    solid: RO('boolean', 'Local copies never block anyone.'), asset: RO('string', 'The SVG design it uses.'),
    exists: RO('boolean', 'false once removed.'),
    set: M('(props: object)', 'LocalObject', 'Moves or resizes the copy: { x, y, w, h }.'),
    remove: M('()', 'void', 'Removes the copy.'),
    onTouch: M('(fn: (player) => void)', 'void', 'Runs when YOU walk into it.', { cb: ['PlayerView'] }),
    onTouchEnd: M('(fn: (player) => void)', 'void', 'Runs when you stop touching it.', { cb: ['PlayerView'] })
  };
  CLIENT.Template = {
    name: RO('string', 'The item\'s name.'), kind: RO('string', 'Object type.'), w: RO('number', 'Default width.'), h: RO('number', 'Default height.'), asset: RO('string', 'SVG design id.'),
    clone: M('(spec?: { x, y, w?, h? })', 'LocalObject', 'Makes a copy only YOU see (max 100). It is drawn but never blocks anyone.')
  };
  CLIENT.Storage = {
    get: M('(name: string)', 'Template', 'The Storage item with that name, or null.'),
    list: M('()', 'Template[]', 'Every Storage item.')
  };
  CLIENT.RemoteEvent = {
    name: RO('string', 'The event\'s name.'),
    onClientEvent: M('(fn: (...args) => void)', 'void', 'Runs when the server fires this event at you.'),
    fireServer: M('(...args)', 'void', 'Sends to the server scripts (about 30 a second at most). The server decides what is real.')
  };
  CLIENT.Remote = SERVER.Remote;
  CLIENT.Camera = {
    x: P('number', 'Camera centre. Setting it frees the camera.'), y: P('number', 'Camera centre. Setting it frees the camera.'),
    zoom: P('number', '0.25 to 4. 1 is normal.'), rotation: P('number', 'Degrees.'),
    smooth: P('number', '0 snaps to the target; 5-10 glides.'), clamp: P('boolean', 'true keeps the camera inside the world.'),
    lookAt: M('(x: number, y: number)', 'void', 'Points the camera at a spot in the world.'),
    follow: M('(name?: string)', 'void', 'Follows a player by name (yourself by default).'),
    offset: M('(x: number, y: number)', 'void', 'Shifts the camera from its target.'),
    shake: M('(amount: number, seconds?: number)', 'void', 'Shakes the screen.'),
    reset: M('()', 'void', 'Back to the normal follow camera.')
  };
  CLIENT.Ui = {
    text: M('(id: string, text: string, opts?: { anchor, x, y, size, color, bg })', 'void', 'Shows (or updates) a line of text. anchor: top-left, top, top-right, left, center, right, bottom-left, bottom, bottom-right.'),
    bar: M('(id: string, value: number, max?: number, opts?: object)', 'void', 'Shows (or updates) a progress bar.'),
    button: M('(id: string, text: string, opts?: object, onClick?: () => void)', 'void', 'Shows a button. The function runs when it is clicked.'),
    remove: M('(id: string)', 'void', 'Removes one HUD element.'),
    clear: M('()', 'void', 'Removes all HUD elements.'),
    toast: M('(text: string, seconds?: number)', 'void', 'A short message at the top of the screen.')
  };
  CLIENT.Input = {
    onKeyDown: M('(fn: (key) => void)', 'void', 'Runs when a key goes down. Keys are lowercase: "q", " ", "arrowup".', { cb: ['string'] }),
    onKeyUp: M('(fn: (key) => void)', 'void', 'Runs when a key comes up.', { cb: ['string'] }),
    onClick: M('(fn: (x, y) => void)', 'void', 'Runs when the world is clicked, with world coordinates.', { cb: ['number', 'number'] }),
    isDown: M('(key: string)', 'boolean', 'Is this key held right now?'),
    moveEnabled: P('boolean', 'false stops the player walking in this browser.')
  };
  CLIENT.Effects = {
    confetti: M('(x: number, y: number)', 'void', 'Confetti, just for you.'),
    flash: M('(color?: string, seconds?: number)', 'void', 'Flashes the screen.'),
    floatText: M('(text: string, x: number, y: number, color?: string)', 'void', 'Text that floats up from a spot in the world.')
  };

  var CONSOLE = {
    log: M('(...values)', 'void', 'Prints to the console below the editor (server) or the game console (client).'),
    info: M('(...values)', 'void', 'Prints an info line.'), warn: M('(...values)', 'void', 'Prints a warning.'), error: M('(...values)', 'void', 'Prints an error.')
  };
  SERVER.Console = CLIENT.Console = CONSOLE;

  // Names visible as globals, per side. `type` links to the tables above; `fn` ones are plain functions.
  function globals(side) {
    var C = side === 'client';
    var g = {
      console: { k: 'object', type: 'Console', doc: 'Print messages while testing.' },
      print: { k: 'function', sig: '(...values)', ret: 'void', doc: 'Same as console.log.' },
      wait: { k: 'function', sig: '(ms: number)', ret: 'Promise', doc: 'Pauses an async script: await wait(1000).' },
      setTimeout: { k: 'function', sig: '(fn, ms: number)', ret: 'number', doc: 'Runs fn once after ms milliseconds.' },
      setInterval: { k: 'function', sig: '(fn, ms: number)', ret: 'number', doc: 'Runs fn every ms milliseconds.' },
      clearTimeout: { k: 'function', sig: '(id: number)', ret: 'void', doc: 'Cancels a timer.' },
      clearInterval: { k: 'function', sig: '(id: number)', ret: 'void', doc: 'Cancels a timer.' },
      players: { k: 'object', type: 'Players', doc: C ? 'The players in the world (read-only view).' : 'The players in the world.' },
      world: { k: 'object', type: 'World', doc: C ? 'The world (read-only view).' : 'The world: ground, spawn and objects.' },
      Remote: { k: 'object', type: 'Remote', doc: 'RemoteEvents carry messages between server and client scripts.' },
      Storage: { k: 'object', type: 'Storage', doc: 'Objects designed in the Studio that scripts can copy into the world.' },
      ReplicatedStorage: { k: 'object', type: 'Storage', doc: 'Another name for Storage.' }
    };
    if (C) {
      g.camera = { k: 'object', type: 'Camera', doc: 'Your camera: zoom, follow, shake.' };
      g.ui = { k: 'object', type: 'Ui', doc: 'Draw on-screen text, bars and buttons.' };
      g.input = { k: 'object', type: 'Input', doc: 'Keys and clicks.' };
      g.effects = { k: 'object', type: 'Effects', doc: 'Visual effects, just for you.' };
      g.localPlayer = { k: 'object', type: 'LocalPlayer', doc: 'You.' };
      g.onFrame = { k: 'function', sig: '(fn: (dt) => void)', ret: 'void', doc: 'Runs every frame; dt is seconds since the last one.', cb: ['number'] };
    } else {
      g.onTick = { k: 'function', sig: '(fn: (dt) => void)', ret: 'void', doc: 'Runs about 20 times a second; dt is seconds since the last tick. Keep it quick.', cb: ['number'] };
    }
    return g;
  }
  var CLIENT_ONLY = ['camera', 'ui', 'input', 'effects', 'localPlayer', 'onFrame'];
  var SERVER_ONLY = ['onTick'];

  function tables(side) { return side === 'client' ? CLIENT : SERVER; }

  var KEYWORDS = 'async await break case catch class const continue default do else export extends false finally for function if import in instanceof let new null of return switch this throw true try typeof undefined var void while yield'.split(' ');
  var BUILTIN_GLOBALS = ['Math', 'JSON', 'Number', 'String', 'Array', 'Object', 'Date', 'Promise', 'Boolean', 'Map', 'Set', 'Error', 'parseInt', 'parseFloat', 'isNaN', 'isFinite'];

  /* ---------------------------------------------------------- text tools */

  // Marks which characters are inside a string or comment, so nothing below reads names out of those.
  var SKIP_RE = /\/\/[^\n]*|\/\*[\s\S]*?(?:\*\/|$)|"(?:\\.|[^"\\\n])*"?|'(?:\\.|[^'\\\n])*'?|`(?:\\[\s\S]|[^`\\])*`?/g;
  function maskOf(text) {
    var out = text.split(''), m;
    SKIP_RE.lastIndex = 0;
    while ((m = SKIP_RE.exec(text))) {
      var isStr = m[0].charAt(0) !== '/';
      for (var i = m.index; i < m.index + m[0].length; i++) if (out[i] !== '\n') out[i] = isStr && i > m.index && i < m.index + m[0].length - 1 ? '\u0001' : ' ';
    }
    return out.join('');
  }
  // Same, but string contents stay (as spaces) only; used when we need "code only" text.
  // Is this offset inside a comment or string (so no suggestions, no hover)?
  function inSkip(text, off) {
    var m;
    SKIP_RE.lastIndex = 0;
    while ((m = SKIP_RE.exec(text))) {
      var end = m.index + m[0].length, first = m[0].charAt(0), closed = first === '/' ? /\*\/$/.test(m[0]) && m[0].charAt(1) === '*' : (m[0].length > 1 && m[0].charAt(m[0].length - 1) === first);
      if (off > m.index && (off < end || (off === end && !closed))) return true;
      if (m.index >= off) break;
    }
    return false;
  }
  function lineCol(text, off) {
    var line = 0, last = -1;
    for (var i = 0; i < off && i < text.length; i++) if (text.charAt(i) === '\n') { line++; last = i; }
    return { line: line, col: off - last - 1 };
  }
  function splitParams(sig) {
    var inner = sig.replace(/^\(/, '').replace(/\)$/, ''), parts = [], depth = 0, cur = '';
    for (var i = 0; i < inner.length; i++) {
      var c = inner.charAt(i);
      if ('({[<'.indexOf(c) >= 0 && !(c === '<' && false)) depth++;
      else if (')}]>'.indexOf(c) >= 0 && !(c === '>' && inner.charAt(i - 1) === '=')) depth--;
      if (c === ',' && depth === 0) { parts.push(cur.trim()); cur = ''; } else cur += c;
    }
    if (cur.trim()) parts.push(cur.trim());
    return parts;
  }
  function paramInfo(sig) {
    var parts = splitParams(sig);
    var required = 0, rest = false;
    parts.forEach(function (p) { if (/^\.\.\./.test(p)) rest = true; else if (!/^[^:]*\?/.test(p)) required++; });
    return { parts: parts, required: required, max: rest ? Infinity : parts.length };
  }
  function lev(a, b) {
    var d = [], i, j;
    for (i = 0; i <= a.length; i++) { d[i] = [i]; }
    for (j = 0; j <= b.length; j++) d[0][j] = j;
    for (i = 1; i <= a.length; i++) for (j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a.charAt(i - 1) === b.charAt(j - 1) ? 0 : 1));
    return d[a.length][b.length];
  }
  function closest(name, list) {
    var best = null, bd = 3;
    list.forEach(function (c) { var d = lev(name.toLowerCase(), c.toLowerCase()); if (d < bd) { bd = d; best = c; } });
    return best;
  }

  /* --------------------------------------------------------------- service */

  function create(opts) {
    opts = opts || {};
    var side = opts.side === 'client' ? 'client' : 'server';
    var isObject = opts.side === 'object';
    var T = tables(side), G = globals(side);
    if (isObject) G.object = { k: 'object', type: 'WorldObject', doc: 'The object this script belongs to. Each copy of the Storage item runs its own copy of the script.' };
    var storage = opts.storage || [], remotes = opts.remotes || [];

    function typeBase(t) { return t ? t.replace(/\[\]$/, '') : t; }
    function isArray(t) { return !!t && /\[\]$/.test(t); }

    // What does an expression like `players.get('Ann')` or `Storage.get('Coin').clone` evaluate to? A type name or null.
    function typeOfChain(expr, env) {
      expr = expr.trim();
      var m = /^([A-Za-z_$][\w$]*)/.exec(expr);
      if (!m) return null;
      var rest = expr.slice(m[0].length), type = null;
      if (G[m[1]]) type = G[m[1]].k === 'object' ? G[m[1]].type : null;
      else if (env) type = env(m[1]);
      var seg = /^\s*\.\s*([A-Za-z_$][\w$]*)\s*(\()?/;
      var s;
      while (type && (s = seg.exec(rest))) {
        var arrIdx = false;
        if (isArray(type)) return null;     // members of an array: not tracked
        var def = T[typeBase(type)] && T[typeBase(type)][s[1]];
        if (!def) return null;
        rest = rest.slice(s[0].length);
        if (s[2]) {
          if (def.k !== 'method') return null;
          var close = matchParen(rest, -1);
          if (close < 0) return null;
          rest = rest.slice(close + 1);
          type = def.ret === 'void' ? null : def.ret;
        } else {
          type = def.k === 'prop' && T[typeBase(def.type)] ? def.type : null;
        }
        void arrIdx;
      }
      return /^\s*$/.test(rest) ? type : null;
    }
    // index of the ")" that closes a "(" at position start (start = -1 means the "(" is just consumed)
    function matchParen(s, start) {
      var depth = 1, i = start + 1;
      for (; i < s.length; i++) {
        var c = s.charAt(i);
        if (c === '(') depth++; else if (c === ')') { depth--; if (depth === 0) return i; }
      }
      return -1;
    }

    // Finds what local names refer to: declarations and callback parameters. Returns a lookup function(name, pos).
    function scan(text) {
      var masked = maskOf(text).replace(/\u0001/g, ' ');
      var defs = [];
      function add(name, type, pos) { if (name && type) defs.push({ name: name, type: type, pos: pos }); }
      var env = function (pos) { return function (name) { var t = null; for (var i = 0; i < defs.length; i++) if (defs[i].name === name && defs[i].pos <= pos) t = defs[i].type; return t; }; };
      // Pass 1 and 2 repeat so one definition can feed the next (a callback's parameter used in a later declaration).
      for (var pass = 0; pass < 2; pass++) {
        defs = defs.filter(function (d) { return d.pass !== pass; });
        var m;
        // const x = <chain>
        var declRe = /\b(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s*=\s*(?:await\s+)?([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)/g;
        while ((m = declRe.exec(masked))) { var t = typeOfChain(maskedWithStrings(text, m.index + m[0].length - m[2].length, m[2]), env(m.index)); if (t) { add(m[1], t, m.index); defs[defs.length - 1].pass = pass; } }
        // for (const x of <chain>)
        var forRe = /\bfor\s*\(\s*(?:const|let|var)\s+([A-Za-z_$][\w$]*)\s+of\s+([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)/g;
        while ((m = forRe.exec(masked))) { var ft = typeOfChain(maskedWithStrings(text, m.index + m[0].length - m[2].length, m[2]), env(m.index)); if (ft && isArray(ft)) { add(m[1], typeBase(ft), m.index); defs[defs.length - 1].pass = pass; } }
        // <chain>.method(function (a, b) / (a, b) => / a =>
        var cbRe = /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)\s*\.\s*([A-Za-z_$][\w$]*)\s*\(\s*(?:async\s*)?(?:function\s*[\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)/g;
        while ((m = cbRe.exec(masked))) {
          var recv = typeOfChain(maskedWithStrings(text, m.index, m[1]), env(m.index));
          var pnames = (m[3] !== undefined ? m[3] : m[4] !== undefined ? m[4] : m[5]).split(',').map(function (s) { return s.trim().replace(/=.*$/, '').trim(); });
          var cbTypes = null, cbPos = m.index;
          if (recv && isArray(recv) && /^(forEach|map|filter|find|some|every)$/.test(m[2])) cbTypes = [typeBase(recv)];
          else if (recv && T[typeBase(recv)] && T[typeBase(recv)][m[2]]) cbTypes = T[typeBase(recv)][m[2]].cb;
          else if (!recv) {
            // `players.all().forEach` etc. are handled above; global functions: onTick(fn)
          }
          if (cbTypes) pnames.forEach(function (n, i) { if (/^[A-Za-z_$][\w$]*$/.test(n) && cbTypes[i] && cbTypes[i] !== 'any') { add(n, cbTypes[i], cbPos); defs[defs.length - 1].pass = pass; } });
        }
        // plain global callbacks: onTick(dt => …)
        var gRe = /\b(onTick|onFrame)\s*\(\s*(?:async\s*)?(?:function\s*[\w$]*\s*\(([^)]*)\)|\(([^)]*)\)\s*=>|([A-Za-z_$][\w$]*)\s*=>)/g;
        while ((m = gRe.exec(masked))) {
          var gn = (m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4]).split(',')[0].trim();
          if (G[m[1]] && /^[A-Za-z_$][\w$]*$/.test(gn)) { add(gn, 'number', m.index); defs[defs.length - 1].pass = pass; }
        }
      }
      return { defs: defs, masked: masked, lookup: function (name, pos) { return env(pos === undefined ? 1e9 : pos)(name); } };
    }
    // typeOfChain reads names, not strings, but needs call arguments intact to skip balanced parens: use the real text.
    function maskedWithStrings(text, from, expr) { return text.substr(from, expr.length); }

    function localNames(masked) {
      var seen = {}, out = [], m;
      var re = /\b(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)|\(([^()]*)\)\s*=>|\bfunction\s*[\w$]*\s*\(([^)]*)\)/g;
      while ((m = re.exec(masked))) {
        var names = m[1] ? [m[1]] : (m[2] || m[3] || '').split(',').map(function (s) { return s.trim().replace(/=.*$/, '').trim(); });
        names.forEach(function (n) { if (/^[A-Za-z_$][\w$]*$/.test(n) && !seen[n]) { seen[n] = 1; out.push(n); } });
      }
      return out;
    }

    function memberItems(typeName) {
      var tbl = T[typeBase(typeName)];
      if (!tbl) return [];
      return Object.keys(tbl).map(function (name) { return memberItem(name, tbl[name]); });
    }
    function memberItem(name, d) {
      var detail = d.k === 'method' ? d.sig + (d.ret && d.ret !== 'void' ? ': ' + d.ret : '') : d.type + (d.ro ? ' · read-only' : '');
      return { label: name, kind: d.k === 'method' ? 'method' : 'property', detail: detail, doc: d.doc, insert: d.k === 'method' ? name + '(' : name, sortText: (d.k === 'method' ? '1' : '0') + name };
    }

    /* ----------------------------------------------------- completions */

    function completions(text, offset, force) {
      var before = text.slice(0, offset);
      // inside a string only a few spots offer names
      var sm = /(Storage|ReplicatedStorage)\s*\.\s*get\s*\(\s*(['"`])([^'"`\n]*)$/.exec(before);
      if (sm) return { from: offset - sm[3].length, items: storage.filter(function (n) { return n.toLowerCase().indexOf(sm[3].toLowerCase()) === 0; }).map(function (n) { return { label: n, kind: 'value', detail: 'Storage item', doc: '', insert: n }; }) };
      var rm = /Remote\s*\.\s*event\s*\(\s*(['"`])([^'"`\n]*)$/.exec(before);
      if (rm) return { from: offset - rm[2].length, items: remotes.filter(function (n) { return n.toLowerCase().indexOf(rm[2].toLowerCase()) === 0; }).map(function (n) { return { label: n, kind: 'value', detail: 'RemoteEvent used elsewhere', doc: '', insert: n }; }) };
      if (inSkip(text, offset)) return null;
      var dm = /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)\s*\.\s*([A-Za-z_$][\w$]*)?$/.exec(before);
      var sc = scan(text);
      if (dm && /\.\s*[A-Za-z_$]*$/.test(before)) {
        var prefix = dm[2] || '';
        var type = typeOfChain(dm[1], function (n) { return sc.lookup(n, offset); });
        if (!type) return null;
        if (isArray(type)) {
          var arr = ['forEach', 'map', 'filter', 'find', 'some', 'every', 'length', 'indexOf', 'includes', 'slice', 'push', 'join'].map(function (n) { return { label: n, kind: n === 'length' ? 'property' : 'method', detail: 'Array<' + typeBase(type) + '>', doc: '', insert: n === 'length' ? n : n + '(' }; });
          return { from: offset - prefix.length, items: arr.filter(function (i) { return i.label.toLowerCase().indexOf(prefix.toLowerCase()) === 0; }) };
        }
        var items = memberItems(type).filter(function (i) { return i.label.toLowerCase().indexOf(prefix.toLowerCase()) === 0; });
        return items.length ? { from: offset - prefix.length, items: items } : null;
      }
      var wm = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)$/.exec(before);
      var word = wm ? wm[1] : '';
      if (!word && !force) return null;
      if (/\bfunction\s+$|\b(?:const|let|var)\s+$/.test(before) || /\.\s*$/.test(before)) return null;
      var out = [];
      Object.keys(G).forEach(function (n) { var g = G[n]; out.push({ label: n, kind: g.k === 'function' ? 'function' : 'variable', detail: g.k === 'function' ? g.sig + (g.ret !== 'void' ? ': ' + g.ret : '') : g.type, doc: g.doc, insert: g.k === 'function' ? n + '(' : n, sortText: '0' + n }); });
      localNames(sc.masked).forEach(function (n) { if (!G[n]) { var lt = sc.lookup(n, offset); out.push({ label: n, kind: 'variable', detail: lt || 'local', doc: '', insert: n, sortText: '0' + n }); } });
      BUILTIN_GLOBALS.forEach(function (n) { out.push({ label: n, kind: 'class', detail: 'JavaScript', doc: '', insert: n, sortText: '2' + n }); });
      KEYWORDS.forEach(function (n) { out.push({ label: n, kind: 'keyword', detail: 'keyword', doc: '', insert: n, sortText: '3' + n }); });
      var low = word.toLowerCase();
      out = out.filter(function (i) { return i.label !== word && i.label.toLowerCase().indexOf(low) === 0; });
      out.sort(function (a, b) { return a.sortText < b.sortText ? -1 : a.sortText > b.sortText ? 1 : 0; });
      return out.length ? { from: offset - word.length, items: out } : null;
    }

    /* ------------------------------------------------------------ hover */

    function wordAt(text, offset) {
      var s = offset, e = offset;
      while (s > 0 && /[\w$]/.test(text.charAt(s - 1))) s--;
      while (e < text.length && /[\w$]/.test(text.charAt(e))) e++;
      return s === e ? null : { from: s, to: e, word: text.slice(s, e) };
    }

    function hover(text, offset) {
      if (inSkip(text, offset)) return null;
      var w = wordAt(text, offset);
      if (!w || /^\d/.test(w.word)) return null;
      var sc = scan(text);
      var before = text.slice(0, w.from);
      var dm = /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)\s*\.\s*$/.exec(before);
      if (dm) {
        var type = typeOfChain(dm[1], function (n) { return sc.lookup(n, w.from); });
        var def = type && !isArray(type) && T[typeBase(type)] && T[typeBase(type)][w.word];
        if (!def) return null;
        return { from: w.from, to: w.to, title: def.k === 'method' ? '(method) ' + typeBase(type) + '.' + w.word + def.sig + (def.ret !== 'void' ? ': ' + def.ret : '') : (def.ro ? '(read-only property) ' : '(property) ') + typeBase(type) + '.' + w.word + ': ' + def.type, doc: def.doc };
      }
      var g = G[w.word];
      if (g) return { from: w.from, to: w.to, title: g.k === 'function' ? '(function) ' + w.word + g.sig + (g.ret !== 'void' ? ': ' + g.ret : '') : '(object) ' + w.word + ': ' + g.type, doc: g.doc };
      if (side === 'server' && CLIENT_ONLY.indexOf(w.word) >= 0) return { from: w.from, to: w.to, title: w.word, doc: 'Only available in client scripts.' };
      if (side === 'client' && SERVER_ONLY.indexOf(w.word) >= 0) return { from: w.from, to: w.to, title: w.word, doc: 'Only available in server scripts.' };
      var lt = sc.lookup(w.word, w.from);
      if (lt) return { from: w.from, to: w.to, title: '(variable) ' + w.word + ': ' + lt, doc: '' };
      return null;
    }

    /* -------------------------------------------------------- signature */

    function signature(text, offset) {
      var masked = maskOf(text), depth = 0, i, active = 0;
      for (i = offset - 1; i >= 0; i--) {
        var c = masked.charAt(i);
        if (c === ')' || c === ']' || c === '}') depth++;
        else if (c === '(' || c === '[' || c === '{') { if (depth === 0) { if (c !== '(') return null; break; } depth--; }
        else if (c === ',' && depth === 0) active++;
      }
      if (i < 0) return null;
      var before = text.slice(0, i), sc = scan(text);
      var m = /([A-Za-z_$][\w$]*(?:\s*\.\s*[A-Za-z_$][\w$]*(?:\((?:[^()]|\([^()]*\))*\))?)*)\s*\.\s*([A-Za-z_$][\w$]*)\s*$/.exec(before), def = null, name = '';
      if (m) {
        var type = typeOfChain(m[1], function (n) { return sc.lookup(n, i); });
        def = type && !isArray(type) && T[typeBase(type)] && T[typeBase(type)][m[2]];
        name = typeBase(type) + '.' + m[2];
        if (!def || def.k !== 'method') return null;
      } else {
        var gm = /(?:^|[^\w$.])([A-Za-z_$][\w$]*)\s*$/.exec(before);
        def = gm && G[gm[1]];
        name = gm ? gm[1] : '';
        if (!def || def.k !== 'function') return null;
      }
      var info = paramInfo(def.sig);
      return { label: name + def.sig + (def.ret && def.ret !== 'void' ? ': ' + def.ret : ''), params: info.parts, active: Math.min(active, Math.max(0, info.parts.length - 1)), doc: def.doc };
    }

    /* ------------------------------------------------------ diagnostics */

    function diagnostics(text) {
      var out = [], masked = maskOf(text), sc = scan(text);
      // comments are blanked; string contents become x's, so a string argument still counts as an argument
      var code = masked.replace(/\u0001/g, 'x');
      function add(from, to, severity, message) { var lc = lineCol(text, from); out.push({ from: from, to: to, line: lc.line, col: lc.col, severity: severity, message: message }); }
      var m;

      // names that only exist on the other side
      var idRe = /(^|[^\w$.])([A-Za-z_$][\w$]*)/g;
      while ((m = idRe.exec(code))) {
        var n = m[2], at = m.index + m[1].length;
        if (side === 'server' && CLIENT_ONLY.indexOf(n) >= 0 && !sc.lookup(n)) add(at, at + n.length, 'error', '“' + n + '” only exists in client scripts. Server scripts can\'t use it.' + (n === 'localPlayer' ? ' Use players.get(name) instead.' : ''));
        else if (side === 'client' && SERVER_ONLY.indexOf(n) >= 0 && !sc.lookup(n)) add(at, at + n.length, 'error', '“' + n + '” only exists in server scripts. Client scripts can use onFrame(dt => …) instead.');
        else if (n === 'object' && !isObject && side === 'server' && !sc.lookup(n) && !/\b(?:const|let|var)\s+object\b/.test(code)) add(at, at + n.length, 'warning', '“object” is only set inside a Storage item\'s script.');
      }

      // member access on things we know the type of: p.foo, p.x = 1, p.teleport(1)
      var startRe = /(^|[^\w$.])([A-Za-z_$][\w$]*)/g;
      while ((m = startRe.exec(code))) {
        var at = m.index + m[1].length, first = m[2];
        var type = G[first] ? (G[first].k === 'object' ? G[first].type : null) : sc.lookup(first, at);
        var pos = at + first.length;
        while (type) {
          var sm = /^\s*\.\s*([A-Za-z_$][\w$]*)/.exec(code.slice(pos));
          if (!sm) break;
          var propName = sm[1], propAt = pos + sm[0].length - propName.length;
          pos += sm[0].length;
          if (isArray(type)) break;
          var tbl = T[typeBase(type)];
          if (!tbl) break;
          var def = tbl[propName];
          if (!def) {
            if (propName === 'prototype' || propName === 'constructor' || propName === 'toString' || propName === 'toJSON') break;
            var otherT = tables(side === 'client' ? 'server' : 'client'), other = otherT[typeBase(type)] || otherT[typeBase(type).replace(/View$/, '')];
            var msg = '“' + propName + '” does not exist on ' + typeBase(type) + '.';
            if (other && other[propName]) msg = '“' + propName + '” is only available in ' + (side === 'server' ? 'client' : 'server') + ' scripts.';
            else { var sug = closest(propName, Object.keys(tbl)); if (sug) msg += ' Did you mean “' + sug + '”?'; }
            add(propAt, propAt + propName.length, 'error', msg);
            break;
          }
          var afterName = code.slice(pos);
          if (def.k === 'prop') {
            if (def.ro && /^\s*(?:=(?!=)|\+=|-=|\*=|\/=|\+\+|--)/.test(afterName)) add(propAt, propAt + propName.length, 'error', typeBase(type) + '.' + propName + ' is read-only.' + (def.doc ? ' ' + def.doc : ''));
            type = T[typeBase(def.type)] ? def.type : null;
          } else {
            var po = afterName.match(/^\s*\(/);
            if (!po) { type = null; break; }
            var openAt = pos + po[0].length - 1, close = matchParen(code, openAt);
            if (close < 0) break;
            var args = countArgs(code.slice(openAt + 1, close)), info = paramInfo(def.sig);
            if (args < info.required) add(propAt, propAt + propName.length, 'warning', propName + ' expects ' + (info.required === info.max ? info.required : 'at least ' + info.required) + ' argument' + (info.required === 1 ? '' : 's') + ', got ' + args + '.  ' + propName + def.sig);
            else if (args > info.max) add(propAt, propAt + propName.length, 'warning', propName + ' takes at most ' + info.max + ' argument' + (info.max === 1 ? '' : 's') + ', got ' + args + '.');
            type = def.ret === 'void' ? null : def.ret;
            pos = close + 1;
          }
        }
      }
      out.sort(function (a, b) { return a.from - b.from; });
      return out;
    }
    function countArgs(s) {
      if (!/\S/.test(s)) return 0;
      var depth = 0, n = 1;
      for (var i = 0; i < s.length; i++) { var c = s.charAt(i); if ('({['.indexOf(c) >= 0) depth++; else if (')}]'.indexOf(c) >= 0) depth--; else if (c === ',' && depth === 0) n++; }
      if (/,\s*$/.test(s)) n--;
      return n;
    }

    return { completions: completions, hover: hover, signature: signature, diagnostics: diagnostics, side: side };
  }

  return { create: create, version: 1 };
});
