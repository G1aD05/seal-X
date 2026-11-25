// Merges the app shell (public/) and the heavy static files (static/: games in 1/,
// tools/, gameIcons/) into worker/dist, which is what gets uploaded to Cloudflare.
// Mirrors server.js: it serves STATIC_DIR first, then public/.
//
// Also bundles split-manifest.json next to index.js (files over 25 MiB were cut into
// .partNNN files by deploy/split-static.mjs; index.js glues them back together).
//
// Run from the worker/ folder (which sits next to server.js):  node build.mjs
// Override locations with env vars:  PUBLIC_DIR=... STATIC_DIR=... SPLIT_MANIFEST=... node build.mjs

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const serverDir = path.resolve(here, "..");

const publicDir = path.resolve(process.env.PUBLIC_DIR || path.join(serverDir, "public"));
const staticCandidates = [
  process.env.STATIC_DIR,
  path.join(serverDir, "..", "static"), // server.js default: ../static
  path.join(serverDir, "static"),
].filter(Boolean).map((p) => path.resolve(p));
const staticDir = staticCandidates.find((p) => fs.existsSync(p));

if (!fs.existsSync(publicDir)) {
  console.error(`Can't find ${publicDir}. Run this from the worker/ folder next to server.js, or set PUBLIC_DIR.`);
  process.exit(1);
}

const dist = path.join(here, "dist");
fs.rmSync(dist, { recursive: true, force: true });
fs.mkdirSync(dist, { recursive: true });

const SKIP_NAMES = new Set([".DS_Store", "node_modules", ".git", "Thumbs.db"]);
function copyTree(from, label, skipRelDirs = []) {
  fs.cpSync(from, dist, {
    recursive: true,
    force: true,
    filter: (src) => {
      const rel = path.relative(from, src).split(path.sep).join("/");
      if (SKIP_NAMES.has(path.basename(src))) return false;
      if (skipRelDirs.includes(rel)) return false; // runtime upload folders live on the server
      return true;
    },
  });
  console.log(`  + ${label}: ${from}`);
}

console.log("Building worker/dist");
// public/uploads holds files users upload while the site runs (chat images, avatars when no S3);
// those stay on the server and are reached through the Worker's proxy fallback.
// The ScreenLink page and its script are Tier 6 only. The server checks the login before sending
// them (server.js, "ScreenLink page"), but files in dist are served straight from Cloudflare's edge
// without ever reaching the server, so they must NOT be in dist. Left out, the requests fall through
// to the Worker's proxy and the Render server decides who gets them.
copyTree(publicDir, "public", ["uploads", "screenlink.html", "js/screenlink-ui.js"]);
if (staticDir) copyTree(staticDir, "static");
else console.warn("  ! no static/ folder found (tried: " + staticCandidates.join(", ") + ") - games/tools/icons NOT included");

// ---- split files ------------------------------------------------------------
// index.js imports ./split-manifest.json, so it must exist next to it. Look for the one
// written by deploy/split-static.mjs and copy it here.
const manifestDst = path.join(here, "split-manifest.json");
const manifestCandidates = [
  process.env.SPLIT_MANIFEST,
  manifestDst,
  path.join(serverDir, "..", "deploy", "split-manifest.json"), // seal-x/deploy
  staticDir && path.join(staticDir, "..", "deploy", "split-manifest.json"),
].filter(Boolean).map((p) => path.resolve(p));
const manifestSrc = manifestCandidates.find((p) => fs.existsSync(p));

let splitManifest = {};
if (manifestSrc) {
  if (manifestSrc !== manifestDst) fs.copyFileSync(manifestSrc, manifestDst);
  splitManifest = JSON.parse(fs.readFileSync(manifestDst, "utf8"));
  console.log(`  + split manifest: ${manifestSrc} (${Object.keys(splitManifest).length} split files)`);
} else {
  fs.writeFileSync(manifestDst, "{}\n");
  console.warn("  ! no split-manifest.json found (tried: " + manifestCandidates.join(", ") + ") - any game file that was split into parts will NOT load");
}

// Every part named in the manifest has to be in dist, and the original must not be (a
// leftover original is over 25 MiB and would shadow the parts).
let splitOk = 0;
for (const [key, entry] of Object.entries(splitManifest)) {
  const segs = key.split("/").filter(Boolean);
  const dir = path.join(dist, ...segs.slice(0, -1));
  const missing = entry.parts.filter((p) => !fs.existsSync(path.join(dir, p.name)));
  if (missing.length) {
    console.warn(`  ! ${key}: ${missing.length} of ${entry.parts.length} part(s) missing from dist (e.g. ${missing[0].name}) - this file will fail to load`);
    continue;
  }
  if (fs.existsSync(path.join(dist, ...segs))) {
    console.warn(`  ! ${key}: the original file is still in dist next to its parts - run deploy/split-static.mjs split first`);
    continue;
  }
  splitOk++;
}
if (Object.keys(splitManifest).length) console.log(`  split files with all parts present: ${splitOk}/${Object.keys(splitManifest).length}`);

let files = 0, biggest = { size: 0, file: "" };
(function walk(d) {
  for (const e of fs.readdirSync(d, { withFileTypes: true })) {
    const p = path.join(d, e.name);
    if (e.isDirectory()) walk(p);
    else {
      files++;
      const s = fs.statSync(p).size;
      if (s > biggest.size) biggest = { size: s, file: path.relative(dist, p) };
    }
  }
})(dist);

console.log(`Done: ${files} files in dist (largest: ${biggest.file}, ${(biggest.size / 1048576).toFixed(1)} MiB)`);
if (files > 20000) console.warn("  ! Over 20,000 files: Workers Free will reject this. Workers Paid allows 100,000 (Wrangler >= 4.34).");
if (biggest.size > 25 * 1048576) console.warn("  ! A file is over 25 MiB, which Cloudflare rejects. Run deploy/split-static.mjs split (or move it to R2/Supabase / shrink it).");
