// ═══════════════════════════════════════════════════════════════
//  Seal — backend
//  Real accounts, a banner that's stored on the server (so it's
//  the same for every visitor), and a game/tool library that can
//  be edited from the admin panel OR by hand-editing data/db.json.
// ═══════════════════════════════════════════════════════════════
// Mirror mode: with PROXY_TO set, this process is just a forwarder to your main
// site (see proxy.js) — it loads no database and writes no files.
if (process.env.PROXY_TO) { require('./proxy'); return; }

const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const { MongoClient, GridFSBucket } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const os = require('os');
const market = require('./market');

// DATA_DIR lets you point storage at a mounted persistent disk (Render,
// Fly, a VPS volume, etc.) instead of the app folder, so your data
// survives redeploys. Defaults to ./data for plain local/VPS use.
// If the data folder can't be created or written to (a broken volume mount,
// wrong permissions…), the server used to crash on boot with only a bare
// "ENOENT"/"EACCES". Now it prints what it found (who it's running as, what the
// folder looks like, what's mounted there) and falls back to a temp folder so
// the site still comes up. That folder is usually wiped on restart — the
// warning says so — which is why the real fix is still a writable DATA_DIR.
let DATA_DIR_FALLBACK = null; // set to { from, to, error } when the fallback is in use

function describePath(p) {
  try {
    const st = fs.lstatSync(p);
    let kind = st.isSymbolicLink() ? 'symlink' : st.isDirectory() ? 'directory' : st.isFile() ? 'file' : 'other';
    if (st.isSymbolicLink()) {
      let target = '?';
      try { target = fs.readlinkSync(p); } catch {}
      kind += ' -> ' + target + (fs.existsSync(p) ? '' : ' (BROKEN LINK: target does not exist)');
    }
    return `${kind}, mode ${(st.mode & 0o777).toString(8)}, owner uid ${st.uid} gid ${st.gid}`;
  } catch (e) {
    return `does not exist (${e.code || e.message})`;
  }
}

// Creates everything the server stores under `dir` and proves it can write there.
// Returns null if all is well, or the Error that stopped it.
function checkDataDir(dir) {
  try {
    fs.mkdirSync(dir, { recursive: true });
    for (const sub of ['uploads', 'tmp', 'sessions']) fs.mkdirSync(path.join(dir, sub), { recursive: true });
    const probe = path.join(dir, '.write-test-' + process.pid);
    fs.writeFileSync(probe, 'ok');
    fs.unlinkSync(probe);
    return null;
  } catch (err) {
    return err;
  }
}

function printDataDirDiagnostics(dir, err) {
  const uid = typeof process.getuid === 'function' ? process.getuid() : 'n/a';
  const gid = typeof process.getgid === 'function' ? process.getgid() : 'n/a';
  const lines = [
    `error:        ${err.code || ''} ${err.message}`,
    `running as:   uid ${uid}, gid ${gid}`,
    `working dir:  ${process.cwd()}`,
    `DATA_DIR env: ${process.env.DATA_DIR ? process.env.DATA_DIR : '(not set — using ./data)'}`,
    `data folder:  ${dir}`,
    `  ${describePath(dir)}`,
    `  its parent: ${describePath(path.dirname(dir))}`
  ];
  for (const sub of ['uploads', 'tmp', 'sessions']) lines.push(`  ${sub}/: ${describePath(path.join(dir, sub))}`);
  try {
    const mounts = fs.readFileSync('/proc/mounts', 'utf8').split('\n').filter(l => {
      const mp = l.split(' ')[1];
      return mp && mp !== '/' && (dir === mp || dir.startsWith(mp + '/') || mp.startsWith(dir + '/'));
    });
    lines.push(mounts.length ? 'mounts touching this folder:' : 'mounts touching this folder: none');
    mounts.forEach(m => lines.push('  ' + m));
  } catch {}
  console.error(lines.map(l => '[seal] ' + l).join('\n'));
}

function resolveDataDir() {
  const wanted = process.env.DATA_DIR || path.join(__dirname, 'data');
  const err = checkDataDir(wanted);
  if (!err) return wanted;

  const fallback = path.join(os.tmpdir(), 'seal-data');
  console.error('\n[seal] ================================================================');
  console.error(`[seal] WARNING: cannot use the data folder "${wanted}".`);
  printDataDirDiagnostics(wanted, err);
  const err2 = checkDataDir(fallback);
  if (err2) {
    console.error(`[seal] The temp fallback "${fallback}" doesn't work either (${err2.code || err2.message}). Giving up.`);
    console.error('[seal] ================================================================\n');
    throw err; // the original problem is the useful one
  }
  // Keep the site's existing accounts/admins if the old folder is at least readable.
  for (const f of ['db.json', 'admins.json', 'tier4.json', 'overseer.json', 'session-secret.txt']) {
    try {
      const dest = path.join(fallback, f);
      if (!fs.existsSync(dest) && fs.existsSync(path.join(wanted, f))) fs.copyFileSync(path.join(wanted, f), dest);
    } catch {}
  }
  console.error(`[seal] Using "${fallback}" instead so the site can start.`);
  console.error('[seal] Everything saved there (accounts, uploads, logins) is usually WIPED when the');
  console.error('[seal] container restarts. To fix it properly, set DATA_DIR to a writable, persistent');
  console.error('[seal] folder, or repair the volume/mount shown above.');
  console.error('[seal] ================================================================\n');
  DATA_DIR_FALLBACK = { from: wanted, to: fallback, error: err.message };
  return fallback;
}

const DATA_DIR = resolveDataDir();
const DB_PATH = path.join(DATA_DIR, 'db.json');
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');
const TIER4_PATH = path.join(DATA_DIR, 'tier4.json');
const OVERSEER_PATH = path.join(DATA_DIR, 'overseer.json');
// ── uploaded-file storage (avatars, banners, rings, the file library) ──
// Same idea as the MongoDB switch above: on hosts without a persistent
// disk, uploaded files vanish on every restart just like the database
// would. Setting all five S3_* vars switches to an S3-compatible object
// store instead of local disk — Supabase Storage or Backblaze B2 both
// work (both have free tiers with no card required for basic storage;
// note some providers, including B2, may ask for a card specifically to
// make a bucket public, even though the account itself is free — check
// before committing to one). Leave these vars unset for local dev / a
// host with real persistent storage — the app then writes to
// public/uploads/ exactly as before.
//
// NOT covered by this: game/tool zip uploads (public/games, public/tools)
// stay on local disk. Those unpack into many-file static directory trees
// served directly by express.static, not single files — moving that to
// object storage would mean proxying every game asset request through
// this server instead, which is a bigger, riskier change than a small
// site's game library usually needs. Re-upload games/tools after a
// restart on hosts without persistent disk, or host this app somewhere
// with a real disk if that's too painful.
const { S3Client, PutObjectCommand, DeleteObjectCommand, ListObjectsV2Command } = require('@aws-sdk/client-s3');
const S3_ENDPOINT = process.env.S3_ENDPOINT || '';
const S3_REGION = process.env.S3_REGION || 'us-east-1';
const S3_BUCKET = process.env.S3_BUCKET || '';
const S3_ACCESS_KEY_ID = process.env.S3_ACCESS_KEY_ID || '';
const S3_SECRET_ACCESS_KEY = process.env.S3_SECRET_ACCESS_KEY || '';
// Copy this from your storage provider's dashboard — for Supabase it's
// https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>;
// for B2 it's the bucket's "Friendly URL", e.g.
// https://f002.backblazeb2.com/file/my-bucket-name
const S3_PUBLIC_URL_BASE = (process.env.S3_PUBLIC_URL_BASE || '').replace(/\/$/, '');
const USING_S3_STORAGE = !!(S3_ENDPOINT && S3_BUCKET && S3_ACCESS_KEY_ID && S3_SECRET_ACCESS_KEY && S3_PUBLIC_URL_BASE);
let s3Client = null;
if (USING_S3_STORAGE) {
  s3Client = new S3Client({
    endpoint: S3_ENDPOINT,
    region: S3_REGION,
    credentials: { accessKeyId: S3_ACCESS_KEY_ID, secretAccessKey: S3_SECRET_ACCESS_KEY },
    forcePathStyle: true
  });
}

// Stores a buffer and returns a URL usable directly (in <img src>, for a
// download link, whatever) — a B2 URL when configured, otherwise the
// same same-origin /uploads/... path this app has always used. Every
// avatar/banner/ring/file-library upload goes through this, so none of
// those routes need their own B2-vs-local branching.
async function storeUpload(buffer, subdir, filename, contentType, opts) {
  opts = opts || {};
  if (USING_S3_STORAGE) {
    const key = `${subdir}/${filename}`;
    const params = { Bucket: S3_BUCKET, Key: key, Body: buffer, ContentType: contentType };
    if (opts.downloadName) params.ContentDisposition = `attachment; filename="${opts.downloadName.replace(/"/g, '')}"`;
    await s3Client.send(new PutObjectCommand(params));
    return `${S3_PUBLIC_URL_BASE}/${key}`;
  }
  const dir = opts.localDir || path.join(__dirname, 'public', 'uploads', subdir);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, filename), buffer);
  return opts.localDir ? null : `/uploads/${subdir}/${filename}`;
}

// Deletes a previously-stored upload. Accepts either the bare filename
// (the local-disk case) or the full URL storeUpload() returned (the B2
// case) — callers don't need to know which mode is active.
async function deleteUpload(subdir, filenameOrUrl, opts) {
  opts = opts || {};
  if (!filenameOrUrl) return;
  const filename = filenameOrUrl.includes('/') ? filenameOrUrl.split('/').pop() : filenameOrUrl;
  if (USING_S3_STORAGE) {
    try { await s3Client.send(new DeleteObjectCommand({ Bucket: S3_BUCKET, Key: `${subdir}/${filename}` })); }
    catch (err) { console.error('Failed to delete from B2:', err.message); }
  } else {
    const dir = opts.localDir || path.join(__dirname, 'public', 'uploads', subdir);
    fs.unlink(path.join(dir, filename), () => {});
  }
}

const UPLOADS_DIR = path.join(DATA_DIR, 'uploads');
const SITE_TMP_DIR = path.join(DATA_DIR, 'tmp'); // scratch space for in-progress zip uploads
const SESSIONS_DIR = path.join(DATA_DIR, 'sessions'); // one file per logged-in session, so restarts don't log everyone out
const PORT = process.env.PORT || 3000;

// ── persistent storage mode ────────────────────────────────────
// On hosts without a persistent disk (Render's free tier is the common
// case), everything under DATA_DIR gets wiped on every restart — which
// happens automatically after ~15 idle minutes. Setting MONGODB_URI (a
// free MongoDB Atlas cluster works fine) switches the "database" over to
// Mongo instead, so it survives restarts. Leave it unset for local dev /
// any host that already gives you a real persistent disk — the app then
// behaves exactly as before, reading/writing data/db.json directly.
const MONGODB_URI = process.env.MONGODB_URI || '';
const MONGODB_DB_NAME = process.env.MONGODB_DB_NAME || 'sealsite';
const USING_MONGO = !!MONGODB_URI;
let mongoClient = null;
let mongoCollection = null;

// ADMIN_USERNAMES (comma-separated) is the equivalent fix for admins.json
// specifically — env vars set in your host's dashboard persist across
// restarts even without any database, so this is the simplest way to keep
// admin access stable on Render's free tier without needing Mongo just
// for a short, rarely-changed list. Falls back to the local file if unset.
const ADMIN_USERNAMES_ENV = process.env.ADMIN_USERNAMES || '';
// TIER4_USERNAMES (comma-separated) is the Tier 4 equivalent — Tier 4 is
// owner-granted only (env var or data/tier4.json), never in-app.
const TIER4_USERNAMES_ENV = process.env.TIER4_USERNAMES || '';
// Overseer is the owner-only tier above Tier 4 (OVERSEER_USERNAMES, comma-
// separated, or data/overseer.json). Never grantable in-app.
const OVERSEER_USERNAMES_ENV = process.env.OVERSEER_USERNAMES || '';

// These live under public/ (part of the app itself, not DATA_DIR) since
// they're served as static site content — same place games/tools already
// live, just now writable by admins through the upload endpoint below.
const PUBLIC_DIR = path.join(__dirname, 'public');
const GAMES_DIR = path.join(PUBLIC_DIR, '1');
const TOOLS_DIR = path.join(PUBLIC_DIR, 'tools');
const ICONS_DIR = path.join(PUBLIC_DIR, 'gameIcons');

// ── tiny file-backed "database" ───────────────────────────────
// Good enough for a small self-hosted site. Swap for real SQLite
// later if you outgrow it — every route below just calls readDB/writeDB.
function defaultDbShape() {
  return {
    users: {},
    banner: { active: false, text: '', type: 'info' },
    popup: { active: false, id: null, title: '', text: '' },
    games: [],
    tools: [],
    chat: [],
    files: [],
    audioSenders: [],
    ringUploaders: [],
    imageUploaders: [],
    suggestions: [],
    tier1Admins: [],
    tier2Users: [],
    escalations: [],
    tier3Admins: [],
    auditLog: [],
    polls: [],
    maintenance: { enabled: false, message: '', exemptTier4: false, startedBy: null, startedAt: null },
    chatRooms: [],
    friendRequests: [],
    customize: { background: null, elements: {} },
    rings: [],
    profileComments: []
  };
}
function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(SITE_TMP_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  for (const dir of [GAMES_DIR, TOOLS_DIR, ICONS_DIR]) {
    try { fs.mkdirSync(dir, { recursive: true }); }
    catch (err) { console.error(`[seal] Cannot create "${dir}" — the app folder isn't writable.`); printDataDirDiagnostics(dir, err); throw err; }
  }
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDbShape(), null, 2));
  }
  if (!fs.existsSync(ADMINS_PATH)) {
    fs.writeFileSync(ADMINS_PATH, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(TIER4_PATH)) {
    fs.writeFileSync(TIER4_PATH, JSON.stringify([], null, 2));
  }
  if (!fs.existsSync(OVERSEER_PATH)) {
    fs.writeFileSync(OVERSEER_PATH, JSON.stringify([], null, 2));
  }
}
ensureDataFiles();

// SESSION_SECRET should be set explicitly in production (it's what signs
// the session cookie), but if it isn't, generate one once and persist it
// to disk rather than picking a new random one on every boot — a fresh
// secret every restart would silently invalidate every cookie's signature
// even with a persistent session store, defeating the point of one.
function getSessionSecret() {
  if (process.env.SESSION_SECRET) return process.env.SESSION_SECRET;
  const secretPath = path.join(DATA_DIR, 'session-secret.txt');
  try {
    return fs.readFileSync(secretPath, 'utf8').trim();
  } catch {
    const secret = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(secretPath, secret, { mode: 0o600 });
    return secret;
  }
}

// ── Seals: the site currency, plus profile customization ──────────
// New accounts start with a small balance and the free cosmetic
// options already "owned". Existing accounts (created before this
// feature existed) get backfilled the same way the first time
// they're read, in ensureUserDefaults() below.
const STARTER_SEALS = 20;
const DAILY_SEALS = 10;
const DAILY_COOLDOWN_MS = 20 * 60 * 60 * 1000; // 20h, a little forgiving vs a strict 24h
const PLAY_PING_INTERVAL_S = 60;   // client is expected to ping about this often
const PLAY_SEAL_INTERVAL_S = 180;  // 1 Seal per 3 minutes of verified, focused play
const PLAY_MAX_GAP_S = PLAY_PING_INTERVAL_S * 1.5; // clamp any single gap to this many seconds
const PLAY_DAILY_CAP = 40; // Seals/day from playtime, separate from the daily-claim cap
const NOW_PLAYING_STALE_MS = PLAY_PING_INTERVAL_S * 1000 * 2.5; // generous vs the ping cadence so jitter doesn't flicker it off

const AVATAR_COLORS = [
  { id: 'teal',   label: 'Teal',   value: '#45d6c8', price: 0 },
  { id: 'coral',  label: 'Coral',  value: '#ff8a5c', price: 0 },
  { id: 'ice',    label: 'Ice',    value: '#7ce8dd', price: 40 },
  { id: 'gold',   label: 'Gold',   value: '#f2b33d', price: 60 },
  { id: 'sky',    label: 'Sky',    value: '#4fa7e0', price: 60 },
  { id: 'mint',   label: 'Mint',   value: '#2ecb71', price: 60 },
  { id: 'violet', label: 'Violet', value: '#a06cf2', price: 90 },
  { id: 'rose',   label: 'Rose',   value: '#f26ca0', price: 90 }
];
const BANNERS = [
  { id: 'banner-default', label: 'Midnight',     value: 'linear-gradient(135deg,#151b23,#1e2630)', price: 0 },
  { id: 'banner-teal',    label: 'Arctic Teal',  value: 'linear-gradient(135deg,#0e4d47,#45d6c8)', price: 80 },
  { id: 'banner-coral',   label: 'Warm Coral',   value: 'linear-gradient(135deg,#7a3a1f,#ff8a5c)', price: 80 },
  { id: 'banner-gold',    label: 'Golden Hour',  value: 'linear-gradient(135deg,#6b4f10,#f2b33d)', price: 120 },
  { id: 'banner-violet',  label: 'Violet Dusk',  value: 'linear-gradient(135deg,#3a2260,#a06cf2)', price: 120 },
  { id: 'banner-aurora',  label: 'Aurora',       value: 'linear-gradient(135deg,#0e4d47,#45d6c8 45%,#a06cf2)', price: 200 }
];
const TITLES = [
  { id: 'title-none',          label: 'No title',        value: null,               price: 0 },
  { id: 'title-seal-scout',    label: 'Seal Scout',      value: 'Seal Scout',       price: 30 },
  { id: 'title-icebreaker',    label: 'Icebreaker',      value: 'Icebreaker',       price: 50 },
  { id: 'title-arcade-regular',label: 'Arcade Regular',  value: 'Arcade Regular',   price: 75 },
  { id: 'title-og',            label: 'OG',              value: 'OG',               price: 150 },
  { id: 'title-high-roller',   label: 'High Roller',     value: 'High Roller',      price: 250 }
];
const FREE_INVENTORY = ['teal', 'banner-default', 'title-none', 'ring-none'];
const NO_RING = { id: 'ring-none', kind: 'ring', label: 'No Ring', price: 0, value: null };
// Rings are admin/permitted-user uploaded, so — unlike the other cosmetics —
// there's no fixed in-code catalog for them; they live in db.rings and are
// looked up alongside the fixed catalog wherever an item id needs resolving.
function findAnyShopItem(db, id) {
  if (id === NO_RING.id) return NO_RING;
  const fixed = shopItemById(id);
  if (fixed) return fixed;
  const ring = (db.rings || []).find(r => r.id === id);
  return ring ? { id: ring.id, kind: 'ring', label: ring.label, price: ring.price, value: ring.imageUrl, uploadedBy: ring.uploadedBy } : undefined;
}
// Rings are rendered as a CSS overlay scaled relative to the avatar's own
// size, not the uploaded image's pixel dimensions — so as long whoever
// draws a ring matches this ratio (see the downloadable template), it lines
// up correctly at every avatar size across the site automatically.
const RING_HOLE_RATIO = 0.72;
const CUSTOM_UNLOCK_PRICE = 300;
const CUSTOM_UNLOCKS = [
  { id: 'avatar-custom', kind: 'avatar', label: 'Custom Avatar',     price: CUSTOM_UNLOCK_PRICE, value: null, custom: true },
  { id: 'banner-custom', kind: 'banner', label: 'Custom Background', price: CUSTOM_UNLOCK_PRICE, value: null, custom: true },
  { id: 'title-custom',  kind: 'title',  label: 'Custom Title',      price: CUSTOM_UNLOCK_PRICE, value: null, custom: true }
];
const CUSTOM_TITLE_MAX_LEN = 24;

function allShopItems() {
  return [
    ...AVATAR_COLORS.map(a => ({ ...a, kind: 'avatar' })),
    ...BANNERS.map(b => ({ ...b, kind: 'banner' })),
    ...TITLES.map(t => ({ ...t, kind: 'title' })),
    ...CUSTOM_UNLOCKS
  ];
}
function shopItemById(id) { return allShopItems().find(i => i.id === id); }

// ── Badges — earned automatically, never purchasable ──────────────
const BADGES = [
  { id: 'badge-welcome',          label: 'Newcomer',         icon: '\u{1F331}', desc: 'Created a Seal account' },
  { id: 'badge-week-one',         label: 'Regular',          icon: '\u{1F4C5}', desc: 'Account is 7+ days old' },
  { id: 'badge-month-one',        label: 'Veteran',          icon: '\u{1F5D3}\uFE0F', desc: 'Account is 30+ days old' },
  { id: 'badge-first-purchase',   label: 'Shopper',          icon: '\u{1F6CD}\uFE0F', desc: 'Bought your first item from the Shop' },
  { id: 'badge-collector',        label: 'Collector',        icon: '\u{1F3A8}', desc: 'Own 5+ shop items' },
  { id: 'badge-custom-creator',   label: 'Custom Creator',   icon: '\u2728', desc: 'Unlocked all 3 custom slots' },
  { id: 'badge-dedicated-player', label: 'Dedicated Player', icon: '\u{1F3AE}', desc: 'Logged 30+ minutes of verified playtime' },
  { id: 'badge-chatterbox',       label: 'Chatterbox',       icon: '\u{1F4AC}', desc: 'Sent 25+ chat messages' },
  { id: 'badge-loyal',            label: 'Loyal',            icon: '\u{1F501}', desc: 'Claimed your daily Seals 5+ times' },
  { id: 'badge-staff',            label: 'Staff',            icon: '\u{1F6E1}\uFE0F', desc: 'Site admin' }
];
const MAX_FEATURED_BADGES = 3;
function badgeById(id) { return BADGES.find(b => b.id === id); }

