// Seal front-end Worker.
//
// Static files from ../public are served straight from Cloudflare's edge by the
// assets layer (they never invoke this code). Everything that is NOT a static
// file - /api/*, the SSE streams (banner/chat/popups), avatars/uploads stored on
// the server, games uploaded later via the admin panel - lands here and is
// proxied to the Render server. Because the browser only ever talks to the
// workers.dev origin, login cookies stay first-party: no CORS, no SameSite=None,
// and no third-party-cookie blocking in Safari/Firefox.
//
// Split files: Cloudflare rejects any single asset over 25 MiB, so deploy/split-static.mjs
// cuts those into numbered parts (index.html.part000, ...) and lists them in
// split-manifest.json (build.mjs copies it next to this file). The original URL of such
// a file no longer matches an asset, so it lands here; serveSplit() below looks it up in
// the manifest and streams the parts back as ONE response. Anything not in the manifest
// falls through to the Render proxy exactly as before.
//
// Render's free tier spins the server down after ~15 minutes without traffic, and static
// files are served by Cloudflare (so they never wake it). Two things handle that:
//   * a Cron Trigger (wrangler.toml [triggers]) runs scheduled() every few minutes and pings
//     the server so it doesn't go to sleep;
//   * while it IS asleep/waking, /api/* requests get a clear 503 {waking:true} JSON answer
//     (instead of a bare 502) and js/server-wake.js shows the visitor a "waking up" notice.

import manifest from "./split-manifest.json";

export default {
  // Cron Trigger: keeps the Render server awake. See wrangler.toml [triggers].
  async scheduled(event, env, ctx) {
    ctx.waitUntil(keepAlive(env));
  },

  async fetch(request, env, ctx) {
    const split = serveSplit(request, env, ctx);
    if (split) return split;

    const origin = new URL(env.ORIGIN);
    const url = new URL(request.url);
    const target = new URL(url.pathname + url.search, origin);

    const headers = new Headers(request.headers);
    headers.set("X-Forwarded-Host", url.host);
    headers.set("X-Forwarded-Proto", "https");

    let upstream;
    try {
      upstream = await fetch(
        new Request(target, {
          method: request.method,
          headers,
          body: request.body,
          redirect: "manual",
        })
      );
    } catch (err) {
      return wakingResponse(url);
    }

    // Render answers 502/503/504 with its own HTML page while a sleeping instance boots.
    // The app itself always answers /api/* with JSON (even its 503 maintenance reply), so a
    // non-JSON gateway error on /api/* means "still waking up", not a real app error.
    if (url.pathname.startsWith("/api/") && [502, 503, 504].includes(upstream.status) &&
        !/json/i.test(upstream.headers.get("Content-Type") || "")) {
      try { await upstream.body?.cancel(); } catch { /* ignore */ }
      return wakingResponse(url);
    }

    const res = new Response(upstream.body, upstream);

    // Keep redirects on the workers.dev origin.
    const loc = res.headers.get("Location");
    if (loc && loc.startsWith(origin.origin)) {
      res.headers.set("Location", url.origin + loc.slice(origin.origin.length));
    }

    // Host-only cookies: drop any Domain= attribute the server might set.
    const cookies = upstream.headers.getSetCookie ? upstream.headers.getSetCookie() : [];
    if (cookies.length) {
      res.headers.delete("Set-Cookie");
      for (const c of cookies) res.headers.append("Set-Cookie", c.replace(/;\s*Domain=[^;]*/i, ""));
    }

    // Never let an edge/browser cache sit on live streams or API responses.
    const type = res.headers.get("Content-Type") || "";
    if (type.includes("text/event-stream") || url.pathname.startsWith("/api/")) {
      res.headers.set("Cache-Control", "no-store");
    }
    return res;
  },
};

// A cheap, always-JSON endpoint on the Render app (in-memory read, works in maintenance mode too).
const PING_PATH = "/api/banner";

// Runs from the Cron Trigger. Any response from the app counts: the point is that the instance
// receives traffic. If it was already asleep this request is what wakes it (can take ~1 min).
async function keepAlive(env) {
  const started = Date.now();
  try {
    const res = await fetch(new URL(PING_PATH, env.ORIGIN), {
      headers: { "User-Agent": "seal-keepalive", "Cache-Control": "no-cache" },
      cf: { cacheTtl: 0 },
    });
    await res.arrayBuffer(); // drain so the connection closes cleanly
    console.log(`[keepalive] ${res.status} in ${Date.now() - started}ms`);
  } catch (err) {
    console.error(`[keepalive] failed after ${Date.now() - started}ms: ${err && err.message}`);
  }
}

// Answer used while the Render server is asleep / booting / unreachable.
function wakingResponse(url) {
  const message = "The server is waking up. This can take up to a minute, please try again shortly.";
  const common = { "Retry-After": "10", "Cache-Control": "no-store" };
  if (url.pathname.startsWith("/api/")) {
    return new Response(JSON.stringify({ error: message, waking: true }), {
      status: 503,
      headers: { ...common, "Content-Type": "application/json; charset=utf-8" },
    });
  }
  return new Response(message, { status: 503, headers: { ...common, "Content-Type": "text/plain; charset=utf-8" } });
}

// ---------------------------------------------------------------------------
// Split-file support (ported from deploy/worker.js). Returns a Response when the
// request is for a file listed in split-manifest.json, otherwise null so the
// caller carries on to the Render proxy. Supports GET, HEAD, conditional requests
// (ETag) and single-range requests.
// ---------------------------------------------------------------------------

const CORS = { "Access-Control-Allow-Origin": "*" };

