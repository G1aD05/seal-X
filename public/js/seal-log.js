/* seal-log.js — custom logs for any page on the site.
 *
 *   <script src="/js/seal-log.js"></script>
 *   <script>
 *     SealLog.info('Opened the shop');
 *     SealLog.error('Checkout failed', { code: 402, cart: 3 });
 *     const log = SealLog.create('market');        // a named logger
 *     log.warn('Slow response', { ms: 2300 });
 *   </script>
 *
 * Logs are sent to this site's server (POST /api/log), which relays them to Discord. The Discord
 * link itself lives only on the server, so it never appears in a page. You must be signed in, and
 * a user can send about 20 logs a minute. Optional settings go on the script tag:
 *   data-capture-errors   also log uncaught errors and failed promises
 *   data-console          also mirror console.warn / console.error
 *   data-source="name"    default logger name
 *   data-endpoint="/api/log"
 */
(function (root) {
  'use strict';
  var tag = document.currentScript, attr = function (n) { return tag ? tag.getAttribute(n) : null; };
  var cfg = { endpoint: attr('data-endpoint') || '/api/log', source: attr('data-source') || (location.pathname.replace(/^\//, '') || 'index'), echo: true };
  var LEVELS = { debug: 1, info: 1, warn: 1, error: 1 }, queue = [], busy = false, recent = [], lastKey = '', lastAt = 0;

  function clean(v, depth) {
    if (v == null || typeof v === 'number' || typeof v === 'boolean') return v == null ? null : v;
    if (typeof v === 'string') return v.length > 500 ? v.slice(0, 499) + '…' : v;
    if (v instanceof Error) return v.name + ': ' + v.message;
    if (depth > 1) return String(v).slice(0, 200);
    if (Array.isArray(v)) return v.slice(0, 10).map(function (x) { return clean(x, depth + 1); });
    if (typeof v === 'object') { var o = {}; Object.keys(v).slice(0, 10).forEach(function (k) { o[k] = clean(v[k], depth + 1); }); return o; }
    return String(v).slice(0, 200);
  }
  function pump() {
    if (busy || !queue.length) return; busy = true;
    var item = queue.shift();
    fetch(cfg.endpoint, { method: 'POST', credentials: 'same-origin', headers: { 'content-type': 'application/json' }, body: JSON.stringify(item), keepalive: true })
      .catch(function () {}).then(function () { setTimeout(function () { busy = false; pump(); }, 350); });
  }
  function send(level, source, message, fields) {
    var now = Date.now(), key = level + '|' + source + '|' + message;
    recent = recent.filter(function (t) { return now - t < 60000; });
    if (key === lastKey && now - lastAt < 2000) return false;      // identical line in a loop
    if (recent.length >= 20) return false;                          // matches the server's limit
    lastKey = key; lastAt = now; recent.push(now);
    if (queue.length >= 30) queue.shift();
    queue.push({ level: level, source: source, message: String(message == null ? '' : message).slice(0, 2000), fields: clean(fields, 0), page: location.pathname });
    pump(); return true;
  }
  function make(name) {
    var api = { name: name };
    Object.keys(LEVELS).forEach(function (lv) {
      api[lv] = function (message, fields) {
        if (cfg.echo && root.console) (console[lv === 'debug' ? 'log' : lv] || console.log).call(console, '[' + name + ']', message, fields || '');
        return send(lv, name, message, fields);
      };
    });
    api.log = api.info;
    return api;
  }

  var base = make(cfg.source), SealLog = Object.assign(base, {
    create: function (name) { return make(String(name || cfg.source).slice(0, 40)); },
    configure: function (o) { if (o && typeof o === 'object') { if (o.endpoint) cfg.endpoint = String(o.endpoint); if (o.source) cfg.source = String(o.source); if (o.echo === false || o.echo === true) cfg.echo = o.echo; } return SealLog; }
  });

  if (tag && tag.hasAttribute('data-capture-errors')) {
    root.addEventListener('error', function (e) { send('error', cfg.source, e.message || 'Script error', { file: (e.filename || '').split('/').pop(), line: e.lineno, col: e.colno }); });
    root.addEventListener('unhandledrejection', function (e) { send('error', cfg.source, 'Unhandled promise rejection: ' + clean(e.reason, 1)); });
  }
  if (tag && tag.hasAttribute('data-console') && root.console) {
    ['warn', 'error'].forEach(function (lv) {
      var orig = console[lv];
      console[lv] = function () { orig.apply(console, arguments); send(lv, cfg.source, Array.prototype.map.call(arguments, function (a) { return typeof a === 'string' ? a : JSON.stringify(clean(a, 1)); }).join(' ')); };
    });
  }
  root.SealLog = SealLog;
})(window);