// Runs every auto-award rule against a record and grants anything newly
// earned. Cheap, idempotent, and safe to call often — it's wired into
// every frequent user action (chat, shop, daily claim, playtime) rather
// than needing a cron job. Returns true if it changed anything.
const MAX_NOTIFICATIONS = 50;
// Newest-first, capped — used for badge awards, ring sales, profile
// comments, and anything else that should surface as a bell-icon ping.
function addNotification(record, text) {
  if (!Array.isArray(record.notifications)) record.notifications = [];
  record.notifications.unshift({ id: crypto.randomUUID(), text, createdAt: new Date().toISOString(), read: false });
  if (record.notifications.length > MAX_NOTIFICATIONS) record.notifications.length = MAX_NOTIFICATIONS;
}

function checkBadges(record) {
  const stats = record.stats;
  const ageMs = Date.now() - new Date(record.createdAt).getTime();
  const owned = new Set(record.inventory);
  let changed = false;
  const maybeAward = (id, condition) => {
    if (condition && !record.badges[id]) {
      record.badges[id] = new Date().toISOString();
      changed = true;
      const badge = badgeById(id);
      if (badge) addNotification(record, `You earned the \u201c${badge.label}\u201d ${badge.icon} badge!`);
    }
  };
  maybeAward('badge-welcome', true);
  maybeAward('badge-week-one', ageMs >= 7 * 24 * 60 * 60 * 1000);
  maybeAward('badge-month-one', ageMs >= 30 * 24 * 60 * 60 * 1000);
  maybeAward('badge-first-purchase', stats.totalPurchases >= 1);
  maybeAward('badge-collector', record.inventory.length >= 5);
  maybeAward('badge-custom-creator', ['avatar-custom', 'banner-custom', 'title-custom'].every(id => owned.has(id)));
  maybeAward('badge-dedicated-player', stats.lifetimePlaySeconds >= 30 * 60);
  maybeAward('badge-chatterbox', stats.chatMessageCount >= 25);
  maybeAward('badge-loyal', stats.totalDailyClaims >= 5);
  maybeAward('badge-staff', isAdmin(record.username));
  return changed;
}

// Where uploaded custom avatars/banners live — "subdir" names passed to
// storeUpload()/deleteUpload() above. Under public/uploads/ locally, or
// under these same names as B2 object-key prefixes when B2 is configured.
const CUSTOM_IMAGE_SUBDIRS = { avatar: 'avatars', banner: 'banners', ring: 'rings' };
const CUSTOM_IMAGE_EXT_BY_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
// Rings need real alpha transparency to look right as an overlay — a JPEG
// (no alpha channel) or a GIF (1-bit alpha at best) would show as a solid
// square/box around the avatar, so only true transparency formats qualify.
const RING_IMAGE_EXT_BY_MIME = { 'image/png': '.png', 'image/webp': '.webp' };
const MAX_CUSTOM_IMAGE_BYTES = 3 * 1024 * 1024; // 3MB

// In-memory, not disk — the file goes wherever storeUpload() sends it
// (B2 or local disk), so multer itself never needs to know which.
function customImageUploader() {
  return multer({
    storage: multer.memoryStorage(),
    limits: { fileSize: MAX_CUSTOM_IMAGE_BYTES },
    fileFilter: (req, file, cb) => {
      if (!CUSTOM_IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error('Please upload a PNG, JPG, GIF, or WEBP image.'));
      cb(null, true);
    }
  });
}
const avatarImageUpload = customImageUploader();
const bannerImageUpload = customImageUploader();

const ringImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CUSTOM_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!RING_IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error('Rings need transparency \u2014 please upload a PNG or WEBP.'));
    cb(null, true);
  }
});

// A file being a PNG/WEBP only proves the *format* supports transparency —
// plenty of editors flatten the canvas to a solid color on export anyway,
// which produces a perfectly valid PNG that just happens to be opaque
// where the avatar needs to show through. This checks actual pixel alpha
// in the center of the image (comfortably inside the RING_HOLE_RATIO
// circle) and rejects uploads that would cover the avatar instead of
// framing it, with an error that explains exactly what went wrong.
const RING_ALPHA_MAX_MEAN = 40; // 0-255; tolerant of soft edges/glow, not of a solid fill
async function validateRingTransparency(buffer) {
  const img = sharp(buffer);
  const meta = await img.metadata();
  if (!meta.hasAlpha) {
    return { ok: false, error: 'This image has no transparency channel at all \u2014 export it with a transparent background so the avatar can show through the center.' };
  }
  const cropFrac = 0.4; // inscribed comfortably inside the 72%-diameter hole
  const cropW = Math.max(1, Math.round(meta.width * cropFrac));
  const cropH = Math.max(1, Math.round(meta.height * cropFrac));
  const left = Math.round((meta.width - cropW) / 2);
  const top = Math.round((meta.height - cropH) / 2);
  const { channels } = await img.extract({ left, top, width: cropW, height: cropH }).stats();
  const alphaMean = channels[channels.length - 1].mean;
  if (alphaMean > RING_ALPHA_MAX_MEAN) {
    return { ok: false, error: 'The center of your ring isn\u2019t transparent enough, so it\u2019ll cover the avatar instead of framing it. Keep the area inside the template\u2019s dashed guide circle fully transparent, then re-upload.' };
  }
  return { ok: true };
}

// Best-effort cleanup — never blocks the response on a delete failure.
function deleteOldCustomImage(urlPath, kind) {
  if (!urlPath) return;
  deleteUpload(CUSTOM_IMAGE_SUBDIRS[kind], urlPath).catch(() => {});
}

// Backfills currency/profile fields onto a user record that predates
// this feature. Returns true if it changed anything, so readDB() knows
// whether to persist the backfill.
function ensureUserDefaults(record) {
  let changed = false;
  if (typeof record.seals !== 'number') { record.seals = STARTER_SEALS; changed = true; }
  if (!Array.isArray(record.inventory)) { record.inventory = [...FREE_INVENTORY]; changed = true; }
  if (!record.profile || typeof record.profile !== 'object') {
    record.profile = { avatar: 'teal', banner: 'banner-default', title: 'title-none', bio: '' };
    changed = true;
  }
  if (record.profile.customAvatarUrl === undefined) { record.profile.customAvatarUrl = null; changed = true; }
  if (record.profile.customBannerUrl === undefined) { record.profile.customBannerUrl = null; changed = true; }
  if (record.profile.customTitleText === undefined) { record.profile.customTitleText = ''; changed = true; }
  if (!record.profile.customAvatarPosition) { record.profile.customAvatarPosition = { ...DEFAULT_POSITION }; changed = true; }
  if (!record.profile.customBannerPosition) { record.profile.customBannerPosition = { ...DEFAULT_POSITION }; changed = true; }
  if (record.profile.ring === undefined) { record.profile.ring = 'ring-none'; changed = true; }
  if (record.lastDailyClaim === undefined) { record.lastDailyClaim = null; changed = true; }
  if (!record.playtime || typeof record.playtime !== 'object') {
    record.playtime = { date: null, accumSeconds: 0, sealsToday: 0, lastTick: null };
    changed = true;
  }
  // Rewards claimed through the Seal SDK (Seal.reward()) — keyed by
  // gameId, then by the game's own reward key, so the same milestone
  // (e.g. "level-3-complete") can only ever pay out once per game per
  // player. See POST /api/rewards/grant.
  if (!record.claimedRewards || typeof record.claimedRewards !== 'object') {
    record.claimedRewards = {};
    changed = true;
  }
  if (!record.stats || typeof record.stats !== 'object') {
    record.stats = { totalDailyClaims: 0, chatMessageCount: 0, lifetimePlaySeconds: 0, totalPurchases: 0 };
    changed = true;
  }
  if (!record.badges || typeof record.badges !== 'object') { record.badges = {}; changed = true; }
  if (!record.portfolio || typeof record.portfolio !== 'object') { record.portfolio = {}; changed = true; }
  if (!Array.isArray(record.notifications)) { record.notifications = []; changed = true; }
  if (record.nowPlaying === undefined) { record.nowPlaying = null; changed = true; }
  if (record.cookieSync === undefined) { record.cookieSync = null; changed = true; }
  if (record.storageSync === undefined) { record.storageSync = null; changed = true; }
  if (!Array.isArray(record.profile.featuredBadges)) { record.profile.featuredBadges = []; changed = true; }
  // Moderation / user-management fields (Tier 3's User Management panel)
  if (typeof record.sessionVersion !== 'number') { record.sessionVersion = 0; changed = true; }
  if (typeof record.banned !== 'boolean') { record.banned = false; changed = true; }
  if (record.banReason === undefined) { record.banReason = ''; changed = true; }
  if (typeof record.muted !== 'boolean') { record.muted = false; changed = true; }
  if (record.muteReason === undefined) { record.muteReason = ''; changed = true; }
  if (record.suspendedUntil === undefined) { record.suspendedUntil = null; changed = true; }
  if (typeof record.jailed !== 'boolean') { record.jailed = false; changed = true; }
  if (record.jailReason === undefined) { record.jailReason = ''; changed = true; }
  if (checkBadges(record)) changed = true;
  return changed;
}

// The public-safe view of a user record — used for profile pages and
// the leaderboard. Never includes passwordHash.
const DEFAULT_POSITION = { x: 50, y: 50 };
function clampPosition(pos) {
  const num = (v, fallback) => {
    const n = Number(v);
    return Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : fallback;
  };
  return { x: num(pos && pos.x, DEFAULT_POSITION.x), y: num(pos && pos.y, DEFAULT_POSITION.y) };
}

function publicProfile(record, db) {
  const p = record.profile;
  const avatarItem = shopItemById(p.avatar) || AVATAR_COLORS[0];
  const bannerItem = shopItemById(p.banner) || BANNERS[0];
  const titleItem = shopItemById(p.title);

  // "Custom" slots store their real content in customAvatarUrl / etc,
  // separately from the equipped shop-item id — this way switching back
  // to a preset (or buying a new custom slot later) never loses the
  // upload/text that was already made.
  const avatarImage = (p.avatar === 'avatar-custom' && p.customAvatarUrl) ? p.customAvatarUrl : null;
  const bannerImage = (p.banner === 'banner-custom' && p.customBannerUrl) ? p.customBannerUrl : null;
  const title = (p.title === 'title-custom') ? (p.customTitleText || null) : (titleItem ? titleItem.value : null);
  const ringItem = (db && p.ring && p.ring !== 'ring-none') ? findAnyShopItem(db, p.ring) : null;
  const ringImage = ringItem ? ringItem.value : null;

  const badges = Object.keys(record.badges || {})
    .map(id => { const b = badgeById(id); return b ? { ...b, earnedAt: record.badges[id] } : null; })
    .filter(Boolean)
    .sort((a, b) => new Date(a.earnedAt) - new Date(b.earnedAt));
  const featuredBadges = (p.featuredBadges || [])
    .filter(id => record.badges && record.badges[id])
    .map(badgeById)
    .filter(Boolean);

  // "Now Playing" goes stale on its own if pings stop (tab closed, browser
  // crashed, whatever) rather than needing an explicit "I stopped" signal
  // to always be trusted — though play.html does send one via sendBeacon
  // on unload for a snappier UI in the common case.
  const nowPlaying = (record.nowPlaying && (Date.now() - new Date(record.nowPlaying.lastPing).getTime()) < NOW_PLAYING_STALE_MS)
    ? { gameId: record.nowPlaying.gameId, gameName: record.nowPlaying.gameName }
    : null;

  return {
    username: record.username,
    createdAt: record.createdAt,
    isAdmin: isAdmin(record.username),
    isTier3: isTier3(record.username),
    isTier4: isTier4(record.username),
    isOverseer: isOverseer(record.username),
    isTier1: isTier1(record.username),
    isTier2: isTier2(record.username),
    seals: record.seals,
    holdingsValue: db ? market.holdingsValue(db, record) : 0,
    netWorth: db ? market.netWorth(db, record) : record.seals,
    bio: p.bio || '',
    avatarColor: avatarItem.value,
    avatarImage,
    avatarPosition: clampPosition(p.customAvatarPosition),
    bannerValue: bannerItem.value,
    bannerImage,
    bannerPosition: clampPosition(p.customBannerPosition),
    title,
    ringImage,
    nowPlaying,
    inventory: record.inventory,
    badges,
    featuredBadges
  };
}

// ── persistent "database" — an in-memory cache backed by either
// MongoDB or the local file, so every route below keeps calling the
// exact same synchronous readDB()/writeDB() it always has. The actual
// network round-trip to Mongo happens in the background after writeDB()
// returns, so route handlers don't need to change at all.
let CACHED_DB = null;
let CACHED_ADMINS = null;
let CACHED_TIER4 = null;
let CACHED_OVERSEER = null;
let mongoWriteQueued = false;
let mongoWriteInFlight = null;

function readDB() {
  const db = CACHED_DB;
  let changed = false;
  if (!Array.isArray(db.ringUploaders)) { db.ringUploaders = []; changed = true; }
  if (!Array.isArray(db.imageUploaders)) { db.imageUploaders = []; changed = true; }
  if (!Array.isArray(db.suggestions)) { db.suggestions = []; changed = true; }
  if (!Array.isArray(db.tier1Admins)) { db.tier1Admins = []; changed = true; }
  if (!Array.isArray(db.tier2Users)) { db.tier2Users = []; changed = true; }
  if (!Array.isArray(db.escalations)) { db.escalations = []; changed = true; }
  if (!Array.isArray(db.tier3Admins)) { db.tier3Admins = []; changed = true; }
  if (!Array.isArray(db.auditLog)) { db.auditLog = []; changed = true; }
  if (!Array.isArray(db.polls)) { db.polls = []; changed = true; }
  if (!db.gameStats || typeof db.gameStats !== 'object' || Array.isArray(db.gameStats)) { db.gameStats = {}; changed = true; }
  if (!db.maintenance || typeof db.maintenance !== 'object') { db.maintenance = { enabled: false, message: '', exemptTier4: false, startedBy: null, startedAt: null }; changed = true; }
  if (!Array.isArray(db.chatRooms)) { db.chatRooms = []; changed = true; }
  if (!db.chatRooms.some(r => r.id === 'general')) {
    // Every install needs at least the one default room that can't be
    // deleted — this also covers first migration from the old
    // single-room chat, and Chat's very first ever run.
    db.chatRooms.unshift({ id: 'general', name: 'General', createdBy: null, createdAt: new Date().toISOString() });
    changed = true;
  }
  if (!Array.isArray(db.friendRequests)) { db.friendRequests = []; changed = true; }
  if (Array.isArray(db.chat)) {
    // Messages from before multi-room chat existed have no roomId —
    // they all belonged to what is now "General".
    for (const m of db.chat) {
      if (!m.roomId) { m.roomId = 'general'; changed = true; }
    }
  }
  if (!db.customize || typeof db.customize !== 'object') { db.customize = { background: null, elements: {} }; changed = true; }
  if (!db.customize.elements || typeof db.customize.elements !== 'object') { db.customize.elements = {}; changed = true; }
  if (!Array.isArray(db.rings)) { db.rings = []; changed = true; }
  if (!Array.isArray(db.profileComments)) { db.profileComments = []; changed = true; }
  if (market.ensureMarket(db)) changed = true;
  // One-time migration for installs from before the games folder was
  // renamed from public/games/ to public/1/ — old entries still point
  // at the "games/" prefix and would 404 without this.
  for (const g of db.games || []) {
    if (typeof g.url === 'string' && g.url.startsWith('games/')) {
      g.url = '1/' + g.url.slice('games/'.length);
      changed = true;
    }
  }
  for (const key of Object.keys(db.users || {})) {
    if (ensureUserDefaults(db.users[key])) changed = true;
  }
  if (changed) writeDB(db);
  return db;
}

function writeDB(db) {
  CACHED_DB = db;
  if (!USING_MONGO) {
    fs.writeFileSync(DB_PATH, JSON.stringify(db, null, 2));
    return;
  }
  // Fire-and-forget, but coalesce a burst of writeDB() calls within the
  // same tick (or while a previous write is still in flight) into a
  // single network write rather than one per call — most routes here
  // call writeDB() once per small mutation.
  if (mongoWriteQueued) return;
  mongoWriteQueued = true;
  const run = async () => {
    mongoWriteQueued = false;
    try {
      await mongoCollection.updateOne({ _id: 'db' }, { $set: { data: CACHED_DB } }, { upsert: true });
    } catch (err) {
      console.error('Failed to persist to MongoDB:', err.message);
    }
  };
  mongoWriteInFlight = (mongoWriteInFlight || Promise.resolve()).then(run);
}

function readAdmins() {
  return CACHED_ADMINS || [];
}

// Loads the initial in-memory state before the server starts accepting
// requests — from Mongo if configured, otherwise from the local files
// exactly as before. Must finish before app.listen() below.
async function initStorage() {
  if (USING_MONGO) {
    mongoClient = new MongoClient(MONGODB_URI);
    await mongoClient.connect();
    mongoCollection = mongoClient.db(MONGODB_DB_NAME).collection('state');

    const doc = await mongoCollection.findOne({ _id: 'db' });
    if (doc) {
      CACHED_DB = doc.data;
    } else {
      // First-ever boot against this cluster — seed it from the local
      // file (covers migrating an existing site) or the same defaults
      // ensureDataFiles() would otherwise write.
      CACHED_DB = fs.existsSync(DB_PATH) ? JSON.parse(fs.readFileSync(DB_PATH, 'utf8')) : defaultDbShape();
      await mongoCollection.updateOne({ _id: 'db' }, { $set: { data: CACHED_DB } }, { upsert: true });
    }
    console.log('Connected to MongoDB \u2014 data will persist across restarts.');
  } else {
    CACHED_DB = JSON.parse(fs.readFileSync(DB_PATH, 'utf8'));
    console.log('MONGODB_URI not set \u2014 using data/db.json directly. On hosts without a persistent disk (e.g. Render\u2019s free tier), this resets on every restart. Set MONGODB_URI to fix that.');
  }

  CACHED_ADMINS = ADMIN_USERNAMES_ENV
    ? ADMIN_USERNAMES_ENV.split(',').map(s => s.trim()).filter(Boolean)
    : JSON.parse(fs.readFileSync(ADMINS_PATH, 'utf8'));
  CACHED_TIER4 = TIER4_USERNAMES_ENV
    ? TIER4_USERNAMES_ENV.split(',').map(s => s.trim()).filter(Boolean)
    : JSON.parse(fs.readFileSync(TIER4_PATH, 'utf8'));
  if (!CACHED_TIER4.length) {
    console.warn('WARNING: no Tier 4 admins configured (TIER4_USERNAMES / data/tier4.json). Nobody will be able to ban or suspend until one is set.');
  }
  CACHED_OVERSEER = OVERSEER_USERNAMES_ENV
    ? OVERSEER_USERNAMES_ENV.split(',').map(s => s.trim()).filter(Boolean)
    : JSON.parse(fs.readFileSync(OVERSEER_PATH, 'utf8'));
  if (!CACHED_OVERSEER.length) {
    console.warn('No Overseer configured (OVERSEER_USERNAMES / data/overseer.json) \u2014 maintenance mode and site polls are unavailable.');
  }
}

