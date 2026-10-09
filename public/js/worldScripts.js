/* Client scripts for Seal Worlds — the page half.
 *
 * Starts a world's client scripts in a locked-down Web Worker (js/world-sandbox-client.js), feeds
 * it the game state, and applies what it asks for: camera moves, HUD elements, local effects and
 * RemoteEvents. The worker is not trusted. Every message it sends back is checked and clamped here,
 * text only ever goes in through textContent, and if it stops answering the worker is terminated
 * so a bad script can freeze its own script thread but never the game or the tab.
 */
(function (global) {
  'use strict';

  var STALL_MS = 1500;          // a started worker that stays silent this long is stopped
  var LOAD_STALL_MS = 4000;     // allowance for the first run of every script
  var MAX_REMOTE_PER_SEC = 30;
  var NAME_RE = /^[A-Za-z0-9_.-]{1,40}$/;
  var ID_RE = /^[A-Za-z0-9_.-]{1,30}$/;
  var ANCHORS = { 'top-left': 1, top: 1, 'top-right': 1, left: 1, center: 1, right: 1, 'bottom-left': 1, bottom: 1, 'bottom-right': 1 };

  function clamp(n, lo, hi) { n = Number(n); if (!isFinite(n)) return lo; return Math.max(lo, Math.min(hi, n)); }
  function cleanColor(c) {
    c = String(c == null ? '' : c).trim();
    if (/^#[0-9a-f]{3,8}$/i.test(c) || /^[a-z]{3,20}$/i.test(c) || /^(rgb|hsl)a?\([0-9 .,%\/-]{1,40}\)$/i.test(c)) return c;
    return '';
  }

  /**
   * @param {object} host  what the page provides:
   *   getFrame()  -> { t, dt, myName, me, players, keys, cam, attrs }   current game state
   *   hudRoot     the element HUD elements are drawn into
   *   fireRemote(name, args)
   *   sendConfetti(x, y)  floatText(text, x, y, color)  walkTo(x, y)  setMoveEnabled(bool)
   *   applyCamera(cam)    log(level, text)
   */
  function WorldScripts(host) {
    this.host = host;
    this.worker = null;
    this.ready = false;
    this.inflight = 0;
    this.lastProgress = 0;
    this.seq = 0;
    this.hud = new Map();
    this.remoteTokens = MAX_REMOTE_PER_SEC;
    this.remoteAt = 0;
    this.watch = null;
  }

  WorldScripts.prototype.running = function () { return !!this.worker; };

  /** Starts (or restarts) the scripts. `init` = { world, me, players, attrs }. */
  WorldScripts.prototype.start = function (scripts, init) {
    this.stop();
    if (!scripts || !scripts.length) return;
    var self = this;
    var worker;
    try { worker = new Worker('/js/world-sandbox-client.js'); }
    catch (e) { this.host.log('error', 'Client scripts could not start: ' + (e && e.message ? e.message : e)); return; }
    this.worker = worker;
    this.ready = false;
    this.inflight = 0;
    this.lastProgress = Date.now();
    worker.onmessage = function (ev) { if (self.worker === worker) self._onOut(ev.data); };
    worker.onerror = function (ev) {
      if (self.worker !== worker) return;
      if (ev && ev.preventDefault) ev.preventDefault();
      self._kill('The client script engine failed: ' + (ev && ev.message ? ev.message : 'unknown error'));
    };
    this._post({ t: 'init', scripts: scripts.map(function (s) { return { name: s.name, source: s.source }; }), world: init.world, me: init.me, players: init.players || [], attrs: init.attrs || {} });
    this.watch = setInterval(function () { self._checkStall(); }, 250);
  };

  WorldScripts.prototype.stop = function () {
    if (this.watch) { clearInterval(this.watch); this.watch = null; }
    if (this.worker) { try { this.worker.terminate(); } catch (e) { /* gone */ } this.worker = null; }
    this.ready = false;
    this.inflight = 0;
    this.clearHud();
    this.host.setMoveEnabled(true);
    this.host.applyCamera(null);
  };

  WorldScripts.prototype._kill = function (why) {
    this.host.log('error', why);
    this.stop();
  };

  WorldScripts.prototype._post = function (m) {
    if (!this.worker) return;
    if (this.inflight++ === 0) this.lastProgress = Date.now();
    try { this.worker.postMessage(m); } catch (e) { this.inflight--; }
  };

  WorldScripts.prototype._checkStall = function () {
    if (!this.worker || this.inflight === 0) return;
    if (Date.now() - this.lastProgress > (this.ready ? STALL_MS : LOAD_STALL_MS)) {
      this._kill('Client scripts were turned off: one of them got stuck. Reload the world to try again.');
    }
  };

  /** Call once per animation frame. Skips the frame if the scripts are still busy with the last one. */
  WorldScripts.prototype.frame = function () {
    if (!this.worker || !this.ready || this.inflight > 0) return;
    var f = this.host.getFrame();
    f.t = 'frame';
    f.seq = ++this.seq;
    this._post(f);
  };

  /** Delivers one event: { k: 'key'|'click'|'remote'|'join'|'leave'|'attr'|'attrs'|'world'|'ui', ... }. */
  WorldScripts.prototype.event = function (e, extra) {
    if (!this.worker) return;
    var m = { t: 'event', e: e };
    if (extra) for (var k in extra) m[k] = extra[k];
    this._post(m);
  };

  /* ------------------------------------------------------ worker output */

  WorldScripts.prototype._onOut = function (o) {
    if (!o || o.t !== 'out') return;
    this.inflight = Math.max(0, this.inflight - 1);
    this.lastProgress = Date.now();
    if (o.ready) this.ready = true;
    var host = this.host;

    if (Array.isArray(o.logs)) o.logs.slice(0, 30).forEach(function (l) {
      host.log(['log', 'info', 'warn', 'error'].indexOf(l && l.l) >= 0 ? l.l : 'log', String(l && l.t != null ? l.t : '').slice(0, 450));
    });
    if (o.cam) host.applyCamera(this._cleanCam(o.cam));
    if (o.moveEnabled === true || o.moveEnabled === false) host.setMoveEnabled(o.moveEnabled);
    if (o.walkTo && isFinite(o.walkTo.x) && isFinite(o.walkTo.y)) host.walkTo(Number(o.walkTo.x), Number(o.walkTo.y));
    if (Array.isArray(o.ui)) for (var i = 0; i < o.ui.length && i < 120; i++) this._ui(o.ui[i]);
    if (Array.isArray(o.fx)) for (var j = 0; j < o.fx.length && j < 20; j++) this._fx(o.fx[j]);
    if (Array.isArray(o.remote)) for (var r = 0; r < o.remote.length && r < 20; r++) this._remote(o.remote[r]);
  };

  WorldScripts.prototype._cleanCam = function (c) {
    return {
      mode: c.mode === 'free' ? 'free' : 'follow',
      follow: typeof c.follow === 'string' ? c.follow.slice(0, 30) : null,
      x: clamp(c.x, -5000, 5000), y: clamp(c.y, -5000, 5000),
      zoom: clamp(c.zoom, 0.25, 4), rotation: clamp(c.rotation, -360, 360),
      ox: clamp(c.ox, -2000, 2000), oy: clamp(c.oy, -2000, 2000),
      smooth: clamp(c.smooth, 0, 30), clamp: c.clamp !== false,
      shake: clamp(c.shake, 0, 60), shakeFor: clamp(c.shakeFor, 0, 5)
    };
  };

  WorldScripts.prototype._remote = function (r) {
    if (!r || !NAME_RE.test(String(r.n)) || !Array.isArray(r.a)) return;
    var now = Date.now();
    this.remoteTokens = Math.min(MAX_REMOTE_PER_SEC * 2, this.remoteTokens + (now - this.remoteAt) / 1000 * MAX_REMOTE_PER_SEC);
    this.remoteAt = now;
    if (this.remoteTokens < 1) return;
    this.remoteTokens -= 1;
    this.host.fireRemote(String(r.n), r.a);
  };

  WorldScripts.prototype._fx = function (f) {
    if (!f) return;
    if (f.k === 'confetti') this.host.sendConfetti(clamp(f.x, -100, 5000), clamp(f.y, -100, 5000));
    else if (f.k === 'text') this.host.floatText(String(f.t).slice(0, 60), clamp(f.x, -100, 5000), clamp(f.y, -100, 5000), cleanColor(f.c) || '#ffffff');
    else if (f.k === 'flash') this._flash(cleanColor(f.c) || '#ffffff', clamp(f.s, 0.05, 5));
  };

  WorldScripts.prototype._flash = function (color, seconds) {
    var el = document.createElement('div');
    el.className = 'wl-flash';
    el.style.background = color;
    el.style.transition = 'opacity ' + seconds + 's ease-out';
    el.style.opacity = '0.65';
    this.host.hudRoot.appendChild(el);
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.style.opacity = '0'; }); });
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, seconds * 1000 + 200);
  };

  /* ------------------------------------------------------------------ HUD */

  WorldScripts.prototype.clearHud = function () {
    this.hud.forEach(function (el) { if (el.parentNode) el.parentNode.removeChild(el); });
    this.hud.clear();
    var root = this.host.hudRoot;
    if (root) { while (root.firstChild) root.removeChild(root.firstChild); }
  };

  function place(el, anchor, x, y) {
    var s = el.style;
    s.left = s.right = s.top = s.bottom = 'auto';
    var t = [];
    if (/left/.test(anchor)) s.left = x + 'px';
    else if (/right/.test(anchor)) s.right = x + 'px';
    else { s.left = 'calc(50% + ' + x + 'px)'; t.push('translateX(-50%)'); }
    if (/top/.test(anchor)) s.top = y + 'px';
    else if (/bottom/.test(anchor)) s.bottom = y + 'px';
    else { s.top = 'calc(50% + ' + y + 'px)'; t.push('translateY(-50%)'); }
    // plain "left" / "right" / "top" / "bottom" centre along the other axis
    if (anchor === 'left' || anchor === 'right') { s.top = 'calc(50% + ' + y + 'px)'; t.push('translateY(-50%)'); }
    if (anchor === 'top' || anchor === 'bottom') { s.left = 'calc(50% + ' + x + 'px)'; t.push('translateX(-50%)'); }
    s.transform = t.join(' ');
  }

  WorldScripts.prototype._ui = function (op) {
    if (!op) return;
    var self = this;
    if (op.op === 'clear') { this.clearHud(); return; }
    if (op.op === 'rm') { var old = this.hud.get(String(op.id)); if (old && old.parentNode) old.parentNode.removeChild(old); this.hud.delete(String(op.id)); return; }
    if (op.op === 'toast') { this._toast(String(op.text).slice(0, 200), clamp(op.sec, 0.5, 10)); return; }
    if (op.op !== 'set' || !ID_RE.test(String(op.id))) return;
    var id = String(op.id), type = op.type, d = op.d || {}, o = op.o || {};
    if (type !== 'text' && type !== 'bar' && type !== 'button') return;
    var el = this.hud.get(id);
    if (el && el.dataset.type !== type) { if (el.parentNode) el.parentNode.removeChild(el); this.hud.delete(id); el = null; }
    if (!el) {
      if (this.hud.size >= 40) return;
      el = document.createElement(type === 'button' ? 'button' : 'div');
      el.dataset.type = type;
      el.className = 'wl-hud-el wl-hud-' + type;
      if (type === 'button') { el.type = 'button'; el.addEventListener('click', function () { self.event({ k: 'ui', id: id }); }); }
      if (type === 'bar') { var fill = document.createElement('div'); fill.className = 'wl-hud-fill'; el.appendChild(fill); }
      this.host.hudRoot.appendChild(el);
      this.hud.set(id, el);
    }
    var anchor = ANCHORS[o.anchor] ? o.anchor : 'top-left';
    place(el, anchor, clamp(o.x, -4000, 4000), clamp(o.y, -4000, 4000));
    var color = cleanColor(o.color), bg = cleanColor(o.bg), size = o.size ? clamp(o.size, 8, 64) : 0;
    el.style.color = color; el.style.fontSize = size ? size + 'px' : '';
    if (type === 'bar') {
      var w = o.width ? clamp(o.width, 20, 800) : 160, h = o.height ? clamp(o.height, 4, 100) : 14;
      el.style.width = w + 'px'; el.style.height = h + 'px';
      var max = Number(d.max) > 0 ? Number(d.max) : 1;
      var frac = clamp(Number(d.value) / max, 0, 1);
      var f = el.firstChild;
      f.style.width = (frac * 100) + '%';
      f.style.background = color || '#34d399';
      el.style.background = bg || '';
    } else {
      el.textContent = String(d.text == null ? '' : d.text).slice(0, 200);
      el.style.background = bg;
      if (o.width) el.style.minWidth = clamp(o.width, 10, 800) + 'px';
    }
  };

  // Toasts from the server (announce, say) and from scripts share one stack, newest at the bottom,
  // so they never sit on top of each other.
  WorldScripts.toast = function (hudRoot, text, sec) {
    var stack = hudRoot.querySelector('.wl-toasts');
    if (!stack) {
      stack = document.createElement('div');
      stack.className = 'wl-toasts';
      hudRoot.appendChild(stack);
    }
    var el = document.createElement('div');
    el.className = 'wl-hud-toast';
    el.textContent = text;
    stack.appendChild(el);
    while (stack.children.length > 5) stack.removeChild(stack.firstChild);
    setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, sec * 1000);
  };

  WorldScripts.prototype._toast = function (text, sec) {
    WorldScripts.toast(this.host.hudRoot, text, sec);
  };

  global.WorldScripts = WorldScripts;
})(window);
