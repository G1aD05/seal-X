# Seal — self-hosting guide

## Keeping your data on hosts without a persistent disk (e.g. Render's free tier)

Render's free web services (and several other free hosts) don't attach a
persistent disk at all — every restart, which happens automatically after
about 15 idle minutes, wipes the entire local filesystem. That resets
`data/db.json` (every account, Seals balance, chat message, badge, comment
— everything) and any uploaded avatar/banner/ring images back to nothing.

Fix it by setting these environment variables in your host's dashboard
(not in a committed `.env` file):

- **`MONGODB_URI`** — switches the "database" over to MongoDB instead of
  the local file, so it survives restarts. A free [MongoDB Atlas](https://www.mongodb.com/cloud/atlas/register)
  cluster (the M0 tier — free forever, no card required, 512MB) works
  fine for a site this size. Something like:
  `mongodb+srv://user:password@cluster0.xxxxx.mongodb.net/`
  Leave it unset for local development or any host that already gives
  you a real persistent disk — the app then behaves exactly as before,
  reading and writing `data/db.json` directly.
- **`ADMIN_USERNAMES`** — a comma-separated list (e.g.
  `turkey,thesealking`) that replaces `data/admins.json`. Since env vars
  set in your host's dashboard persist across restarts on their own, this
  is the simplest fix for the admin list specifically, without needing a
  database just for a short, rarely-changed list. Leave unset to keep
  editing `data/admins.json` by hand as before.
- **`SESSION_SECRET`** — a long random string. If unset, one is generated
  and saved to `data/session-secret.txt` on first boot — but that file is
  just as ephemeral as everything else on hosts without a persistent
  disk, so set this explicitly there too, or logged-in sessions won't
  survive a restart either.

None of this is required to run the site locally or on a host with a real
disk — every one of these has a working fallback. It only matters on
hosts like Render's free tier where the filesystem itself is temporary.

### Uploaded files (avatars, banners, rings, the file library)

`MONGODB_URI` above only covers the database — uploaded images still
reset the same way unless you set these too. Works with any
S3-compatible storage provider; two good free options, both genuinely
free with no credit card needed for basic storage:

- **[Supabase Storage](https://supabase.com/storage)** — 1GB free, no
  card required, and public buckets just work with no extra
  verification step. **Recommended** for that last reason specifically.
  One caveat: free projects pause after 7 days of *zero* activity
  (any API/database traffic resets the clock, so an actively-used site
  won't hit this) and wake back up automatically on the next request.
- **[Backblaze B2](https://www.backblaze.com/cloud-storage)** — 10GB
  free, no card to create the account, but B2 may ask for a card
  specifically when you try to make a bucket *public* — worth checking
  before you commit to it, since that's the whole point of using it here
  (avatars and rings need to load directly in the browser).

Either way, set these five together — leave any of them unset and the
app falls back to local disk exactly as before:

- **`S3_ENDPOINT`** — the S3-compatible endpoint from your provider's
  dashboard. For Supabase: `https://<project-ref>.supabase.co/storage/v1/s3`.
  For B2: `https://s3.<region>.backblazeb2.com`.
- **`S3_REGION`** — for Supabase, your project's region (e.g.
  `us-east-1`); for B2, the region from its endpoint (e.g.
  `us-west-002`). Defaults to `us-east-1` if unset.
- **`S3_BUCKET`** — your bucket's name.
- **`S3_ACCESS_KEY_ID`** / **`S3_SECRET_ACCESS_KEY`** — an access key
  scoped to this bucket. For Supabase: Storage settings → generate new
  S3 access keys. For B2: create an *S3-compatible* application key
  (B2's native master key won't work with the S3 API).
- **`S3_PUBLIC_URL_BASE`** — the public URL prefix for objects in your
  bucket. For Supabase:
  `https://<project-ref>.supabase.co/storage/v1/object/public/<bucket>`.
  For B2: the bucket's "Friendly URL" from its settings page, e.g.
  `https://f002.backblazeb2.com/file/your-bucket`. The bucket needs to
  be set to public either way, since avatars and rings load directly in
  the browser.

**Not covered by this:** game and tool zip uploads still live on local
disk and reset the same way. Those unpack into many-file static
directory trees served directly by the webserver, not single files —
moving that to object storage would mean proxying every game asset
request through this server instead of serving it directly, which is a
bigger, riskier change than a small site's game library usually needs.
Re-upload games/tools after a restart on hosts without persistent disk,
or host this app somewhere with real persistent storage if that's too
painful for a large game library.

## What changed from the old version:

- **There's a site currency called Seals, plus customizable profiles.**
  Every account has a Seals balance (`GET/POST /api/seals/daily` for a
  once-a-day claim) and can spend it in the new **Shop** (`shop.html`)
  on avatar colors, profile banner gradients, and titles — each
  purchase is validated server-side (`POST /api/shop/buy` checks the
  price against the account's actual balance, never trusts the
  client). Everyone gets a public **Profile** page (`profile.html?u=
  <username>`, backed by `GET /api/profile/:username`) showing their
  Seals, bio, and equipped cosmetics; signed-in users can edit their
  own bio and equip anything they own (`PUT /api/profile/me`) and see
  a Seals leaderboard. Usernames in Chat link to profiles. Accounts
  created before this feature was added are backfilled with a starter
  balance and the free cosmetics the first time they're read, so
  nothing needs a manual migration.

- **Playing games earns Seals passively, without trusting the game.**
  While a game is open on `play.html` and the tab is focused, the page
  pings `POST /api/seals/playtime-ping` roughly once a minute. The
  server — never the game itself — decides the payout: it only counts
  the time actually elapsed since a user's last ping (clamped to 1.5×
  the expected interval, so a spoofed timestamp or a left-open tab
  can't claim a huge gap), pays 1 Seal per 3 minutes of verified play,
  and caps playtime earnings at 40 Seals/day, separate from the daily
  login claim. Because it's driven by `play.html` rather than
  per-game code, it works for every game in the library with no
  changes to the games themselves.

- **The banner now updates live, on every device, with no refresh.**
  Every open tab holds a lightweight connection to the server
  (Server-Sent Events); the moment an admin publishes or clears the
  banner, the server pushes it straight to every connected browser.
- **Games open inside the site instead of navigating away.** Clicking a
  game now opens `play.html?g=<id>`, which keeps the header, the global
  banner, and sign-in available in an iframe wrapper around the actual
  game — so a banner published while someone's mid-game still reaches
  them, and they're never fully off-site.
- **There's a live chat room.** It's listed as a Tool ("Chat") and lives
  at `chat.html`. Anyone can read it; only signed-in users can post (the
  server, not the browser, decides who a message is "from," so no one
  can spoof a username). Messages arrive live via the same
  Server-Sent-Events pattern as the banner, admins can delete any
  message, and there's a basic per-user rate limit (about one message
  per second) baked into the server.
- **There's a dismissible "what's new" popup, separate from the banner.**
  Admins can publish one from the same Admin Panel (below the banner
  controls). It shows once to each visitor as a modal; when they close
  it, their browser remembers that specific update (by id) so it won't
  show again — but publishing a new one always reaches everyone again,
  even people who dismissed a previous update. It also arrives live via
  the same SSE pattern as the banner and chat, so it can appear without
  a refresh.

- **There's a Settings panel for signed-in users** (⚙ Settings, next to
  Sign Out), with three tabs:
  - **Send Audio** — admin-only by default. An admin (or a user an
    admin has explicitly granted access) picks anyone currently online
    and sends them a sound from the file library. The recipient gets a
    prompt ("_username_ sent you a sound — Play / Dismiss") unless
    they've turned on auto-play for themselves in Preferences, in
    which case it just plays. That auto-play choice is personal to
    each person's own browser — no one can turn it on for someone
    else, and the server never plays anything on its own; it only
    delivers the notification. Ordinary users without access see a
    message telling them to ask an admin, instead of the send form.
    Admins grant/revoke access per-user from Admin Panel → **Sound
    Permissions**, without making anyone a full admin. (This only
    gates *sending* — anyone signed in can still upload to, and anyone
    at all can still download from, the Files library below.)
  - **Files** — a public upload/download library (anyone visiting can
    browse and download; uploading requires an account). 25MB cap per
    file, and a fixed blocklist of executable-ish extensions (`.exe`,
    `.sh`, `.jar`, etc.) is rejected server-side as a baseline safety
    measure on a publicly-writable upload endpoint — it's not content
    moderation.
  - **Preferences** — currently just the audio auto-play toggle above.

  "Online" uses the same live-connection pattern as the banner/chat/
  popup: a signed-in user counts as online for as long as they have
  the site open in a tab.

- **Admins can export the whole site, and add new games/tools without
  shell access**, both from the Admin Panel (below Data Backup):
  - **Export Site** downloads a single .zip of everything under
    `public/` (every game/tool folder, icons, the site code) plus the
    data backup — a full offline copy, useful for migrating hosts.
  - **Add Game/Tool Files** lets an admin upload a `.zip` of a new
    game or tool's files, which gets extracted into a fresh folder on
    the server (`public/games/<name>/` or `public/tools/<name>/`), or
    upload a single image straight into `public/gameIcons/`. The
    response gives you the path to paste into the existing Add
    Game/Tool form's URL or Thumbnail field. Every extracted path is
    checked to make sure it can't escape its target folder (protects
    against malicious "zip-slip" archives), and there's a 500MB
    uncompressed-size cap as a zip-bomb guard. This writes real files
    to the server, so — like editing `data/db.json` by hand — it's
    admin-only and should be treated with the same trust you'd give
    someone SFTP access.

