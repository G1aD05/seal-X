# Seal static files

Everything heavy lives here: the games (`1/`), tools (`tools/`) and game
thumbnails (`gameIcons/`). There is no code to run - upload this folder to any
static host and point the server at it with `STATIC_BASE_URL`.

Folder names matter: they are the URL paths the site already uses
(`/1/<game>/index.html`, `/gameIcons/<file>`), so don't rename `1`, `tools`
or `gameIcons`.

## Deploying

Publish this `static/` folder (no build command) on a host with generous or
unmetered bandwidth, then set `STATIC_BASE_URL` on the server (see
`../README.md`).

Check the host's limits before picking one. This folder is about 2.8 GB and
about 4,000 files. A few files are larger than 25 MiB (the biggest is a 53 MB
`eaglercraft/index.html`), which a host with a 25 MiB per-file cap (Cloudflare
Workers/Pages) won't accept as-is. **For Cloudflare, see `../deploy/README.md`**:
it splits those files into parts and serves them back as one file with a small
Worker. Hosts with a ~1 GB site cap (GitHub Pages) are still ruled out.

`_headers` sets a 7-day browser cache for games and an open CORS header.
Netlify and Cloudflare Pages read it automatically; on other hosts, set the
same headers by hand.

## Adding a game or tool

Drop its folder in `1/` (games) or `tools/`, redeploy this folder, then add it
in the admin panel using the path `1/<folder>/index.html`. The admin panel's
zip upload does not work while `STATIC_BASE_URL` is set, because uploaded files
would land on the server instead of here.
