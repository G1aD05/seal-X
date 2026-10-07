/* Seal World SDK — include with <script src="/js/seal-world-sdk.js"></script> in a world's index.html.
   Worlds run in a sandbox: no cookies, no direct API access. Everything goes through the Seal page.
     SealWorld.ready().then(info => ...)       info = { me, players, host, isHost, maxPlayers }
     SealWorld.send(type, data[, toUsername])   relay a small JSON message (<4 KB, ~40/sec) to others
     SealWorld.on(type, ({from, data}) => ...)  receive messages;  'players' fires on join/leave/host change
     SealWorld.products.buy(id)   -> asks the player to confirm; resolves { owned, seals } or rejects
     SealWorld.products.owned()   -> { productId: count }
     SealWorld.products.consume(id, qty) -> uses up consumables
   Tip: the host (SealWorld.isHost) is a good place for shared logic; it moves to the next player if they leave. */
(function () {
  var pend = {}, n = 0, handlers = {}, S = window.SealWorld = { me: null, players: [], host: null, isHost: false, maxPlayers: 0 };
  function call(op, d) {
    return new Promise(function (res, rej) {
      var id = ++n; pend[id] = { res: res, rej: rej };
      parent.postMessage(Object.assign({ sealWorld: 1, id: id, op: op }, d || {}), '*');
    });
  }
  function emit(t, m) { (handlers[t] || []).forEach(function (f) { try { f(m); } catch (e) { console.error(e); } }); }
  function apply(m) { S.players = m.players || S.players; S.host = m.host; S.isHost = !!S.me && m.host === S.me; }
  window.addEventListener('message', function (e) {
    if (e.source !== parent) return;
    var m = e.data; if (!m || !m.sealWorld) return;
    if (m.id && pend[m.id]) { var p = pend[m.id]; delete pend[m.id]; return m.error ? p.rej(new Error(m.error)) : p.res(m.result); }
    if (m.event === 'players') { apply(m); emit('players', m); }
    else if (m.event === 'msg') emit(m.type, { from: m.from, data: m.data });
  });
  S.on = function (t, f) { (handlers[t] = handlers[t] || []).push(f); };
  S.send = function (type, data, to) { return call('send', { type: type, data: data, to: to }).catch(function () {}); };
  S.ready = function () { return call('hello').then(function (r) { S.me = r.me; S.maxPlayers = r.maxPlayers; apply(r); return S; }); };
  S.products = {
    buy: function (id) { return call('buy', { product: id }); },
    owned: function () { return call('owned'); },
    consume: function (id, qty) { return call('consume', { product: id, qty: qty || 1 }); }
  };
})();
