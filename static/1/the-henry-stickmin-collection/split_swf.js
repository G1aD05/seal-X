
/* split_swf.js
 * Split SWF loader with CDN fallbacks.
 */

(function () {
  "use strict";

  const PART_COUNTS = {
    "Henry.swf": 6,
    "HenryCtM.swf": 6,
    "HenryCtM2.swf": 7,
    "HenryFtC.swf": 3
  };

  // CDN locations, in priority order.
  const CDN_SOURCES = [
    "https://cdn.jsdelivr.net/gh/arcade-v/flash/henry_stickmen_collection/",
    "https://fastly.jsdelivr.net/gh/arcade-v/flash/henry_stickmen_collection/",
    "https://testingcf.jsdelivr.net/gh/arcade-v/flash/henry_stickmen_collection/",
    "https://raw.githubusercontent.com/arcade-v/flash/main/flash/henry_stickmen_collection/",
    "https://raw.githack.com/arcade-v/flash/main/henry_stickmen_collection/",
    "https://cdn.statically.io/gh/arcade-v/flash@main/henry_stickmen_collection/"
  ];

  const GAME_PATH = "Game%20Files/";
  const MAX_RETRIES = 2;

  const originalFetch = window.fetch.bind(window);
  const originalXhrOpen = XMLHttpRequest.prototype.open;
  const originalXhrSend = XMLHttpRequest.prototype.send;

  const cache = new Map();

  function resolveUrl(input) {
    try {
      return new URL(
        typeof input === "string" ? input : input.url,
        document.baseURI
      );
    } catch {
      return null;
    }
  }

  function getSwfName(input) {
    const url = resolveUrl(input);
    if (!url) return null;

    let pathname = url.pathname;

    try {
      pathname = decodeURIComponent(pathname);
    } catch {}

    const match = pathname.match(
      /(?:^|\/)(Henry(?:CtM2|CtM|FtC)?\.swf)$/i
    );

    if (!match) return null;

    return Object.keys(PART_COUNTS).find(
      name => name.toLowerCase() === match[1].toLowerCase()
    ) || null;
  }

  function getPartUrl(source, partName) {
    return source + GAME_PATH + encodeURIComponent(partName);
  }

  // Download a part, trying every CDN before giving up.
  async function loadPart(partName) {
    let lastError;

    for (const source of CDN_SOURCES) {
      for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
        const url = getPartUrl(source, partName) +
          "?_=" + Date.now();

        try {
          console.info(
            "[split_swf] Loading " + partName +
            " from " + source +
            " (attempt " + (attempt + 1) + ")"
          );

          const response = await originalFetch(url, {
            cache: "no-store"
          });

          if (!response.ok) {
            throw new Error("HTTP " + response.status);
          }

          const buffer = await response.arrayBuffer();

          if (!buffer.byteLength) {
            throw new Error("Empty part received");
          }

          console.info(
            "[split_swf] Loaded " + partName +
            " (" + (buffer.byteLength / 1048576).toFixed(2) + " MiB)"
          );

          return buffer;

        } catch (error) {
          lastError = error;

          console.warn(
            "[split_swf] Failed " + partName +
            " using " + source +
            ": " + error.message
          );

          if (attempt < MAX_RETRIES) {
            await new Promise(resolve =>
              setTimeout(resolve, 500 * (attempt + 1))
            );
          }
        }
      }
    }

    throw new Error(
      "All CDN sources failed for " + partName +
      ". Last error: " + lastError
    );
  }

  async function assemble(name) {
    if (cache.has(name)) {
      return cache.get(name);
    }

    const promise = (async () => {
      const count = PART_COUNTS[name];
      const parts = [];
      let total = 0;

      console.info(
        "[split_swf] Starting " + name +
        " (" + count + " parts)"
      );

      for (let i = 0; i < count; i++) {
        const partName =
          name + ".part" + String(i).padStart(3, "0");

        const buffer = await loadPart(partName);

        parts.push(buffer);
        total += buffer.byteLength;

        console.info(
          "[split_swf] Progress: " +
          (i + 1) + "/" + count +
          " parts (" +
          Math.round(total / 1048576) +
          " MiB)"
        );
      }

      const blob = new Blob(parts, {
        type: "application/x-shockwave-flash"
      });

      console.info(
        "[split_swf] Successfully assembled " +
        name + " (" +
        (blob.size / 1048576).toFixed(2) +
        " MiB)"
      );

      return blob;
    })();

    cache.set(name, promise);

    try {
      return await promise;
    } catch (error) {
      cache.delete(name);
      throw error;
    }
  }

  // Fetch interception.
  window.fetch = async function (input, init) {
    const name = getSwfName(input);

    if (!name) {
      return originalFetch(input, init);
    }

    const blob = await assemble(name);
    const url = resolveUrl(input);

    return new Response(blob, {
      status: 200,
      statusText: "OK",
      headers: {
        "Content-Type": "application/x-shockwave-flash",
        "Content-Length": String(blob.size),
        "X-Split-SWF": name,
        "X-Split-SWF-URL": url ? url.href : ""
      }
    });
  };

  // XMLHttpRequest interception.
  XMLHttpRequest.prototype.open = function (method, url) {
    this.__splitSwfName = getSwfName(String(url));
    this.__splitSwfMethod = String(method).toUpperCase();

    if (this.__splitSwfName) {
      this.__splitSwfUrl = resolveUrl(String(url)).href;

      return originalXhrOpen.call(
        this,
        method,
        this.__splitSwfUrl,
        true
      );
    }

    return originalXhrOpen.apply(this, arguments);
  };

  XMLHttpRequest.prototype.send = function (body) {
    const name = this.__splitSwfName;

    if (!name) {
      return originalXhrSend.call(this, body);
    }

    const xhr = this;
    let aborted = false;

    xhr.abort = function () {
      aborted = true;

      if (typeof xhr.onabort === "function") {
        xhr.onabort(new ProgressEvent("abort"));
      }
    };

    (async () => {
      try {
        const blob = await assemble(name);

        if (aborted) return;

        const buffer = await blob.arrayBuffer();

        if (aborted) return;

        Object.defineProperty(xhr, "readyState", {
          configurable: true,
          value: 4
        });

        Object.defineProperty(xhr, "status", {
          configurable: true,
          value: 200
        });

        Object.defineProperty(xhr, "statusText", {
          configurable: true,
          value: "OK"
        });

        Object.defineProperty(xhr, "responseURL", {
          configurable: true,
          value: xhr.__splitSwfUrl
        });

        Object.defineProperty(xhr, "response", {
          configurable: true,
          get: () =>
            xhr.responseType === "blob"
              ? blob
              : xhr.responseType === "json"
                ? null
                : xhr.responseType === "text"
                  ? new TextDecoder().decode(buffer)
                  : buffer
        });

        if (typeof xhr.onreadystatechange === "function") {
          xhr.onreadystatechange(new Event("readystatechange"));
        }

        if (typeof xhr.onload === "function") {
          xhr.onload(new ProgressEvent("load", {
            lengthComputable: true,
            loaded: blob.size,
            total: blob.size
          }));
        }

        if (typeof xhr.onloadend === "function") {
          xhr.onloadend(new ProgressEvent("loadend"));
        }

      } catch (error) {
        console.error(
          "[split_swf] Failed to assemble " + name,
          error
        );

        if (aborted) return;

        Object.defineProperty(xhr, "readyState", {
          configurable: true,
          value: 4
        });

        Object.defineProperty(xhr, "status", {
          configurable: true,
          value: 0
        });

        if (typeof xhr.onreadystatechange === "function") {
          xhr.onreadystatechange(new Event("readystatechange"));
        }

        if (typeof xhr.onerror === "function") {
          xhr.onerror(new ProgressEvent("error"));
        }

        if (typeof xhr.onloadend === "function") {
          xhr.onloadend(new ProgressEvent("loadend"));
        }
      }
    })();
  };

  window.SplitSWF = {
    assemble,
    getSwfName,
    loadPart,
    partCounts: Object.assign({}, PART_COUNTS),
    cdnSources: CDN_SOURCES
  };

  console.info("[split_swf] Fallback-enabled SWF loader installed.");

})();
