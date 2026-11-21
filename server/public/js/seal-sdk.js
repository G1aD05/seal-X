/**
 * Seal SDK — lets a game grant its player Seals for things like
 * finishing a level, without the game ever touching accounts, cookies,
 * or the site's API directly.
 *
 * INCLUDE THIS FILE
 *   Your game runs inside an <iframe> on Seal's play page. Add this one
 *   script tag somewhere in your game's HTML:
 *
 *     <script src="/js/seal-sdk.js"></script>
 *
 *   (If your game is hosted on a different domain than Seal itself, use
 *   the full URL instead, e.g. <script src="https://yourseal.site/js/seal-sdk.js">.)
 *
 * WAIT FOR READY
 *   The SDK doesn't know who's playing until the page it's embedded in
 *   tells it. Always wait for that before you rely on it:
 *
 *     Seal.onReady(function (player) {
 *       if (!player) return; // visitor isn't signed in — reward calls
 *                             // will just fail, so don't bother showing
 *                             // reward UI at all
 *       console.log('Playing as', player.username);
 *     });
 *
 * GRANT A REWARD
 *   Seal.reward(key, amount, label)
 *     key    a short string unique to THIS milestone in YOUR game, e.g.
 *            "level-3-complete". Every player can only ever be paid out
 *            for a given key ONCE — calling it again (a replay, a bug
 *            that fires it twice, a player farming it) just returns
 *            { alreadyClaimed: true } and grants nothing further. Reuse
 *            the same key for the same milestone every time; use a
 *            different key for each distinct thing you reward.
 *     amount how many Seals to request (whole number, > 0). The server
 *            has the final say — it's capped per call and across your
 *            whole game per player, so don't design your reward
 *            balance assuming every request is honored in full; read
 *            the amount back off the result if you want to reflect it.
 *     label  optional short human-readable text ("Level 3 Complete!")
 *            shown in the player's Seal notifications.
 *
 *   Returns a Promise:
 *     { ok: true, seals, awarded, alreadyClaimed, capped }
 *       seals           the player's new total balance
 *       awarded         Seals actually granted THIS call (may be less
 *                        than you asked for, or 0)
 *       alreadyClaimed  true if this key had already paid out before
 *       capped          true if you hit this game's reward ceiling
 *     { ok: false, error }
 *       signed out, rate-limited, or something else went wrong — error
 *       is a short message you can log or ignore
 *
 *   Example:
 *     function onLevelComplete(level) {
 *       Seal.reward('level-' + level + '-complete', 10, 'Level ' + level + ' Complete!')
 *         .then(function (result) {
 *           if (result.ok && result.awarded > 0) {
 *             showToast('+' + result.awarded + ' Seals!');
 *           }
 *         });
 *     }
 *
 * That's the whole API. Everything else (who's signed in, how many
 * Seals they have, whether a reward is legitimate) is decided by Seal
 * itself, not by your game — so there's nothing here to configure.
 */
(function () {
  'use strict';

  if (window.Seal) return; // already loaded (e.g. included twice)

  var player = null;
  var readyCallbacks = [];
  var isReady = false;
  var pending = {}; // requestId -> {resolve}
  var nextRequestId = 1;

  function fireReady() {
    isReady = true;
    var callbacks = readyCallbacks;
    readyCallbacks = [];
    callbacks.forEach(function (cb) {
      try { cb(player); } catch (e) { /* a broken callback shouldn't break the SDK */ }
    });
  }

  window.addEventListener('message', function (event) {
    var data = event.data;
    if (!data || typeof data !== 'object') return;

    if (data.type === 'seal:init') {
      player = data.player || null;
      fireReady();
      return;
    }

    if (data.type === 'seal:grant-reward-result') {
      var waiting = pending[data.requestId];
      if (!waiting) return;
      delete pending[data.requestId];
      waiting.resolve(data.result);
    }
  });

  window.Seal = {
    /**
     * Registers a callback for when the SDK knows who's playing (or
     * that nobody's signed in). If the SDK is already ready, the
     * callback fires immediately instead of waiting.
     */
    onReady: function (callback) {
      if (typeof callback !== 'function') return;
      if (isReady) callback(player);
      else readyCallbacks.push(callback);
    },

    /** The last known player ({ username, seals }), or null. Prefer onReady() before your first read of this. */
    getPlayer: function () {
      return player;
    },

    /** True once the SDK has heard from the page it's embedded in. */
    isReady: function () {
      return isReady;
    },

    /**
     * Requests a Seal reward for the current player. See the file
     * header above for the full contract. Resolves even on failure
     * (check .ok) — it only rejects if called with a missing key.
     */
    reward: function (key, amount, label) {
      if (!key) return Promise.resolve({ ok: false, error: 'A reward key is required.' });
      var requestId = 'r' + (nextRequestId++) + '-' + Date.now();
      return new Promise(function (resolve) {
        pending[requestId] = { resolve: resolve };
        window.parent.postMessage({
          type: 'seal:grant-reward',
          requestId: requestId,
          key: String(key),
          amount: Number(amount) || 0,
          label: label ? String(label) : undefined
        }, '*');
        // If the parent page never answers (e.g. this isn't actually
        // running inside Seal), don't leave the caller hanging forever.
        setTimeout(function () {
          if (!pending[requestId]) return;
          delete pending[requestId];
          resolve({ ok: false, error: 'No response from Seal — is this running inside the Seal play page?' });
        }, 8000);
      });
    }
  };
})();
