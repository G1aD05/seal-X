// Serverless co-op for the browser build: the same WebRTC link and the same pasted codes ("RD1-...") as the
// desktop game (src/rtc.rs), so a browser can host or join a desktop player and the other way round.
// No game server: the two players swap one code each by hand; STUN servers (public, free) only tell each
// side its own public address. src/main.rs reaches this file through web/rtc_lib.js (rdnet_* functions).
(function () {
  'use strict';
  const PREFIX = 'RD1-';
  const CHUNK = 15000; // data channels like small messages; bigger frames are cut up and rejoined
  const ICE = { iceServers: [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }] };
  const KIND = { open: 1, msg: 2, close: 3, info: 4 };
  const enc = new TextEncoder();

  const events = [];           // packets waiting for the game: [kind, id, payload bytes]
  const conns = new Map();     // link id -> { pc, dc }
  const pending = new Map();   // invite id -> { pc }
  let nextConn = 1, nextInvite = 1;

  const push = (kind, id, payload) => events.push([kind, id, payload || new Uint8Array(0)]);
  const info = (k, a, b) => push(KIND.info, 0, enc.encode(k + '\0' + (a || '') + '\0' + (b || '')));

  // ---- codes: base64url( raw-deflate( JSON {type, sdp} ) ), the same as the desktop game ----------------
  const b64 = (u8) => { let s = ''; for (const c of u8) s += String.fromCharCode(c); return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, ''); };
  const unb64 = (s) => { s = s.replace(/-/g, '+').replace(/_/g, '/'); while (s.length % 4) s += '='; const r = atob(s); const u = new Uint8Array(r.length); for (let i = 0; i < r.length; i++) u[i] = r.charCodeAt(i); return u; };
  async function pipe(bytes, stream) {
    const w = stream.writable.getWriter(); w.write(bytes).catch(() => {}); w.close().catch(() => {});
    return new Uint8Array(await new Response(stream.readable).arrayBuffer());
  }
  function slim(sdp) { // keep the code short: drop addresses that can never work for a friend, cap the candidates
    const lines = sdp.split('\r\n');
    const cands = lines.filter((l) => l.startsWith('a=candidate:')).filter((l) => !(/ fe80:| 127\.0\.0\.1 | ::1 | 169\.254\./.test(l)));
    cands.sort((a, b) => (/ typ host/.test(a) ? 1 : 0) - (/ typ host/.test(b) ? 1 : 0)); // public (srflx/relay) first
    const keep = new Set(cands.slice(0, 6));
    return lines.filter((l) => !l.startsWith('a=candidate:') || keep.has(l)).join('\r\n');
  }
  async function encode(desc) {
    if (typeof CompressionStream === 'undefined') throw new Error('this browser is too old for invite codes (try a current Chrome, Edge, Firefox or Safari)');
    const json = enc.encode(JSON.stringify({ type: desc.type, sdp: slim(desc.sdp) }));
    return PREFIX + b64(await pipe(json, new CompressionStream('deflate-raw')));
  }
  async function decode(code) {
    code = String(code || '').replace(/\s+/g, '');
    if (!code.startsWith(PREFIX)) throw new Error('that is not a code from this game (it should start with RD1-)');
    if (typeof DecompressionStream === 'undefined') throw new Error('this browser is too old for invite codes');
    try {
      const json = await pipe(unb64(code.slice(PREFIX.length)), new DecompressionStream('deflate-raw'));
      const d = JSON.parse(new TextDecoder().decode(json));
      if (!d || !d.sdp || !d.type) throw 0;
      return d;
    } catch (e) { throw new Error('the code is damaged (copied only partly?)'); }
  }

  // ---- peer plumbing -------------------------------------------------------------------------------------
  function gathered(pc) { // resolves when our addresses are known (gives up after 6 s if STUN can't be reached)
    return new Promise((res) => {
      if (pc.iceGatheringState === 'complete') return res();
      const done = () => { pc.removeEventListener('icegatheringstatechange', ch); clearTimeout(t); res(); };
      const ch = () => { if (pc.iceGatheringState === 'complete') done(); };
      const t = setTimeout(done, 6000);
      pc.addEventListener('icegatheringstatechange', ch);
    });
  }

  // wires a data channel into the game as a link. announce = tell the game a link opened (host side)
  function attach(pc, dc, announce, onOpen) {
    dc.binaryType = 'arraybuffer';
    let id = 0, acc = [];
    const drop = () => { // the other side went away
      const c = conns.get(id);
      if (c) { conns.delete(id); push(KIND.close, id); }
    };
    dc.onopen = () => {
      id = nextConn++;
      conns.set(id, { pc, dc });
      if (announce) push(KIND.open, id);
      if (onOpen) onOpen(id);
    };
    dc.onmessage = (e) => {
      const d = new Uint8Array(e.data);
      if (!d.length) return;
      acc.push(d.subarray(1));
      if (d[0] === 1) {
        let n = 0; for (const p of acc) n += p.length;
        const full = new Uint8Array(n); let o = 0;
        for (const p of acc) { full.set(p, o); o += p.length; }
        acc = [];
        push(KIND.msg, id, full);
      }
    };
    dc.onclose = drop;
    pc.addEventListener('connectionstatechange', () => { if (pc.connectionState === 'failed' || pc.connectionState === 'closed') drop(); });
  }

  // host: an offer for one friend (a few seconds: it asks STUN for our address)
  async function makeInvite() {
    const pc = new RTCPeerConnection(ICE);
    const dc = pc.createDataChannel('rd');
    attach(pc, dc, true);
    await pc.setLocalDescription(await pc.createOffer());
    await gathered(pc);
    const code = await encode(pc.localDescription);
    const id = nextInvite++;
    pending.set(id, { pc });
    return { id, code };
  }
  // host: apply the friend's reply to invite `id` (throws on a damaged code; the invite stays)
  async function applyReply(id, code) {
    const p = pending.get(id);
    if (!p) throw new Error('that invite is no longer waiting; make a new one');
    await p.pc.setRemoteDescription(await decode(code));
    pending.delete(id);
  }
  // guest: turn an invite code into a reply code (handed to onReply), then wait for the link to come up
  async function joinWith(code, secs, onReply) {
    let pc;
    try {
      const offer = await decode(code);
      pc = new RTCPeerConnection(ICE);
      let opened = false, finished = false;
      const fail = (m) => { if (!opened && !finished) { finished = true; info('rtc_fail', '', m); try { pc.close(); } catch (e) {} } };
      const timer = setTimeout(() => fail('timed out waiting for the host to answer'), secs * 1000);
      pc.ondatachannel = (e) => attach(pc, e.channel, false, (id) => { opened = true; clearTimeout(timer); info('rtc_open', String(id), ''); });
      pc.addEventListener('connectionstatechange', () => {
        if (pc.connectionState === 'failed') { clearTimeout(timer); fail('the connection could not be made (both networks block direct links; a relay server would be needed)'); }
      });
      await pc.setRemoteDescription(offer);
      await pc.setLocalDescription(await pc.createAnswer());
      await gathered(pc);
      onReply(await encode(pc.localDescription));
    } catch (e) { if (pc) { try { pc.close(); } catch (e2) {} } info('rtc_fail', '', String(e.message || e)); }
  }

  // ---- room codes: a tiny matchmaker server (server/) only ferries the two codes; game data goes direct -------
  const SIGNAL = String(window.RD_SIGNAL || new URLSearchParams(location.search).get('server') || '').trim().replace(/\/+$/, '');
  const wsUrl = () => SIGNAL.replace(/^http/i, 'ws');
  const stamp = () => Date.now();
  // free servers sleep when idle and take up to a minute to wake: keep trying
  function openSocket(giveUpMs) {
    const end = stamp() + giveUpMs;
    return new Promise((resolve, reject) => {
      const attempt = () => {
        let ws;
        try { ws = new WebSocket(wsUrl()); } catch (e) { return reject(new Error('the server address in config.js is not valid')); }
        let opened = false;
        ws.onopen = () => { opened = true; resolve(ws); };
        ws.onclose = ws.onerror = () => {
          if (opened) return;
          if (stamp() > end) reject(new Error('could not reach the game server (is it running, and is the address in config.js right?)'));
          else { info('room_wait', '', 'waking up the server, this can take up to a minute...'); setTimeout(attempt, 2000); }
        };
      };
      attempt();
    });
  }
  if (SIGNAL) { try { fetch(SIGNAL.replace(/^ws/i, 'http'), { mode: 'no-cors' }).catch(() => {}); } catch (e) {} } // wake a sleeping free server early
  const sendJson = (ws, o) => { if (ws.readyState === 1) ws.send(JSON.stringify(o)); };
  let hosting = null; // { room, ws, stop }

  const RDNet = {
    roomAvailable() { return SIGNAL ? 1 : 0; },
    // host: open a room others can join by name
    async hostRoom(room, pub, label) {
      if (hosting) { hosting.stop = true; try { hosting.ws.close(); } catch (e) {} }
      const h = hosting = { room, ws: null, stop: false, first: true, byGuest: new Map() };
      const run = async () => {
        let ws;
        try { ws = await openSocket(h.first ? 75000 : 30000); } catch (e) {
          if (h.first) { h.stop = true; return info('room_fail', '', String(e.message || e)); }
          return setTimeout(() => { if (!h.stop) run(); }, 3000);
        }
        h.ws = ws;
        const ka = setInterval(() => sendJson(ws, { t: 'ping' }), 25000);
        ws.onmessage = async (e) => {
          let m; try { m = JSON.parse(e.data); } catch (x) { return; }
          if (m.t === 'hosted') { if (h.first) info('room_ok', '', m.room); h.first = false; }
          else if (m.t === 'error') { // taken / invalid at first; later (after a reconnect) just try again
            if (h.first) { h.stop = true; info('room_fail', '', m.msg); ws.close(); }
          } else if (m.t === 'guest') {
            try { const r = await makeInvite(); h.byGuest.set(m.gid, r.id); sendJson(ws, { t: 'offer', gid: m.gid, code: r.code }); } catch (x) { console.warn('[rtc] invite failed:', x); }
          } else if (m.t === 'answer') {
            const id = h.byGuest.get(m.gid);
            try { if (id) await applyReply(id, m.code); } catch (x) { console.warn('[rtc] reply failed:', x); }
            h.byGuest.delete(m.gid);
          }
        };
        ws.onclose = () => { clearInterval(ka); if (!h.stop) setTimeout(() => { if (!h.stop) run(); }, 3000); };
        sendJson(ws, { t: 'host', room, pub: !!pub, name: label || '' });
      };
      run();
    },
    // public rooms: tells the game "rooms" with one line per room: ROOM <tab> host name <tab> players/max
    async listRooms() {
      let ws, done = false;
      const end = (k, b) => { if (!done) { done = true; info(k, '', b); } try { ws && ws.close(); } catch (e) {} };
      try { ws = await openSocket(75000); } catch (e) { return end('rooms_fail', String(e.message || e)); }
      const timer = setTimeout(() => end('rooms_fail', 'the server did not answer'), 15000);
      ws.onmessage = (e) => {
        let m; try { m = JSON.parse(e.data); } catch (x) { return; }
        if (m.t === 'rooms') { clearTimeout(timer); end('rooms', m.rooms.map((r) => [r.room, r.name, r.players + '/' + r.max].join('\t')).join('\n')); }
      };
      ws.onclose = () => { clearTimeout(timer); end('rooms_fail', 'lost the connection to the server'); };
      sendJson(ws, { t: 'list' });
    },
    stopRoom() { if (hosting) { hosting.stop = true; try { hosting.ws && hosting.ws.close(); } catch (e) {} hosting = null; } },
    // host: make an invite code to send by hand (no server needed)
    async invite() {
      try { const r = await makeInvite(); info('invite', String(r.id), r.code); }
      catch (e) { info('invite_fail', '', String(e.message || e)); }
    },
    // host: feed in the friend's reply code for invite `id`
    async accept(id, code) {
      try { await applyReply(id, code); info('accept', String(id), ''); }
      catch (e) { info('accept', String(id), String(e.message || e)); } // a damaged code: invite stays, paste again
    },
    cancel(id) {
      const p = pending.get(id);
      if (p) { pending.delete(id); try { p.pc.close(); } catch (e) {} }
    },
    // guest: "room:NAME" asks the server for NAME's host; anything else is a pasted invite code
    async join(code, secs) {
      if (String(code).startsWith('room:')) {
        const room = String(code).slice(5).trim().toUpperCase();
        let ws, done = false;
        const fail = (m) => { if (!done) { done = true; info('rtc_fail', '', m); } try { ws && ws.close(); } catch (e) {} };
        try { ws = await openSocket(75000); } catch (e) { return fail(String(e.message || e)); }
        const timer = setTimeout(() => fail('timed out waiting for the host to answer'), secs * 1000);
        ws.onmessage = (e) => {
          let m; try { m = JSON.parse(e.data); } catch (x) { return; }
          if (m.t === 'error') { clearTimeout(timer); fail(m.msg); }
          else if (m.t === 'offer') {
            joinWith(m.code, secs, (reply) => { sendJson(ws, { t: 'answer', code: reply }); info('reply', '', 'room'); setTimeout(() => { try { ws.close(); } catch (x) {} }, 20000); });
          }
        };
        ws.onclose = () => { if (!done) setTimeout(() => { if (!done) { /* answer already sent; the link may still open */ } }, 0); };
        sendJson(ws, { t: 'join', room });
        return;
      }
      joinWith(code, secs, (reply) => info('reply', '', reply));
    },
    send(id, bytes) {
      const c = conns.get(id);
      if (!c || c.dc.readyState !== 'open') return;
      const n = Math.max(1, Math.ceil(bytes.length / CHUNK));
      for (let i = 0; i < n; i++) {
        const part = bytes.subarray(i * CHUNK, Math.min(bytes.length, (i + 1) * CHUNK));
        const m = new Uint8Array(part.length + 1);
        m[0] = i + 1 === n ? 1 : 0; m.set(part, 1);
        try { c.dc.send(m); } catch (e) { return; }
      }
    },
    close(id) {
      const c = conns.get(id);
      if (!c) return;
      conns.delete(id); // no close event for a link the game closed itself
      setTimeout(() => { try { c.pc.close(); } catch (e) {} }, 300); // let queued bytes go out first
    },
    // next packet for the game: writes [kind u8][id u32 LE][payload] at heap[ptr..]; returns its length, 0 when
    // there is none, or -N if the buffer must hold N bytes (the packet stays queued)
    next(heap, ptr, cap) {
      if (!events.length) return 0;
      const [kind, id, payload] = events[0];
      const total = 5 + payload.length;
      if (total > cap) return -total;
      events.shift();
      heap[ptr] = kind;
      heap[ptr + 1] = id & 255; heap[ptr + 2] = (id >> 8) & 255; heap[ptr + 3] = (id >> 16) & 255; heap[ptr + 4] = (id >> 24) & 255;
      heap.set(payload, ptr + 5);
      return total;
    },
    // Copy / Paste buttons: copying uses the clipboard when the browser allows it, else shows the text to copy by hand;
    // pasting asks in a small box (browsers do not let a game read the clipboard on its own)
    clipSet(text) {
      const fallback = () => { try { window.prompt('Copy this code (Ctrl+C / Cmd+C), then press OK:', text); } catch (e) {} };
      try { navigator.clipboard.writeText(text).catch(fallback); } catch (e) { fallback(); }
    },
    clipGet() {
      let t = '';
      try { t = window.prompt('Paste the code here (Ctrl+V / Cmd+V), then press OK:', '') || ''; } catch (e) {}
      return t.trim();
    },
  };
  window.RDNet = RDNet;
})();
