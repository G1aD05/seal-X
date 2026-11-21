# Seal

This repo is split in two so the games don't eat the server's bandwidth:

| Folder | What it is | Where it goes |
| --- | --- | --- |
| `server/` | Node/Express backend: accounts, chat, API, plus the small app shell (HTML/CSS/JS in `server/public/`) | Render (or any Node host) |
| `static/` | The games (`1/`), tools (`tools/`) and thumbnails (`gameIcons/`), about 2.8 GB | A static host with plenty of bandwidth |

The two are joined by one setting. With `STATIC_BASE_URL` set on the server,
requests for `/1/*`, `/tools/*` and `/gameIcons/*` are redirected to the static
host. Game URLs already saved in your database keep working.

## Deploy

**Static site.** Publish the `static/` folder on your static host. For
Cloudflare Workers (25 MiB per-file limit) use `deploy/`: `cd deploy && npm install
&& npm run deploy` splits the oversized files and serves them reassembled. See
`deploy/README.md`. For other hosts see `static/README.md` for limits.

**Server on Render.** Same steps as `server/README.md`, with these changes:

- **Root Directory:** `server`
- **Build Filters** (Settings, Build & Deploy): add `static/**` as an ignored
  path so changing a game doesn't redeploy the server.
- **Environment:** add `STATIC_BASE_URL` = your static site's address, with no
  trailing slash, e.g. `https://seal-static.example.com`

## Local development

```bash
cd server
npm install
npm start
```

With `STATIC_BASE_URL` unset, the server serves `../static` itself, so
everything works at `http://localhost:3000` as before.

## What changes when games are on another host

- Cross-device save sync for games stops working. The site's cookie,
  localStorage and IndexedDB sync works because games share the site's origin;
  on another host the browser keeps each game's saves per device instead
  (saves still work on that device). Accounts, chat and the rest of the site
  are unaffected.
- The admin panel's game/tool/thumbnail zip upload is turned off (see
  `static/README.md` for how to add games instead).
