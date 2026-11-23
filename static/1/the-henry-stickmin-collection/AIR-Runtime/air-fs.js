/*
 * AIR-Runtime / air-fs.js
 * ------------------------
 * The JavaScript half of the AIR file APIs. The patched Ruffle build in
 * vendor/ruffle/ implements flash.filesystem.File / FileStream / FileMode,
 * com.amanitadesign.steam.FRESteamWorks and NativeApplication.exit() in
 * ActionScript, and they call into the page through one synchronous
 * ExternalInterface function: window.__ruffleAirFS(op, ...args).
 *
 * Roots (see File.as in AIR-Runtime/ruffle-patches/):
 *   "app"     - File.applicationDirectory: read-only files in Game Files/
 *               (the subtitle .txt files). Read with a synchronous XHR,
 *               because the game reads them synchronously.
 *   "storage" - File.applicationStorageDirectory: save files (*.sav,
 *               settings.txt). Kept in localStorage.
 *   "other"   - any other absolute path. Also localStorage.
 *
 * File contents cross the bridge as lowercase hex strings, which survive
 * ExternalInterface marshalling byte-for-byte.
 */

(function () {
  const AIR = (window.AIR = window.AIR || {});
  const KEY_PREFIX = "henry-air:";
  const APP_DIR = "Game Files/";

  const appCache = new Map(); // path -> hex string | null (missing)

  function storageKey(root, path) {
    return KEY_PREFIX + root + ":" + path;
  }

  function appUrl(path) {
    return APP_DIR + path.split("/").map(encodeURIComponent).join("/");
  }

  function syncRequest(method, path) {
    const xhr = new XMLHttpRequest();
    xhr.open(method, appUrl(path), false);
    // Byte-exact text: each char's low byte is the original byte.
    xhr.overrideMimeType("text/plain; charset=x-user-defined");
    try {
      xhr.send();
    } catch (e) {
      return null;
    }
    return xhr.status >= 200 && xhr.status < 300 ? xhr : null;
  }

  function readApp(path) {
    if (appCache.has(path)) return appCache.get(path);
    const xhr = syncRequest("GET", path);
    let hex = null;
    if (xhr) {
      const text = xhr.responseText;
      const parts = new Array(text.length);
      for (let i = 0; i < text.length; i++) {
        const b = text.charCodeAt(i) & 0xff;
        parts[i] = (b < 16 ? "0" : "") + b.toString(16);
      }
      hex = parts.join("");
    }
    appCache.set(path, hex);
    return hex;
  }

  function existsApp(path) {
    if (path === "") return true;
    if (appCache.has(path)) return appCache.get(path) !== null;
    // Static web servers don't reliably expose directories, so a path with no file
    // extension (the game probes for an optional "Resources" folder) counts as absent.
    if (!/\.[^/]+$/.test(path)) return false;
    return syncRequest("HEAD", path) !== null;
  }

  function read(root, path) {
    if (root === "app") return readApp(path);
    try {
      return localStorage.getItem(storageKey(root, path));
    } catch (e) {
      return memory.get(storageKey(root, path)) ?? null;
    }
  }

  // Fallback when localStorage is blocked (e.g. some third-party iframes).
  const memory = new Map();
  let warnedStorage = false;

  function write(root, path, hex) {
    if (root === "app") return false;
    const key = storageKey(root, path);
    try {
      localStorage.setItem(key, hex);
    } catch (e) {
      memory.set(key, hex);
      if (!warnedStorage) {
        warnedStorage = true;
        AIR.log && AIR.log("Browser storage is unavailable - progress will be lost when this tab closes.", "warn");
      }
    }
    AIR.onSaveChanged && AIR.onSaveChanged();
    return true;
  }

  function remove(root, path) {
    if (root === "app") return false;
    const key = storageKey(root, path);
    try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
    memory.delete(key);
    AIR.onSaveChanged && AIR.onSaveChanged();
    return true;
  }

  function exists(root, path) {
    if (root === "app") return existsApp(path);
    return read(root, path) !== null || isDir(root, path);
  }

  function list(root, path) {
    if (root === "app") return [];
    const prefix = storageKey(root, path ? path + "/" : "");
    const names = new Set();
    for (const key of allKeys()) {
      if (key.startsWith(prefix)) names.add(key.slice(prefix.length).split("/")[0]);
    }
    return Array.from(names);
  }

  function isDir(root, path) {
    if (path === "") return true;
    return root !== "app" && list(root, path).length > 0;
  }

  function allKeys() {
    const keys = [];
    try {
      for (let i = 0; i < localStorage.length; i++) keys.push(localStorage.key(i));
    } catch (e) { /* ignore */ }
    return keys.concat(Array.from(memory.keys()));
  }

  window.__ruffleAirFS = function (op, a, b, c, d) {
    try {
      switch (op) {
        case "appUrl": return new URL(appUrl(b), document.baseURI).href;
        case "exists": return exists(a, b);
        case "isDir": return isDir(a, b);
        case "read": return read(a, b);
        case "write": return write(a, b, c);
        case "delete": return remove(a, b);
        case "list": return list(a, b);
        case "move":
        case "copy": {
          const data = read(a, b);
          if (data === null) return false;
          write(c, d, data);
          if (op === "move") remove(a, b);
          return true;
        }
        case "achievement":
          AIR.onAchievement && AIR.onAchievement(String(a));
          return true;
        case "exit":
          AIR.onExit && AIR.onExit(Number(a) || 0);
          return true;
      }
    } catch (e) {
      console.error("[AIR fs] " + op + " failed:", e);
    }
    return null;
  };

  // ---- save management (used by the page's Saves menu) -------------------

  AIR.saves = {
    /** Every save-related key/value: our files plus any SharedObjects Ruffle stored. */
    snapshot() {
      const out = {};
      for (const key of allKeys()) {
        if (key.startsWith("air.") || key.startsWith("henry-web:")) continue; // page UI prefs
        try { out[key] = localStorage.getItem(key) ?? memory.get(key); } catch (e) { out[key] = memory.get(key); }
      }
      return out;
    },
    hasAny() {
      return allKeys().some((k) => k.startsWith(KEY_PREFIX + "storage:"));
    },
    restore(data) {
      if (!data || typeof data !== "object") throw new Error("Not a save file.");
      for (const [key, value] of Object.entries(data)) {
        if (typeof value === "string") localStorage.setItem(key, value);
      }
    },
    clear() {
      for (const key of Object.keys(this.snapshot())) {
        try { localStorage.removeItem(key); } catch (e) { /* ignore */ }
        memory.delete(key);
      }
    },
  };
})();