// Ensures the last write actually lands before the process exits — the
// in-memory cache updates instantly, but the Mongo write happens shortly
// after in the background, so a restart landing in that gap would
// otherwise lose whatever changed in the last few hundred ms.
async function flushPendingWrites() {
  if (mongoWriteInFlight) { try { await mongoWriteInFlight; } catch {} }
  if (mongoClient) { try { await mongoClient.close(); } catch {} }
}
for (const sig of ['SIGTERM', 'SIGINT']) {
  process.on(sig, async () => {
    await flushPendingWrites();
    process.exit(0);
  });
}
// ── admin tiers ─────────────────────────────────────────────────
// Tier 3 ("owner-granted") is the original admin mechanism — it can only
// be changed by editing ADMIN_USERNAMES (or data/admins.json without that
// env var set), i.e. by whoever controls the deployment. Tier 3 admins
// get everything Tier 1 gets, plus the ability to grant/revoke Tier 1
// themselves and hand out Seals — see requireTier3 below.
//
// Tier 1 is granted entirely in-app by Tier 3 admins (db.tier1Admins,
// same pattern as audioSenders/ringUploaders) — there's deliberately no
// environment variable for it, so it never requires a redeploy.
//
// isAdmin() stays the general "has some admin tier" check so every
// existing call site (the crown, the Staff badge, requireAdmin-gated
// routes, comment-deletion rights, etc.) keeps working for both tiers
// without having to touch each one individually.
// Tier 4 sits above Tier 3 and is owner-granted the same way (TIER4_USERNAMES
// or data/tier4.json). It's the only tier that can ban accounts, and the
// only one that can suspend Tier 3 admins. Tier 3 users escalate instead
// (see /api/admin/users/:username/escalate).
// Overseer sits above Tier 4: the site owner(s). It's the only tier that can
// ban/suspend Tier 4 admins, create site-wide polls, and lock everyone else
// out for maintenance. Overseer is a superset of Tier 4 (and so of Tier 3),
// so every existing gate keeps working for them.
function isOverseer(username) {
  if (!username) return false;
  return (CACHED_OVERSEER || []).some(a => a.toLowerCase() === username.toLowerCase());
}
function isTier4(username) {
  if (!username) return false;
  if (isOverseer(username)) return true;
  return (CACHED_TIER4 || []).some(a => a.toLowerCase() === username.toLowerCase());
}
// Tier 4 is a superset of Tier 3, so isTier3() is true for Tier 4 accounts
// too — every existing Tier 3 gate (panel, customize, grants, etc.) keeps
// working for them. Use isTier4() where the distinction matters.
function isTier3(username) {
  if (!username) return false;
  if (isTier4(username)) return true;
  const lower = username.toLowerCase();
  if (readAdmins().some(a => a.toLowerCase() === lower)) return true;
  // Tier 3 can also be granted in-app by a Tier 4 (db.tier3Admins). Read the
  // cache directly, not readDB(), for the same recursion-safety reason as
  // isTier1() below.
  const db = CACHED_DB;
  return !!db && (db.tier3Admins || []).some(u => u.toLowerCase() === lower);
}
function isTier1(username) {
  if (!username) return false;
  // Must NOT call readDB() here — isAdmin() (which calls this) is itself
  // invoked from inside readDB()'s own migration pass (checkBadges awards
  // the Staff badge via isAdmin), so re-entering readDB() here would
  // recurse forever. Read the already-loaded cache directly instead —
  // by the time any request handler can reach this, initStorage() has
  // already populated it.
  const db = CACHED_DB;
  if (!db) return false;
  return (db.tier1Admins || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

// Tier 2 is purely cosmetic (a yellow name) — it carries no permissions
// and isAdmin() deliberately does NOT include it. It's unlocked by
// entering a password in a box inside the Admin Panel (so only people
// who already have some admin access can even see the box), not granted
// by anyone. Same CACHED_DB-direct read as isTier1, for the same
// recursion-safety reason.
// Set via the TIER2_PASSWORD env var. There's deliberately no default: a
// hard-coded password in a public repo isn't a secret. Unset = the unlock
// is disabled.
const TIER2_PASSWORD = process.env.TIER2_PASSWORD || '';
if (!TIER2_PASSWORD) console.warn('TIER2_PASSWORD is not set \u2014 the Tier 2 unlock is disabled.');
function safeEqual(a, b) {
  const ha = crypto.createHash('sha256').update(String(a)).digest();
  const hb = crypto.createHash('sha256').update(String(b)).digest();
  return crypto.timingSafeEqual(ha, hb);
}
function isTier2(username) {
  if (!username) return false;
  const db = CACHED_DB;
  if (!db) return false;
  return (db.tier2Users || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

// Returns a human-readable reason the account can't be used right now
// (banned / temporarily suspended), or null if it's fine. Shared by
// login, /api/session, and requireLogin so all three agree.
function accountBlockReason(record) {
  if (!record) return null;
  if (record.banned) {
    return record.banReason ? `This account was banned: ${record.banReason}` : 'This account has been banned.';
  }
  if (record.suspendedUntil && Date.now() < new Date(record.suspendedUntil).getTime()) {
    const until = new Date(record.suspendedUntil).toLocaleString();
    return record.banReason
      ? `This account is suspended until ${until}: ${record.banReason}`
      : `This account is suspended until ${until}.`;
  }
  return null;
}
function isMuted(record) {
  return !!(record && record.muted);
}
function isAdmin(username) {
  return isTier3(username) || isTier1(username);
}

// Sending a sound to someone is admin-only by default; admins can grant
// individual users access without making them full admins. The granted
// list lives in db.json (db.audioSenders) so it's manageable from the
// Admin Panel, unlike admins.json which is a file edit.
function canSendAudio(username) {
  if (!username) return false;
  if (isAdmin(username)) return true;
  const db = readDB();
  return (db.audioSenders || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

// Same pattern as canSendAudio — admins can grant specific users permission
// to publish Rings to the Shop without making them full admins.
function canUploadRings(username) {
  if (!username) return false;
  if (isAdmin(username)) return true;
  const db = readDB();
  return (db.ringUploaders || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

// "Image Perms" tier: lets a user post images/GIFs in chat. Admins can grant
// it to anyone (Admin Panel → Image Perms). It is deliberately a separate
// list and is NOT checked by isAdmin()/requireAdmin(), so holding it gives
// no access to the Admin Panel or any admin route. Admins can always post
// images themselves.
function canPostImages(username) {
  if (!username) return false;
  if (isAdmin(username)) return true;
  const db = readDB();
  return (db.imageUploaders || []).map(u => u.toLowerCase()).includes(username.toLowerCase());
}

// ── audit log ───────────────────────────────────────────────────
// Every moderation / permission action is appended here (Tier 4 can read
// it). Capped so db.json can't grow without bound. Call BEFORE writeDB().
const AUDIT_LOG_MAX = 3000;
function audit(db, actor, action, target, detail) {
  if (!Array.isArray(db.auditLog)) db.auditLog = [];
  db.auditLog.push({
    id: crypto.randomBytes(6).toString('hex'),
    at: new Date().toISOString(),
    actor: actor || null,
    action,
    target: target || null,
    detail: String(detail || '').slice(0, 300)
  });
  if (db.auditLog.length > AUDIT_LOG_MAX) db.auditLog.splice(0, db.auditLog.length - AUDIT_LOG_MAX);
}

// ── brute-force protection ──────────────────────────────────────
// In-memory (resets on restart, which is fine for this). Failed attempts
// inside the window count toward a temporary lockout. Thresholds are
// deliberately generous on the per-IP side because a school/office NAT can
// put many real users behind one address; override with the env vars.
function makeFailLimiter({ max, windowMs, lockMs }) {
  const map = new Map();
  setInterval(() => {
    const now = Date.now();
    for (const [k, v] of map) {
      v.fails = v.fails.filter(t => now - t < windowMs);
      if (!v.fails.length && now >= v.lockedUntil) map.delete(k);
    }
  }, 5 * 60 * 1000).unref();
  return {
    retryAfterMs(key) {
      const v = map.get(key);
      if (!v) return 0;
      const left = v.lockedUntil - Date.now();
      return left > 0 ? left : 0;
    },
    fail(key) {
      const now = Date.now();
      let v = map.get(key);
      if (!v) { v = { fails: [], lockedUntil: 0 }; map.set(key, v); }
      v.fails = v.fails.filter(t => now - t < windowMs);
      v.fails.push(now);
      if (v.fails.length >= max) { v.lockedUntil = now + lockMs; v.fails = []; }
    },
    reset(key) { map.delete(key); }
  };
}
const FIFTEEN_MIN = 15 * 60 * 1000;
const loginAccountLimiter = makeFailLimiter({ max: Number(process.env.LOGIN_FAIL_MAX_PER_ACCOUNT) || 8,  windowMs: FIFTEEN_MIN, lockMs: FIFTEEN_MIN });
const loginIpLimiter      = makeFailLimiter({ max: Number(process.env.LOGIN_FAIL_MAX_PER_IP) || 50,       windowMs: FIFTEEN_MIN, lockMs: FIFTEEN_MIN });
const tier2Limiter        = makeFailLimiter({ max: 5, windowMs: FIFTEEN_MIN, lockMs: FIFTEEN_MIN });
function tooManyAttempts(res, ms) {
  const mins = Math.ceil(ms / 60000);
  res.set('Retry-After', String(Math.ceil(ms / 1000)));
  return res.status(429).json({ error: `Too many failed attempts. Try again in ${mins} minute${mins === 1 ? '' : 's'}.` });
}

const app = express();
app.set('trust proxy', 1); // Render (and most hosts) sit behind a proxy — needed for secure cookies to work
app.use(express.json({ limit: '5mb' }));
app.use(session({
  store: new FileStore({
    path: SESSIONS_DIR,
    ttl: 60 * 60 * 24 * 30, // matches the cookie's 30-day maxAge below
    logFn: () => {} // the default logs every read/write to the console — too noisy
  }),
  secret: getSessionSecret(),
  resave: false,
  saveUninitialized: false,
  cookie: {
    maxAge: 1000 * 60 * 60 * 24 * 30, // 30 days
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production'
  }
}));

// ── maintenance lockout ────────────────────────────────────────
// An Overseer can lock everyone else out. This runs before every route and
// before the static files. Overseers always get through (they need to be
// able to switch it off); Tier 4 can optionally be let in too. Login stays
// open so staff can sign in from the maintenance page itself.
const MAINTENANCE_PAGE_PATH = path.join(__dirname, 'pages', 'maintenance.html');
let MAINTENANCE_PAGE_HTML = null;
function escapeHtmlServer(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
function maintenanceActive(db) {
  const m = db && db.maintenance;
  if (!m || !m.enabled) return false;
  if (process.env.DISABLE_MAINTENANCE === '1') return false; // owner's escape hatch (set the env var, redeploy)
  return (CACHED_OVERSEER || []).length > 0;                  // with no Overseer, nobody could ever switch it off
}
function maintenanceExempt(db, username) {
  if (!username) return false;
  return isOverseer(username) || (!!db.maintenance.exemptTier4 && isTier4(username));
}
app.use((req, res, next) => {
  const db = readDB();
  if (!maintenanceActive(db)) return next();
  if (maintenanceExempt(db, req.session && req.session.user)) return next();
  const p = req.path;
  if (req.method === 'POST' && (p === '/api/login' || p === '/api/logout')) return next();
  if (req.method === 'GET' && p === '/api/maintenance') return next();
  const message = db.maintenance.message || 'The site is down for maintenance. Please check back soon.';
  res.set('Retry-After', '300');
  if (p.startsWith('/api/')) return res.status(503).json({ error: message, maintenance: true });
  if (MAINTENANCE_PAGE_HTML === null) {
    try { MAINTENANCE_PAGE_HTML = fs.readFileSync(MAINTENANCE_PAGE_PATH, 'utf8'); }
    catch { MAINTENANCE_PAGE_HTML = '<h1>Down for maintenance</h1><p>{{MESSAGE}}</p>'; }
  }
  res.status(503).type('html').send(MAINTENANCE_PAGE_HTML.replace('{{MESSAGE}}', () => escapeHtmlServer(message)));
});

// ── jail ───────────────────────────────────────────────────────
// A Tier 4 admin can "jail" an account. A jailed user can still sign in, but
// every page they request is replaced with pages/jail.html (nothing but a
// picture of a seal) and every API call is refused, so there is nothing else
// for them to see or do until a Tier 4 releases them. Runs before the routes
// and the static files, like the maintenance lockout above.
const JAIL_PAGE_PATH = path.join(__dirname, 'pages', 'jail.html');
let JAIL_PAGE_HTML = null;
function isJailed(record) { return !!(record && record.jailed); }
// Only the sign-in/out calls, the session check (the jail page polls it to
// know when to reload) and the one image the jail page shows get through.
const JAIL_ALLOWED = new Set(['POST /api/login', 'POST /api/logout', 'GET /api/session', 'GET /images/seal.png', 'HEAD /images/seal.png']);
app.use((req, res, next) => {
  const username = req.session && req.session.user;
  if (!username) return next();
  const db = readDB();
  const record = db.users[username.toLowerCase()];
  if (!isJailed(record)) return next();
  // A signed-out (banned / force-logged-out) session isn't a jailed one.
  const sessVer = typeof req.session.sessionVersion === 'number' ? req.session.sessionVersion : 0;
  if (accountBlockReason(record) || sessVer !== record.sessionVersion) return next();
  if (JAIL_ALLOWED.has(`${req.method} ${req.path}`)) return next();
  res.set('Cache-Control', 'no-store');
  if (req.path.startsWith('/api/')) return res.status(403).json({ error: 'Jailed.', jailed: true });
  if (req.method !== 'GET' && req.method !== 'HEAD') return res.status(403).end();
  if (JAIL_PAGE_HTML === null) {
    try { JAIL_PAGE_HTML = fs.readFileSync(JAIL_PAGE_PATH, 'utf8'); }
    catch { JAIL_PAGE_HTML = '<!DOCTYPE html><title>Seal</title><img src="/images/seal.png" alt="">'; }
  }
  res.status(200).type('html').send(JAIL_PAGE_HTML);
});

// ── live banner updates (Server-Sent Events) ──────────────────
// Every connected tab keeps one open GET request; when an admin
// publishes/clears the banner we push the new value down each of
// these instead of making clients poll or refresh.
const bannerClients = new Set();
function broadcastBanner(banner) {
  const payload = `data: ${JSON.stringify(banner)}\n\n`;
  for (const res of bannerClients) res.write(payload);
}

// Same pattern for chat, but scoped per room: each open connection
// subscribes to exactly one room id, and a message is only ever written
// to the connections subscribed to ITS room. That's what keeps a DM
// between two people from reaching anyone else's open stream — there is
// no global "everyone" set anymore.
const chatClients = new Map(); // roomId -> Set<res>
function broadcastChat(roomId, event, payload) {
  const subscribers = chatClients.get(roomId);
  if (!subscribers) return;
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of subscribers) res.write(line);
}
const lastMessageAt = new Map(); // username -> timestamp, simple per-user rate limit

// ── chat rooms + DMs + friends (helpers) ──────────────────────────
// A DM "room" has no row in db.chatRooms — its id is derived from the
// two participants (sorted, lowercased) so there's exactly one thread
// per pair no matter who opens it first.
function dmRoomId(a, b) {
  return 'dm:' + [String(a).toLowerCase(), String(b).toLowerCase()].sort().join(':');
}
function isDmRoom(roomId) {
  return typeof roomId === 'string' && roomId.startsWith('dm:');
}
function dmParticipants(roomId) {
  return roomId.slice(3).split(':');
}
function friendshipBetween(db, a, b) {
  const x = String(a).toLowerCase(), y = String(b).toLowerCase();
  return (db.friendRequests || []).find(r => {
    const f = r.from.toLowerCase(), t = r.to.toLowerCase();
    return (f === x && t === y) || (f === y && t === x);
  }) || null;
}
function areFriends(db, a, b) {
  const rel = friendshipBetween(db, a, b);
  return !!(rel && rel.status === 'accepted');
}

// Update popups work like the banner (server-stored, pushed live) but
// render as a dismissible modal. Each publish gets a fresh id, so a new
// update reaches everyone again even if they dismissed a previous one.
const popupClients = new Set();
function broadcastPopup(popup) {
  const payload = `data: ${JSON.stringify(popup)}\n\n`;
  for (const res of popupClients) res.write(payload);
}

// Seal Customize — a Tier 3-only site-wide WYSIWYG layer (drag elements,
// set a background). Same broadcast-to-everyone pattern as the banner, so
// a change shows up for every open tab live, not just on next page load.
const customizeClients = new Set();
function broadcastCustomize(customize) {
  const payload = `data: ${JSON.stringify(customize)}\n\n`;
  for (const res of customizeClients) res.write(payload);
}

// Unlike the broadcast-to-everyone streams above, this one is
// per-user: it's how "someone sent you a sound" reaches the one
// person it's addressed to. The same connection also doubles as a
// presence list — a username only counts as "online" while it has
// at least one of these open.
const notifyClients = new Map(); // username -> Set of open res objects
function sendToUser(username, event, payload) {
  const targets = notifyClients.get(username);
  if (!targets || targets.size === 0) return false;
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of targets) res.write(line);
  return true;
}
// Push an event to everyone who currently has the site open.
function notifyAllOnline(event, payload) {
  for (const username of [...notifyClients.keys()]) sendToUser(username, event, payload);
}
// Push an event to every Tier 4 who currently has the site open.
function notifyOnlineTier4(event, payload) {
  for (const username of [...notifyClients.keys()]) {
    if (isTier4(username)) sendToUser(username, event, payload);
  }
}

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in.' });
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  if (!record) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'Not signed in.' });
  }
  const blockReason = accountBlockReason(record);
  if (blockReason) {
    req.session.destroy(() => {});
    return res.status(403).json({ error: blockReason });
  }
  // A Tier 3 admin bumping record.sessionVersion (the "Force sign out"
  // button) invalidates every session that was issued before the bump,
  // without needing to touch the session store directly. Sessions from
  // before this feature existed have no sessionVersion at all — treat
  // that as 0 so upgrading the site doesn't sign everyone out.
  const sessVer = typeof req.session.sessionVersion === 'number' ? req.session.sessionVersion : 0;
  if (sessVer !== record.sessionVersion) {
    req.session.destroy(() => {});
    return res.status(401).json({ error: 'You were signed out remotely. Please sign in again.' });
  }
  next();
}
// The admin guards run requireLogin first so a banned, suspended, or
// remotely-signed-out admin loses admin access immediately — otherwise
// their old session cookie would keep working on every admin route.
function requireAdmin(req, res, next) {
  if (!req.session.user || !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'Admins only.' });
  }
  requireLogin(req, res, next);
}
function requireTier3(req, res, next) {
  if (!req.session.user || !isTier3(req.session.user)) {
    return res.status(403).json({ error: 'Tier 3 admins only.' });
  }
  requireLogin(req, res, next);
}
function requireTier4(req, res, next) {
  if (!req.session.user || !isTier4(req.session.user)) {
    return res.status(403).json({ error: 'Tier 4 admins only.' });
  }
  requireLogin(req, res, next);
}
function requireOverseer(req, res, next) {
  if (!req.session.user || !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Overseers only.' });
  }
  requireLogin(req, res, next);
}

// ── auth ────────────────────────────────────────────────────────
app.post('/api/register', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });
  if (username.length < 3) return res.status(400).json({ error: 'Username must be at least 3 characters.' });
  if (!/^[a-zA-Z0-9_-]{3,20}$/.test(username)) {
    return res.status(400).json({ error: 'Usernames can only contain letters, numbers, underscores, and hyphens (3–20 characters).' });
  }
  if (password.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });

  const db = readDB();
  const key = username.toLowerCase();
  if (db.users[key]) return res.status(409).json({ error: 'Username already taken.' });

  db.users[key] = {
    username,
    passwordHash: bcrypt.hashSync(password, 10),
    createdAt: new Date().toISOString(),
    seals: STARTER_SEALS,
    inventory: [...FREE_INVENTORY],
    profile: { avatar: 'teal', banner: 'banner-default', title: 'title-none', bio: '', customAvatarUrl: null, customBannerUrl: null, customTitleText: '', customAvatarPosition: { ...DEFAULT_POSITION }, customBannerPosition: { ...DEFAULT_POSITION }, featuredBadges: [], ring: 'ring-none' },
    lastDailyClaim: null,
    playtime: { date: null, accumSeconds: 0, sealsToday: 0, lastTick: null },
    stats: { totalDailyClaims: 0, chatMessageCount: 0, lifetimePlaySeconds: 0, totalPurchases: 0 },
    badges: {},
    notifications: [],
    nowPlaying: null,
    cookieSync: null,
    storageSync: null,
    sessionVersion: 0,
    banned: false,
    banReason: '',
    muted: false,
    muteReason: '',
    suspendedUntil: null,
    jailed: false,
    jailReason: ''
  };
  checkBadges(db.users[key]);
  writeDB(db);

  req.session.user = username;
  req.session.sessionVersion = db.users[key].sessionVersion;
  const pub = publicProfile(db.users[key], db);
  res.json({
    username, isAdmin: pub.isAdmin, isTier3: pub.isTier3, isTier4: pub.isTier4, isOverseer: pub.isOverseer, isTier1: pub.isTier1, isTier2: pub.isTier2, canSendAudio: canSendAudio(username), canUploadRings: canUploadRings(username), canPostImages: canPostImages(username), seals: pub.seals,
    avatarColor: pub.avatarColor, avatarImage: pub.avatarImage, avatarPosition: pub.avatarPosition, ringImage: pub.ringImage
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });

  const ip = req.ip || 'unknown';
  const acctKey = `${String(username).toLowerCase()}|${ip}`;
  const lockedFor = Math.max(loginIpLimiter.retryAfterMs(ip), loginAccountLimiter.retryAfterMs(acctKey));
  if (lockedFor) return tooManyAttempts(res, lockedFor);

  const db = readDB();
  const record = db.users[username.toLowerCase()];
  if (!record || !bcrypt.compareSync(password, record.passwordHash)) {
    loginAccountLimiter.fail(acctKey);
    loginIpLimiter.fail(ip);
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }
  loginAccountLimiter.reset(acctKey);
  const blockReason = accountBlockReason(record);
  if (blockReason) return res.status(403).json({ error: blockReason });

  req.session.user = record.username;
  req.session.sessionVersion = record.sessionVersion;
  const pub = publicProfile(record, db);
  if (isJailed(record)) return res.json({ username: record.username, jailed: true });
  res.json({
    username: record.username, isAdmin: pub.isAdmin, isTier3: pub.isTier3, isTier4: pub.isTier4, isOverseer: pub.isOverseer, isTier1: pub.isTier1, isTier2: pub.isTier2, canSendAudio: canSendAudio(record.username), canUploadRings: canUploadRings(record.username), canPostImages: canPostImages(record.username), seals: pub.seals,
    avatarColor: pub.avatarColor, avatarImage: pub.avatarImage, avatarPosition: pub.avatarPosition, ringImage: pub.ringImage
  });
});

app.post('/api/logout', (req, res) => {
  req.session.destroy(() => res.json({ ok: true }));
});

app.get('/api/session', (req, res) => {
  if (!req.session.user) return res.json({ user: null });
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  if (!record) return res.json({ user: null });
  const sessVer = typeof req.session.sessionVersion === 'number' ? req.session.sessionVersion : 0;
  if (accountBlockReason(record) || sessVer !== record.sessionVersion) {
    req.session.destroy(() => {});
    return res.json({ user: null });
  }
  const pub = publicProfile(record, db);
  if (isJailed(record)) return res.json({ username: req.session.user, jailed: true });
  res.json({
    username: req.session.user, isAdmin: pub.isAdmin, isTier3: pub.isTier3, isTier4: pub.isTier4, isOverseer: pub.isOverseer, isTier1: pub.isTier1, isTier2: pub.isTier2, canSendAudio: canSendAudio(req.session.user), canUploadRings: canUploadRings(req.session.user), canPostImages: canPostImages(req.session.user), seals: pub.seals,
    avatarColor: pub.avatarColor, avatarImage: pub.avatarImage, avatarPosition: pub.avatarPosition, ringImage: pub.ringImage
  });
});

// ── global banner ─────────────────────────────────────────────
app.get('/api/banner', (req, res) => {
  res.json(readDB().banner);
});

app.get('/api/whitelist', (req, res) => {
  res.json(readDB().whitelist);
});