// Mirrors static/_headers (Workers only apply that file to plain assets, not to
// responses a Worker builds itself).
const CACHE_PREFIXES = ["/1/", "/tools/", "/gameIcons/"];
const CACHE_CONTROL = "public, max-age=604800";

const TYPES = {
  html: "text/html; charset=utf-8", htm: "text/html; charset=utf-8",
  js: "text/javascript; charset=utf-8", mjs: "text/javascript; charset=utf-8",
  css: "text/css; charset=utf-8", json: "application/json; charset=utf-8",
  wasm: "application/wasm", // must be exact for WebAssembly.instantiateStreaming
  png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", gif: "image/gif", webp: "image/webp", svg: "image/svg+xml",
  mp3: "audio/mpeg", ogg: "audio/ogg", wav: "audio/wav", mp4: "video/mp4", webm: "video/webm",
  txt: "text/plain; charset=utf-8", xml: "application/xml",
};
const contentType = (path) => TYPES[path.split(".").pop().toLowerCase()] || "application/octet-stream";
const has = (obj, key) => Object.prototype.hasOwnProperty.call(obj, key);

function serveSplit(request, env, ctx) {
  // Only read-style requests can be for a split file. POST/PUT/etc. (the API) go to the proxy.
  const method = request.method;
  if (method !== "GET" && method !== "HEAD" && method !== "OPTIONS") return null;

  const url = new URL(request.url);
  let path;
  try { path = decodeURIComponent(url.pathname); } catch { return null; }
  if (path.endsWith("/")) path += "index.html"; // /1/eaglercraft/ -> /1/eaglercraft/index.html

  const entry = has(manifest, path) ? manifest[path] : null;
  if (!entry) {
    // /1/eaglercraft (no slash) where index.html is split: send the browser to the slash form
    // so the page's relative URLs resolve correctly.
    if (method !== "OPTIONS" && has(manifest, path + "/index.html")) {
      return Response.redirect(url.origin + url.pathname + "/" + url.search, 308);
    }
    return null; // not a split file: let the proxy handle it
  }

  if (method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...CORS, "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS", "Access-Control-Allow-Headers": "Range, If-None-Match", "Access-Control-Max-Age": "86400" } });
  }

  const { size, sha256, parts } = entry;
  const etag = `"${sha256.slice(0, 32)}"`;
  const headers = new Headers(CORS);
  headers.set("Content-Type", contentType(path));
  headers.set("Accept-Ranges", "bytes");
  headers.set("ETag", etag);
  headers.set("Access-Control-Expose-Headers", "Content-Length, Content-Range, ETag");
  if (CACHE_PREFIXES.some((p) => path.startsWith(p))) headers.set("Cache-Control", CACHE_CONTROL);

  if (matchesETag(request.headers.get("If-None-Match"), etag)) {
    headers.delete("Content-Type");
    return new Response(null, { status: 304, headers });
  }

  // Range handling (single range only; anything odd falls back to the full file).
  let start = 0, end = size - 1, status = 200;
  const range = parseRange(request.headers.get("Range"), size);
  if (range === "unsatisfiable") {
    headers.set("Content-Range", `bytes */${size}`);
    return new Response(null, { status: 416, headers });
  }
  if (range && ifRangeAllows(request.headers.get("If-Range"), etag)) {
    ({ start, end } = range);
    status = 206;
    headers.set("Content-Range", `bytes ${start}-${end}/${size}`);
  }
  const length = end - start + 1;
  headers.set("Content-Length", String(length));

  if (method === "HEAD") return new Response(null, { status, headers });

  // FixedLengthStream (a workerd global) lets us send a real Content-Length, which
  // Godot/Unity/Emscripten loaders use for their progress bars.
  const { readable, writable } = typeof FixedLengthStream === "function" ? new FixedLengthStream(length) : new TransformStream();
  ctx.waitUntil(pump(env, url, path, parts, start, end, writable));
  return new Response(readable, { status, headers });
}

// Writes bytes [start..end] of the joined file to `writable`, one part at a time.
async function pump(env, url, path, parts, start, end, writable) {
  const dir = path.slice(0, path.lastIndexOf("/") + 1);
  let offset = 0; // where the current part starts within the joined file
  try {
    for (const part of parts) {
      const partStart = offset, partEnd = offset + part.size - 1;
      offset += part.size;
      if (partEnd < start) continue;
      if (partStart > end) break;

      const partUrl = new URL(dir.split("/").map(encodeURIComponent).join("/") + encodeURIComponent(part.name), url);
      const res = await env.ASSETS.fetch(new Request(partUrl, { headers: { "Accept-Encoding": "identity" } }));
      if (!res.ok || !res.body) throw new Error(`part ${part.name} returned ${res.status}`);

      const skip = Math.max(0, start - partStart);                  // bytes to drop at the front of this part
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
  return header.split(",").some((t) => { t = t.trim(); return t === "*" || t === etag || t === "W/" + etag; });
}
function ifRangeAllows(header, etag) { return !header || header.trim() === etag; }

// Returns {start,end}, 'unsatisfiable', or null (no/unsupported Range header).
function parseRange(header, size) {
  if (!header) return null;
  const m = /^bytes=(\d*)-(\d*)$/.exec(header.trim()); // multi-range is ignored on purpose
  if (!m || (m[1] === "" && m[2] === "")) return null;
  let start, end;
  if (m[1] === "") { // suffix: last N bytes
    const n = Number(m[2]);
    if (n === 0) return "unsatisfiable";
    start = Math.max(0, size - n); end = size - 1;
  } else {
    start = Number(m[1]);
    end = m[2] === "" ? size - 1 : Math.min(Number(m[2]), size - 1);
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { start, end };
}
