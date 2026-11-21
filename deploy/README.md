# Deploying `static/` to Cloudflare Workers

Cloudflare Workers (and Pages) reject any single file over **25 MiB**. A handful
of games have bigger files (a 55 MB `eaglercraft/index.html`, several 38-47 MB
`.wasm`/`.pck` files), so they get split into parts and a small Worker glues them
back together when the game asks for them.

```
static/1/crazycattle/index.pck          <- too big, can't upload
static/1/crazycattle/index.pck.part000  <- 20 MB   (uploaded as normal assets)
static/1/crazycattle/index.pck.part001  <- 19.4 MB
```

A game still requests `/1/crazycattle/index.pck`. No asset has that name any more, so
Cloudflare hands the request to `worker.js`, which looks it up in
`split-manifest.json`, streams the parts back-to-back and answers as one file
(correct `Content-Type`, `Content-Length`, `Range`/`ETag` support). **The games need no
edits** and it works for any loader (fetch, XHR, Godot, Unity, Emscripten).

## One-time setup + deploy

```bash
cd deploy
npm install
npx wrangler login          # first time only
npm run deploy              # split -> verify -> upload
```

`npm run deploy` runs `split` (only touches files over 25 MB, safe to re-run), then
`verify` (fails if any part is missing/corrupt or any file is still too big), then
`wrangler deploy`. Your site is then at `https://seal-static.<your-subdomain>.workers.dev`;
put that (no trailing slash) in the server's `STATIC_BASE_URL`.

Test locally first with `npm run dev` (serves `static/` + the Worker on :8787).

## Commands

| Command | What it does |
| --- | --- |
| `npm run split` | Split every file over 25 MB in `static/` into <= 20 MB parts, write `split-manifest.json`, delete the original (only after re-reading the parts and confirming their SHA-256 matches). |
| `npm run verify` | Check every part exists with the right size/checksum and that nothing in `static/` is over the limit. Exit code 1 on any problem. |
| `npm run join` | Put the original files back and delete the parts. Needed for running `server/` locally (it serves `../static` directly and doesn't know about parts), or for hosts without a Worker. |

Options (after `node split-static.mjs <cmd>`): `--max <bytes>` (default 25000000),
`--chunk <bytes>` (default 20000000), `--dir <path>`, `--dry-run`, `--keep-parts`.

## Adding a new big game

Drop it in `static/1/<game>/` like any other, then `npm run deploy`. Anything over
25 MB is split automatically; the manifest and Worker pick it up with no other changes.

## Notes

- Games that already ship their own `*.partNNN` files and join them in the browser
  (beatblock, cheese-rolling, deltarune_ch2/ch3...) are left alone: `split` skips
  `.partNNN` files and they're under the limit.
- Worker responses are built by the Worker, so cache/CORS headers are set in `worker.js`
  (same values as `static/_headers`, which only applies to plain assets).
- Free Workers plan: 100,000 requests/day to the Worker; plain asset requests are free and
  unlimited. Only the split files cost Worker requests (each one also makes a few
  internal asset fetches, well under the 50-subrequest limit).