app.post('/api/banner', requireAdmin, (req, res) => {
  const { text, type } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Banner text is required.' });
  const db = readDB();
  db.banner = { active: true, text: text.trim(), type: type || 'info' };
  writeDB(db);
  broadcastBanner(db.banner);
  res.json(db.banner);
});

app.delete('/api/banner', requireAdmin, (req, res) => {
  const db = readDB();
  db.banner = { active: false, text: '', type: 'info' };
  writeDB(db);
  broadcastBanner(db.banner);
  res.json(db.banner);
});

// Live stream: every open tab holds this connection open and gets
// pushed the new banner the instant an admin changes it — no
// refresh, no polling.
app.get('/api/banner/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(readDB().banner)}\n\n`);

  bannerClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    bannerClients.delete(res);
  });
});

// ── update popup (dismissible, shown once per browser per publish) ──
app.get('/api/popup', (req, res) => {
  res.json(readDB().popup);
});

app.post('/api/popup', requireAdmin, (req, res) => {
  const { title, text } = req.body || {};
  if (!text || !text.trim()) return res.status(400).json({ error: 'Popup text is required.' });
  const db = readDB();
  db.popup = {
    active: true,
    id: crypto.randomUUID(), // new id = every visitor sees it again, even if they dismissed the last one
    title: (title || '').trim() || 'Update',
    text: text.trim()
  };
  writeDB(db);
  broadcastPopup(db.popup);
  res.json(db.popup);
});

app.delete('/api/popup', requireAdmin, (req, res) => {
  const db = readDB();
  db.popup = { active: false, id: null, title: '', text: '' };
  writeDB(db);
  broadcastPopup(db.popup);
  res.json(db.popup);
});

app.get('/api/popup/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(readDB().popup)}\n\n`);

  popupClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    popupClients.delete(res);
  });
});

// ── Seal Customize — Tier 3-only site-wide WYSIWYG (drag elements around,
// set a background). Everyone can read the current state; only Tier 3 can
// change it. Elements are addressed by a nth-child CSS path from <body>
// (built client-side), so this stores {dx, dy} pixel offsets keyed by
// that path rather than anything about what the element actually is.
app.get('/api/customize', (req, res) => {
  res.json(readDB().customize);
});

app.get('/api/customize/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(`data: ${JSON.stringify(readDB().customize)}\n\n`);

  customizeClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    customizeClients.delete(res);
  });
});

app.post('/api/customize', requireTier3, (req, res) => {
  const { background, elements } = req.body || {};
  if (background !== null && background !== undefined) {
    if (typeof background !== 'object' || !['color', 'image'].includes(background.type) || typeof background.value !== 'string') {
      return res.status(400).json({ error: 'Invalid background.' });
    }
  }
  if (elements !== undefined && (typeof elements !== 'object' || Array.isArray(elements))) {
    return res.status(400).json({ error: 'Invalid elements.' });
  }

  const db = readDB();
  db.customize = {
    background: background || null,
    elements: elements && typeof elements === 'object' ? elements : (db.customize.elements || {})
  };
  writeDB(db);
  broadcastCustomize(db.customize);
  res.json(db.customize);
});

app.post('/api/customize/reset', requireTier3, (req, res) => {
  const db = readDB();
  db.customize = { background: null, elements: {} };
  writeDB(db);
  broadcastCustomize(db.customize);
  res.json(db.customize);
});

// ── chat ───────────────────────────────────────────────────────
// Simple site-wide chat room. Anyone can read; only signed-in users
// can post; messages carry the server-known username so no one can
// spoof who said what. History is capped so db.json doesn't grow forever.
const CHAT_HISTORY_LIMIT = 200;
const CHAT_RATE_LIMIT_MS = 800;
const CHAT_MAX_LENGTH = 500;
const ROOM_NAME_MAX = 40;

// Trims ONE room's history to CHAT_HISTORY_LIMIT, leaving every other
// room's messages alone — the limit used to apply to the single global
// array, which would let one busy room push a quiet one's history out.
function trimRoomHistory(db, roomId) {
  const inRoom = db.chat.filter(m => m.roomId === roomId);
  if (inRoom.length <= CHAT_HISTORY_LIMIT) return;
  const drop = new Set(inRoom.slice(0, inRoom.length - CHAT_HISTORY_LIMIT).map(m => m.id));
  const droppedImages = inRoom.filter(m => drop.has(m.id) && m.imageUrl).map(m => m.imageUrl);
  db.chat = db.chat.filter(m => !drop.has(m.id));
  releaseChatImages(db, droppedImages);
}

// ── chat image cleanup ──────────────────────────────────────────────
// Images are stored (Supabase/B2/local disk) separately from the messages
// that show them, so they have to be cleaned up explicitly. Two safety nets:
//  1. releaseChatImages() — whenever messages are removed (admin delete,
//     room deleted, old history trimmed) delete their images, but only if
//     no remaining message still points at the same file.
//  2. sweepOrphanChatImages() — periodically deletes stored chat images that
//     no message references: ones uploaded but never sent, leftovers from a
//     restored backup, or from before this cleanup existed. Files younger
//     than the grace period are left alone so an upload that's about to be
//     attached to a message is never removed from under it.
const CHAT_IMAGE_NAME_RE = /^[0-9a-f-]{36}\.(?:png|jpg|gif|webp)$/;
const CHAT_IMAGE_ORPHAN_GRACE_MS = parseInt(process.env.CHAT_IMAGE_ORPHAN_GRACE_MS, 10) || 60 * 60 * 1000;
const CHAT_IMAGE_SWEEP_INTERVAL_MS = parseInt(process.env.CHAT_IMAGE_SWEEP_INTERVAL_MS, 10) || 6 * 60 * 60 * 1000;

function chatImageFilename(url) { return String(url || '').split('/').pop(); }
function chatImagesInUse(db) {
  const used = new Set();
  for (const m of db.chat || []) if (m.imageUrl) used.add(chatImageFilename(m.imageUrl));
  return used;
}
// Call AFTER the messages have been removed from db.chat.
function releaseChatImages(db, urls) {
  const inUse = chatImagesInUse(db);
  new Set((urls || []).filter(Boolean)).forEach(url => {
    if (inUse.has(chatImageFilename(url))) return;
    deleteUpload('chat', url).catch(() => {});
  });
}

async function listStoredChatImages() {
  const out = [];
  if (USING_S3_STORAGE) {
    let token;
    do {
      const page = await s3Client.send(new ListObjectsV2Command({ Bucket: S3_BUCKET, Prefix: 'chat/', ContinuationToken: token }));
      for (const o of page.Contents || []) out.push({ name: o.Key.slice('chat/'.length), modified: o.LastModified ? new Date(o.LastModified) : null });
      token = page.IsTruncated ? page.NextContinuationToken : undefined;
    } while (token);
  } else {
    const dir = path.join(__dirname, 'public', 'uploads', 'chat');
    let names = [];
    try { names = fs.readdirSync(dir); } catch { return out; }
    for (const name of names) {
      try { out.push({ name, modified: fs.statSync(path.join(dir, name)).mtime }); } catch {}
    }
  }
  return out;
}

async function sweepOrphanChatImages() {
  try {
    const db = readDB();
    if (!db || !Array.isArray(db.chat)) return; // never sweep against a database that didn't load properly
    const stored = await listStoredChatImages();
    const inUse = chatImagesInUse(db);
    const cutoff = Date.now() - CHAT_IMAGE_ORPHAN_GRACE_MS;
    let removed = 0;
    for (const f of stored) {
      if (!CHAT_IMAGE_NAME_RE.test(f.name)) continue; // only ever touch files this feature created
      if (inUse.has(f.name)) continue;
      if (!f.modified || f.modified.getTime() > cutoff) continue;
      await deleteUpload('chat', f.name);
      removed++;
    }
    if (removed) console.log(`Chat image cleanup: removed ${removed} unused image(s).`);
  } catch (err) {
    console.error('Chat image cleanup failed:', err.message);
  }
}

// Returns null if `username` may read/write this room, otherwise an
// { status, error } to send back. Public rooms are open; a DM is only
// for its two participants.
function chatRoomAccessError(db, roomId, username) {
  if (isDmRoom(roomId)) {
    if (!username) return { status: 401, error: 'Sign in to view DMs.' };
    if (!dmParticipants(roomId).includes(username.toLowerCase())) {
      return { status: 403, error: 'That conversation isn\u2019t yours.' };
    }
    return null;
  }
  if (!(db.chatRooms || []).some(r => r.id === roomId)) {
    return { status: 404, error: 'That room doesn\u2019t exist.' };
  }
  return null;
}

// ── rooms ─────────────────────────────────────────────────────────
app.get('/api/chat/rooms', (req, res) => {
  res.json((readDB().chatRooms || []).map(r => ({
    id: r.id, name: r.name, createdBy: r.createdBy, createdAt: r.createdAt
  })));
});

app.post('/api/chat/rooms', requireLogin, (req, res) => {
  const name = String((req.body && req.body.name) || '').trim();
  if (!name) return res.status(400).json({ error: 'Room name is required.' });
  if (name.length > ROOM_NAME_MAX) return res.status(400).json({ error: `Room names are limited to ${ROOM_NAME_MAX} characters.` });

  const db = readDB();
  if (db.chatRooms.some(r => r.name.toLowerCase() === name.toLowerCase())) {
    return res.status(400).json({ error: 'A room with that name already exists.' });
  }
  const room = { id: crypto.randomUUID(), name, createdBy: req.session.user, createdAt: new Date().toISOString() };
  db.chatRooms.push(room);
  writeDB(db);
  res.status(201).json(room);
});

app.delete('/api/chat/rooms/:id', requireLogin, (req, res) => {
  const db = readDB();
  const room = db.chatRooms.find(r => r.id === req.params.id);
  if (!room) return res.status(404).json({ error: 'That room doesn\u2019t exist.' });
  if (room.id === 'general') return res.status(400).json({ error: 'The General room can\u2019t be deleted.' });
  const isCreator = room.createdBy && room.createdBy.toLowerCase() === req.session.user.toLowerCase();
  if (!isCreator && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'Only the room\u2019s creator or an admin can delete it.' });
  }
  db.chatRooms = db.chatRooms.filter(r => r.id !== room.id);
  const roomImages = (db.chat || []).filter(m => m.roomId === room.id && m.imageUrl).map(m => m.imageUrl);
  db.chat = (db.chat || []).filter(m => m.roomId !== room.id);
  writeDB(db);
  releaseChatImages(db, roomImages);
  broadcastChat(room.id, 'room-deleted', { id: room.id });
  res.json({ ok: true });
});

// ── messages ──────────────────────────────────────────────────────
app.get('/api/chat/messages', (req, res) => {
  const db = readDB();
  const roomId = req.query.room || 'general';
  const denied = chatRoomAccessError(db, roomId, req.session.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  res.json((db.chat || []).filter(m => m.roomId === roomId));
});

// Only counts a mention as real if it matches an actual username — so
// "@" in normal conversation (emails, code, whatever) never pings anyone
// and never lights up as a highlighted mention on the frontend.
function extractMentions(text, db, senderUsername) {
  const candidates = text.match(/@([a-zA-Z0-9_]{1,32})/g) || [];
  const seen = new Set();
  const mentioned = [];
  for (const raw of candidates) {
    const key = raw.slice(1).toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    const record = db.users[key];
    if (record && record.username.toLowerCase() !== senderUsername.toLowerCase()) {
      mentioned.push(record.username);
    }
  }
  return mentioned;
}

// ── chat images / GIFs (Image Perms tier or admins) ───────────────
const CHAT_IMAGE_EXT_BY_MIME = { 'image/png': '.png', 'image/jpeg': '.jpg', 'image/gif': '.gif', 'image/webp': '.webp' };
const MAX_CHAT_IMAGE_BYTES = 8 * 1024 * 1024; // 8MB — GIFs run big
const chatImageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_CHAT_IMAGE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!CHAT_IMAGE_EXT_BY_MIME[file.mimetype]) return cb(new Error('Please upload a PNG, JPG, GIF, or WEBP image.'));
    cb(null, true);
  }
});
// The declared MIME type comes from the client, so also check the file's
// actual leading bytes — a renamed .html/.svg must not get through.
function bufferMatchesImageMime(buf, mime) {
  if (!buf || buf.length < 12) return false;
  if (mime === 'image/png') return buf.slice(0, 8).equals(Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]));
  if (mime === 'image/jpeg') return buf[0] === 0xFF && buf[1] === 0xD8 && buf[2] === 0xFF;
  if (mime === 'image/gif') { const h = buf.slice(0, 6).toString('latin1'); return h === 'GIF87a' || h === 'GIF89a'; }
  if (mime === 'image/webp') return buf.slice(0, 4).toString('latin1') === 'RIFF' && buf.slice(8, 12).toString('latin1') === 'WEBP';
  return false;
}
// A message may only point at an image this server stored under chat/ —
// never an arbitrary external URL (tracking pixels, hotlinked junk, etc.).
function isOwnChatImageUrl(url) {
  if (typeof url !== 'string' || url.length > 600) return false;
  const tail = '/chat/[0-9a-f-]{36}\\.(?:png|jpg|gif|webp)$';
  if (USING_S3_STORAGE) {
    const base = String(S3_PUBLIC_URL_BASE || '').replace(/\/+$/, '');
    return !!base && url.startsWith(base + '/chat/') && new RegExp(tail).test(url);
  }
  return new RegExp('^/uploads' + tail).test(url);
}

app.post('/api/chat/images', requireLogin, (req, res) => {
  if (!canPostImages(req.session.user)) {
    return res.status(403).json({ error: 'You need Image Perms to upload images. Ask an admin.' });
  }
  const db0 = readDB();
  const rec = db0.users[req.session.user.toLowerCase()];
  if (isMuted(rec)) {
    return res.status(403).json({ error: rec.muteReason ? `You're muted: ${rec.muteReason}` : "You're muted." });
  }
  chatImageUpload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.code === 'LIMIT_FILE_SIZE' ? 'Images are limited to 8MB.' : (err.message || 'Upload failed.') });
    if (!req.file) return res.status(400).json({ error: 'No image received.' });
    if (!bufferMatchesImageMime(req.file.buffer, req.file.mimetype)) {
      return res.status(400).json({ error: 'That file doesn\u2019t look like a real image.' });
    }
    const ext = CHAT_IMAGE_EXT_BY_MIME[req.file.mimetype];
    const filename = `${crypto.randomUUID()}${ext}`;
    try {
      const url = await storeUpload(req.file.buffer, 'chat', filename, req.file.mimetype);
      res.status(201).json({ url });
    } catch (e) {
      console.error('Chat image upload failed:', e.message);
      res.status(500).json({ error: 'Couldn\u2019t store that image.' });
    }
  });
});

app.post('/api/chat/messages', requireLogin, (req, res) => {
  const text = (req.body && req.body.text || '').trim();
  const imageUrl = req.body && req.body.imageUrl ? String(req.body.imageUrl) : '';
  const roomId = (req.body && req.body.room) || 'general';
  if (imageUrl) {
    if (!canPostImages(req.session.user)) return res.status(403).json({ error: 'You need Image Perms to post images. Ask an admin.' });
    if (!isOwnChatImageUrl(imageUrl)) return res.status(400).json({ error: 'Invalid image.' });
  }
  if (!text && !imageUrl) return res.status(400).json({ error: 'Message is empty.' });
  if (text.length > CHAT_MAX_LENGTH) return res.status(400).json({ error: `Messages are limited to ${CHAT_MAX_LENGTH} characters.` });

  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  if (isMuted(record)) {
    return res.status(403).json({ error: record.muteReason ? `You're muted: ${record.muteReason}` : "You're muted." });
  }

  const denied = chatRoomAccessError(db, roomId, req.session.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });
  if (isDmRoom(roomId)) {
    // Being a participant lets you read the thread forever, but sending
    // needs an active friendship — unfriending makes it read-only.
    const [a, b] = dmParticipants(roomId);
    if (!areFriends(db, a, b)) {
      return res.status(403).json({ error: 'You can only send DMs to friends.' });
    }
  }

  const now = Date.now();
  const last = lastMessageAt.get(req.session.user) || 0;
  if (now - last < CHAT_RATE_LIMIT_MS) return res.status(429).json({ error: 'Slow down a little.' });
  lastMessageAt.set(req.session.user, now);

  const senderProfile = publicProfile(record, db);
  const mentions = extractMentions(text, db, req.session.user);
  const message = {
    id: crypto.randomUUID(),
    roomId,
    username: req.session.user,
    isAdmin: isAdmin(req.session.user),
    isTier3: isTier3(req.session.user),
    isTier4: isTier4(req.session.user),
    isOverseer: isOverseer(req.session.user),
    isTier1: isTier1(req.session.user),
    isTier2: isTier2(req.session.user),
    title: senderProfile.title,
    avatarColor: senderProfile.avatarImage ? null : senderProfile.avatarColor,
    avatarImage: senderProfile.avatarImage,
    avatarPosition: senderProfile.avatarPosition,
    ringImage: senderProfile.ringImage,
    nowPlaying: senderProfile.nowPlaying,
    mentions,
    text,
    imageUrl: imageUrl || null,
    ts: now
  };

  record.stats.chatMessageCount += 1;
  checkBadges(record);

  if (isDmRoom(roomId)) {
    // DMs get their own notification instead of the @mention one, so
    // the recipient hears about it even if they aren't looking at that
    // thread right now.
    const other = dmParticipants(roomId).find(u => u !== req.session.user.toLowerCase());
    const otherRecord = db.users[other];
    if (otherRecord) {
      const excerpt = !text ? '[image]' : (text.length > 80 ? text.slice(0, 80) + '\u2026' : text);
      addNotification(otherRecord, `${req.session.user} sent you a DM: \u201c${excerpt}\u201d`);
      // Live pop-up (same channel as the incoming-sound prompt).
      sendToUser(otherRecord.username, 'chat-notify', {
        kind: 'dm', from: req.session.user, roomId, roomName: null, excerpt
      });
    }
  } else {
    const roomRecord = (db.chatRooms || []).find(r => r.id === roomId);
    mentions.forEach(username => {
      const mentionedRecord = db.users[username.toLowerCase()];
      if (!mentionedRecord) return;
      const excerpt = !text ? '[image]' : (text.length > 80 ? text.slice(0, 80) + '\u2026' : text);
      addNotification(mentionedRecord, `${req.session.user} mentioned you in chat: \u201c${excerpt}\u201d`);
      sendToUser(mentionedRecord.username, 'chat-notify', {
        kind: 'mention', from: req.session.user, roomId, roomName: roomRecord ? roomRecord.name : null, excerpt
      });
    });
  }

  db.chat = db.chat || [];
  db.chat.push(message);
  trimRoomHistory(db, roomId);
  writeDB(db);

  broadcastChat(roomId, 'message', message);
  res.status(201).json(message);
});

// ── Typing indicators ─────────────────────────────────────────────
// The client pings this while someone is typing (at most once every few
// seconds) and once more with typing:false when they stop. Nothing is stored:
// it's relayed straight to whoever has that room's stream open, the same way
// messages are, so DMs stay between their two people. Receivers also expire
// an indicator on their own after a few seconds, so a dropped "stop" can
// never leave someone stuck as "typing".
const TYPING_MIN_INTERVAL_MS = 1500;
const lastTypingAt = new Map(); // "user|room" -> timestamp
setInterval(() => {
  const cutoff = Date.now() - 60000;
  for (const [k, t] of lastTypingAt) if (t < cutoff) lastTypingAt.delete(k);
}, 5 * 60 * 1000).unref();

app.post('/api/chat/typing', requireLogin, (req, res) => {
  const roomId = String((req.body && req.body.room) || 'general').slice(0, 120);
  const typing = !(req.body && req.body.typing === false);
  const db = readDB();
  const denied = chatRoomAccessError(db, roomId, req.session.user);
  if (denied) return res.status(denied.status).json({ error: denied.error });

  // People who couldn't send the message anyway don't get to show as typing.
  const record = db.users[req.session.user.toLowerCase()];
  if (!record || isMuted(record)) return res.json({ ok: true });
  if (isDmRoom(roomId)) {
    const [a, b] = dmParticipants(roomId);
    if (!areFriends(db, a, b)) return res.json({ ok: true });
  }

  const key = req.session.user.toLowerCase() + '|' + roomId;
  const now = Date.now();
  if (typing) {
    if (now - (lastTypingAt.get(key) || 0) < TYPING_MIN_INTERVAL_MS) return res.json({ ok: true });
    lastTypingAt.set(key, now);
  } else {
    lastTypingAt.delete(key);
  }
  broadcastChat(roomId, 'typing', { username: req.session.user, typing });
  res.json({ ok: true });
});

app.delete('/api/chat/messages/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const target = (db.chat || []).find(m => m.id === req.params.id);
  db.chat = (db.chat || []).filter(m => m.id !== req.params.id);
  writeDB(db);
  if (target && target.imageUrl) releaseChatImages(db, [target.imageUrl]);
  if (target) broadcastChat(target.roomId, 'delete', { id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/chat/stream', (req, res) => {
  const roomId = req.query.room || 'general';
  const denied = chatRoomAccessError(readDB(), roomId, req.session.user);
  if (denied) return res.status(denied.status).end();

  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');

  if (!chatClients.has(roomId)) chatClients.set(roomId, new Set());
  chatClients.get(roomId).add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const subscribers = chatClients.get(roomId);
    if (subscribers) {
      subscribers.delete(res);
      if (!subscribers.size) chatClients.delete(roomId);
    }
  });
});

// ── friends ───────────────────────────────────────────────────────
// A friendship is one row in db.friendRequests: 'pending' until the
// recipient accepts, then 'accepted'. Declining or unfriending just
// deletes the row, so there's no separate "blocked/declined" state to
// keep consistent.
function friendSummary(db, username) {
  const record = db.users[username.toLowerCase()];
  if (!record) return null;
  return {
    username: record.username,
    isAdmin: isAdmin(record.username),
    isTier3: isTier3(record.username),
    isTier4: isTier4(record.username),
    isOverseer: isOverseer(record.username),
    isTier1: isTier1(record.username),
    isTier2: isTier2(record.username)
  };
}

