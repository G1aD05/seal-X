#!/usr/bin/env node
// Splits files in ../static that are too big for the static host's per-file
// limit (Cloudflare Workers/Pages: 25 MiB) into numbered parts, and records
// them in split-manifest.json so deploy/worker.js can serve them again as one
// file at the original URL.
//
//   node deploy/split-static.mjs split     split every file over the limit
//   node deploy/split-static.mjs verify    check parts + that nothing is still too big
//   node deploy/split-static.mjs join      put the original files back (local dev / other hosts)
//
// Options:
//   --dir <path>     folder to scan (default: ../static)
//   --max <bytes>    files larger than this get split   (default: 25000000)
//   --chunk <bytes>  size of each part                  (default: 20000000)
//   --keep-parts     (join) don't delete the parts after joining
//   --dry-run        (split) only list what would happen
//
// No dependencies; needs Node 18+.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MANIFEST_PATH = path.join(HERE, 'split-manifest.json');
const PART_RE = /\.part\d{3}$/;

// ---- args -----------------------------------------------------------------
const argv = process.argv.slice(2);
const command = argv[0];
function opt(name, fallback) {
  const i = argv.indexOf(`--${name}`);
  return i === -1 ? fallback : argv[i + 1];
}
const flag = (name) => argv.includes(`--${name}`);

const ROOT = path.resolve(opt('dir', path.join(HERE, '..', 'static')));
const MAX = Number(opt('max', 25_000_000));
const CHUNK = Number(opt('chunk', 20_000_000));

if (!['split', 'verify', 'join'].includes(command)) {
  console.error('Usage: node deploy/split-static.mjs <split|verify|join> [--dir D] [--max N] [--chunk N] [--keep-parts] [--dry-run]');
  process.exit(2);
}
if (!(CHUNK > 0 && CHUNK < MAX)) {
  console.error(`--chunk (${CHUNK}) must be positive and smaller than --max (${MAX}).`);
  process.exit(2);
}

// ---- helpers --------------------------------------------------------------
const mb = (n) => (n / 1e6).toFixed(1) + ' MB';
const partName = (i) => '.part' + String(i).padStart(3, '0');
const urlKey = (abs) => '/' + path.relative(ROOT, abs).split(path.sep).join('/');
const fromKey = (key) => path.join(ROOT, ...key.split('/').filter(Boolean));

function* walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (entry.isFile()) yield full;
  }
}

function readManifest() {
  return fs.existsSync(MANIFEST_PATH) ? JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8')) : {};
}
function writeManifest(m) {
  const sorted = Object.fromEntries(Object.entries(m).sort(([a], [b]) => a.localeCompare(b)));
  fs.writeFileSync(MANIFEST_PATH, JSON.stringify(sorted, null, 2) + '\n');
}

// sha256 of a list of files read back-to-back, without loading them whole.
function hashFiles(files) {
  const h = crypto.createHash('sha256');
  const buf = Buffer.allocUnsafe(4 * 1024 * 1024);
  for (const f of files) {
    const fd = fs.openSync(f, 'r');
    try {
      let n;
      while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) h.update(buf.subarray(0, n));
    } finally { fs.closeSync(fd); }
  }
  return h.digest('hex');
}

function stalePartsFor(file) {
  const dir = path.dirname(file);
  const base = path.basename(file);
  return fs.readdirSync(dir)
    .filter((n) => PART_RE.test(n) && n.slice(0, -8) === base)
    .map((n) => path.join(dir, n));
}

