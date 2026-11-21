// Build for Prisma Compute: the server runs from source (no compile step), so
// the build assembles the deployable output — a self-contained copy of server/
// in server/dist/, minus things the deploy must not ship (local data, dev
// tests, and node_modules, whose symlinks the packager rejects; the deploy
// stages the runtime packages itself by tracing the entry).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
const src = path.join(root, 'server');
const out = path.join(src, 'dist');
const staging = path.join(root, '.dist-staging');

const SKIP = new Set(['node_modules', 'data', 'test', 'dist', 'package-lock.json']);

fs.rmSync(out, { recursive: true, force: true });
fs.rmSync(staging, { recursive: true, force: true });
fs.cpSync(src, staging, {
  recursive: true,
  filter: (from) => !SKIP.has(path.basename(from)),
});
fs.renameSync(staging, out);
console.log(`Built server/dist/ from server/ (${fs.readdirSync(out).length} entries).`);
