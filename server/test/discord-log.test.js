'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const { createDiscordLogger } = require('../discord-log');

function sink(handler) {
  const got = [];
  const srv = http.createServer((req, res) => {
    let t = ''; req.on('data', c => { t += c; });
    req.on('end', () => { got.push(JSON.parse(t)); handler ? handler(got.length, res) : (res.statusCode = 204, res.end()); });
  });
  return new Promise(r => srv.listen(0, () => r({ got, srv, url: 'http://127.0.0.1:' + srv.address().port + '/x' })));
}

test('only real discord webhook links are accepted', () => {
  assert.equal(createDiscordLogger({ url: 'https://evil.example/api/webhooks/1/abc' }).enabled, false);
  assert.equal(createDiscordLogger({ url: 'https://discord.com/api/webhooks/123/abc-DEF_9' }).enabled, true);
  assert.equal(createDiscordLogger({ url: '' }).enabled, false);
});

test('audit entries become embeds and can never ping anyone', async () => {
  const s = await sink(); const d = createDiscordLogger({ url: s.url, allowAnyHost: true, spacingMs: 0 });
  d.audit({ actor: 'Ann', action: 'ban', target: 'Bob', detail: '@everyone spam', at: '2026-10-10T00:00:00.000Z' });
  await d.flush(); await new Promise(r => setTimeout(r, 50));
  assert.equal(s.got.length, 1);
  assert.deepEqual(s.got[0].allowed_mentions, { parse: [] });
  const e = s.got[0].embeds[0];
  assert.equal(e.title, 'ban'); assert.equal(e.description, '@everyone spam');
  assert.deepEqual(e.fields.map(f => f.name + '=' + f.value), ['Admin=Ann', 'Target=Bob']);
  s.srv.close();
});

test('custom logs are labelled, truncated and retried after a rate limit', async () => {
  const s = await sink((n, res) => { if (n === 1) { res.statusCode = 429; res.setHeader('content-type', 'application/json'); res.end('{"retry_after":0.05}'); } else { res.statusCode = 204; res.end(); } });
  const d = createDiscordLogger({ url: s.url, allowAnyHost: true, spacingMs: 0 });
  d.log('error', 'x'.repeat(5000), { code: 402, obj: { a: 1 } }, 'Ann');
  await d.flush(); await new Promise(r => setTimeout(r, 300));
  assert.equal(s.got.length, 2, 'the same message was sent again after the 429');
  const e = s.got[1].embeds[0];
  assert.equal(e.title, 'ERROR'); assert.ok(e.description.length <= 3000);
  assert.ok(e.fields.some(f => f.name === 'User' && f.value === 'Ann'));
  assert.ok(e.fields.some(f => f.name === 'obj' && f.value === '{"a":1}'));
  s.srv.close();
});

test('a disabled logger does nothing and never throws', () => {
  const d = createDiscordLogger({});
  d.audit({ actor: 'a', action: 'b' }); d.log('info', 'hi');
});