app.get('/api/friends', requireLogin, (req, res) => {
  const db = readDB();
  const me = req.session.user.toLowerCase();
  const friends = [], incoming = [], outgoing = [];
  for (const r of db.friendRequests) {
    const from = r.from.toLowerCase(), to = r.to.toLowerCase();
    if (from !== me && to !== me) continue;
    const other = from === me ? r.to : r.from;
    const summary = friendSummary(db, other);
    if (!summary) continue;
    if (r.status === 'accepted') friends.push({ ...summary, dmRoomId: dmRoomId(me, other) });
    else if (to === me) incoming.push(summary);
    else outgoing.push(summary);
  }
  res.json({ friends, incoming, outgoing });
});

app.post('/api/friends/request', requireLogin, (req, res) => {
  const targetName = String((req.body && req.body.username) || '').trim();
  if (!targetName) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const target = db.users[targetName.toLowerCase()];
  if (!target) return res.status(404).json({ error: 'No account with that username exists.' });
  if (target.username.toLowerCase() === req.session.user.toLowerCase()) {
    return res.status(400).json({ error: 'You can\u2019t add yourself.' });
  }

  const existing = friendshipBetween(db, req.session.user, target.username);
  if (existing) {
    if (existing.status === 'accepted') return res.status(400).json({ error: 'You\u2019re already friends.' });
    if (existing.from.toLowerCase() === req.session.user.toLowerCase()) {
      return res.status(400).json({ error: 'You already sent them a request.' });
    }
    // They'd already asked you — adding them back just accepts it.
    existing.status = 'accepted';
    addNotification(target, `${req.session.user} accepted your friend request.`);
    writeDB(db);
    return res.json({ status: 'accepted' });
  }

  db.friendRequests.push({
    id: crypto.randomUUID(),
    from: req.session.user,
    to: target.username,
    status: 'pending',
    createdAt: new Date().toISOString()
  });
  addNotification(target, `${req.session.user} sent you a friend request.`);
  writeDB(db);
  res.status(201).json({ status: 'pending' });
});

app.post('/api/friends/accept', requireLogin, (req, res) => {
  const db = readDB();
  const from = String((req.body && req.body.username) || '').toLowerCase();
  const request = db.friendRequests.find(r =>
    r.status === 'pending' && r.from.toLowerCase() === from && r.to.toLowerCase() === req.session.user.toLowerCase());
  if (!request) return res.status(404).json({ error: 'No pending request from that user.' });
  request.status = 'accepted';
  const requester = db.users[from];
  if (requester) addNotification(requester, `${req.session.user} accepted your friend request.`);
  writeDB(db);
  res.json({ ok: true });
});

app.post('/api/friends/decline', requireLogin, (req, res) => {
  const db = readDB();
  const from = String((req.body && req.body.username) || '').toLowerCase();
  const before = db.friendRequests.length;
  db.friendRequests = db.friendRequests.filter(r =>
    !(r.status === 'pending' && r.from.toLowerCase() === from && r.to.toLowerCase() === req.session.user.toLowerCase()));
  if (db.friendRequests.length === before) return res.status(404).json({ error: 'No pending request from that user.' });
  writeDB(db);
  res.json({ ok: true });
});

app.delete('/api/friends/:username', requireLogin, (req, res) => {
  const db = readDB();
  const other = req.params.username.toLowerCase();
  const me = req.session.user.toLowerCase();
  const before = db.friendRequests.length;
  db.friendRequests = db.friendRequests.filter(r => {
    const f = r.from.toLowerCase(), t = r.to.toLowerCase();
    return !((f === me && t === other) || (f === other && t === me));
  });
  if (db.friendRequests.length === before) return res.status(404).json({ error: 'You aren\u2019t friends with that user.' });
  writeDB(db);
  res.json({ ok: true });
});

// ── presence + per-user notifications ─────────────────────────
// Signed-in users open this once and it stays connected while they're
// on the site; that's how "online now" is determined and how a
// targeted push (like an incoming sound) reaches one specific person.
app.get('/api/notify/stream', requireLogin, (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');

  const user = req.session.user;
  if (!notifyClients.has(user)) notifyClients.set(user, new Set());
  notifyClients.get(user).add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    const set = notifyClients.get(user);
    if (set) {
      set.delete(res);
      if (set.size === 0) notifyClients.delete(user);
    }
  });
});

app.get('/api/presence/online', requireLogin, (req, res) => {
  res.json([...notifyClients.keys()].filter(u => u !== req.session.user));
});

// ── GIF picker (search proxy) ───────────────────────────────────────
// The chat's GIF picker searches Giphy or Tenor. Both need an API key, which
// must never reach the browser, so the browser asks *this* server and the
// server asks them. Set GIPHY_API_KEY or TENOR_API_KEY (Giphy wins if both
// are set); with neither, the GIF button simply doesn't appear. Picking a
// GIF just sends its link as a normal chat message, and the chat page turns
// GIF links into pictures.
const GIPHY_API_KEY = process.env.GIPHY_API_KEY || '';
const TENOR_API_KEY = process.env.TENOR_API_KEY || '';
const GIF_PROVIDER = GIPHY_API_KEY ? 'giphy' : (TENOR_API_KEY ? 'tenor' : null);
const GIF_RATING = ['g', 'pg', 'pg-13', 'r'].includes(String(process.env.GIF_RATING || '').toLowerCase())
  ? String(process.env.GIF_RATING).toLowerCase() : 'pg';
const TENOR_FILTER_BY_RATING = { 'g': 'high', 'pg': 'medium', 'pg-13': 'low', 'r': 'off' };
const GIF_PAGE_SIZE = 24;
const GIF_SEARCHES_PER_MIN = 40;
const GIF_CACHE_TTL_MS = 60 * 1000;
const GIF_CACHE_MAX = 200;
const gifCache = new Map();      // "provider|query|pos" -> { t, data }
const gifUserHits = new Map();   // username -> [timestamps]

// Only ever hand the browser links on the providers' own media hosts.
function isProviderGifUrl(u) {
  try {
    const x = new URL(u);
    if (x.protocol !== 'https:') return false;
    return /^(?:media\d*|i)\.giphy\.com$/.test(x.hostname) || /^(?:media\d*|c)\.tenor\.com$/.test(x.hostname);
  } catch { return false; }
}
function gifRateLimited(username) {
  const now = Date.now();
  const hits = (gifUserHits.get(username) || []).filter(t => now - t < 60 * 1000);
  if (hits.length >= GIF_SEARCHES_PER_MIN) { gifUserHits.set(username, hits); return true; }
  hits.push(now);
  gifUserHits.set(username, hits);
  return false;
}
async function fetchJsonWithTimeout(url) {
  const r = await fetch(url, { signal: AbortSignal.timeout(6000), headers: { Accept: 'application/json' } });
  if (!r.ok) throw new Error(`upstream ${r.status}`);
  return r.json();
}
async function searchGifs(query, pos) {
  if (GIF_PROVIDER === 'giphy') {
    const offset = Math.max(0, parseInt(pos, 10) || 0);
    const params = new URLSearchParams({ api_key: GIPHY_API_KEY, limit: String(GIF_PAGE_SIZE), offset: String(offset), rating: GIF_RATING });
    if (query) params.set('q', query);
    const base = process.env.GIPHY_API_BASE || 'https://api.giphy.com';
    const data = await fetchJsonWithTimeout(`${base}/v1/gifs/${query ? 'search' : 'trending'}?${params}`);
    const results = (data.data || []).map(g => {
      const im = g.images || {};
      const full = im.downsized || im.fixed_width || im.original || {};
      const small = im.fixed_width_small || im.fixed_width || full;
      // Drop the tracking query string: the bare media link works and keeps chat messages short.
      const clean = u => String(u || '').split('?')[0];
      return { id: g.id, title: g.title || '', url: clean(full.url), preview: clean(small.url), w: Number(small.width) || 100, h: Number(small.height) || 100 };
    });
    const pg = data.pagination || {};
    const nextOffset = offset + (pg.count || results.length);
    return { results, next: pg.total_count && nextOffset < pg.total_count ? String(nextOffset) : null };
  }
  const params = new URLSearchParams({ key: TENOR_API_KEY, client_key: 'seal', limit: String(GIF_PAGE_SIZE), media_filter: 'gif,tinygif', contentfilter: TENOR_FILTER_BY_RATING[GIF_RATING] });
  if (query) params.set('q', query);
  if (pos) params.set('pos', pos);
  const base = process.env.TENOR_API_BASE || 'https://tenor.googleapis.com';
  const data = await fetchJsonWithTimeout(`${base}/v2/${query ? 'search' : 'featured'}?${params}`);
  const results = (data.results || []).map(g => {
    const mf = g.media_formats || {};
    const dims = (mf.tinygif && mf.tinygif.dims) || [100, 100];
    return { id: g.id, title: g.content_description || '', url: mf.gif && mf.gif.url, preview: (mf.tinygif && mf.tinygif.url) || (mf.gif && mf.gif.url), w: dims[0], h: dims[1] };
  });
  return { results, next: data.next ? String(data.next) : null };
}

app.get('/api/gifs/status', (req, res) => {
  res.json({ enabled: !!GIF_PROVIDER, provider: GIF_PROVIDER });
});

app.get('/api/gifs/search', requireLogin, async (req, res) => {
  if (!GIF_PROVIDER) return res.status(503).json({ error: 'GIF search isn\u2019t set up yet.', notConfigured: true });
  if (gifRateLimited(req.session.user)) return res.status(429).json({ error: 'Slow down a little \u2014 too many GIF searches.' });
  const query = String(req.query.q || '').trim().slice(0, 60);
  const pos = String(req.query.pos || '').slice(0, 80);
  const key = `${GIF_PROVIDER}|${query.toLowerCase()}|${pos}`;
  const hit = gifCache.get(key);
  if (hit && Date.now() - hit.t < GIF_CACHE_TTL_MS) return res.json(hit.data);
  try {
    const out = await searchGifs(query, pos);
    const data = {
      provider: GIF_PROVIDER,
      next: out.next,
      results: out.results.filter(g => g && g.id && isProviderGifUrl(g.url) && isProviderGifUrl(g.preview)).map(g => ({ id: String(g.id), title: String(g.title).slice(0, 100), url: g.url, preview: g.preview, w: g.w, h: g.h }))
    };
    if (gifCache.size >= GIF_CACHE_MAX) gifCache.delete(gifCache.keys().next().value);
    gifCache.set(key, { t: Date.now(), data });
    res.json(data);
  } catch (err) {
    console.error('GIF search failed:', err.message);
    res.status(502).json({ error: 'GIF search is unavailable right now.' });
  }
});

// ── suggestion box ──────────────────────────────────────────────────
// Anyone can read; signed-in users can post (rate limited), upvote, and
// delete their own while it's still open. Admins set the status, leave a
// short note, and can delete anything. Voter names never leave the server —
// clients only see a count and whether *they* voted.
const SUGGESTION_STATUSES = ['open', 'planned', 'done', 'declined'];
const SUGGESTION_TITLE_MAX = 80;
const SUGGESTION_BODY_MAX = 1000;
const SUGGESTION_NOTE_MAX = 200;
const SUGGESTIONS_PER_DAY = 5;
const SUGGESTION_COOLDOWN_MS = 20 * 1000;
const lastSuggestionAt = new Map();

function publicSuggestion(sg, viewer) {
  const votes = sg.votes || [];
  return {
    id: sg.id,
    author: sg.author,
    title: sg.title,
    body: sg.body,
    status: sg.status,
    adminNote: sg.adminNote || '',
    createdAt: sg.createdAt,
    voteCount: votes.length,
    hasVoted: !!viewer && votes.includes(viewer.toLowerCase()),
    mine: !!viewer && sg.author.toLowerCase() === viewer.toLowerCase()
  };
}

app.get('/api/suggestions', (req, res) => {
  const db = readDB();
  const viewer = req.session.user || null;
  res.json((db.suggestions || []).map(sg => publicSuggestion(sg, viewer)));
});

app.post('/api/suggestions', requireLogin, (req, res) => {
  const title = String(req.body && req.body.title || '').trim();
  const body = String(req.body && req.body.body || '').trim();
  if (!title) return res.status(400).json({ error: 'Give your suggestion a title.' });
  if (title.length > SUGGESTION_TITLE_MAX) return res.status(400).json({ error: `Titles are limited to ${SUGGESTION_TITLE_MAX} characters.` });
  if (body.length > SUGGESTION_BODY_MAX) return res.status(400).json({ error: `Details are limited to ${SUGGESTION_BODY_MAX} characters.` });

  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  if (isMuted(record)) {
    return res.status(403).json({ error: record.muteReason ? `You're muted: ${record.muteReason}` : "You're muted." });
  }

  const now = Date.now();
  if (now - (lastSuggestionAt.get(req.session.user) || 0) < SUGGESTION_COOLDOWN_MS) {
    return res.status(429).json({ error: 'Slow down a little before sending another suggestion.' });
  }
  const dayAgo = now - 24 * 60 * 60 * 1000;
  const recent = (db.suggestions || []).filter(sg => sg.author.toLowerCase() === req.session.user.toLowerCase() && new Date(sg.createdAt).getTime() > dayAgo);
  if (recent.length >= SUGGESTIONS_PER_DAY) {
    return res.status(429).json({ error: `You can send up to ${SUGGESTIONS_PER_DAY} suggestions per day.` });
  }
  if ((db.suggestions || []).some(sg => sg.status === 'open' && sg.title.toLowerCase() === title.toLowerCase())) {
    return res.status(409).json({ error: 'Someone already suggested that \u2014 go upvote it instead.' });
  }
  lastSuggestionAt.set(req.session.user, now);

  const suggestion = {
    id: crypto.randomUUID(),
    author: req.session.user,
    title,
    body,
    status: 'open',
    adminNote: '',
    votes: [req.session.user.toLowerCase()], // the author's own upvote
    createdAt: new Date(now).toISOString()
  };
  db.suggestions = db.suggestions || [];
  db.suggestions.push(suggestion);
  writeDB(db);
  res.status(201).json(publicSuggestion(suggestion, req.session.user));
});

app.post('/api/suggestions/:id/vote', requireLogin, (req, res) => {
  const db = readDB();
  const sg = (db.suggestions || []).find(x => x.id === req.params.id);
  if (!sg) return res.status(404).json({ error: 'Suggestion not found.' });
  const me = req.session.user.toLowerCase();
  sg.votes = sg.votes || [];
  const i = sg.votes.indexOf(me);
  if (i === -1) sg.votes.push(me); else sg.votes.splice(i, 1);
  writeDB(db);
  res.json(publicSuggestion(sg, req.session.user));
});

app.patch('/api/suggestions/:id', requireAdmin, (req, res) => {
  const db = readDB();
  const sg = (db.suggestions || []).find(x => x.id === req.params.id);
  if (!sg) return res.status(404).json({ error: 'Suggestion not found.' });
  const { status } = req.body || {};
  const hasNote = req.body && typeof req.body.adminNote === 'string';
  if (status !== undefined && !SUGGESTION_STATUSES.includes(status)) return res.status(400).json({ error: 'Invalid status.' });
  const note = hasNote ? req.body.adminNote.trim() : sg.adminNote;
  if (note && note.length > SUGGESTION_NOTE_MAX) return res.status(400).json({ error: `Notes are limited to ${SUGGESTION_NOTE_MAX} characters.` });

  const statusChanged = status !== undefined && status !== sg.status;
  if (statusChanged) {
    sg.status = status;
    audit(db, req.session.user, 'suggestion-status', sg.author, `"${sg.title.slice(0, 60)}" -> ${status}`);
    // Let the author know (skip if an admin is changing their own post).
    const authorRecord = db.users[sg.author.toLowerCase()];
    if (authorRecord && sg.author.toLowerCase() !== req.session.user.toLowerCase() && status !== 'open') {
      const label = { planned: 'marked as planned', done: 'marked as done', declined: 'declined' }[status];
      addNotification(authorRecord, `Your suggestion \u201c${sg.title.slice(0, 60)}\u201d was ${label}.`);
    }
  }
  if (hasNote) sg.adminNote = note;
  writeDB(db);
  res.json(publicSuggestion(sg, req.session.user));
});

app.delete('/api/suggestions/:id', requireLogin, (req, res) => {
  const db = readDB();
  const sg = (db.suggestions || []).find(x => x.id === req.params.id);
  if (!sg) return res.status(404).json({ error: 'Suggestion not found.' });
  const admin = isAdmin(req.session.user);
  const isAuthor = sg.author.toLowerCase() === req.session.user.toLowerCase();
  if (!admin && !(isAuthor && sg.status === 'open')) {
    return res.status(403).json({ error: 'You can only delete your own suggestions while they\u2019re still open.' });
  }
  db.suggestions = db.suggestions.filter(x => x.id !== sg.id);
  if (admin && !isAuthor) audit(db, req.session.user, 'suggestion-delete', sg.author, `"${sg.title.slice(0, 60)}"`);
  writeDB(db);
  res.json({ ok: true });
});

// ── file library (public browse/download; upload requires sign-in) ──
// Blocklist of executable-ish extensions — this is a shared-hosting
// safety floor, not content moderation. Everything else is allowed.
const BLOCKED_EXTENSIONS = new Set([
  '.exe', '.bat', '.cmd', '.com', '.msi', '.scr', '.vbs', '.vbe',
  '.js', '.jse', '.wsf', '.wsh', '.ps1', '.jar', '.apk', '.sh',
  '.dll', '.app', '.deb', '.rpm', '.iso', '.bin', '.cpl'
]);
const MAX_UPLOAD_BYTES = 25 * 1024 * 1024; // 25MB

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_UPLOAD_BYTES },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (BLOCKED_EXTENSIONS.has(ext)) return cb(new Error('That file type isn\'t allowed.'));
    cb(null, true);
  }
});

app.get('/api/files', (req, res) => {
  res.json(readDB().files || []);
});

app.post('/api/files', requireLogin, (req, res) => {
  upload.single('file')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const ext = path.extname(req.file.originalname).toLowerCase();
    const storedName = crypto.randomUUID() + ext;
    const url = await storeUpload(req.file.buffer, 'library', storedName, req.file.mimetype, {
      localDir: UPLOADS_DIR,
      downloadName: req.file.originalname
    });

    const entry = {
      id: crypto.randomUUID(),
      name: req.file.originalname,
      storedName,
      url, // set when using B2; null in local-disk mode (served via the download route below instead)
      size: req.file.size,
      mime: req.file.mimetype,
      uploader: req.session.user,
      ts: Date.now()
    };
    const db = readDB();
    db.files = db.files || [];
    db.files.push(entry);
    writeDB(db);
    res.status(201).json(entry);
  });
});

app.get('/api/files/:id/download', (req, res) => {
  const file = (readDB().files || []).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (file.url) return res.redirect(file.url); // B2 already serves the right filename via Content-Disposition
  res.download(path.join(UPLOADS_DIR, file.storedName), file.name);
});

app.delete('/api/files/:id', requireLogin, (req, res) => {
  const db = readDB();
  const file = (db.files || []).find(f => f.id === req.params.id);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (file.uploader !== req.session.user && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'You can only remove your own uploads.' });
  }
  db.files = db.files.filter(f => f.id !== req.params.id);
  writeDB(db);
  deleteUpload('library', file.storedName, { localDir: UPLOADS_DIR }).catch(() => {}); // best-effort, ignore errors
  res.json({ ok: true });
});

// ── send a sound to a specific online user ────────────────────────
// Admin-only by default; admins can grant individual users access
// (see the audio-senders endpoints below) without making them full
// admins. The recipient decides what happens next (confirm-first or
// auto-play) via their own client-side preference — this endpoint
// only delivers the notification, it never plays anything itself.
app.post('/api/audio/send', requireLogin, (req, res) => {
  if (!canSendAudio(req.session.user)) {
    return res.status(403).json({ error: 'Sending sounds is admin-only right now. Ask an admin to grant you access in Settings.' });
  }

  const { toUsername, fileId } = req.body || {};
  if (!toUsername || !fileId) return res.status(400).json({ error: 'Missing recipient or file.' });
  if (toUsername.toLowerCase() === req.session.user.toLowerCase()) {
    return res.status(400).json({ error: "You can't send a sound to yourself." });
  }

  const file = (readDB().files || []).find(f => f.id === fileId);
  if (!file) return res.status(404).json({ error: 'File not found.' });
  if (!file.mime || !file.mime.startsWith('audio/')) {
    return res.status(400).json({ error: 'That file isn\'t audio.' });
  }

  const delivered = sendToUser(toUsername, 'incoming-audio', {
    from: req.session.user,
    fileId: file.id,
    fileName: file.name,
    url: `/api/files/${file.id}/download`
  });
  if (!delivered) return res.status(404).json({ error: `${toUsername} isn't online right now.` });
  res.json({ ok: true });
});

// ── admin: grant/revoke audio-sending access ──────────────────────
app.get('/api/admin/audio-senders', requireAdmin, (req, res) => {
  res.json(readDB().audioSenders || []);
});

app.post('/api/admin/audio-senders', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[username.trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  db.audioSenders = db.audioSenders || [];
  if (!db.audioSenders.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.audioSenders.push(record.username);
    audit(db, req.session.user, 'grant-audio', record.username, '');
    writeDB(db);
  }
  res.status(201).json(db.audioSenders);
});

app.delete('/api/admin/audio-senders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  const audioBefore = (db.audioSenders || []).length;
  db.audioSenders = (db.audioSenders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  if (db.audioSenders.length !== audioBefore) audit(db, req.session.user, 'revoke-audio', req.params.username, '');
  writeDB(db);
  res.json(db.audioSenders);
});