- **The banner is now global for real.** It used to live in each visitor's
  `localStorage`, so only *you* ever saw it. Now it's stored on the server
  (`data/db.json`) and every visitor's browser asks the server for it, so
  everyone sees the same banner at the same time.
- **Adding a game is now a form, not a code edit.** Signed-in admins get an
  "Add a game to the library" panel at the top of the Games/Tools page.
  Fill it in, hit *Add* — it's saved on the server and shows up for every
  visitor immediately. (You can also hand-edit `data/db.json` directly if
  you prefer; the server reads it fresh on every request.)
- **Accounts and admin status are enforced by the server**, not the
  browser. Passwords are hashed with bcrypt instead of just base64'd, and
  admin status is checked against `data/admins.json` server-side, so a
  visitor can't just edit their browser storage to grant themselves admin
  (the old version's `ADMINS` array lived in client-side JS, which anyone
  could bypass in devtools).

## 1. Install Node.js

You need Node.js 18 or newer. Check with:

```bash
node -v
```

If you don't have it, install it from [nodejs.org](https://nodejs.org) or
your package manager (e.g. `apt install nodejs npm` on Debian/Ubuntu).

## 2. Install dependencies

From the project folder:

```bash
npm install
```

This pulls in `express`, `express-session`, and `bcryptjs` — three small
packages, nothing heavy.

