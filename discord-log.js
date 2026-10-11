'use strict';
// Sends log entries to a Discord webhook. The webhook URL is a secret: anyone who has it can post
// as the site, so it comes from the DISCORD_WEBHOOK_URL env var (or data/discord-webhook.txt) and
// is never sent to browsers, committed, or printed. Entries are queued and sent one at a time,
// respecting Discord's rate limits. A failed send never affects the admin action that caused it.

const fs = require('fs');
const path = require('path');

const HOST_OK = /^https:\/\/(?:(?:canary|ptb)\.)?(?:discord|discordapp)\.com\/api\/webhooks\/\d+\/[\w-]+\/?$/;
const MAX_QUEUE = 200;
const SPACING_MS = 450;
const COLORS = { ban: 0xe5484d, jail: 0xe5484d, suspend: 0xf5a524, mute: 0xf5a524, grant: 0x3b82f6, revoke: 0x8b5cf6, unban: 0x30a46c, unjail: 0x30a46c, unsuspend: 0x30a46c, unmute: 0x30a46c, info: 0x3b82f6, warn: 0xf5a524, error: 0xe5484d, debug: 0x8b8b8b };

function colorFor(action) {
  const a = String(action || '').toLowerCase();
  if (COLORS[a]) return COLORS[a];
  for (const k of ['unban', 'unjail', 'unsuspend', 'unmute', 'ban', 'jail', 'suspend', 'mute', 'grant', 'revoke']) if (a.includes(k)) return COLORS[k];
  return 0x45d6c8;
}
const cut = (v, n) => { const s = String(v == null ? '' : v); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

function createDiscordLogger(opts) {
  opts = opts || {};
  let url = String(opts.url || '').trim();
  if (!url && opts.file) { try { url = fs.readFileSync(opts.file, 'utf8').trim(); } catch { /* no file */ } }
  const enabled = !!url && (opts.allowAnyHost || HOST_OK.test(url));
  if (url && !enabled) console.error('[discord] The webhook URL is not a discord.com webhook link, so logging to Discord is off.');
  const queue = []; let sending = false, dropped = 0;
  const doFetch = opts.fetch || fetch;

  async function post(body) {
    for (let attempt = 0; attempt < 3; attempt++) {
      let res;
      try { res = await doFetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body), signal: AbortSignal.timeout(8000) }); }
      catch { await new Promise(r => setTimeout(r, 1000)); continue; }
      if (res.status === 429) {
        let wait = 1500; try { const j = await res.json(); wait = Math.min(15000, Math.ceil((j.retry_after || 1.5) * 1000)); } catch { /* keep default */ }
        await new Promise(r => setTimeout(r, wait)); continue;
      }
      return;
    }
  }
  async function pump() {
    if (sending) return; sending = true;
    try {
      while (queue.length) {
        await post(queue.shift());
        if (queue.length) await new Promise(r => setTimeout(r, opts.spacingMs == null ? SPACING_MS : opts.spacingMs));
      }
    } finally { sending = false; }
  }
  function enqueue(embed) {
    if (!enabled) return;
    if (queue.length >= MAX_QUEUE) { queue.shift(); dropped++; }
    // allowed_mentions: nothing a user typed can ping @everyone or a role
    queue.push({ username: opts.name || 'Seal', allowed_mentions: { parse: [] }, embeds: [embed] });
    pump().catch(() => {});
  }

  return {
    enabled,
    // One admin/moderation action from the site's audit log
    audit(entry) {
      if (!entry) return;
      const fields = [{ name: 'Admin', value: cut(entry.actor || 'system', 200), inline: true }];
      if (entry.target) fields.push({ name: 'Target', value: cut(entry.target, 200), inline: true });
      enqueue({ title: cut(entry.action, 120), description: entry.detail ? cut(entry.detail, 1500) : undefined, color: colorFor(entry.action), fields, timestamp: entry.at || new Date().toISOString() });
    },
    // A custom log line: level is debug | info | warn | error; fields is a small { name: value } object
    log(level, message, fields, who) {
      level = ['debug', 'info', 'warn', 'error'].includes(level) ? level : 'info';
      const list = [];
      if (who) list.push({ name: 'User', value: cut(who, 200), inline: true });
      if (fields && typeof fields === 'object') {
        for (const k of Object.keys(fields).slice(0, 10)) list.push({ name: cut(k, 200) || '—', value: cut(typeof fields[k] === 'object' ? JSON.stringify(fields[k]) : fields[k], 1000) || '—', inline: true });
      }
      enqueue({ title: level.toUpperCase(), description: cut(message, 3000) || '(empty)', color: COLORS[level], fields: list.length ? list : undefined, timestamp: new Date().toISOString() });
    },
    flush() { return new Promise(resolve => { const iv = setInterval(() => { if (!queue.length && !sending) { clearInterval(iv); resolve(); } }, 20); }); },
    get dropped() { return dropped; }
  };
}

module.exports = { createDiscordLogger, HOST_OK };