// ── admin: grant/revoke Ring-uploading access ──────────────────────
app.get('/api/admin/ring-uploaders', requireAdmin, (req, res) => {
  res.json(readDB().ringUploaders || []);
});

app.post('/api/admin/ring-uploaders', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[username.trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  db.ringUploaders = db.ringUploaders || [];
  if (!db.ringUploaders.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.ringUploaders.push(record.username);
    audit(db, req.session.user, 'grant-ring-upload', record.username, '');
    writeDB(db);
  }
  res.status(201).json(db.ringUploaders);
});

app.delete('/api/admin/ring-uploaders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  const ringsBefore = (db.ringUploaders || []).length;
  db.ringUploaders = (db.ringUploaders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  if (db.ringUploaders.length !== ringsBefore) audit(db, req.session.user, 'revoke-ring-upload', req.params.username, '');
  writeDB(db);
  res.json(db.ringUploaders);
});

// ── admin: grant/revoke Image Perms (chat image/GIF uploads) ────────
// requireAdmin guards who can *grant*; holders of the tier itself are NOT
// admins and cannot reach any of these routes.
app.get('/api/admin/image-uploaders', requireAdmin, (req, res) => {
  res.json(readDB().imageUploaders || []);
});

app.post('/api/admin/image-uploaders', requireAdmin, (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[username.trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  db.imageUploaders = db.imageUploaders || [];
  if (!db.imageUploaders.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.imageUploaders.push(record.username);
    audit(db, req.session.user, 'grant-image-perms', record.username, '');
    writeDB(db);
  }
  res.status(201).json(db.imageUploaders);
});

app.delete('/api/admin/image-uploaders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  const before = (db.imageUploaders || []).length;
  db.imageUploaders = (db.imageUploaders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  if (db.imageUploaders.length !== before) audit(db, req.session.user, 'revoke-image-perms', req.params.username, '');
  writeDB(db);
  res.json(db.imageUploaders);
});

// ── admin: Tier 3 grants/revokes Tier 1 — no env var involved, so this
// never needs a redeploy the way Tier 3 membership itself does ────────
app.get('/api/admin/tier1-admins', requireAdmin, (req, res) => {
  res.json(readDB().tier1Admins || []);
});

app.post('/api/admin/tier1-admins', requireTier3, (req, res) => {
  const { username } = req.body || {};
  if (!username || !username.trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[username.trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  db.tier1Admins = db.tier1Admins || [];
  if (!db.tier1Admins.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.tier1Admins.push(record.username);
    audit(db, req.session.user, 'grant-tier1', record.username, '');
    writeDB(db);
  }
  res.status(201).json(db.tier1Admins);
});

app.delete('/api/admin/tier1-admins/:username', requireTier3, (req, res) => {
  const db = readDB();
  const t1Before = (db.tier1Admins || []).length;
  db.tier1Admins = (db.tier1Admins || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  if (db.tier1Admins.length !== t1Before) audit(db, req.session.user, 'revoke-tier1', req.params.username, '');
  writeDB(db);
  res.json(db.tier1Admins);
});

// ── admin: Tier 4 grants/revokes Tier 3 in-app ─────────────────────
// Admins from ADMIN_USERNAMES / data/admins.json ("configured") are fixed
// by whoever controls the deployment and can't be removed from here; only
// ones granted here (db.tier3Admins) can be revoked here.
app.get('/api/admin/tier3-admins', requireTier4, (req, res) => {
  const db = readDB();
  res.json({ granted: db.tier3Admins || [], configured: readAdmins() });
});

app.post('/api/admin/tier3-admins', requireTier4, (req, res) => {
  const { username } = req.body || {};
  if (!username || !String(username).trim()) return res.status(400).json({ error: 'Username is required.' });
  const db = readDB();
  const record = db.users[String(username).trim().toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });
  const lower = record.username.toLowerCase();
  if (isTier4(record.username)) return res.status(400).json({ error: 'That account is already Tier 4.' });
  if (readAdmins().some(a => a.toLowerCase() === lower)) {
    return res.status(400).json({ error: 'That account is already Tier 3 (set by the site owner in ADMIN_USERNAMES / admins.json).' });
  }
  db.tier3Admins = db.tier3Admins || [];
  if (!db.tier3Admins.some(u => u.toLowerCase() === lower)) {
    db.tier3Admins.push(record.username);
    audit(db, req.session.user, 'grant-tier3', record.username, '');
    writeDB(db);
  }
  res.status(201).json({ granted: db.tier3Admins, configured: readAdmins() });
});

app.delete('/api/admin/tier3-admins/:username', requireTier4, (req, res) => {
  const db = readDB();
  const lower = req.params.username.toLowerCase();
  const before = (db.tier3Admins || []).length;
  db.tier3Admins = (db.tier3Admins || []).filter(u => u.toLowerCase() !== lower);
  if (db.tier3Admins.length === before) {
    if (readAdmins().some(a => a.toLowerCase() === lower)) {
      return res.status(400).json({ error: 'That Tier 3 is set in ADMIN_USERNAMES / admins.json \u2014 remove them there.' });
    }
    return res.status(404).json({ error: 'That account was not granted Tier 3 here.' });
  }
  audit(db, req.session.user, 'revoke-tier3', req.params.username, '');
  writeDB(db);
  res.json({ granted: db.tier3Admins, configured: readAdmins() });
});

// ── Overseer: maintenance mode ─────────────────────────────────────
function maintenanceView(db) {
  const m = db.maintenance || {};
  return {
    enabled: !!m.enabled, message: m.message || '', exemptTier4: !!m.exemptTier4,
    startedBy: m.startedBy || null, startedAt: m.startedAt || null,
    forcedOff: process.env.DISABLE_MAINTENANCE === '1'
  };
}
// Public: the maintenance page polls this to know when to reload.
app.get('/api/maintenance', (req, res) => {
  const db = readDB();
  res.json({ enabled: maintenanceActive(db), message: (db.maintenance && db.maintenance.message) || '' });
});
app.get('/api/overseer/maintenance', requireOverseer, (req, res) => {
  res.json(maintenanceView(readDB()));
});
app.post('/api/overseer/maintenance', requireOverseer, (req, res) => {
  const db = readDB();
  const enabled = !!(req.body && req.body.enabled);
  const message = String((req.body && req.body.message) || '').trim().slice(0, 300);
  const exemptTier4 = !!(req.body && req.body.exemptTier4);
  const was = !!(db.maintenance && db.maintenance.enabled);
  const prev = db.maintenance || {};
  db.maintenance = {
    enabled, message, exemptTier4,
    startedBy: enabled ? (was ? prev.startedBy : req.session.user) : null,
    startedAt: enabled ? (was ? prev.startedAt : new Date().toISOString()) : null
  };
  const action = enabled ? (was ? 'maintenance-update' : 'maintenance-on') : (was ? 'maintenance-off' : null);
  if (action) audit(db, req.session.user, action, null, (message || '(no message)') + (enabled && exemptTier4 ? ' [Tier 4 allowed in]' : ''));
  writeDB(db);
  // Tell everyone who just got locked out so their page flips immediately
  // instead of waiting for their next request to fail.
  if (enabled) {
    for (const u of [...notifyClients.keys()]) {
      if (!maintenanceExempt(db, u)) sendToUser(u, 'maintenance', { enabled: true });
    }
  }
  res.json(maintenanceView(db));
});

// ── Site-wide polls ────────────────────────────────────────────────
// Created by an Overseer, voted on by any signed-in user (one vote per
// account, final). Voters see results after voting; Overseers always do.
const POLL_QUESTION_MAX = 200;
const POLL_OPTION_MAX = 80;
const POLL_MAX_OPTIONS = 8;
const POLL_MAX_STORED = 100;
function pollIsOpen(p) {
  return !p.closed && (!p.closesAt || Date.parse(p.closesAt) > Date.now());
}
function pollView(p, username, forceResults) {
  const me = username ? username.toLowerCase() : null;
  const myVote = me ? (p.votes[me] || null) : null;
  const open = pollIsOpen(p);
  const showResults = !!forceResults || !!myVote || !open;
  const counts = {};
  for (const v of Object.values(p.votes)) counts[v] = (counts[v] || 0) + 1;
  const view = {
    id: p.id,
    question: p.question,
    options: p.options.map(o => showResults ? { id: o.id, text: o.text, count: counts[o.id] || 0 } : { id: o.id, text: o.text }),
    closesAt: p.closesAt || null,
    closed: !open,
    myVote,
    createdAt: p.createdAt
  };
  if (showResults) view.totalVotes = Object.keys(p.votes).length;
  if (forceResults) view.createdBy = p.createdBy;
  return view;
}

app.get('/api/polls', requireLogin, (req, res) => {
  const db = readDB();
  res.json((db.polls || []).filter(pollIsOpen).map(p => pollView(p, req.session.user, false)).reverse());
});

app.post('/api/polls/:id/vote', requireLogin, (req, res) => {
  const db = readDB();
  const poll = (db.polls || []).find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: 'That poll doesn\u2019t exist.' });
  if (!pollIsOpen(poll)) return res.status(400).json({ error: 'That poll is closed.' });
  const optionId = String((req.body && req.body.optionId) || '');
  if (!poll.options.some(o => o.id === optionId)) return res.status(400).json({ error: 'Pick one of the options.' });
  const me = req.session.user.toLowerCase();
  if (poll.votes[me]) return res.status(409).json({ error: 'You already voted in this poll.' });
  poll.votes[me] = optionId;
  writeDB(db);
  res.json(pollView(poll, req.session.user, false));
});

app.get('/api/overseer/polls', requireOverseer, (req, res) => {
  const db = readDB();
  res.json((db.polls || []).slice().reverse().map(p => pollView(p, req.session.user, true)));
});

app.post('/api/overseer/polls', requireOverseer, (req, res) => {
  const body = req.body || {};
  const question = String(body.question || '').trim().slice(0, POLL_QUESTION_MAX);
  if (!question) return res.status(400).json({ error: 'A poll needs a question.' });
  const rawOptions = Array.isArray(body.options) ? body.options : [];
  const seen = new Set();
  const options = [];
  for (const o of rawOptions) {
    const text = String(o || '').trim().slice(0, POLL_OPTION_MAX);
    if (!text || seen.has(text.toLowerCase())) continue;
    seen.add(text.toLowerCase());
    options.push({ id: crypto.randomBytes(4).toString('hex'), text });
  }
  if (options.length < 2) return res.status(400).json({ error: 'Give at least two different options.' });
  if (options.length > POLL_MAX_OPTIONS) return res.status(400).json({ error: `Polls are limited to ${POLL_MAX_OPTIONS} options.` });
  let closesAt = null;
  if (body.hours !== undefined && body.hours !== null && body.hours !== '') {
    const hours = Number(body.hours);
    if (!Number.isFinite(hours) || hours <= 0 || hours > 24 * 90) {
      return res.status(400).json({ error: 'Closing time must be between a moment and 90 days.' });
    }
    closesAt = new Date(Date.now() + hours * 3600000).toISOString();
  }
  const db = readDB();
  db.polls = db.polls || [];
  const poll = {
    id: crypto.randomBytes(6).toString('hex'),
    question, options, closesAt,
    closed: false,
    createdBy: req.session.user,
    createdAt: new Date().toISOString(),
    votes: {}
  };
  db.polls.push(poll);
  if (db.polls.length > POLL_MAX_STORED) db.polls.splice(0, db.polls.length - POLL_MAX_STORED);
  audit(db, req.session.user, 'poll-create', null, question);
  writeDB(db);
  notifyAllOnline('poll-new', { id: poll.id });
  res.status(201).json(pollView(poll, req.session.user, true));
});

app.post('/api/overseer/polls/:id/close', requireOverseer, (req, res) => {
  const db = readDB();
  const poll = (db.polls || []).find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: 'That poll doesn\u2019t exist.' });
  poll.closed = true;
  audit(db, req.session.user, 'poll-close', null, poll.question);
  writeDB(db);
  notifyAllOnline('poll-update', {});
  res.json(pollView(poll, req.session.user, true));
});

app.delete('/api/overseer/polls/:id', requireOverseer, (req, res) => {
  const db = readDB();
  const poll = (db.polls || []).find(p => p.id === req.params.id);
  if (!poll) return res.status(404).json({ error: 'That poll doesn\u2019t exist.' });
  db.polls = db.polls.filter(p => p.id !== req.params.id);
  audit(db, req.session.user, 'poll-delete', null, poll.question);
  writeDB(db);
  notifyAllOnline('poll-update', {});
  res.json({ ok: true });
});

// ── admin: audit log (Tier 4 only) ─────────────────────────────────
app.get('/api/admin/audit-log', requireTier4, (req, res) => {
  const db = readDB();
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 100, 1), 500);
  const q = String(req.query.q || '').trim().toLowerCase();
  let list = db.auditLog || [];
  if (q) list = list.filter(e => [e.actor, e.action, e.target, e.detail].some(v => String(v || '').toLowerCase().includes(q)));
  res.json(list.slice(-limit).reverse());
});

// ── admin: Tier 3 can hand out Seals directly ──────────────────────
app.post('/api/admin/give-seals', requireTier3, (req, res) => {
  const { username: rawUsername, amount: rawAmount } = req.body || {};
  const username = String(rawUsername || '').trim();
  const amount = Number(rawAmount);
  if (!username) return res.status(400).json({ error: 'Username is required.' });
  if (!Number.isFinite(amount) || amount <= 0) {
    return res.status(400).json({ error: 'Enter a positive amount of Seals.' });
  }

  const db = readDB();
  const record = db.users[username.toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });

  record.seals = Math.round((record.seals + amount) * 100) / 100;
  audit(db, req.session.user, 'give-seals', record.username, `+${amount}`);
  writeDB(db);
  res.json({ username: record.username, seals: record.seals });
});

// ── Tier 2 — cosmetic only, no permissions. Anyone signed in who knows
// the password can unlock it; the only way to find the password box is
// through the Admin Panel, but the check itself doesn't require being
// an admin — there's nothing here worth protecting beyond that.
app.post('/api/admin/tier2', requireLogin, (req, res) => {
  if (!TIER2_PASSWORD) return res.status(503).json({ error: 'The Tier 2 unlock isn\u2019t configured on this server.' });
  const tier2Key = req.session.user.toLowerCase();
  const tier2Wait = tier2Limiter.retryAfterMs(tier2Key);
  if (tier2Wait) return tooManyAttempts(res, tier2Wait);
  const password = String((req.body && req.body.password) || '');
  if (!safeEqual(password, TIER2_PASSWORD)) {
    tier2Limiter.fail(tier2Key);
    return res.status(400).json({ error: 'Incorrect password.' });
  }
  tier2Limiter.reset(tier2Key);
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  db.tier2Users = db.tier2Users || [];
  if (!db.tier2Users.some(u => u.toLowerCase() === record.username.toLowerCase())) {
    db.tier2Users.push(record.username);
    writeDB(db);
  }
  res.json({ isTier2: true });
});

// ── User Management ────────────────────────────────────────────────
// A searchable/sortable table plus per-account moderation actions.
// Permission model:
//   Tier 3: mute, force sign-out, reset password, and ESCALATE a user
//           (or another Tier 3) to Tier 4 asking for a ban or a suspension,
//           with a short reason. Tier 3 can NOT ban or suspend directly.
//   Tier 4: everything Tier 3 can do, plus ban/unban and suspend/unsuspend
//           anyone below Tier 4 (Tier 3 admins included), and
//           review/dismiss escalations.
// Tier 4 accounts can't be banned or suspended from in here — Tier 4 is
// the owner level and only comes from TIER4_USERNAMES (or data/tier4.json),
// so locking them out this way could leave nobody able to undo it. Tier 4
// accounts also can't be acted on at all by anyone below Tier 4.
const ESCALATION_REASON_MAX = 300;

function openEscalationFor(db, username) {
  return (db.escalations || []).find(e => e.status === 'open' && e.target.toLowerCase() === username.toLowerCase()) || null;
}
function adminUserSummary(record, db) {
  const esc = openEscalationFor(db, record.username);
  return {
    username: record.username,
    createdAt: record.createdAt,
    seals: record.seals,
    holdingsValue: market.holdingsValue(db, record),
    netWorth: market.netWorth(db, record),
    isOverseer: isOverseer(record.username),
    isTier4: isTier4(record.username),
    isTier3: isTier3(record.username),
    isTier1: isTier1(record.username),
    isTier2: isTier2(record.username),
    isAdmin: isAdmin(record.username),
    banned: !!record.banned,
    banReason: record.banReason || '',
    suspendedUntil: record.suspendedUntil || null,
    jailed: !!record.jailed,
    jailReason: record.jailReason || '',
    muted: !!record.muted,
    muteReason: record.muteReason || '',
    escalated: !!esc,
    chatMessageCount: (record.stats && record.stats.chatMessageCount) || 0
  };
}
function findManagedUser(db, res, usernameParam) {
  const record = db.users[String(usernameParam || '').toLowerCase()];
  if (!record) {
    res.status(404).json({ error: 'No account with that username exists.' });
    return null;
  }
  return record;
}
// Tier 4 accounts can only be acted on by other Tier 4s. Without this a
// Tier 3 could reset a Tier 4's password (or force-logout/mute them) and
// take over the account. Returns true (and sends the 403) when blocked.
function blockedByHigherTier(req, res, record) {
  if (record.username.toLowerCase() === req.session.user.toLowerCase()) return false; // your own account
  // Tier 4 and Overseer accounts are off-limits to everyone but an Overseer
  // (otherwise a Tier 4 could reset a fellow Tier 4's password and take
  // over their account).
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    res.status(403).json({ error: "Only an Overseer can do that to a Tier 4 account." });
    return true;
  }
  return false;
}
// Tells the Tier 3 who filed an escalation how it turned out: a bell
// notification (so they see it even if offline) plus a live pop-up.
function notifyEscalationResolved(db, e) {
  const escalator = db.users[String(e.escalatedBy).toLowerCase()];
  if (!escalator) return;
  const text = e.status === 'dismissed'
    ? `Your escalation of ${e.target} was dismissed by ${e.resolvedBy}${e.resolution ? ': ' + e.resolution : '.'}`
    : `Your escalation of ${e.target} was resolved: ${e.target} was ${e.status} by ${e.resolvedBy}.`;
  addNotification(escalator, text);
  sendToUser(escalator.username, 'admin-notify', { kind: 'escalation-resolved', text });
}
function resolveEscalations(db, username, status, by, note) {
  let any = false;
  for (const e of (db.escalations || [])) {
    if (e.status === 'open' && e.target.toLowerCase() === username.toLowerCase()) {
      e.status = status;
      e.resolvedBy = by;
      e.resolvedAt = new Date().toISOString();
      e.resolution = String(note || '').slice(0, ESCALATION_REASON_MAX);
      notifyEscalationResolved(db, e);
      any = true;
    }
  }
  // Keep every Tier 4's open-escalations badge in sync.
  if (any) notifyOnlineTier4('admin-notify', { kind: 'escalations-changed' });
}

app.get('/api/admin/users', requireTier3, (req, res) => {
  const db = readDB();
  res.json(Object.values(db.users).map(u => adminUserSummary(u, db)));
});

// Tier 3 → Tier 4 escalation. Replaces direct banning for Tier 3.
app.post('/api/admin/users/:username/escalate', requireTier3, (req, res) => {
  if (isTier4(req.session.user)) {
    return res.status(400).json({ error: "You're Tier 4 — you can ban directly, no need to escalate." });
  }
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isTier4(record.username)) return res.status(400).json({ error: "Can't escalate a Tier 4 admin." });
  if (record.username.toLowerCase() === req.session.user.toLowerCase()) return res.status(400).json({ error: "You can't escalate yourself." });
  if (record.banned) return res.status(400).json({ error: 'That account is already banned.' });
  const action = (req.body && req.body.action) === 'suspend' ? 'suspend' : 'ban';
  const reason = String((req.body && req.body.reason) || '').trim().slice(0, ESCALATION_REASON_MAX);
  if (!reason) return res.status(400).json({ error: 'Add a short description of why you\u2019re escalating this user.' });
  if (openEscalationFor(db, record.username)) {
    return res.status(409).json({ error: 'That user already has an open escalation.' });
  }
  db.escalations = db.escalations || [];
  db.escalations.push({
    id: crypto.randomBytes(8).toString('hex'),
    target: record.username,
    escalatedBy: req.session.user,
    action, // what the Tier 3 is asking for: 'ban' or 'suspend'
    reason,
    status: 'open',
    createdAt: new Date().toISOString(),
    resolvedBy: null,
    resolvedAt: null,
    resolution: ''
  });
  audit(db, req.session.user, 'escalate-' + action, record.username, reason);
  writeDB(db);
  notifyOnlineTier4('admin-notify', {
    kind: 'escalation-new',
    text: `${req.session.user} escalated ${record.username} for a ${action === 'ban' ? 'ban' : 'suspension'}: ${reason}`
  });
  res.status(201).json(adminUserSummary(record, db));
});

// Tier 4 sees every escalation; Tier 3 only sees the ones they filed
// (so they can tell whether it's still pending, banned, or dismissed).
app.get('/api/admin/escalations', requireTier3, (req, res) => {
  const db = readDB();
  let list = db.escalations || [];
  if (!isTier4(req.session.user)) {
    list = list.filter(e => e.escalatedBy.toLowerCase() === req.session.user.toLowerCase());
  }
  res.json(list.slice().sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt))).slice(0, 200));
});

app.get('/api/admin/escalations/count', requireTier4, (req, res) => {
  res.json({ open: (readDB().escalations || []).filter(e => e.status === 'open').length });
});

