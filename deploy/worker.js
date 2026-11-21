// Cloudflare Worker for the Seal static site.
//
// Static assets (everything in ../static) are served by Cloudflare directly.
// Files that were too big for Cloudflare's 25 MiB per-file limit were split by
// deploy/split-static.mjs, so their original URL no longer matches an asset and
// the request lands here. We look the path up in split-manifest.json, fetch the
// parts from the assets binding and stream them back as ONE response, so games
// keep requesting e.g. /1/crazycattle/index.pck and never know it was split.
//
// Supports GET, HEAD, conditional requests (ETag) and single-range requests.

import manifest from './split-manifest.json';

const CORS = { 'Access-Control-Allow-Origin': '*' };

// Mirrors static/_headers (Workers only apply that file to plain assets, not to
// responses a Worker builds itself).
const CACHE_PREFIXES = ['/1/', '/tools/', '/gameIcons/'];
const CACHE_CONTROL = 'public, max-age=604800';

const TYPES = {
  html: 'text/html; charset=utf-8', htm: 'text/html; charset=utf-8',
  js: 'text/javascript; charset=utf-8', mjs: 'text/javascript; charset=utf-8',
  css: 'text/css; charset=utf-8', json: 'application/json; charset=utf-8',
  wasm: 'application/wasm', // must be exact for WebAssembly.instantiateStreaming
  png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', gif: 'image/gif', webp: 'image/webp', svg: 'image/svg+xml',
  mp3: 'audio/mpeg', ogg: 'audio/ogg', wav: 'audio/wav', mp4: 'video/mp4', webm: 'video/webm',
  txt: 'text/plain; charset=utf-8', xml: 'application/xml',
};
const contentType = (path) => TYPES[path.split('.').pop().toLowerCase()] || 'application/octet-stream';

export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: { ...CORS, 'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS', 'Access-Control-Allow-Headers': 'Range, If-None-Match', 'Access-Control-Max-Age': '86400' } });
    }
    if (request.method !== 'GET' && request.method !== 'HEAD') {
      return new Response('Method not allowed', { status: 405, headers: { ...CORS, Allow: 'GET, HEAD, OPTIONS' } });
    }

    let path;
    try { path = decodeURIComponent(url.pathname); } catch { return env.ASSETS.fetch(request); }
    if (path.endsWith('/')) path += 'index.html'; // /1/eaglercraft/ -> /1/eaglercraft/index.html

    const entry = Object.prototype.hasOwnProperty.call(manifest, path) ? manifest[path] : null;
    if (!entry) {
      // /1/eaglercraft (no slash) where index.html is split: send the browser to the slash form
      // so the page's relative URLs resolve correctly.
      if (Object.prototype.hasOwnProperty.call(manifest, path + '/index.html')) {
        return Response.redirect(url.origin + url.pathname + '/' + url.search, 308);
      }
      return env.ASSETS.fetch(request); // not ours: normal asset handling / 404
    }

    const { size, sha256, parts } = entry;
    const etag = `"${sha256.slice(0, 32)}"`;
    const headers = new Headers(CORS);
    headers.set('Content-Type', contentType(path));
    headers.set('Accept-Ranges', 'bytes');
    headers.set('ETag', etag);
    headers.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, ETag');
    if (CACHE_PREFIXES.some((p) => path.startsWith(p))) headers.set('Cache-Control', CACHE_CONTROL);

    if (matchesETag(request.headers.get('If-None-Match'), etag)) {
      headers.delete('Content-Type');
      return new Response(null, { status: 304, headers });
    }

    // Range handling (single range only; anything odd falls back to the full file).
    let start = 0, end = size - 1, status = 200;
    const range = parseRange(request.headers.get('Range'), size);
    if (range === 'unsatisfiable') {
      headers.set('Content-Range', `bytes */${size}`);
      return new Response(null, { status: 416, headers });
    }
    if (range && ifRangeAllows(request.headers.get('If-Range'), etag)) {
      ({ start, end } = range);
      status = 206;
      headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    }
    const length = end - start + 1;
    headers.set('Content-Length', String(length));

    if (request.method === 'HEAD') return new Response(null, { status, headers });

    // FixedLengthStream (a workerd global) lets us send a real Content-Length, which
    // Godot/Unity/Emscripten loaders use for their progress bars.
    const { readable, writable } = typeof FixedLengthStream === 'function' ? new FixedLengthStream(length) : new TransformStream();
    ctx.waitUntil(pump(env, url, path, parts, start, end, writable));
    return new Response(readable, { status, headers });
  },
};

// Writes bytes [start..end] of the joined file to `writable`, one part at a time.
async function pump(env, url, path, parts, start, end, writable) {
  const dir = path.slice(0, path.lastIndexOf('/') + 1);
  let offset = 0; // where the current part starts within the joined file
  try {
    for (const part of parts) {
      const partStart = offset, partEnd = offset + part.size - 1;
      offset += part.size;
      if (partEnd < start) continue;
      if (partStart > end) break;

      const partUrl = new URL(dir.split('/').map(encodeURIComponent).join('/') + encodeURIComponent(part.name), url);
      const res = await env.ASSETS.fetch(new Request(partUrl, { headers: { 'Accept-Encoding': 'identity' } }));
      if (!res.ok || !res.body) throw new Error(`part ${part.name} returned ${res.status}`);

      const skip = Math.max(0, start - partStart);          // bytes to drop at the front of this part
      const take = Math.min(part.size, end - partStart + 1) - skip; // bytes to keep
      if (skip === 0 && take === part.size) {
        await res.body.pipeTo(writable, { preventClose: true }); // whole part: fast path
      } else {
        await copySlice(res.body, writable, skip, take);
      }
    }
    await writable.close();
  } catch (err) {
    console.error(`[split] ${path}: ${err && err.message}`);
    try { await writable.abort(err); } catch { /* already closed */ }
  }
}

async function copySlice(body, writable, skip, take) {
  const reader = body.getReader();
  const writer = writable.getWriter();
  try {
    while (take > 0) {
      const { done, value } = await reader.read();
      if (done) break;
      let chunk = value;
      if (skip > 0) {
        if (skip >= chunk.length) { skip -= chunk.length; continue; }
        chunk = chunk.subarray(skip); skip = 0;
      }
      if (chunk.length > take) chunk = chunk.subarray(0, take);
      take -= chunk.length;
      await writer.write(chunk);
    }
    await reader.cancel().catch(() => {});
  } finally {
    writer.releaseLock();
  }
}

function matchesETag(header, etag) {
  if (!header) return false;
  return header.split(',').some((t) => { t = t.trim(); return t === '*' || t === etag || t === 'W/' + etag; });
}
function ifRangeAllows(header, etag) { return !header || header.trim() === etag; }

// Returns {start,end}, 'unsatisfiable', or null (no/unsupported Range header).
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim()); // multi-range is ignored on purpose
  if (!m || (m[1] === '' && m[2] === '')) return null;
  let start, end;
  if (m[1] === '') { // suffix: last N bytes
    const n = Number(m[2]);
    if (n === 0) return 'unsatisfiable';
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === '' ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return 'unsatisfiable';
  return { start, end };
}
