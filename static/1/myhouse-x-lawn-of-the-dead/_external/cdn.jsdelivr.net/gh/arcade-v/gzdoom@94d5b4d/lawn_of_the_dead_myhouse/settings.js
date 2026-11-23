const GITHUB_REPO = "arcade-v/gzdoom";
const GITHUB_BRANCH = "main";

function getMirrors(path) {
    const encodedPath = path
        .split("/")
        .map(encodeURIComponent)
        .join("/");

    return [
        `https://cdn.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${encodedPath}`,
        `https://raw.githubusercontent.com/${GITHUB_REPO}/refs/heads/${GITHUB_BRANCH}/${encodedPath}`,
        `https://fastly.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${encodedPath}`,
        `https://gcore.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${encodedPath}`,
        `https://testingcf.jsdelivr.net/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${encodedPath}`,
        `https://raw.githack.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${encodedPath}`,
        `https://cdn.statically.io/gh/${GITHUB_REPO}@${GITHUB_BRANCH}/${encodedPath}`
    ];
}
var GZDOOMSETTINGS = {
    CLOUDSAVEURL: "",

    WADURL: getMirrors("doom_2/doom2.wad"),

    MODNAMES: [
        "Dad Visits MyHouse.wad",
        "Doom_Mower_v2.wad",
        "myhouse.pk3"
    ],
    MODURLS: [
        {
            name: "Dad Visits MyHouse.wad",
            urls: getMirrors(
                "lawn_of_the_dead_myhouse/Dad Visits MyHouse.wad"
            )
        },

        {
            name: "Doom_Mower_v2.wad",
            urls: getMirrors(
                "lawn_of_the_dead/Doom_Mower_v2.wad"
            )
        },

        {
            name: "myhouse.pk3",
            parts: [
                getMirrors("myhouse/myhouse.pk3.part1"),
                getMirrors("myhouse/myhouse.pk3.part2"),
                getMirrors("myhouse/myhouse.pk3.part3"),
                getMirrors("myhouse/myhouse.pk3.part4")
            ]
        }
    ]
};

window.GZDOOMSETTINGS = GZDOOMSETTINGS;
window.GZDOOM_MOD_BLOB_URLS = [];

async function fetchWithFallback(urls, fileName, validator) {
    if (typeof urls === "string") {
        urls = [urls];
    }

    let lastError;

    for (let i = 0; i < urls.length; i++) {
        try {
            console.log(
                `Loading ${fileName}: mirror ${i + 1}/${urls.length}`
            );

            const response = await fetch(urls[i], {
                cache: "no-store"
            });

            if (!response.ok) {
                throw new Error(
                    `${response.status} ${response.statusText}`
                );
            }

            const data = await response.arrayBuffer();

            if (!data.byteLength) {
                throw new Error("Empty download.");
            }

            if (validator) {
                await validator(data);
            }

            console.log(`Successfully loaded ${fileName}: ${urls[i]}`);

            return data;

        } catch (error) {
            lastError = error;
            console.warn(`Mirror failed: ${urls[i]}`, error);
        }
    }

    throw new Error(
        `All mirrors failed for ${fileName}: ${lastError}`
    );
}

// Validate WAD or ZIP/PK3 signatures.
function validateGZDoomFile(blob, fileName) {
    return blob.slice(0, 4).arrayBuffer().then(buffer => {
        const header = new Uint8Array(buffer);

        if (header.length < 4) {
            throw new Error(`${fileName} is too small.`);
        }

        const signature = String.fromCharCode(...header);

        const isWAD =
            signature === "IWAD" ||
            signature === "PWAD";

        const isZIP =
            header[0] === 0x50 &&
            header[1] === 0x4B &&
            (
                (header[2] === 0x03 && header[3] === 0x04) ||
                (header[2] === 0x05 && header[3] === 0x06) ||
                (header[2] === 0x07 && header[3] === 0x08)
            );

        const expectsWAD = /\.wad$/i.test(fileName || "");

        if (expectsWAD && !isWAD) {
            throw new Error(`${fileName} has an invalid WAD signature.`);
        }

        if (!expectsWAD && !isZIP) {
            throw new Error(`${fileName} has an invalid ZIP/PK3 signature.`);
        }
    });
}