app.post('/api/admin/escalations/:id/dismiss', requireTier4, (req, res) => {
  const db = readDB();
  const esc = (db.escalations || []).find(e => e.id === req.params.id);
  if (!esc) return res.status(404).json({ error: 'No such escalation.' });
  if (esc.status !== 'open') return res.status(400).json({ error: 'That escalation is already resolved.' });
  esc.status = 'dismissed';
  esc.resolvedBy = req.session.user;
  esc.resolvedAt = new Date().toISOString();
  esc.resolution = String((req.body && req.body.note) || '').slice(0, ESCALATION_REASON_MAX);
  audit(db, req.session.user, 'dismiss-escalation', esc.target, esc.resolution);
  notifyEscalationResolved(db, esc);
  writeDB(db);
  notifyOnlineTier4('admin-notify', { kind: 'escalations-changed' });
  res.json(esc);
});

app.post('/api/admin/users/:username/ban', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isOverseer(record.username)) return res.status(400).json({ error: "Can't ban an Overseer." });
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can ban a Tier 4 admin.' });
  }
  record.banned = true;
  record.banReason = String((req.body && req.body.reason) || '').slice(0, 300);
  record.suspendedUntil = null;
  record.sessionVersion += 1; // force sign-out everywhere
  resolveEscalations(db, record.username, 'banned', req.session.user, record.banReason);
  audit(db, req.session.user, 'ban', record.username, record.banReason);
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/unban', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can unban a Tier 4 admin.' });
  }
  record.banned = false;
  record.banReason = '';
  record.suspendedUntil = null;
  audit(db, req.session.user, 'unban', record.username, '');
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

// Jail / release — Tier 4 only, same protections as ban/suspend: nobody can
// jail an Overseer, and jailing another Tier 4 takes an Overseer. Unlike a
// ban this does NOT sign the user out — that's the point: they log in and
// land on the seal page.
app.post('/api/admin/users/:username/jail', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (record.username.toLowerCase() === req.session.user.toLowerCase()) return res.status(400).json({ error: "You can't jail yourself." });
  if (isOverseer(record.username)) return res.status(400).json({ error: "Can't jail an Overseer." });
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can jail a Tier 4 admin.' });
  }
  record.jailed = true;
  record.jailReason = String((req.body && req.body.reason) || '').slice(0, 300);
  audit(db, req.session.user, 'jail', record.username, record.jailReason);
  writeDB(db);
  // Any tab they already have open jumps to the jail page right away.
  sendToUser(record.username, 'jailed', {});
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/unjail', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can release a Tier 4 admin.' });
  }
  record.jailed = false;
  record.jailReason = '';
  audit(db, req.session.user, 'unjail', record.username, '');
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/suspend', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isOverseer(record.username)) return res.status(400).json({ error: "Can't suspend an Overseer." });
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can suspend a Tier 4 admin.' });
  }
  const hours = Number(req.body && req.body.hours);
  if (!Number.isFinite(hours) || hours <= 0) return res.status(400).json({ error: 'Enter a positive number of hours.' });
  record.suspendedUntil = new Date(Date.now() + hours * 3600000).toISOString();
  record.banReason = String((req.body && req.body.reason) || '').slice(0, 300);
  record.sessionVersion += 1; // force sign-out everywhere
  resolveEscalations(db, record.username, 'suspended', req.session.user, record.banReason);
  audit(db, req.session.user, 'suspend', record.username, `${hours}h${record.banReason ? ': ' + record.banReason : ''}`);
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/unsuspend', requireTier4, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (isTier4(record.username) && !isOverseer(req.session.user)) {
    return res.status(403).json({ error: 'Only an Overseer can unsuspend a Tier 4 admin.' });
  }
  record.suspendedUntil = null;
  record.banReason = '';
  audit(db, req.session.user, 'unsuspend', record.username, '');
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/mute', requireTier3, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (blockedByHigherTier(req, res, record)) return;
  record.muted = true;
  record.muteReason = String((req.body && req.body.reason) || '').slice(0, 300);
  audit(db, req.session.user, 'mute', record.username, record.muteReason);
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/unmute', requireTier3, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (blockedByHigherTier(req, res, record)) return;
  record.muted = false;
  record.muteReason = '';
  audit(db, req.session.user, 'unmute', record.username, '');
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/force-logout', requireTier3, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (blockedByHigherTier(req, res, record)) return;
  record.sessionVersion += 1;
  audit(db, req.session.user, 'force-logout', record.username, '');
  writeDB(db);
  res.json(adminUserSummary(record, db));
});

app.post('/api/admin/users/:username/reset-password', requireTier3, (req, res) => {
  const db = readDB();
  const record = findManagedUser(db, res, req.params.username);
  if (!record) return;
  if (blockedByHigherTier(req, res, record)) return;
  const newPassword = (req.body && req.body.newPassword) || '';
  if (newPassword.length < 6) return res.status(400).json({ error: 'Password must be at least 6 characters.' });
  record.passwordHash = bcrypt.hashSync(newPassword, 10);
  record.sessionVersion += 1; // the old password no longer works anywhere, so sign out every existing session too
  audit(db, req.session.user, 'reset-password', record.username, '');
  writeDB(db);
  res.json({ ok: true });
});

// ── Seals wallet, shop, and profiles ──────────────────────────────
app.post('/api/seals/daily', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  const now = Date.now();
  const last = record.lastDailyClaim ? new Date(record.lastDailyClaim).getTime() : 0;
  const nextClaimAt = last + DAILY_COOLDOWN_MS;
  if (now < nextClaimAt) {
    return res.status(429).json({ error: 'You already claimed today\u2019s Seals.', nextClaimAt });
  }
  record.seals += DAILY_SEALS;
  record.lastDailyClaim = new Date(now).toISOString();
  record.stats.totalDailyClaims += 1;
  checkBadges(record);
  writeDB(db);
  res.json({ seals: record.seals, awarded: DAILY_SEALS, nextClaimAt: now + DAILY_COOLDOWN_MS });
});

app.get('/api/seals/daily', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  const last = record.lastDailyClaim ? new Date(record.lastDailyClaim).getTime() : 0;
  res.json({ seals: record.seals, nextClaimAt: last + DAILY_COOLDOWN_MS });
});

// ── Trending ────────────────────────────────────────────────────────
// Every playtime ping is also tallied per game per day: seconds played and
// which accounts played. Only counts and usernames-as-a-set are kept (the
// usernames never leave the server — the trending API returns counts only).
// Days older than TRENDING_KEEP_DAYS are dropped so this stays small.
const TRENDING_WINDOW_DAYS = 7;
const TRENDING_KEEP_DAYS = 14;
const TRENDING_DECAY = 0.8;          // yesterday counts 80% as much as today, and so on
const TRENDING_MAX_PLAYERS_PER_DAY = 500;

function dayKey(ms) { return new Date(ms).toISOString().slice(0, 10); }

function recordGamePlay(db, gameId, username, seconds, now) {
  if (!db.gameStats || typeof db.gameStats !== 'object') db.gameStats = {};
  // Ignore ids that aren't actual games, so a client can't create junk entries.
  if (!db.games.some(g => g.id === gameId)) return;
  const today = dayKey(now);
  const entry = db.gameStats[gameId] || (db.gameStats[gameId] = { days: {} });
  const day = entry.days[today] || (entry.days[today] = { seconds: 0, players: [] });
  day.seconds += seconds;
  const u = username.toLowerCase();
  if (!day.players.includes(u) && day.players.length < TRENDING_MAX_PLAYERS_PER_DAY) day.players.push(u);
  const cutoff = dayKey(now - TRENDING_KEEP_DAYS * 86400000);
  for (const d of Object.keys(entry.days)) if (d < cutoff) delete entry.days[d];
}

function computeTrending(db, now, limit) {
  const stats = db.gameStats || {};
  const out = [];
  for (const game of db.games) {
    const entry = stats[game.id];
    if (!entry || !entry.days) continue;
    let score = 0, seconds = 0;
    const players = new Set();
    for (let age = 0; age < TRENDING_WINDOW_DAYS; age++) {
      const day = entry.days[dayKey(now - age * 86400000)];
      if (!day) continue;
      const daySeconds = Number(day.seconds) || 0;
      const dayPlayers = Array.isArray(day.players) ? day.players : [];
      score += Math.pow(TRENDING_DECAY, age) * (dayPlayers.length * 10 + daySeconds / 60);
      seconds += daySeconds;
      dayPlayers.forEach(p => players.add(p));
    }
    if (score > 0) out.push({ id: game.id, players: players.size, minutes: Math.round(seconds / 60), score });
  }
  out.sort((a, b) => b.score - a.score || b.players - a.players || a.id.localeCompare(b.id));
  return out.slice(0, limit).map((e, i) => ({ id: e.id, rank: i + 1, players: e.players, minutes: e.minutes }));
}

// Public, like the games list itself. Counts only — no usernames.
app.get('/api/trending', (req, res) => {
  const limit = Math.max(1, Math.min(parseInt(req.query.limit, 10) || 6, 20));
  res.json({ windowDays: TRENDING_WINDOW_DAYS, items: computeTrending(readDB(), Date.now(), limit) });
});

// Called every ~PLAY_PING_INTERVAL_S seconds by play.html while a game is
// open and the tab is focused. Only the elapsed time SINCE THE LAST PING
// FROM THIS SAME ENDPOINT is credited (clamped to PLAY_MAX_GAP_S), so a
// client can't claim a huge gap, and skipping pings while backgrounded
// just means that stretch earns nothing rather than a burst on return.
app.post('/api/seals/playtime-ping', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  const now = Date.now();
  const today = new Date(now).toISOString().slice(0, 10);

  if (record.playtime.date !== today) {
    record.playtime.date = today;
    record.playtime.accumSeconds = 0;
    record.playtime.sealsToday = 0;
  }

  let elapsed = 0;
  if (record.playtime.lastTick) {
    elapsed = Math.max(0, Math.min((now - record.playtime.lastTick) / 1000, PLAY_MAX_GAP_S));
  }
  record.playtime.lastTick = now;
  record.playtime.accumSeconds += elapsed;
  record.stats.lifetimePlaySeconds += elapsed;

  const { gameId, gameName } = req.body || {};
  if (gameId && gameName) {
    record.nowPlaying = { gameId: String(gameId).slice(0, 100), gameName: String(gameName).slice(0, 100), lastPing: now };
  }
  if (gameId) recordGamePlay(db, String(gameId).slice(0, 100), req.session.user, elapsed, now);

  let awarded = 0;
  while (record.playtime.accumSeconds >= PLAY_SEAL_INTERVAL_S && record.playtime.sealsToday < PLAY_DAILY_CAP) {
    record.playtime.accumSeconds -= PLAY_SEAL_INTERVAL_S;
    record.seals += 1;
    record.playtime.sealsToday += 1;
    awarded += 1;
  }
  checkBadges(record);
  writeDB(db);
  res.json({ seals: record.seals, awarded, sealsToday: record.playtime.sealsToday, dailyCap: PLAY_DAILY_CAP });
});

// ── Seal SDK — server-validated in-game rewards ────────────────────
// Games call Seal.reward(key, amount, label) via postMessage; play.html
// forwards that (with the actually-signed-in user attached) to this
// route. A game's own claimed amount is never trusted as-is:
//   - amount is clamped to REWARD_MAX_PER_CLAIM per call
//   - each (game, key) pair can only ever pay out once per player —
//     a buggy or malicious game calling reward('level-3', 10) in a
//     tight loop just gets "alreadyClaimed" after the first call
//   - a lifetime-per-game cap stops a game from working around that by
//     generating lots of unique keys instead
const REWARD_MAX_PER_CLAIM = 25;
const REWARD_MAX_PER_GAME = 200;
const REWARD_KEY_MAX = 60;
const REWARD_RATE_LIMIT_MS = 500;
const lastRewardAt = new Map();

app.post('/api/rewards/grant', requireLogin, (req, res) => {
  const { gameId, key: rawKey, amount: rawAmount, label } = req.body || {};
  if (!gameId) return res.status(400).json({ error: 'gameId is required.' });
  const key = String(rawKey || '').trim().slice(0, REWARD_KEY_MAX);
  if (!key) return res.status(400).json({ error: 'A reward key is required.' });
  const requested = Number(rawAmount);
  if (!Number.isFinite(requested) || requested <= 0) {
    return res.status(400).json({ error: 'amount must be a positive number.' });
  }

  const db = readDB();
  if (!(db.games || []).some(g => g.id === gameId)) {
    return res.status(404).json({ error: 'Unknown gameId.' });
  }

  const now = Date.now();
  const last = lastRewardAt.get(req.session.user) || 0;
  if (now - last < REWARD_RATE_LIMIT_MS) return res.status(429).json({ error: 'Slow down a little.' });
  lastRewardAt.set(req.session.user, now);

  const record = db.users[req.session.user.toLowerCase()];
  record.claimedRewards[gameId] = record.claimedRewards[gameId] || {};
  const gameRewards = record.claimedRewards[gameId];

  if (gameRewards[key]) {
    return res.json({ seals: record.seals, awarded: 0, alreadyClaimed: true, capped: false });
  }

  const amount = Math.min(requested, REWARD_MAX_PER_CLAIM);
  const alreadyEarnedThisGame = Object.values(gameRewards).reduce((sum, r) => sum + r.amount, 0);
  const remaining = Math.max(0, REWARD_MAX_PER_GAME - alreadyEarnedThisGame);
  const awarded = Math.min(amount, remaining);

  if (awarded <= 0) {
    // Still record the claim (with 0 awarded) so a game that keeps
    // calling the same key after hitting the cap gets a consistent
    // "alreadyClaimed" from here on instead of silently doing nothing
    // forever.
    gameRewards[key] = { amount: 0, claimedAt: new Date(now).toISOString() };
    writeDB(db);
    return res.json({ seals: record.seals, awarded: 0, alreadyClaimed: false, capped: true });
  }

  gameRewards[key] = { amount: awarded, claimedAt: new Date(now).toISOString() };
  record.seals = Math.round((record.seals + awarded) * 100) / 100;
  checkBadges(record);
  if (label) {
    addNotification(record, `${String(label).slice(0, 100)} \u2014 +${awarded} Seal${awarded === 1 ? '' : 's'}`);
  }
  writeDB(db);
  res.json({ seals: record.seals, awarded, alreadyClaimed: false, capped: awarded < amount });
});

app.post('/api/now-playing/stop', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  record.nowPlaying = null;
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/badges', (req, res) => {
  res.json(BADGES);
});

// ── cookie sync — carries game-save cookies between devices on the same
// account (localStorage alone never leaves one browser, so it can't do
// this by itself; this is the server-backed piece that actually can) ──
const COOKIE_SYNC_MAX_BYTES = 50 * 1024; // 50KB is generous for cookie data

app.get('/api/cookie-sync', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  res.json(record.cookieSync || null);
});

app.put('/api/cookie-sync', requireLogin, (req, res) => {
  const data = (req.body && req.body.data) || {};
  if (typeof data !== 'object' || Array.isArray(data)) {
    return res.status(400).json({ error: 'Invalid cookie data.' });
  }
  const serialized = JSON.stringify(data);
  if (serialized.length > COOKIE_SYNC_MAX_BYTES) {
    return res.status(400).json({ error: 'That\u2019s too much cookie data to sync.' });
  }
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  record.cookieSync = { data, updatedAt: new Date().toISOString(), byteSize: serialized.length };
  writeDB(db);
  res.json(record.cookieSync);
});

// ── localStorage sync — same idea as cookie sync, for games that keep their
// save in localStorage (same-origin games share the play page's storage) ──
const STORAGE_SYNC_MAX_BYTES = 3 * 1024 * 1024; // express.json's limit is 5MB, so stay under it

app.get('/api/storage-sync', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  res.json(record.storageSync || null);
});

app.put('/api/storage-sync', requireLogin, (req, res) => {
  const data = (req.body && req.body.data) || {};
  if (typeof data !== 'object' || Array.isArray(data) || Object.values(data).some(v => typeof v !== 'string')) {
    return res.status(400).json({ error: 'Invalid storage data.' });
  }
  const serialized = JSON.stringify(data);
  if (serialized.length > STORAGE_SYNC_MAX_BYTES) {
    return res.status(400).json({ error: 'That\u2019s too much save data to sync.' });
  }
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  record.storageSync = { data, updatedAt: new Date().toISOString(), byteSize: serialized.length };
  writeDB(db);
  res.json({ updatedAt: record.storageSync.updatedAt, byteSize: record.storageSync.byteSize });
});

// ── IndexedDB sync storage ───────────────────────────────────────
// Games that keep their save in IndexedDB can be large (a whole virtual
// file system, a Minecraft world…), so these snapshots are deliberately NOT
// kept in db.json: every writeDB() rewrites that whole file (or the single
// MongoDB document that mirrors it, which has a hard 16MB limit). Instead
// each account gets one opaque gzip blob, stored as a private file under
// DATA_DIR/idbsync/ — or in GridFS when MONGODB_URI is set, so it survives
// restarts on hosts without a persistent disk, like the rest of the data.
// The server never parses it; the browser builds and reads it. Writes use
// If-Match / If-None-Match with the blob's hash so two devices can't
// silently overwrite each other's changes.
const IDB_SYNC_MAX_BYTES = 20 * 1024 * 1024;
const IDB_SYNC_DIR = path.join(DATA_DIR, 'idbsync');

function idbSyncFile(user) {
  // hashed so a username can never influence the file path
  return path.join(IDB_SYNC_DIR, crypto.createHash('sha256').update(user.toLowerCase()).digest('hex') + '.bin');
}
async function idbFsGet(user) {
  const file = idbSyncFile(user);
  try {
    const [data, stat] = await Promise.all([fs.promises.readFile(file), fs.promises.stat(file)]);
    return { data, updatedAt: stat.mtime };
  } catch (err) {
    if (err.code === 'ENOENT') return null;
    throw err;
  }
}
async function idbFsPut(user, data) {
  fs.mkdirSync(IDB_SYNC_DIR, { recursive: true });
  const file = idbSyncFile(user);
  const tmp = file + '.tmp';
  await fs.promises.writeFile(tmp, data);
  await fs.promises.rename(tmp, file); // atomic swap — a crash never leaves a half-written save
}
function idbBucket() {
  return new GridFSBucket(mongoClient.db(MONGODB_DB_NAME), { bucketName: 'idbsync' });
}
async function idbMongoGet(user) {
  const bucket = idbBucket();
  const filename = 'idb:' + user.toLowerCase();
  const files = await bucket.find({ filename }).sort({ uploadDate: -1 }).limit(1).toArray();
  if (!files.length) return null;
  const chunks = [];
  for await (const chunk of bucket.openDownloadStream(files[0]._id)) chunks.push(chunk);
  return { data: Buffer.concat(chunks), updatedAt: files[0].uploadDate };
}
async function idbMongoPut(user, data) {
  const bucket = idbBucket();
  const filename = 'idb:' + user.toLowerCase();
  const older = await bucket.find({ filename }).toArray();
  await new Promise((resolve, reject) => {
    const up = bucket.openUploadStream(filename);
    up.on('error', reject);
    up.on('finish', resolve);
    up.end(data);
  });
  // only after the new copy is safely stored
  for (const f of older) { try { await bucket.delete(f._id); } catch {} }
}
const idbGet = user => (USING_MONGO ? idbMongoGet(user) : idbFsGet(user));
const idbPut = (user, data) => (USING_MONGO ? idbMongoPut(user, data) : idbFsPut(user, data));
const idbEtag = data => '"' + crypto.createHash('sha1').update(data).digest('hex') + '"';

// one request at a time per account, so a read-compare-write can't interleave
const idbLocks = new Map();
function withIdbLock(user, fn) {
  const key = user.toLowerCase();
  const run = (idbLocks.get(key) || Promise.resolve()).catch(() => {}).then(fn);
  idbLocks.set(key, run);
  run.catch(() => {}).then(() => { if (idbLocks.get(key) === run) idbLocks.delete(key); });
  return run;
}

app.get('/api/idb-sync', requireLogin, async (req, res) => {
  try {
    const rec = await withIdbLock(req.session.user, () => idbGet(req.session.user));
    if (!rec) return res.status(204).end();
    const etag = idbEtag(rec.data);
    res.set({ 'Cache-Control': 'no-store', 'ETag': etag, 'X-Updated-At': new Date(rec.updatedAt).toISOString() });
    if (req.get('If-None-Match') === etag) return res.status(304).end();
    res.set('Content-Type', 'application/octet-stream');
    res.end(rec.data);
  } catch (err) {
    console.error('IndexedDB sync read failed:', err.message);
    res.status(500).json({ error: 'Could not load synced game data.' });
  }
});

app.put('/api/idb-sync', requireLogin,
  express.raw({ type: 'application/octet-stream', limit: IDB_SYNC_MAX_BYTES }),
  async (req, res) => {
    const body = req.body;
    if (!Buffer.isBuffer(body) || body.length < 2 || body[0] !== 0x1f || body[1] !== 0x8b) {
      return res.status(400).json({ error: 'Expected a gzip body.' });
    }
    const ifMatch = req.get('If-Match');
    const ifNoneMatch = req.get('If-None-Match');
    if (!ifMatch && ifNoneMatch !== '*') return res.status(428).json({ error: 'Send If-Match or If-None-Match: *.' });
    try {
      const result = await withIdbLock(req.session.user, async () => {
        const cur = await idbGet(req.session.user);
        const curEtag = cur ? idbEtag(cur.data) : null;
        const ok = ifNoneMatch === '*' ? !cur : curEtag === ifMatch;
        if (!ok) return { conflict: true, etag: curEtag };
        await idbPut(req.session.user, body);
        return { etag: idbEtag(body), updatedAt: new Date().toISOString() };
      });
      if (result.conflict) {
        if (result.etag) res.set('ETag', result.etag);
        return res.status(412).json({ error: 'Out of date.' });
      }
      res.json({ etag: result.etag, updatedAt: result.updatedAt, byteSize: body.length });
    } catch (err) {
      console.error('IndexedDB sync write failed:', err.message);
      res.status(500).json({ error: 'Could not save game data.' });
    }
  });

