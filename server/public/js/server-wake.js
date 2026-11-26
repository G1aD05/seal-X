// Tells visitors when the Render server is asleep / waking up, and refreshes the page once it
// answers. Static files come from Cloudflare, so a page can load fine while every /api/* call
// fails because the free-tier Render server has spun down (it needs up to ~a minute to boot).
//
// Add to a page, BEFORE js/api.js:   <script src="/js/server-wake.js"></script>
//
// How it works
//  * On load it probes /api/banner (tiny, always JSON). If the answer takes longer than a few
//    seconds, or isn't the app's JSON (Render's own "starting up" page / a gateway error), it
//    shows a banner and keeps probing until the real server answers. The probe itself is what
//    wakes the server, so a visitor landing on a sleeping site also starts the boot.
//  * It also watches the page's own /api/* calls: if one fails with a gateway error or a
//    network error later (the server slept while the tab was open) it shows the same banner.
//  * When the server answers after the banner was shown, the page reloads once so it can load
//    the data it missed. A reload is never repeated within a minute, so it can't loop.

(function () {
  if (window.__sealWake) return;
  window.__sealWake = true;

  var PING = '/api/banner';
  var SLOW_MS = 3500;     // show the banner if the first answer takes longer than this
  var POLL_MS = 4000;     // pause between probes while waiting
  var PROBE_TIMEOUT = 20000;
  var RELOAD_KEY = 'seal-wake-reload';
  var RELOAD_COOLDOWN = 60000;

  var origFetch = window.fetch ? window.fetch.bind(window) : null;
  if (!origFetch) return;

  var looping = false;
  var shown = false;
  var el = null;

  function isJson(res) {
    return /json/i.test((res.headers && res.headers.get('content-type')) || '');
  }

  function isApi(input) {
    try {
      var u = typeof input === 'string' ? input : (input && input.url) || String(input);
      return new URL(u, location.href).pathname.indexOf('/api/') === 0;
    } catch (e) { return false; }
  }

  // ---- banner ---------------------------------------------------------------
  function ensureEl() {
    if (el) return el;
    var style = document.createElement('style');
    style.textContent =
      '#seal-wake{position:fixed;top:12px;left:50%;transform:translateX(-50%);z-index:2147483000;' +
      'max-width:min(92vw,520px);box-sizing:border-box;padding:10px 16px;border-radius:12px;' +
      'background:var(--warning,#f5a524);color:#000;font:500 14px/1.4 Inter,system-ui,sans-serif;' +
      'box-shadow:0 6px 24px rgba(0,0,0,.35);display:flex;align-items:center;gap:10px}' +
      '#seal-wake .sw-spin{flex:none;width:14px;height:14px;border-radius:50%;border:2px solid rgba(0,0,0,.25);' +
      'border-top-color:#000;animation:sw-rot .8s linear infinite}' +
      '@keyframes sw-rot{to{transform:rotate(360deg)}}' +
      '@media (prefers-reduced-motion:reduce){#seal-wake .sw-spin{animation:none}}';
    document.head.appendChild(style);
    el = document.createElement('div');
    el.id = 'seal-wake';
    el.setAttribute('role', 'status');
    el.setAttribute('aria-live', 'polite');
    el.innerHTML = '<span class="sw-spin" aria-hidden="true"></span><span class="sw-text"></span>';
    return el;
  }

  function setText(t) { ensureEl().querySelector('.sw-text').textContent = t; }

  function attach() {
    var e = ensureEl();
    if (!e.parentNode) (document.body || document.documentElement).appendChild(e);
  }

  function show(text) {
    shown = true;
    setText(text || 'The server is waking up. This can take up to a minute, the page will refresh when it’s ready.');
    if (document.body) attach();
    else document.addEventListener('DOMContentLoaded', function () { if (shown) attach(); });
  }

  function hide() {
    shown = false;
    if (el && el.parentNode) el.parentNode.removeChild(el);
  }

  // ---- probing --------------------------------------------------------------
  // Resolves true once the real app answered (any JSON response, including its maintenance 503).
  function probe() {
    var ctl = typeof AbortController === 'function' ? new AbortController() : null;
    var timer = ctl ? setTimeout(function () { ctl.abort(); }, PROBE_TIMEOUT) : null;
    return origFetch(PING + '?_=' + Date.now(), { cache: 'no-store', credentials: 'same-origin', signal: ctl ? ctl.signal : undefined })
      .then(function (res) { return isJson(res); })
      .catch(function () { return false; })
      .then(function (ok) { if (timer) clearTimeout(timer); return ok; });
  }

  function ready() {
    looping = false;
    if (!shown) return;
    var last = 0;
    try { last = Number(sessionStorage.getItem(RELOAD_KEY)) || 0; } catch (e) {}
    if (Date.now() - last < RELOAD_COOLDOWN) { hide(); return; } // already reloaded a moment ago
    setText('The server is ready. Refreshing…');
    try { sessionStorage.setItem(RELOAD_KEY, String(Date.now())); } catch (e) {}
    setTimeout(function () { location.reload(); }, 600);
  }

  function loop() {
    probe().then(function (ok) {
      if (ok) return ready();
      show();
      setTimeout(loop, POLL_MS);
    });
  }

  // Start (or continue) waiting for the server. `immediate` shows the banner right away.
  function waitForServer(immediate) {
    if (looping) { if (immediate && !shown) show(); return; }
    looping = true;
    if (immediate) show();
    loop();
  }

  // ---- initial check on page load ------------------------------------------
  (function initial() {
    looping = true;
    var slow = setTimeout(function () { show(); }, SLOW_MS);
    probe().then(function (ok) {
      clearTimeout(slow);
      if (ok) return ready();
      show();
      setTimeout(loop, POLL_MS);
    });
  })();

  // ---- watch the page's own API calls --------------------------------------
  window.fetch = function (input, init) {
    return origFetch(input, init).then(function (res) {
      if (isApi(input) && (res.status === 502 || res.status === 503 || res.status === 504) && !isJson(res)) {
        waitForServer(true);
      } else if (isApi(input) && res.status === 503 && isJson(res)) {
        // our Worker's {waking:true} answer (JSON, so the check above doesn't catch it)
        res.clone().json().then(function (d) { if (d && d.waking) waitForServer(true); }).catch(function () {});
      }
      return res;
    }, function (err) {
      if (isApi(input) && navigator.onLine !== false) waitForServer(true);
      throw err;
    });
  };
})();
