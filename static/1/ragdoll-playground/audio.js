// Browser sound for the web build. The game drives it through the same six calls as the desktop version
// (host.audio_play / set / stop / pause / active, see src/webaudio.rs and web/rtc_lib.js); each playing Sound owns
// one "voice", keyed by a handle the game picks.
//
// Sounds are NOT preloaded: they are fetched from sounds/<id>.ogg the first time they are played. build.sh puts them
// there (web/pack_sounds.sh) together with sounds/manifest.json, which lists every file and how many pieces it was
// split into (a file over the size limit is stored as <id>.part0.bin, <id>.part1.bin ... and joined here).
//   * small files are decoded once into memory (AudioBufferSourceNode: exact looping, regions, speed)
//   * big files (music) stream through an <audio> element, so they are never decoded in full
// Browsers only allow sound after a click or key press, so the first one unlocks it: until then one-shot sounds are
// skipped and looping sounds wait.
// Add ?sound=0 to the address to switch sound off.
(function () {
  'use strict';
  const params = new URLSearchParams(location.search);
  const BASE = 'sounds/';
  const STREAM_ABOVE = 1024 * 1024;      // bytes: bigger files stream, smaller ones are decoded
  const DECODED_CAP = 160 * 1048576;     // decoded sound kept in memory (oldest used goes first)
  const BLOB_CAP = 96 * 1048576;         // downloaded big files kept for replays
  const PREFETCH_BELOW = 400 * 1024;     // small sounds are downloaded in the background after start-up...
  const PREFETCH_CAP = 24 * 1048576;     // ...up to this much in total
  const MAX_VOICES = 96;

  let manifest = null;                    // { id: [size, parts] }
  let ctx = null, master = null;
  const voices = new Map();               // handle -> voice
  const waiting = new Set();              // looping voices that are ready but wait for the first click
  const off = params.get('sound') === '0';

  // ---- manifest + downloads -----------------------------------------------------------------------------------
  if (!off) {
    fetch(BASE + 'manifest.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : null))
      .then((j) => { if (j && j.files) { manifest = j.files; setTimeout(prefetch, 4000); } })
      .catch(() => {});
  }

  async function fetchBytes(id) {
    const [size, parts] = manifest[id];
    const urls = [];
    if (parts <= 1) urls.push(BASE + id + '.ogg');
    else for (let i = 0; i < parts; i++) urls.push(BASE + id + '.part' + i + '.bin');
    const chunks = await Promise.all(urls.map(async (u) => {
      const r = await fetch(u);
      if (!r.ok) throw new Error('HTTP ' + r.status + ' for ' + u);
      return new Uint8Array(await r.arrayBuffer());
    }));
    if (chunks.length === 1) return chunks[0].buffer;
    const all = new Uint8Array(chunks.reduce((n, c) => n + c.length, 0));
    let at = 0;
    for (const c of chunks) { all.set(c, at); at += c.length; }
    return all.buffer;
  }

  // small sounds downloaded ahead of time (still encoded; decoded when first played)
  const raw = new Map();
  let rawBytes = 0;
  async function prefetch() {
    if (!manifest) return;
    const ids = Object.keys(manifest).filter((id) => manifest[id][0] <= PREFETCH_BELOW).sort((a, b) => manifest[a][0] - manifest[b][0]);
    for (const id of ids) {
      if (rawBytes + manifest[id][0] > PREFETCH_CAP) break;
      if (raw.has(id) || decoded.has(id)) continue;
      try { const ab = await fetchBytes(id); raw.set(id, ab); rawBytes += ab.byteLength; } catch (e) { /* played on demand instead */ }
      await new Promise((r) => setTimeout(r, 30));
    }
  }

  // ---- decoded sounds (small files), least recently used goes first ---------------------------------------------
  const decoded = new Map();              // id -> { buf, bytes }   (Map keeps insertion order: re-insert on use)
  const decoding = new Map();             // id -> Promise
  let decodedBytes = 0;
  function getBuffer(id) {
    const hit = decoded.get(id);
    if (hit) { decoded.delete(id); decoded.set(id, hit); return Promise.resolve(hit.buf); }
    let p = decoding.get(id);
    if (p) return p;
    const source = raw.has(id) ? Promise.resolve(raw.get(id).slice(0)) : fetchBytes(id);
    p = source.then((ab) => ctx.decodeAudioData(ab)).then((buf) => {
      decoding.delete(id);
      const bytes = buf.length * buf.numberOfChannels * 4;
      decoded.set(id, { buf, bytes });
      decodedBytes += bytes;
      for (const [k, e] of decoded) { // forget the oldest until we are under the cap (playing sources keep their own reference)
        if (decodedBytes <= DECODED_CAP || k === id) break;
        decoded.delete(k); decodedBytes -= e.bytes;
      }
      raw.delete(id);
      return buf;
    }, (e) => { decoding.delete(id); throw e; });
    decoding.set(id, p);
    return p;
  }

  // ---- downloaded big files (music), kept as Blobs ---------------------------------------------------------------
  const blobs = new Map();                // id -> Blob
  let blobBytes = 0;
  async function getBlob(id) {
    const hit = blobs.get(id);
    if (hit) { blobs.delete(id); blobs.set(id, hit); return hit; }
    const b = new Blob([await fetchBytes(id)], { type: 'audio/ogg' });
    blobs.set(id, b); blobBytes += b.size;
    for (const [k, e] of blobs) { if (blobBytes <= BLOB_CAP || k === id) break; blobs.delete(k); blobBytes -= e.size; }
    return b;
  }

  // ---- audio context + the "first click" unlock ---------------------------------------------------------------
  function ensureCtx() {
    if (ctx) return true;
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    try { ctx = new AC(); } catch (e) { return false; }
    master = ctx.createGain();
    master.connect(ctx.destination);
    ctx.onstatechange = flushWaiting;
    return true;
  }
  function unlock() {
    if (off || !ensureCtx()) return;
    if (ctx.state === 'suspended') ctx.resume().then(flushWaiting, () => {});
    else flushWaiting();
  }
  ['pointerdown', 'mousedown', 'keydown', 'touchend'].forEach((n) => window.addEventListener(n, unlock, true));
  function flushWaiting() {
    if (!ctx || ctx.state !== 'running') return;
    for (const v of [...waiting]) { waiting.delete(v); if (voices.get(v.h) === v) begin(v, v.res); }
  }

  // ---- voices ---------------------------------------------------------------------------------------------------
  // v = { h, id, vol, speed, loop, start, end, state: 'loading'|'waiting'|'playing'|'paused'|'ended', ... }
  const now = () => ctx.currentTime;
  const position = (v) => (v.state === 'playing' ? v.pos + (now() - v.t0) * v.speed : v.pos);

  function teardown(v) {
    if (v.src) { const s = v.src; v.src = null; s.onended = null; try { s.stop(); } catch (e) { /* already stopped */ } try { s.disconnect(); } catch (e) {} }
    if (v.el) { const el = v.el; v.el = null; try { el.pause(); } catch (e) {} el.removeAttribute('src'); try { el.load(); } catch (e) {} }
    if (v.url) { URL.revokeObjectURL(v.url); v.url = null; }
    if (v.gain) { try { v.gain.disconnect(); } catch (e) {} v.gain = null; }
    waiting.delete(v);
  }
  function finish(v) { if (v.state === 'ended') return; teardown(v); v.state = 'ended'; }

  function load(v) {
    const big = manifest[v.id][0] > STREAM_ABOVE;
    (big ? getBlob(v.id) : getBuffer(v.id)).then((res) => {
      if (voices.get(v.h) !== v || v.state !== 'loading') return;
      v.big = big;
      begin(v, res);
    }).catch((e) => { console.warn('[audio] cannot play ' + v.id + ':', e && e.message ? e.message : e); finish(v); });
  }

  function begin(v, res) {
    if (!ctx || ctx.state !== 'running') {
      if (ctx && ctx.state === 'suspended') ctx.resume().catch(() => {});
      if (v.loop) { v.res = res; v.state = 'waiting'; waiting.add(v); } else finish(v); // a one-shot would only play late
      return;
    }
    v.gain = ctx.createGain();
    v.gain.gain.value = v.vol;
    v.gain.connect(master);
    v.pos = Math.max(0, v.start);
    if (v.big) {
      const el = new Audio();
      el.preload = 'auto';
      el.loop = v.loop;
      el.playbackRate = v.speed;
      el.preservesPitch = el.mozPreservesPitch = el.webkitPreservesPitch = false; // Roblox speed changes the pitch too
      v.url = URL.createObjectURL(res);
      el.src = v.url;
      ctx.createMediaElementSource(el).connect(v.gain);
      el.addEventListener('ended', () => finish(v));
      el.addEventListener('error', () => finish(v));
      if (!v.loop && v.end > v.start) el.addEventListener('timeupdate', () => { if (el.currentTime >= v.end) finish(v); });
      v.el = el;
      v.state = v.holdPause ? 'paused' : 'playing';
      const go = () => {
        if (v.start > 0) { try { el.currentTime = v.start; } catch (e) {} }
        if (!v.holdPause) el.play().catch(() => { if (v.loop) { teardown(v); v.state = 'waiting'; v.res = res; waiting.add(v); } else finish(v); });
      };
      if (el.readyState >= 1) go(); else el.addEventListener('loadedmetadata', go, { once: true });
      return;
    }
    v.buffer = res;
    if (v.holdPause) { v.state = 'paused'; return; }
    playFrom(v, v.pos);
  }

  function playFrom(v, offset) {
    const dur = v.buffer.duration;
    if (offset >= dur) { if (!v.loop) { finish(v); return; } offset %= dur; }
    const s = ctx.createBufferSource();
    s.buffer = v.buffer;
    s.loop = v.loop;
    s.playbackRate.value = v.speed;
    s.connect(v.gain);
    s.onended = () => { if (v.src === s) finish(v); };
    if (!v.loop && v.end > v.start) {
      const d = v.end - offset;
      if (d <= 0) { finish(v); return; }
      s.start(0, offset, d);
    } else s.start(0, offset);
    v.src = s; v.pos = offset; v.t0 = now(); v.state = 'playing';
  }

  function reap() { for (const [h, v] of voices) if (v.state === 'ended') voices.delete(h); }

  // ---- what the game calls --------------------------------------------------------------------------------------
  function stop(h) {
    const v = voices.get(h);
    if (!v) return;
    finish(v);
    voices.delete(h);
  }
  function play(h, id, vol, speed, loop, start, end) {
    stop(h);
    if (off || !manifest || !manifest[id] || !ensureCtx()) return false; // unknown sound: the game treats it as silent
    if (voices.size >= MAX_VOICES) { reap(); if (voices.size >= MAX_VOICES) return false; }
    const v = { h, id, vol: Math.max(0, vol), speed: Math.min(8, Math.max(0.05, speed)), loop: !!loop, start: Math.max(0, start), end, state: 'loading',
      pos: 0, t0: 0, src: null, el: null, url: null, gain: null, buffer: null, big: false, holdPause: false, res: null };
    voices.set(h, v);
    load(v);
    return true;
  }
  function set(h, vol, speed) {
    const v = voices.get(h);
    if (!v || v.state === 'ended') return;
    vol = Math.max(0, vol);
    speed = Math.min(8, Math.max(0.05, speed));
    if (vol !== v.vol) { v.vol = vol; if (v.gain) v.gain.gain.value = vol; }
    if (speed !== v.speed) {
      if (v.state === 'playing' && !v.big && ctx) { v.pos = position(v); v.t0 = now(); }
      v.speed = speed;
      if (v.src) v.src.playbackRate.value = speed;
      if (v.el) v.el.playbackRate = speed;
    }
  }
  function pause(h, paused) {
    const v = voices.get(h);
    if (!v || v.state === 'ended') return;
    if (paused) {
      if (v.state === 'playing') {
        if (v.big) { if (v.el) v.el.pause(); }
        else { const p = position(v); const s = v.src; v.src = null; if (s) { s.onended = null; try { s.stop(); } catch (e) {} } v.pos = v.buffer ? p % v.buffer.duration : p; }
        v.state = 'paused';
      } else if (v.state === 'loading' || v.state === 'waiting') v.holdPause = true;
    } else {
      v.holdPause = false;
      if (v.state === 'paused') {
        if (v.big) { v.state = 'playing'; if (v.el) v.el.play().catch(() => finish(v)); }
        else if (v.buffer) playFrom(v, v.pos);
        else begin(v, v.res);
      }
    }
  }
  function active(h) {
    const v = voices.get(h);
    if (!v) return false;
    if (v.state === 'ended') { voices.delete(h); return false; }
    return true;
  }

  window.RDAudio = { play, set, stop, pause, active, enabled: () => !off };
})();
