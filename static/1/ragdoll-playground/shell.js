// Page side of the browser build: loads the wasm game, keeps saves in IndexedDB, runs the frame loop,
// draws the picture on the canvas and turns browser input into the game's events (see src/web.rs).
(function () {
  'use strict';
  const canvas = document.getElementById('screen');
  const ctx = canvas.getContext('2d', { alpha: false });
  const statusBox = document.getElementById('status');
  const msg = document.getElementById('msg');
  const barFill = document.querySelector('#bar i');
  const params = new URLSearchParams(location.search);
  // ---- quality profile --------------------------------------------------------------------------
  // The picture is software-rendered and the game's scripts run on the same thread, so weak machines (Chromebooks with a
  // Celeron and 4 GB) need a smaller picture. "lite" is picked automatically on devices that report <= 4 GB of memory or
  // <= 2 cores; force it with ?quality=lite|normal|high. ?pixels=N still overrides the pixel budget directly.
  const mem = navigator.deviceMemory || 0, cores = navigator.hardwareConcurrency || 0;
  const q = params.get('quality');
  // deviceMemory is only reported on https pages, so a Chromebook (user agent contains CrOS) counts as lite unless it says it has more than 4 GB
  const LITE = q ? q === 'lite' : ((mem > 0 && mem <= 4) || (cores > 0 && cores <= 2) || (/\bCrOS\b/.test(navigator.userAgent || '') && !(mem > 4)));
  const BUDGET = { lite: 360000, normal: 1280 * 720, high: 2000000 };
  const MAX_PIXELS = Number(params.get('pixels')) || BUDGET[q === 'high' ? 'high' : LITE ? 'lite' : 'normal'];

  // The game picks its room (world cells) and UI scale from the canvas size, and rebuilds the room when that changes, so the
  // size is chosen once per window size and never adapted on the fly. This mirrors Config.uiScale / Config.pickWorld in
  // assets/game/TTOClient/Config.lua (keep them in sync): it lets us avoid sizes where the game finds no good room, and in
  // lite mode prefer sizes that give a small room (fewer cells to simulate).
  function pickWorld(X, Y) {
    const ui = (Y >= 2000 && X >= 3000) ? 4 : (Y >= 1500 && X >= 2300) ? 3 : (Y >= 640 && X >= 1000) ? 2 : 1;
    const a = X - 192 * ui, b = Y - 24 * (ui >= 2 ? Math.floor(ui * 1.5 + 0.5) : ui);
    let best = 0, bestD = Infinity;
    for (let k = 1; k <= 14; k++) {
      const w = Math.floor(a / k), h = Math.floor(b / k);
      if (w >= 300 && h >= 172 && w <= 600 && h <= 330) {
        const d = Math.abs(Math.log(w * h / 82944));
        if (d < bestD) { bestD = d; best = k; }
      }
    }
    return best ? { w: Math.floor(a / best), h: Math.floor(b / best), k: best, ui } : null;
  }
  function chooseSize(cssW, cssH, maxPixels, lite) {
    const kMax = Math.min(1, Math.sqrt(maxPixels / (cssW * cssH)));
    const dim = (k) => [Math.max(160, Math.round(cssW * k)), Math.max(120, Math.round(cssH * k))];
    const at = (k) => { const d = dim(k); return { d, r: pickWorld(d[0], d[1]) }; };
    let first = null;
    for (let k = kMax; k >= kMax * 0.5 - 1e-9; k -= 0.01 * kMax) { const c = at(k); if (c.r) { first = c; break; } }
    if (lite && (!first || first.r.w * first.r.h > 100000)) {
      for (let k = kMax * 1.01; k <= Math.min(1, kMax * 1.3); k += 0.01 * kMax) {
        const c = at(k); if (c.r && c.r.w * c.r.h <= 100000) return c.d;
      }
    }
    return first ? first.d : dim(kMax);
  }
  window.RagdollSizing = { pickWorld, chooseSize };

  function say(text, isErr) { msg.textContent = text; msg.className = isErr ? 'err' : ''; if (isErr) barFill.style.background = '#ff7676'; }
  window.addEventListener('error', (e) => say('Error: ' + (e.message || e), true));

  // ---- browser key.code -> the game's key names ------------------------------------------------
  const KEYS = {
    Space: 'Space', Enter: 'Return', NumpadEnter: 'Return', Escape: 'Escape', Tab: 'Tab', Backspace: 'Backspace', Delete: 'Delete',
    Insert: 'Insert', Home: 'Home', End: 'End', PageUp: 'PageUp', PageDown: 'PageDown',
    ArrowUp: 'Up', ArrowDown: 'Down', ArrowLeft: 'Left', ArrowRight: 'Right',
    ShiftLeft: 'LeftShift', ShiftRight: 'RightShift', ControlLeft: 'LeftControl', ControlRight: 'RightControl',
    AltLeft: 'LeftAlt', AltRight: 'RightAlt', MetaLeft: 'LeftMeta', MetaRight: 'RightMeta',
    Comma: 'Comma', Period: 'Period', Slash: 'Slash', Minus: 'Minus', Equal: 'Equals', Semicolon: 'Semicolon', Quote: 'Quote',
    BracketLeft: 'LeftBracket', BracketRight: 'RightBracket', Backslash: 'BackSlash', Backquote: 'Backquote',
  };
  const DIGITS = ['Zero', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine'];
  for (let c = 65; c <= 90; c++) KEYS['Key' + String.fromCharCode(c)] = String.fromCharCode(c);
  for (let i = 0; i < 10; i++) { KEYS['Digit' + i] = DIGITS[i]; KEYS['Numpad' + i] = DIGITS[i]; }
  for (let i = 1; i <= 12; i++) KEYS['F' + i] = 'F' + i;

  function start(M) {
    const call = (name, ...a) => M['_' + name](...a);

    function sizeCanvas() {
      return chooseSize(Math.max(1, window.innerWidth), Math.max(1, window.innerHeight), MAX_PIXELS, LITE);
    }
    let [W, H] = sizeCanvas();
    canvas.width = W; canvas.height = H;
    // lite: rebuild the interface every 2nd frame (?gui=1..4 overrides)
    const guiEvery = Math.min(4, Math.max(1, Number(params.get('gui')) || (LITE ? 2 : 1)));
    if (M._rd_set_gui_interval) call('rd_set_gui_interval', guiEvery); // (older builds do not have it)
    if (!call('rd_init', W, H)) { say('The game could not start. See the browser console for details.', true); return; }

    // ---- input ---------------------------------------------------------------------------------
    const down = new Set();
    const pos = (e) => {
      const r = canvas.getBoundingClientRect();
      return [(e.clientX - r.left) * (canvas.width / r.width), (e.clientY - r.top) * (canvas.height / r.height)];
    };
    const sendKey = (name, d) => M.ccall('rd_event_key', null, ['string', 'number'], [name, d ? 1 : 0]);
    const BTN = [1, 3, 2]; // DOM button 0 left / 1 middle / 2 right -> game 1 left / 3 middle / 2 right
    const btnDown = new Set();
    canvas.addEventListener('mousemove', (e) => { const [x, y] = pos(e); call('rd_event_move', x, y); });
    canvas.addEventListener('mousedown', (e) => {
      canvas.focus(); const [x, y] = pos(e);
      call('rd_event_move', x, y); call('rd_event_mouse', BTN[e.button] || 1, 1, x, y); btnDown.add(e.button); e.preventDefault();
    });
    window.addEventListener('mouseup', (e) => {
      const [x, y] = pos(e);
      call('rd_event_mouse', BTN[e.button] || 1, 0, x, y); btnDown.delete(e.button);
    });
    canvas.addEventListener('contextmenu', (e) => e.preventDefault());
    canvas.addEventListener('wheel', (e) => { call('rd_event_wheel', e.deltaY > 0 ? -1 : 1); e.preventDefault(); }, { passive: false });

    function toggleFullscreen() {
      if (document.fullscreenElement) document.exitFullscreen();
      else (document.documentElement.requestFullscreen || document.documentElement.webkitRequestFullscreen).call(document.documentElement);
    }
    window.addEventListener('keydown', (e) => {
      if (e.code === 'F11' || (e.code === 'Enter' && e.altKey)) { toggleFullscreen(); e.preventDefault(); return; }
      if (e.code === 'F12' || e.code === 'F5' || ((e.ctrlKey || e.metaKey) && /^(KeyR|KeyL|KeyW|KeyT|KeyN|KeyQ)$/.test(e.code))) return; // browser shortcuts
      const name = KEYS[e.code];
      if (name && !e.repeat) { down.add(name); sendKey(name, true); }
      if (e.key && [...e.key].length === 1 && !e.ctrlKey && !e.metaKey) call('rd_event_char', e.key.codePointAt(0));
      e.preventDefault();
    });
    window.addEventListener('keyup', (e) => {
      const name = KEYS[e.code];
      if (name) { down.delete(name); sendKey(name, false); }
      e.preventDefault();
    });
    window.addEventListener('blur', () => { // never leave keys or buttons stuck
      for (const n of down) sendKey(n, false); down.clear();
      for (const b of btnDown) call('rd_event_mouse', BTN[b] || 1, 0, 0, 0); btnDown.clear();
    });
    window.addEventListener('resize', () => { resizePending = true; });
    let resizePending = false;

    // ---- saves: /savedata lives in IndexedDB; flush now and then and when the tab goes away -----
    let syncing = false;
    function flush() {
      if (syncing || !M.FS) return;
      syncing = true;
      try { M.FS.syncfs(false, () => { syncing = false; }); } catch (e) { syncing = false; }
    }
    setInterval(() => { if (!document.hidden) flush(); }, 8000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);

    // ---- frame loop ----------------------------------------------------------------------------
    // Never run the game faster than ~85 frames per second: on a 120-240 Hz monitor every extra frame is a full software
    // render for no visible gain. The 12 ms floor leaves 60 Hz and 75 Hz screens untouched (they come in at 16.7 / 13.3 ms)
    // and runs 144 Hz screens at 72 fps.
    // Slow machines: when frames keep costing more than ~21 ms the loop locks to 30 fps (steady pacing, and the CPU gets to cool,
    // which matters on fanless Chromebooks) and goes back to full speed after a few seconds of easy frames.
    const FAST_MS = 12, SLOW_MS = 31;
    let minFrameMs = FAST_MS, costAvg = 12, slowRun = 0, fastRun = 0;
    let last = performance.now(), running = true, gameMs = 12, frames = 0, shownAt = 0;
    const hint = document.getElementById('hint');
    // the ImageData is only a view of the game's picture memory, so it is made once and reused until that memory moves
    let img = null, imgBuf = null, imgPtr = 0, imgW = 0, imgH = 0;
    function frame(now) {
      if (!running) return;
      if (now - last < minFrameMs) { requestAnimationFrame(frame); return; }
      if (resizePending) {
        resizePending = false;
        const [w, h] = sizeCanvas();
        if (w !== canvas.width || h !== canvas.height) { canvas.width = w; canvas.height = h; call('rd_event_size', w, h); }
      }
      const dt = Math.min(0.1, (now - last) / 1000); last = now;
      const t0 = performance.now();
      const tg = performance.now();
      const okFrame = call('rd_frame', dt);
      gameMs = gameMs * 0.9 + (performance.now() - tg) * 0.1;
      if (!okFrame) { running = false; say('The game stopped (see the browser console).', true); statusBox.style.display = 'flex'; return; }
      const w = call('rd_fb_w'), h = call('rd_fb_h'), p = call('rd_fb_ptr');
      if (p && w > 0 && h > 0) {
        if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
        if (!img || imgBuf !== M.HEAPU8.buffer || imgPtr !== p || imgW !== w || imgH !== h) {
          img = new ImageData(new Uint8ClampedArray(M.HEAPU8.buffer, p, w * h * 4), w, h);
          imgBuf = M.HEAPU8.buffer; imgPtr = p; imgW = w; imgH = h;
        }
        ctx.putImageData(img, 0, 0);
      }
      costAvg = costAvg * 0.9 + (performance.now() - t0) * 0.1;
      if (costAvg > 21) { fastRun = 0; if (++slowRun > 30) minFrameMs = SLOW_MS; }
      else if (costAvg < 13) { slowRun = 0; if (++fastRun > 240) minFrameMs = FAST_MS; }
      else { slowRun = 0; fastRun = 0; }
      if (params.get('debug') && now - shownAt > 500) {
        hint.style.opacity = 1;
        hint.textContent = (LITE ? 'lite ' : 'normal ') + canvas.width + 'x' + canvas.height + ' | game ' + gameMs.toFixed(1) + ' ms | total ' + costAvg.toFixed(1) + ' ms | cap ' + (minFrameMs > 20 ? '30' : '60+') + ' fps';
        shownAt = now;
      }
      requestAnimationFrame(frame);
    }
    statusBox.style.display = 'none';
    canvas.focus();
    requestAnimationFrame((t) => { last = t - FAST_MS; frame(t); });
  }

  // ---- emscripten module setup -----------------------------------------------------------------
  window.RagdollStart = start; // exposed so the page can be tested with a stand-in module
  window.Module = {
    print: (t) => console.log(t),
    printErr: (t) => console.warn(t),
    locateFile: (f) => f,
    monitorRunDependencies(left) {
      this.maxDeps = Math.max(this.maxDeps || 0, left);
      barFill.style.width = (100 * (1 - left / Math.max(1, this.maxDeps)) * 0.9) + '%';
    },
    setStatus(t) { if (t) say(t.replace(/\(\d+(\.\d+)?\/\d+\)/, '').trim() || 'Loading...'); },
    preRun: [function () {
      const M = window.Module;
      // saves: mount IndexedDB at /savedata and load what is there before the game starts
      try {
        M.FS.mkdir('/savedata');
        M.FS.mount(M.IDBFS, {}, '/savedata');
        M.addRunDependency('idbfs');
        M.FS.syncfs(true, (err) => { if (err) console.warn('saves unavailable:', err); M.removeRunDependency('idbfs'); });
      } catch (e) { console.warn('saves unavailable:', e); }
    }],
    onRuntimeInitialized() { say('Starting...'); setTimeout(() => start(window.Module), 0); },
    onAbort(what) { say('The game crashed: ' + what, true); statusBox.style.display = 'flex'; },
  };
})();
