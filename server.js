// ═══════════════════════════════════════════════════════════════
//  Seal — backend
//  Real accounts, a banner that's stored on the server (so it's
//  the same for every visitor), and a game/tool library that can
//  be edited from the admin panel OR by hand-editing data/db.json.
// ═══════════════════════════════════════════════════════════════
const express = require('express');
const session = require('express-session');
const FileStore = require('session-file-store')(session);
const bcrypt = require('bcryptjs');
const multer = require('multer');
const sharp = require('sharp');
const AdmZip = require('adm-zip');
const archiver = require('archiver');
const { MongoClient } = require('mongodb');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

// DATA_DIR lets you point storage at a mounted persistent disk (Render,
// Fly, a VPS volume, etc.) instead of the app folder, so your data
// survives redeploys. Defaults to ./data for plain local/VPS use.
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
const DB_PATH = path.join(DATA_DIR, 'db.json');
const ADMINS_PATH = path.join(DATA_DIR, 'admins.json');
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
const { S3Client, PutObjectCommand, DeleteObjectCommand } = require('@aws-sdk/client-s3');
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
    rings: [],
    profileComments: []
  };
}
function ensureDataFiles() {
  fs.mkdirSync(DATA_DIR, { recursive: true });
  fs.mkdirSync(UPLOADS_DIR, { recursive: true });
  fs.mkdirSync(SITE_TMP_DIR, { recursive: true });
  fs.mkdirSync(SESSIONS_DIR, { recursive: true });
  fs.mkdirSync(GAMES_DIR, { recursive: true });
  fs.mkdirSync(TOOLS_DIR, { recursive: true });
  fs.mkdirSync(ICONS_DIR, { recursive: true });
  if (!fs.existsSync(DB_PATH)) {
    fs.writeFileSync(DB_PATH, JSON.stringify(defaultDbShape(), null, 2));
  }
  if (!fs.existsSync(ADMINS_PATH)) {
    fs.writeFileSync(ADMINS_PATH, JSON.stringify([], null, 2));
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
  if (!record.stats || typeof record.stats !== 'object') {
    record.stats = { totalDailyClaims: 0, chatMessageCount: 0, lifetimePlaySeconds: 0, totalPurchases: 0 };
    changed = true;
  }
  if (!record.badges || typeof record.badges !== 'object') { record.badges = {}; changed = true; }
  if (!Array.isArray(record.notifications)) { record.notifications = []; changed = true; }
  if (record.nowPlaying === undefined) { record.nowPlaying = null; changed = true; }
  if (record.cookieSync === undefined) { record.cookieSync = null; changed = true; }
  if (!Array.isArray(record.profile.featuredBadges)) { record.profile.featuredBadges = []; changed = true; }
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
    seals: record.seals,
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
let mongoWriteQueued = false;
let mongoWriteInFlight = null;

function readDB() {
  const db = CACHED_DB;
  let changed = false;
  if (!Array.isArray(db.ringUploaders)) { db.ringUploaders = []; changed = true; }
  if (!Array.isArray(db.rings)) { db.rings = []; changed = true; }
  if (!Array.isArray(db.profileComments)) { db.profileComments = []; changed = true; }
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
function isAdmin(username) {
  if (!username) return false;
  return readAdmins().map(a => a.toLowerCase()).includes(username.toLowerCase());
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

// ── live banner updates (Server-Sent Events) ──────────────────
// Every connected tab keeps one open GET request; when an admin
// publishes/clears the banner we push the new value down each of
// these instead of making clients poll or refresh.
const bannerClients = new Set();
function broadcastBanner(banner) {
  const payload = `data: ${JSON.stringify(banner)}\n\n`;
  for (const res of bannerClients) res.write(payload);
}

// Same pattern for chat: keep a set of open connections, push new
// messages (or deletions) to all of them as they happen.
const chatClients = new Set();
function broadcastChat(event, payload) {
  const line = `event: ${event}\ndata: ${JSON.stringify(payload)}\n\n`;
  for (const res of chatClients) res.write(line);
}
const lastMessageAt = new Map(); // username -> timestamp, simple per-user rate limit

// Update popups work like the banner (server-stored, pushed live) but
// render as a dismissible modal. Each publish gets a fresh id, so a new
// update reaches everyone again even if they dismissed a previous one.
const popupClients = new Set();
function broadcastPopup(popup) {
  const payload = `data: ${JSON.stringify(popup)}\n\n`;
  for (const res of popupClients) res.write(payload);
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

function requireLogin(req, res, next) {
  if (!req.session.user) return res.status(401).json({ error: 'Not signed in.' });
  next();
}
function requireAdmin(req, res, next) {
  if (!req.session.user || !isAdmin(req.session.user)) {
    return res.status(403).json({ error: 'Admins only.' });
  }
  next();
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
    cookieSync: null
  };
  checkBadges(db.users[key]);
  writeDB(db);

  req.session.user = username;
  const pub = publicProfile(db.users[key], db);
  res.json({
    username, isAdmin: pub.isAdmin, canSendAudio: canSendAudio(username), canUploadRings: canUploadRings(username), seals: pub.seals,
    avatarColor: pub.avatarColor, avatarImage: pub.avatarImage, avatarPosition: pub.avatarPosition, ringImage: pub.ringImage
  });
});

app.post('/api/login', (req, res) => {
  const { username, password } = req.body || {};
  if (!username || !password) return res.status(400).json({ error: 'Missing username or password.' });

  const db = readDB();
  const record = db.users[username.toLowerCase()];
  if (!record || !bcrypt.compareSync(password, record.passwordHash)) {
    return res.status(401).json({ error: 'Incorrect username or password.' });
  }

  req.session.user = record.username;
  const pub = publicProfile(record, db);
  res.json({
    username: record.username, isAdmin: pub.isAdmin, canSendAudio: canSendAudio(record.username), canUploadRings: canUploadRings(record.username), seals: pub.seals,
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
  const pub = publicProfile(record, db);
  res.json({
    username: req.session.user, isAdmin: pub.isAdmin, canSendAudio: canSendAudio(req.session.user), canUploadRings: canUploadRings(req.session.user), seals: pub.seals,
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

// ── chat ───────────────────────────────────────────────────────
// Simple site-wide chat room. Anyone can read; only signed-in users
// can post; messages carry the server-known username so no one can
// spoof who said what. History is capped so db.json doesn't grow forever.
const CHAT_HISTORY_LIMIT = 200;
const CHAT_RATE_LIMIT_MS = 800;
const CHAT_MAX_LENGTH = 500;

app.get('/api/chat/messages', (req, res) => {
  const db = readDB();
  res.json(db.chat || []);
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

app.post('/api/chat/messages', requireLogin, (req, res) => {
  const text = (req.body && req.body.text || '').trim();
  if (!text) return res.status(400).json({ error: 'Message is empty.' });
  if (text.length > CHAT_MAX_LENGTH) return res.status(400).json({ error: `Messages are limited to ${CHAT_MAX_LENGTH} characters.` });

  const now = Date.now();
  const last = lastMessageAt.get(req.session.user) || 0;
  if (now - last < CHAT_RATE_LIMIT_MS) return res.status(429).json({ error: 'Slow down a little.' });
  lastMessageAt.set(req.session.user, now);

  const db = readDB();
  const record = db.users[req.session.user.toLowerCase()];
  const senderProfile = publicProfile(record, db);
  const mentions = extractMentions(text, db, req.session.user);
  const message = {
    id: crypto.randomUUID(),
    username: req.session.user,
    isAdmin: isAdmin(req.session.user),
    title: senderProfile.title,
    avatarColor: senderProfile.avatarImage ? null : senderProfile.avatarColor,
    avatarImage: senderProfile.avatarImage,
    avatarPosition: senderProfile.avatarPosition,
    ringImage: senderProfile.ringImage,
    nowPlaying: senderProfile.nowPlaying,
    mentions,
    text,
    ts: now
  };

  record.stats.chatMessageCount += 1;
  checkBadges(record);

  mentions.forEach(username => {
    const mentionedRecord = db.users[username.toLowerCase()];
    if (!mentionedRecord) return;
    const excerpt = text.length > 80 ? text.slice(0, 80) + '\u2026' : text;
    addNotification(mentionedRecord, `${req.session.user} mentioned you in chat: \u201c${excerpt}\u201d`);
  });

  db.chat = db.chat || [];
  db.chat.push(message);
  if (db.chat.length > CHAT_HISTORY_LIMIT) db.chat = db.chat.slice(-CHAT_HISTORY_LIMIT);
  writeDB(db);

  broadcastChat('message', message);
  res.status(201).json(message);
});

app.delete('/api/chat/messages/:id', requireAdmin, (req, res) => {
  const db = readDB();
  db.chat = (db.chat || []).filter(m => m.id !== req.params.id);
  writeDB(db);
  broadcastChat('delete', { id: req.params.id });
  res.json({ ok: true });
});

app.get('/api/chat/stream', (req, res) => {
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive'
  });
  res.write(': connected\n\n');

  chatClients.add(res);
  const keepAlive = setInterval(() => res.write(': ping\n\n'), 25000);

  req.on('close', () => {
    clearInterval(keepAlive);
    chatClients.delete(res);
  });
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
    writeDB(db);
  }
  res.status(201).json(db.audioSenders);
});

app.delete('/api/admin/audio-senders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  db.audioSenders = (db.audioSenders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
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
    writeDB(db);
  }
  res.status(201).json(db.ringUploaders);
});

app.delete('/api/admin/ring-uploaders/:username', requireAdmin, (req, res) => {
  const db = readDB();
  db.ringUploaders = (db.ringUploaders || []).filter(u => u.toLowerCase() !== req.params.username.toLowerCase());
  writeDB(db);
  res.json(db.ringUploaders);
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
    text: c.text,
    createdAt: c.createdAt
  })));
});

app.post('/api/profile/:username/comments', requireLogin, (req, res) => {
  const db = readDB();
  const target = req.params.username.toLowerCase();
  const targetRecord = db.users[target];
  if (!targetRecord) return res.status(404).json({ error: 'No account with that username exists.' });

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
  res.status(201).json({ id: comment.id, author: comment.author, authorIsAdmin: isAdmin(comment.author), text: comment.text, createdAt: comment.createdAt });
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
    });
  })
  .catch(err => {
    console.error('Failed to initialize storage \u2014 refusing to start:', err.message);
    process.exit(1);
  });