async function loadPK3FromParts(parts, onProgress, fileName) {
    if (!Array.isArray(parts) || parts.length === 0) {
        throw new Error("No file parts provided.");
    }

    const partURLs = parts.map(part =>
        typeof part === "string" ? [part] : part
    );

    if (partURLs.some(urls =>
        !Array.isArray(urls) || urls.length === 0
    )) {
        throw new Error(
            "One or more file parts have no mirror URLs."
        );
    }

    const chunks = [];
    let totalBytes = 0;

    for (let i = 0; i < partURLs.length; i++) {
        const chunk = await fetchWithFallback(
            partURLs[i],
            `${fileName} part ${i + 1}`
        );

        chunks.push(chunk);
        totalBytes += chunk.byteLength;

        if (typeof onProgress === "function") {
            onProgress({
                part: i + 1,
                totalParts: partURLs.length,
                downloadedBytes: totalBytes
            });
        }
    }

    const isWAD = /\.wad$/i.test(fileName || "");

    const blob = new Blob(chunks, {
        type: isWAD
            ? "application/octet-stream"
            : "application/zip"
    });

    await validateGZDoomFile(blob, fileName);

    const blobURL = URL.createObjectURL(blob);

    window.GZDOOM_MOD_BLOB_URLS.push(blobURL);

    console.log(
        `${fileName} reconstructed successfully: ` +
        `${(totalBytes / 1024 / 1024).toFixed(2)} MB`
    );

    return blobURL;
}

// Resolve mods and their fallbacks.
async function resolveGZDoomMods() {
    const mods = GZDOOMSETTINGS.MODURLS;

    if (typeof mods === "string") {
        return mods;
    }

    if (!Array.isArray(mods)) {
        throw new Error(
            "GZDOOMSETTINGS.MODURLS must be a string or array."
        );
    }

    const resolvedURLs = [];

    for (const mod of mods) {
        if (mod && Array.isArray(mod.parts)) {
            const name = mod.name || "mod";

            const url = await loadPK3FromParts(
                mod.parts,
                progress => {
                    console.log(
                        `${name}: ${progress.part}/` +
                        `${progress.totalParts}, ` +
                        `${(
                            progress.downloadedBytes /
                            1024 / 1024
                        ).toFixed(2)} MB downloaded`
                    );
                },
                name
            );

            resolvedURLs.push(url);

        } else if (mod && mod.urls) {
            const name = mod.name || "mod";

            const data = await fetchWithFallback(
                mod.urls,
                name
            );

            const blob = new Blob([data], {
                type: "application/octet-stream"
            });

            await validateGZDoomFile(blob, name);

            const blobURL = URL.createObjectURL(blob);

            window.GZDOOM_MOD_BLOB_URLS.push(blobURL);

            resolvedURLs.push(blobURL);

        } else if (typeof mod === "string") {
            resolvedURLs.push(mod);

        } else {
            throw new Error("Invalid mod configuration.");
        }
    }

    return resolvedURLs.join(",");
}

// Prepare IWAD and mods.
async function prepareGZDoomSettings() {
    const wadData = await fetchWithFallback(
        GZDOOMSETTINGS.WADURL,
        "doom2.wad",
        data => validateGZDoomFile(
            new Blob([data]),
            "doom2.wad"
        )
    );

    const wadBlob = new Blob([wadData], {
        type: "application/octet-stream"
    });

    const wadBlobURL = URL.createObjectURL(wadBlob);

    window.GZDOOM_MOD_BLOB_URLS.push(wadBlobURL);

    const mods = await resolveGZDoomMods();

    GZDOOMSETTINGS.WADURL = wadBlobURL;
    GZDOOMSETTINGS.MODURLS = mods;

    window.GZDOOMSETTINGS = GZDOOMSETTINGS;

    return GZDOOMSETTINGS;
}

window.fetchWithFallback = fetchWithFallback;
window.loadPK3FromParts = loadPK3FromParts;
window.resolveGZDoomMods = resolveGZDoomMods;
window.prepareGZDoomSettings = prepareGZDoomSettings;

function postLoad() {
    if (window.myApp == null) return;

    window.myApp.modReplacementHook = function () {
        // Optional mod replacement logic.
    };

    window.myApp.gzDoomIniHook = function (text) {
        return text;
    };
}

window.postLoad = postLoad;