## 3. Add your game/tool files and images

Copy your existing `games/`, `gameIcons/`, `images/`, and `favicon/`
folders into `public/`, so the structure looks like:

```
public/
  index.html
  games.html
  tools.html
  style.css
  js/
  images/        ← your seal.png, controller.png, tools.png
  gameIcons/     ← game thumbnails
  games/         ← the actual game files/folders
  favicon/
```

The game/tool *entries* themselves (name, description, thumbnail path,
URL) live in `data/db.json` — you don't need to touch HTML to add one.

## 4. Set who's an admin

Open `data/admins.json` and list the usernames (must already have
registered an account on the site) who should get admin powers:

```json
["turkey", "your-username"]
```

Save it — no restart required, it's read fresh on every request.

## 5. Run it

```bash
npm start
```

You'll see `Seal is running at http://localhost:3000`. Visit that in a
browser, register an account using one of the usernames from
`admins.json`, and you'll see the **Admin** button in the header.

To use a different port:

```bash
PORT=8080 npm start
```

## 6. Keep it running / host it publicly

For a quick local LAN test, `npm start` is enough. To host it properly:

- **Keep the process alive**: use [pm2](https://pm2.keymetrics.io/)
  (`npm i -g pm2 && pm2 start server.js --name seal`) or a systemd
  service, so it restarts if it crashes or the machine reboots.
- **Put it behind HTTPS**: use a reverse proxy like nginx or Caddy in
  front of Node, or a host that terminates TLS for you (Render, Railway,
  Fly.io, a VPS with Caddy). Once you're serving over HTTPS, open
  `server.js` and set `cookie.secure: true` in the session config so
  login cookies are only sent over HTTPS.
- **Set a real session secret**: `SESSION_SECRET=some-long-random-string
  npm start` — otherwise a new random secret is generated on every
  restart, which logs everyone out.
- **Back up `data/db.json`** occasionally — it's the entire database
  (accounts, banner, game/tool library) in one file.

## Deploying on Render

Render deploys from a git repo, so first push this project to GitHub (or
GitLab/Bitbucket): create a new repo, then from inside this folder:

```bash
git init
git add .
git commit -m "Seal"
git branch -M main
git remote add origin https://github.com/<you>/<repo>.git
git push -u origin main
```

Then on [render.com](https://render.com):

1. **New +** → **Web Service** → connect the repo you just pushed.
2. Settings:
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
3. **Environment** tab → add:
   - `SESSION_SECRET` — any long random string (otherwise a new one is
     generated on every restart, which signs everyone out)
   - `NODE_ENV` = `production` — Render terminates HTTPS for you, so this
     tells the app to only send login cookies over HTTPS
4. Deploy. Render gives you a `https://your-app.onrender.com` URL — that's
   your live site.

**Important — data persistence.** By default Render's filesystem is
ephemeral: anything written after the container starts (new accounts,
games/tools added through the admin panel, chat messages, the banner)
is lost whenever the service restarts, redeploys, or spins down. Two
options:

- **Free tier, for testing/demos**: works fine, but every restart resets
  to whatever's committed in `data/db.json` in your repo (so the 46
  games are always there, but nothing added live sticks around). Free
  services also spin down after 15 minutes of no traffic and take
  ~30–60s to wake back up on the next visit.
- **Persistent data**: upgrade the service to a paid instance type
  (Starter, ~$7/mo) and attach a **Disk** (Settings → Disks → Add Disk;
  ~$0.25/GB/mo). Give it a mount path like `/var/data`, then add an
  environment variable `DATA_DIR=/var/data` and redeploy. The server
  auto-creates empty data files there on first boot — so either
  re-add your games/admins through the site afterward, or use Render's
  **Shell** tab (paid plans only) once to copy your existing
  `data/db.json` and `data/admins.json` onto the disk before anyone
  else uses the site.

## Notes on the data store

`data/db.json` is a plain JSON file, read and rewritten on each change —
totally fine for a small site with light traffic. If you outgrow it
(thousands of concurrent users, frequent writes), swap `readDB`/`writeDB`
in `server.js` for a real database (SQLite is the easiest upgrade path);
every route already goes through those two functions, so it's a
contained change.
