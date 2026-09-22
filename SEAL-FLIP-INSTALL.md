# Seal Flip — install

Tested by running it against your actual server.js, style.css and api.js
(cloned from github.com/G1aD05/seal-X) — registered a real account, placed
real bets, and confirmed wins/losses/cooldown/daily-cap all round-trip
through data/db.json correctly, including across a server restart.

Unzip from the **root of your seal-X folder** (the one containing
`server.js`):

    unzip -o seal-flip.zip

That writes:

    gamble.js            <- new, next to server.js
    public/flip.html     <- new page, styled to match the rest of the site
    public/js/api.js     <- OVERWRITES your existing one (adds two methods,
                             getFlipState/placeFlipBet, at the bottom —
                             nothing else in the file is touched)

## 1. Wire it into server.js

Add these two lines **right before** the static file mount
(`app.use(express.static(...))`), so after `readDB`, `writeDB` and
`requireLogin` are all defined:

    // Flip (Seals betting game)
    require('./gamble')(app, { readDB, writeDB, requireLogin });

    // ── static site ─────────────────────────────────────────────────
    app.use(express.static(path.join(__dirname, 'public')));

Restart: `npm start`

## 2. Add the link

Sign in as an admin, go to the Tools page, and use the "Add a tool" form:

    Name:  Flip
    URL:   /flip.html

Or hand-edit `data/db.json` the same way you would for any other tool.

## 3. Check it

Visit `/flip.html` signed in. You should see the same header, sign-out
chip, nav dock and Seals balance styling as the rest of the site, plus
the betting board itself.

## Tuning

All the knobs are at the top of `gamble.js`:

    MIN_BET           1
    MAX_BET           100
    DAILY_WAGER_CAP   500     total Seals stakeable per UTC day
    COOLDOWN_MS       1200    minimum gap between bets
    HOUSE_EDGE        0.025   2.5% -> every payout returns 97.5%

Balances, rolls and limits are all decided server-side, the same way
/api/shop/buy already works — the page only animates a result it's told.
Seals are play money: there is no way to buy them and no real money
anywhere in this feature.
