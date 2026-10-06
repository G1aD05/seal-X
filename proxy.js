// ── Mirror mode ─────────────────────────────────────────────────────────
// Start the server with PROXY_TO=https://your-main-site and this file takes
// over: the process holds NO data of its own and simply forwards every
// request (pages, API calls, uploads, and the live chat/notification streams)
// to the main site. People can then use any of your links, but they're all
// the same site underneath — one database, one chat.
//
// Why not just point several full copies of the site at one MongoDB? Each
// copy loads the whole database into memory when it starts and only ever
// writes it back; it never re-reads it. So copies don't see each other's
// changes until restarted, live chat only reaches people connected to the
// same copy, and whichever copy saves last overwrites the others' changes.
//
// Notes
//  • Logins are per link (browsers keep cookies per domain), so someone signs
//    in once on each link they use — but it's the same account everywhere.
//  • The mirror needs no MONGODB_URI, no disk and no other settings.
//  • Cold starts: if the main site sleeps (free hosting), the first request
//    through a mirror waits for it to wake up.
const http = require('http');
const https = require('https');
const { URL } = require('url');

let target;
try {
  target = new URL(process.env.PROXY_TO);
  if (!/^https?:$/.test(target.protocol)) throw new Error('not http(s)');
} catch (e) {
  console.error('[mirror] PROXY_TO must be a full URL such as https://my-main-site.example.com');
  process.exit(1);
}
const lib = target.protocol === 'https:' ? https : http;
const agent = new lib.Agent({ keepAlive: true });
const PORT = process.env.PORT || 3000;

const HOP_BY_HOP = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
                            'te', 'trailer', 'transfer-encoding', 'upgrade', 'proxy-connection']);

function forwardedHeaders(req) {
  const h = {};
  for (const [k, v] of Object.entries(req.headers)) if (!HOP_BY_HOP.has(k) && k !== 'host') h[k] = v;
  h.host = target.host; // hosting platforms route by this
  const prior = req.headers['x-forwarded-for'];
  h['x-forwarded-for'] = (prior ? prior + ', ' : '') + (req.socket.remoteAddress || '');
  h['x-forwarded-host'] = req.headers['x-forwarded-host'] || req.headers.host || '';
  h['x-forwarded-proto'] = req.headers['x-forwarded-proto'] || 'http';
  return h;
}

// If the main site ever redirects to its own absolute address, keep people on the link they came from.
function rewriteLocation(location, req) {
  if (typeof location === 'string' && location.startsWith(target.origin)) {
    const host = req.headers['x-forwarded-host'] || req.headers.host;
    const proto = req.headers['x-forwarded-proto'] || 'http';
    return `${proto}://${host}${location.slice(target.origin.length)}`;
  }
  return location;
}

const server = http.createServer((req, res) => {
  if (req.url === '/__mirror-health') {
    res.writeHead(200, { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' });
    return res.end(JSON.stringify({ ok: true, mirrorOf: target.origin }));
  }
  const upstream = lib.request({
    protocol: target.protocol, hostname: target.hostname, port: target.port || undefined,
    method: req.method, path: req.url, headers: forwardedHeaders(req), agent
  }, up => {
    const headers = {};
    for (const [k, v] of Object.entries(up.headers)) if (!HOP_BY_HOP.has(k)) headers[k] = v;
    if (headers.location) headers.location = rewriteLocation(headers.location, req);
    res.writeHead(up.statusCode, up.statusMessage, headers);
    res.flushHeaders(); // let event streams (chat, notifications) start immediately
    up.pipe(res);
    up.on('error', () => res.destroy());
  });
  upstream.on('error', err => {
    console.error(`[mirror] ${req.method} ${req.url} -> ${err.code || err.message}`);
    if (!res.headersSent) {
      res.writeHead(502, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('The main site could not be reached. Try again in a moment.');
    } else {
      res.destroy();
    }
  });
  // Browser went away (closed tab, stopped a stream) — close our side too so
  // the main site can clean up that listener.
  res.on('close', () => upstream.destroy());
  req.pipe(upstream);
});
server.keepAliveTimeout = 65000;
server.listen(PORT, () => console.log(`[mirror] Serving on :${PORT} — every request is forwarded to ${target.origin}`));