// ---- split ----------------------------------------------------------------
function split() {
  const manifest = readManifest();
  const targets = [];
  for (const file of walk(ROOT)) {
    if (PART_RE.test(file)) continue;
    const size = fs.statSync(file).size;
    if (size > MAX) targets.push({ file, size });
  }
  if (!targets.length) { console.log(`No files larger than ${mb(MAX)} under ${ROOT}. Nothing to split.`); return; }

  for (const { file, size } of targets) {
    const key = urlKey(file);
    const nParts = Math.ceil(size / CHUNK);
    console.log(`${key}  ${mb(size)} -> ${nParts} parts of <= ${mb(CHUNK)}`);
    if (flag('dry-run')) continue;
    if (nParts > 999) throw new Error(`${key}: would need ${nParts} parts (max 999). Raise --chunk.`);

    for (const old of stalePartsFor(file)) fs.unlinkSync(old); // leftovers from an interrupted run

    // One pass: write the parts and hash the original as we go.
    const whole = crypto.createHash('sha256');
    const fd = fs.openSync(file, 'r');
    const parts = [];
    try {
      const buf = Buffer.allocUnsafe(CHUNK);
      for (let i = 0; i < nParts; i++) {
        let filled = 0;
        while (filled < CHUNK) {
          const n = fs.readSync(fd, buf, filled, CHUNK - filled, null);
          if (n === 0) break;
          filled += n;
        }
        const chunk = buf.subarray(0, filled);
        whole.update(chunk);
        const name = path.basename(file) + partName(i);
        fs.writeFileSync(path.join(path.dirname(file), name), chunk);
        parts.push({ name, size: filled });
      }
    } finally { fs.closeSync(fd); }
    const sha256 = whole.digest('hex');

    // Read the parts back from disk and confirm they reproduce the original before deleting it.
    const partPaths = parts.map((p) => path.join(path.dirname(file), p.name));
    if (hashFiles(partPaths) !== sha256) throw new Error(`${key}: parts do not hash to the original. Original left in place.`);
    fs.unlinkSync(file);

    manifest[key] = { size, sha256, parts };
    writeManifest(manifest); // after every file, so an interruption never loses track
  }
  if (!flag('dry-run')) console.log(`\nDone. Manifest: ${path.relative(process.cwd(), MANIFEST_PATH)}`);
}

// ---- join -----------------------------------------------------------------
function join() {
  const manifest = readManifest();
  const keys = Object.keys(manifest);
  if (!keys.length) { console.log('Manifest is empty, nothing to join.'); return; }
  for (const key of keys) {
    const { size, sha256, parts } = manifest[key];
    const file = fromKey(key);
    const partPaths = parts.map((p) => path.join(path.dirname(file), p.name));
    if (fs.existsSync(file) && fs.statSync(file).size === size) { console.log(`${key}  already joined`); continue; }
    const missing = partPaths.filter((p) => !fs.existsSync(p));
    if (missing.length) { console.error(`${key}  MISSING PARTS: ${missing.map((p) => path.basename(p)).join(', ')}`); process.exitCode = 1; continue; }
    if (hashFiles(partPaths) !== sha256) { console.error(`${key}  parts are corrupt (checksum mismatch)`); process.exitCode = 1; continue; }

    const tmp = file + '.joining';
    const out = fs.openSync(tmp, 'w');
    try {
      const buf = Buffer.allocUnsafe(4 * 1024 * 1024);
      for (const p of partPaths) {
        const fd = fs.openSync(p, 'r');
        try { let n; while ((n = fs.readSync(fd, buf, 0, buf.length, null)) > 0) fs.writeSync(out, buf, 0, n); }
        finally { fs.closeSync(fd); }
      }
    } finally { fs.closeSync(out); }
    fs.renameSync(tmp, file);
    if (!flag('keep-parts')) for (const p of partPaths) fs.unlinkSync(p);
    console.log(`${key}  joined (${mb(size)})`);
  }
}

// ---- verify ---------------------------------------------------------------
function verify() {
  const manifest = readManifest();
  let problems = 0;
  for (const [key, { size, sha256, parts }] of Object.entries(manifest)) {
    const file = fromKey(key);
    const partPaths = parts.map((p) => path.join(path.dirname(file), p.name));
    const bad = [];
    if (fs.existsSync(file)) bad.push('original is still present next to its parts');
    partPaths.forEach((p, i) => {
      if (!fs.existsSync(p)) bad.push(`missing ${parts[i].name}`);
      else if (fs.statSync(p).size !== parts[i].size) bad.push(`${parts[i].name} has the wrong size`);
      else if (parts[i].size > MAX) bad.push(`${parts[i].name} is over ${mb(MAX)}`);
    });
    if (!bad.length && parts.reduce((a, p) => a + p.size, 0) !== size) bad.push('part sizes do not add up to the file size');
    if (!bad.length && hashFiles(partPaths) !== sha256) bad.push('checksum mismatch');
    console.log(`${bad.length ? 'FAIL' : 'ok  '} ${key}${bad.length ? '  <- ' + bad.join('; ') : ''}`);
    problems += bad.length;
  }
  let oversized = 0;
  for (const file of walk(ROOT)) {
    if (fs.statSync(file).size > MAX) { console.log(`FAIL ${urlKey(file)} is ${mb(fs.statSync(file).size)} (limit ${mb(MAX)})`); oversized++; }
  }
  problems += oversized;
  console.log(problems ? `\n${problems} problem(s).` : `\nAll good: ${Object.keys(manifest).length} split file(s), nothing over ${mb(MAX)} in ${ROOT}.`);
  process.exitCode = problems ? 1 : 0;
}

({ split, join, verify })[command]();