app.get('/api/notifications', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  res.json(record.notifications || []);
});

app.post('/api/notifications/read-all', requireLogin, (req, res) => {
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  (record.notifications || []).forEach(n => { n.read = true; });
  writeDB(db);
  res.json({ ok: true });
});

app.get('/api/shop', (req, res) => {
  const db = readDB();
  const record = req.session.user ? db.users[req.session.user.toLowerCase()] : null;
  const owned = record ? record.inventory : [];
  const rings = (db.rings || []).map(r => ({ id: r.id, kind: 'ring', label: r.label, price: r.price, value: r.imageUrl, uploadedBy: r.uploadedBy }));
  res.json([...allShopItems(), ...rings].map(item => ({ ...item, owned: owned.includes(item.id) })));
});

app.post('/api/shop/buy', requireLogin, (req, res) => {
  const { itemId } = req.body || {};
  const db = readDB();
  const item = findAnyShopItem(db, itemId);
  if (!item) return res.status(404).json({ error: 'Unknown item.' });

  const record = db.users[req.session.user.toLowerCase()];
  if (record.inventory.includes(item.id)) return res.status(409).json({ error: 'You already own that.' });
  if (record.seals < item.price) return res.status(400).json({ error: 'Not enough Seals.' });

  record.seals -= item.price;
  record.inventory.push(item.id);
  record.stats.totalPurchases += 1;
  checkBadges(record);

  if (item.kind === 'ring' && item.uploadedBy && item.uploadedBy.toLowerCase() !== req.session.user.toLowerCase()) {
    const uploaderRecord = db.users[item.uploadedBy.toLowerCase()];
    if (uploaderRecord) addNotification(uploaderRecord, `${req.session.user} bought your ring \u201c${item.label}\u201d!`);
  }

  writeDB(db);
  res.json({ seals: record.seals, inventory: record.inventory });
});

// ── Market — a Seals-only stock market. Server owns the prices and the
// ledger; see market.js for the tuning knobs. ─────────────────────
market(app, { readDB, writeDB, requireLogin });

// ── Rings — a Shop category admins (or permitted users) can add to,
// rather than a fixed in-code catalog like the other cosmetics ─────
app.post('/api/rings', requireLogin, (req, res) => {
  if (!canUploadRings(req.session.user)) {
    return res.status(403).json({ error: 'Uploading Rings isn\u2019t open to your account. Ask an admin to grant you access.' });
  }
  ringImageUpload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No image received.' });

    const label = (req.body.label || '').trim().slice(0, 40);
    const price = Math.max(0, Math.round(Number(req.body.price)) || 0);
    if (!label) {
      return res.status(400).json({ error: 'Give the ring a name.' });
    }

    let transparency;
    try {
      transparency = await validateRingTransparency(req.file.buffer);
    } catch (imgErr) {
      return res.status(400).json({ error: 'Couldn\u2019t read that image \u2014 try re-exporting it as a PNG.' });
    }
    if (!transparency.ok) {
      return res.status(400).json({ error: transparency.error });
    }

    const ext = RING_IMAGE_EXT_BY_MIME[req.file.mimetype] || '.png';
    const filename = `ring-${crypto.randomUUID()}${ext}`;
    const imageUrl = await storeUpload(req.file.buffer, 'rings', filename, req.file.mimetype);

    const ring = {
      id: `ring-${crypto.randomUUID()}`,
      label,
      price,
      imageUrl,
      uploadedBy: req.session.user,
      createdAt: new Date().toISOString()
    };
    const db = readDB();
    db.rings = db.rings || [];
    db.rings.push(ring);
    writeDB(db);
    res.status(201).json(ring);
  });
});

app.delete('/api/rings/:id', requireLogin, (req, res) => {
  const db = readDB();
  const ring = (db.rings || []).find(r => r.id === req.params.id);
  if (!ring) return res.status(404).json({ error: 'Ring not found.' });
  if (ring.uploadedBy !== req.session.user && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'You can only remove rings you uploaded.' });
  }
  db.rings = db.rings.filter(r => r.id !== req.params.id);
  writeDB(db);
  deleteUpload('rings', ring.imageUrl).catch(() => {});
  res.json({ ok: true });
});

app.get('/api/leaderboard', (req, res) => {
  const db = readDB();
  const list = Object.values(db.users)
    .map(u => publicProfile(u, db))
    .sort((a, b) => b.seals - a.seals)
    .slice(0, 10);
  res.json(list);
});

app.get('/api/profile/:username', (req, res) => {
  const db = readDB();
  const record = db.users[req.params.username.toLowerCase()];
  if (!record) return res.status(404).json({ error: 'No account with that username exists.' });
  res.json(publicProfile(record, db));
});

// ── Profile guestbook ────────────────────────────────────────────
const COMMENT_MAX_LEN = 300;
const lastCommentAt = new Map(); // username -> timestamp, simple per-user rate limit
const COMMENT_RATE_LIMIT_MS = 5000;

app.get('/api/profile/:username/comments', (req, res) => {
  const db = readDB();
  const target = req.params.username.toLowerCase();
  if (!db.users[target]) return res.status(404).json({ error: 'No account with that username exists.' });
  const comments = (db.profileComments || [])
    .filter(c => c.profileUsername.toLowerCase() === target)
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
  res.json(comments.map(c => ({
    id: c.id,
    author: c.author,
    authorIsAdmin: isAdmin(c.author),
    authorIsTier3: isTier3(c.author),
    authorIsTier4: isTier4(c.author),
    authorIsOverseer: isOverseer(c.author),
    authorIsTier1: isTier1(c.author),
    authorIsTier2: isTier2(c.author),
    text: c.text,
    createdAt: c.createdAt
  })));
});

app.post('/api/profile/:username/comments', requireLogin, (req, res) => {
  const db = readDB();
  const target = req.params.username.toLowerCase();
  const targetRecord = db.users[target];
  if (!targetRecord) return res.status(404).json({ error: 'No account with that username exists.' });

  const authorRecord = db.users[req.session.user.toLowerCase()];
  if (isMuted(authorRecord)) {
    return res.status(403).json({ error: authorRecord.muteReason ? `You're muted: ${authorRecord.muteReason}` : "You're muted." });
  }

  const now = Date.now();
  const last = lastCommentAt.get(req.session.user) || 0;
  if (now - last < COMMENT_RATE_LIMIT_MS) return res.status(429).json({ error: 'Slow down a little before posting again.' });

  const text = (req.body && req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Comment can\u2019t be empty.' });
  if (text.length > COMMENT_MAX_LEN) return res.status(400).json({ error: `Comments are limited to ${COMMENT_MAX_LEN} characters.` });

  lastCommentAt.set(req.session.user, now);
  const comment = {
    id: crypto.randomUUID(),
    profileUsername: targetRecord.username,
    author: req.session.user,
    text,
    createdAt: new Date().toISOString()
  };
  db.profileComments = db.profileComments || [];
  db.profileComments.push(comment);

  if (target !== req.session.user.toLowerCase()) {
    addNotification(targetRecord, `${req.session.user} left a comment on your profile.`);
  }
  writeDB(db);
  res.status(201).json({ id: comment.id, author: comment.author, authorIsAdmin: isAdmin(comment.author), authorIsTier3: isTier3(comment.author), authorIsTier4: isTier4(comment.author), authorIsOverseer: isOverseer(comment.author), authorIsTier1: isTier1(comment.author), authorIsTier2: isTier2(comment.author), text: comment.text, createdAt: comment.createdAt });
});

app.delete('/api/profile/:username/comments/:commentId', requireLogin, (req, res) => {
  const db = readDB();
  const target = req.params.username.toLowerCase();
  const comment = (db.profileComments || []).find(c => c.id === req.params.commentId && c.profileUsername.toLowerCase() === target);
  if (!comment) return res.status(404).json({ error: 'Comment not found.' });

  const isOwnComment = comment.author.toLowerCase() === req.session.user.toLowerCase();
  const isProfileOwner = target === req.session.user.toLowerCase();
  if (!isOwnComment && !isProfileOwner && !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'You can\u2019t delete that comment.' });
  }
  db.profileComments = db.profileComments.filter(c => c.id !== req.params.commentId);
  writeDB(db);
  res.json({ ok: true });
});

app.put('/api/profile/me', requireLogin, (req, res) => {
  const { bio, avatar, banner, title, ring, customTitleText, avatarPosition, bannerPosition, featuredBadges } = req.body || {};
  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];

  if (typeof bio === 'string') {
    if (bio.length > 200) return res.status(400).json({ error: 'Bio is limited to 200 characters.' });
    record.profile.bio = bio.trim();
  }
  if (avatar !== undefined) {
    if (!record.inventory.includes(avatar)) return res.status(403).json({ error: 'You don\u2019t own that avatar color yet.' });
    record.profile.avatar = avatar;
  }
  if (banner !== undefined) {
    if (!record.inventory.includes(banner)) return res.status(403).json({ error: 'You don\u2019t own that banner yet.' });
    record.profile.banner = banner;
  }
  if (title !== undefined) {
    if (!record.inventory.includes(title)) return res.status(403).json({ error: 'You don\u2019t own that title yet.' });
    record.profile.title = title;
  }
  if (ring !== undefined) {
    if (!record.inventory.includes(ring)) return res.status(403).json({ error: 'You don\u2019t own that ring yet.' });
    record.profile.ring = ring;
  }
  if (typeof customTitleText === 'string') {
    if (!record.inventory.includes('title-custom')) return res.status(403).json({ error: 'You don\u2019t own Custom Title yet \u2014 grab it from the Shop.' });
    const clean = customTitleText.replace(/[\r\n\t]/g, ' ').trim().slice(0, CUSTOM_TITLE_MAX_LEN);
    if (!clean) return res.status(400).json({ error: 'Your custom title can\u2019t be empty.' });
    record.profile.customTitleText = clean;
    record.profile.title = 'title-custom';
  }
  if (avatarPosition && typeof avatarPosition === 'object') {
    if (!record.profile.customAvatarUrl) return res.status(400).json({ error: 'Upload a custom avatar before positioning it.' });
    record.profile.customAvatarPosition = clampPosition(avatarPosition);
  }
  if (bannerPosition && typeof bannerPosition === 'object') {
    if (!record.profile.customBannerUrl) return res.status(400).json({ error: 'Upload a custom background before positioning it.' });
    record.profile.customBannerPosition = clampPosition(bannerPosition);
  }
  if (Array.isArray(featuredBadges)) {
    const unowned = featuredBadges.find(id => !record.badges[id]);
    if (unowned) return res.status(403).json({ error: 'You can only feature badges you\u2019ve actually earned.' });
    if (featuredBadges.length > MAX_FEATURED_BADGES) {
      return res.status(400).json({ error: `You can feature at most ${MAX_FEATURED_BADGES} badges.` });
    }
    record.profile.featuredBadges = [...new Set(featuredBadges)];
  }
  writeDB(db);
  res.json(publicProfile(record, db));
});

app.post('/api/profile/avatar-image', requireLogin, (req, res) => {
  avatarImageUpload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No image received.' });

    const db = readDB();
    const record = db.users[req.session.user.toLowerCase()];
    if (!record.inventory.includes('avatar-custom')) {
      return res.status(403).json({ error: 'You don\u2019t own Custom Avatar yet \u2014 grab it from the Shop.' });
    }
    const oldUrl = record.profile.customAvatarUrl;
    const ext = CUSTOM_IMAGE_EXT_BY_MIME[req.file.mimetype] || '.png';
    const filename = `${req.session.user.toLowerCase()}-${crypto.randomUUID()}${ext}`;
    record.profile.customAvatarUrl = await storeUpload(req.file.buffer, 'avatars', filename, req.file.mimetype);
    deleteOldCustomImage(oldUrl, 'avatar');
    record.profile.customAvatarPosition = { ...DEFAULT_POSITION };
    record.profile.avatar = 'avatar-custom';
    writeDB(db);
    res.json(publicProfile(record, db));
  });
});

app.post('/api/profile/banner-image', requireLogin, (req, res) => {
  bannerImageUpload.single('image')(req, res, async err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No image received.' });

    const db = readDB();
    const record = db.users[req.session.user.toLowerCase()];
    if (!record.inventory.includes('banner-custom')) {
      return res.status(403).json({ error: 'You don\u2019t own Custom Background yet \u2014 grab it from the Shop.' });
    }
    const oldUrl = record.profile.customBannerUrl;
    const ext = CUSTOM_IMAGE_EXT_BY_MIME[req.file.mimetype] || '.png';
    const filename = `${req.session.user.toLowerCase()}-${crypto.randomUUID()}${ext}`;
    record.profile.customBannerUrl = await storeUpload(req.file.buffer, 'banners', filename, req.file.mimetype);
    deleteOldCustomImage(oldUrl, 'banner');
    record.profile.customBannerPosition = { ...DEFAULT_POSITION };
    record.profile.banner = 'banner-custom';
    writeDB(db);
    res.json(publicProfile(record, db));
  });
});

// ── games & tools (same shape, two collections) ──────────────────
function collectionRoutes(name) {
  app.get(`/api/${name}`, (req, res) => {
    res.json(readDB()[name]);
  });

  app.post(`/api/${name}`, requireAdmin, (req, res) => {
    const { name: gName, url, desc, tag, thumb, isNew } = req.body || {};
    if (!gName || !url) return res.status(400).json({ error: 'Name and URL are required.' });
    const db = readDB();
    const id = gName.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '') || crypto.randomUUID();
    const entry = { id, name: gName, url, desc: desc || '', tag: tag || 'Misc', thumb: thumb || '', new: !!isNew };
    db[name] = db[name].filter(g => g.id !== id); // replace if same id
    db[name].push(entry);
    writeDB(db);
    res.status(201).json(entry);
  });

  app.delete(`/api/${name}/:id`, requireAdmin, (req, res) => {
    const db = readDB();
    db[name] = db[name].filter(g => g.id !== req.params.id);
    writeDB(db);
    res.json({ ok: true });
  });
}
collectionRoutes('games');
collectionRoutes('tools');

// ── backup (so you can get at db.json without needing Render's
// paid-only Shell tab, or any shell at all) ──────────────────────
app.get('/api/admin/backup', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Disposition', `attachment; filename="seal-backup-${stamp}.json"`);
  res.json(readDB());
});

// Restore from a previously downloaded backup. Overwrites everything —
// users, games, tools, chat, banner, popup — with what's in the file.
app.post('/api/admin/restore', requireAdmin, (req, res) => {
  const incoming = req.body;
  if (!incoming || typeof incoming !== 'object' || Array.isArray(incoming)) {
    return res.status(400).json({ error: 'That doesn\'t look like a valid backup file.' });
  }
  const required = ['users', 'banner', 'popup', 'games', 'tools', 'chat'];
  if (!required.every(k => k in incoming)) {
    return res.status(400).json({ error: 'That backup file is missing expected fields.' });
  }
  if (!('files' in incoming)) incoming.files = []; // older backups won't have this yet
  if (!('audioSenders' in incoming)) incoming.audioSenders = [];
  if (!('tier1Admins' in incoming)) incoming.tier1Admins = [];
  if (!('tier2Users' in incoming)) incoming.tier2Users = [];
  if (!('chatRooms' in incoming)) incoming.chatRooms = [{ id: 'general', name: 'General', createdBy: null, createdAt: new Date().toISOString() }];
  if (!('friendRequests' in incoming)) incoming.friendRequests = [];
  if (!('customize' in incoming)) incoming.customize = { background: null, elements: {} };
  writeDB(incoming);
  res.json({ ok: true });
});

// ── export the whole site ──────────────────────────────────────
// Everything under public/ (games, tools, icons, the app itself) plus
// the data backup, streamed as one .zip. Streaming means it doesn't
// buffer the whole thing in memory first, so this is fine even with
// a large games/ folder.
app.get('/api/admin/export', requireAdmin, (req, res) => {
  const stamp = new Date().toISOString().slice(0, 10);
  res.setHeader('Content-Type', 'application/zip');
  res.setHeader('Content-Disposition', `attachment; filename="seal-site-export-${stamp}.zip"`);

  const archive = archiver('zip', { zlib: { level: 6 } });
  archive.on('error', err => {
    console.error('Export failed:', err);
    if (!res.headersSent) res.status(500).end();
  });
  archive.pipe(res);

  archive.directory(PUBLIC_DIR, 'public');
  archive.file(DB_PATH, { name: 'data/db.json' });
  archive.file(ADMINS_PATH, { name: 'data/admins.json' });
  if (fs.existsSync(UPLOADS_DIR)) archive.directory(UPLOADS_DIR, 'data/uploads');

  archive.finalize();
});

// ── add game/tool files directly on the server ────────────────────
// Upload a .zip of a game/tool's files (extracted into a fresh
// folder) or a single image (for gameIcons). This writes real files
// into public/ — same trust level as editing data/db.json by hand,
// so it's admin-only, and every path is validated to stay inside its
// target directory (no zip-slip, no ../ escapes).
const MAX_SITE_UPLOAD_BYTES = 300 * 1024 * 1024; // 300MB — admin-only, not public-facing
const MAX_ZIP_UNCOMPRESSED_BYTES = 500 * 1024 * 1024; // zip-bomb guard

const siteFileUpload = multer({
  storage: multer.diskStorage({
    destination: (req, file, cb) => cb(null, SITE_TMP_DIR),
    filename: (req, file, cb) => cb(null, crypto.randomUUID() + path.extname(file.originalname))
  }),
  limits: { fileSize: MAX_SITE_UPLOAD_BYTES }
});

function safeSlug(name, fallback) {
  const slug = (name || '').toLowerCase().trim().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return slug || fallback;
}
function safeFileName(original) {
  const ext = path.extname(original).toLowerCase();
  const base = path.basename(original, ext).toLowerCase().replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  return (base || 'file') + ext;
}

// Extracts a zip into destDir, refusing to write anything outside it
// (zip-slip) and refusing archives that would unpack to something huge.
function extractZipSafely(zipPath, destDir) {
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries();

  let totalSize = 0;
  const destResolved = path.resolve(destDir);
  for (const entry of entries) {
    totalSize += entry.header.size;
    const resolved = path.resolve(path.join(destDir, entry.entryName));
    if (resolved !== destResolved && !resolved.startsWith(destResolved + path.sep)) {
      throw new Error('That archive contains an unsafe file path and was rejected.');
    }
  }
  if (totalSize > MAX_ZIP_UNCOMPRESSED_BYTES) {
    throw new Error('That archive is too large once extracted (500MB limit).');
  }

  fs.mkdirSync(destDir, { recursive: true });
  zip.extractAllTo(destDir, true);
}

app.post('/api/admin/site-files', requireAdmin, (req, res) => {
  siteFileUpload.single('file')(req, res, err => {
    if (err) return res.status(400).json({ error: err.message || 'Upload failed.' });
    if (!req.file) return res.status(400).json({ error: 'No file received.' });

    const type = (req.body.type || '').trim();
    const nameField = (req.body.name || '').trim();
    const tempPath = req.file.path;
    const cleanup = () => fs.unlink(tempPath, () => {});

    try {
      if (type === 'games' || type === 'tools') {
        const baseDir = type === 'games' ? GAMES_DIR : TOOLS_DIR;
        if (!/\.zip$/i.test(req.file.originalname)) {
          cleanup();
          return res.status(400).json({ error: 'Games and tools need a .zip of the folder\'s files.' });
        }
        const folderName = safeSlug(nameField || req.file.originalname.replace(/\.zip$/i, ''), 'item-' + crypto.randomUUID().slice(0, 8));
        const destDir = path.join(baseDir, folderName);
        if (fs.existsSync(destDir)) {
          cleanup();
          return res.status(409).json({ error: `"${folderName}" already exists there — pick a different name.` });
        }
        extractZipSafely(tempPath, destDir);
        cleanup();
        const urlPrefix = type === 'games' ? '1' : 'tools'; // the actual served path — "games" here is just the admin form's internal type, not the folder name
        return res.status(201).json({ path: `${urlPrefix}/${folderName}` });
      }

      if (type === 'gameIcons') {
        const fileName = safeFileName(nameField ? nameField + path.extname(req.file.originalname) : req.file.originalname);
        let destPath = path.join(ICONS_DIR, fileName);
        if (fs.existsSync(destPath)) {
          const ext = path.extname(fileName);
          destPath = path.join(ICONS_DIR, `${path.basename(fileName, ext)}-${crypto.randomUUID().slice(0, 6)}${ext}`);
        }
        fs.copyFileSync(tempPath, destPath);
        cleanup();
        return res.status(201).json({ path: `gameIcons/${path.basename(destPath)}` });
      }

      cleanup();
      return res.status(400).json({ error: 'Unknown upload type.' });
    } catch (ex) {
      cleanup();
      return res.status(400).json({ error: ex.message || 'Could not process that upload.' });
    }
  });
});

// ── static site ─────────────────────────────────────────────────
app.use(express.static(path.join(__dirname, 'public')));

initStorage()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Seal is running at http://localhost:${PORT}`);
      if (DATA_DIR_FALLBACK) {
        console.warn(`[seal] REMINDER: running on the temporary data folder ${DATA_DIR_FALLBACK.to} (could not use ${DATA_DIR_FALLBACK.from}). Data will be lost on restart.`);
      }
    });
    // Clear out unused chat images shortly after boot, then every few hours.
    setTimeout(sweepOrphanChatImages, Math.min(60 * 1000, CHAT_IMAGE_SWEEP_INTERVAL_MS)).unref();
    setInterval(sweepOrphanChatImages, CHAT_IMAGE_SWEEP_INTERVAL_MS).unref();
  })
  .catch(err => {
    console.error('Failed to initialize storage \u2014 refusing to start:', err.message);
    process.exit(1);
  });
