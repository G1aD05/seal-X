// GZDoom Wasm front-end. Mirrors the Bsnes MyClass pattern:
//   - sets up window.Module, then injects the emscripten glue (gzdoom.js)
//   - does NOT auto-start; waits for the "Play Game" button
//   - lets the user pick a bundled WAD from the dropdown, or drag/drop their own
//     WAD / PK3 which is written into MEMFS and launched instead.

// ---- canvas zoom (windowed display size) --------------------------------
// The displayed size of the game is driven by CSS (the #canvasDiv box). The
// wasm/SDL render resolution follows it: SDL's emscripten backend runs in
// "external_size" mode (because #canvas has a CSS size) and re-reads the
// canvas CSS size on every window 'resize' event, updating the GL drawable +
// engine framebuffer to match (Emscripten_HandleResize -> DFrameBuffer::Update).
// Keeping the size under our control this way is what fixes the post-fullscreen
// "tiny / blank canvas" bug: whatever size SDL leaves the backing store at when
// a fullscreen transition ends, we re-assert our windowed size and resync.
const ZOOM_ASPECT_W = 16;
const ZOOM_ASPECT_H = 9;
const ZOOM_MIN_WIDTH = 480;
const ZOOM_MAX_WIDTH = 3840;
const ZOOM_STEP = 160;
const ZOOM_DEFAULT_WIDTH = 960;
const ZOOM_STORAGE_KEY = 'gzdoom-canvas-width';
const LOW_MEMORY_STORAGE_KEY = 'gzdoom-low-memory';

class MyClass {
    constructor() {
        this.started = false;
        this.mainCalled = false;
        this.autoStart = false;     // set by setupAutoload() when GZDOOMSETTINGS.WADURL is present
        this.args = '';
        this._hideTimer = null;     // pending "hide the progress bar" timeout

        // WAD/mod loader state (see setupWadLoader). baseWad is a single item or
        // null; mods is an ordered list (load order). Each item is
        // { id, label, path?, file?: {name, bytes}, tag }.
        this.baseWad = null;
        this.mods = [];
        this.wadDefs = [];
        this.modDefs = [];
        this._uid = 0;

        // Persisted settings (see the settings store section). Defaults live here;
        // retrieveSettings() below overrides them from localStorage if present.
        this.lowMemory = false;

        this.canvas = document.getElementById('canvas');
        this.statusEl = document.getElementById('status');

        document.getElementById('btnFullScreen').addEventListener('click', () => this.fullscreen());
        document.getElementById('btnNewGame').addEventListener('click', () => location.reload());
        document.getElementById('btnZoomOut').addEventListener('click', () => this.zoomOut());
        document.getElementById('btnZoomIn').addEventListener('click', () => this.zoomIn());

        // Restore the windowed size whenever we leave (or enter) browser
        // fullscreen, so the canvas can never get stuck tiny or blank.
        ['fullscreenchange', 'webkitfullscreenchange', 'mozfullscreenchange'].forEach((ev) =>
            document.addEventListener(ev, () => this.onFullscreenChange(), false));

        // Autoload / kiosk mode: the game box is sized to fit the browser window,
        // so re-fit it whenever the window changes. Ignore the synthetic resize
        // events syncEngineSize() dispatches (isTrusted === false) to avoid a
        // feedback loop; windowed mode uses a fixed zoom size and opts out here.
        window.addEventListener('resize', (e) => {
            if (!this.autoStart) return;
            if (e && e.isTrusted === false) return;
            this.applyCanvasSize();
        }, false);

        this.retrieveSettings();
        this.setupSaveSystem();
        this.setupAutoload();
        this.loadZoom();
        // NB: setupWadLoader() is intentionally NOT started here. It is invoked at
        // the bottom of this file, AFTER settings.js's postLoad() wires the
        // mod/WAD hooks -- so modReplacementHook is guaranteed to exist before the
        // manifests load, without relying on fetch() timing.
    }

    setStatus(text) {
        if (this.statusEl) this.statusEl.innerText = text;
    }

    print(text) {
        // GZDoom is very chatty at boot; keep it in the console only so we don't
        // thrash the DOM (DOM logging was a real perf problem during gameplay).
        console.log(text);
    }

    // ---- emscripten lifecycle ------------------------------------------------

    // Module.onRuntimeInitialized -> the wasm is ready, but we DON'T run yet.
    initModule() {
        if (this.autoStart) {
            // Autoload mode: the runtime is ready -- boot straight into the game
            // instead of waiting for Play. prepareArgs() fetches the WAD/mods, so
            // the download progress + status are still shown before callMain().
            this.playGame();
            return;
        }
        myApp.setStatus('Ready \u2014 to start press Play Game.');
        document.getElementById('btnPlay').disabled = false;
    }

    // ---- progress bar (#myProgress) ------------------------------------------
    // Generic helpers so ANY download can drive the same Bootstrap bar. Usage:
    //   resetProgress()                  -> show the bar at 0% before a download
    //   updateProgress(pct)              -> set 0..100% while it runs
    //   setProgressText('12.3 MB')       -> label for unknown-size downloads
    //   finishProgress()                 -> snap to 100%, then hide + reset so
    //                                       the next download starts clean

    resetProgress() {
        if (this._hideTimer) { clearTimeout(this._hideTimer); this._hideTimer = null; }
        let outer = document.getElementById('progressOuter');
        let bar = document.getElementById('myProgress');
        if (outer) outer.style.display = '';
        if (bar) { bar.style.width = '0%'; bar.innerText = '0%'; }
    }

    updateProgress(pct) {
        let bar = document.getElementById('myProgress');
        if (!bar) return;
        pct = Math.max(0, Math.min(100, Math.round(pct)));
        bar.style.width = pct + '%';
        bar.innerText = pct + '%';
    }

    // Free-form label (e.g. "12.3 MB") for downloads with an unknown size.
    setProgressText(text) {
        let bar = document.getElementById('myProgress');
        if (!bar) return;
        bar.style.width = '100%';
        bar.innerText = text;
    }

    // Snap to 100%, then hide and reset the bar shortly after, so the next
    // download starts from a clean, hidden 0%.
    finishProgress() {
        this.updateProgress(100);
        if (this._hideTimer) clearTimeout(this._hideTimer);
        this._hideTimer = setTimeout(() => {
            let outer = document.getElementById('progressOuter');
            if (outer) outer.style.display = 'none';
            this.updateProgress(0);
            this._hideTimer = null;
        }, 400);
    }

    // ---- WAD / mod loader ----------------------------------------------------
    // Two sections drive the command line: a single "Base WAD" (-iwad) and an
    // ordered, reorderable "Mods" stack (-file, in list order). Both sections are
    // populated from optional JS manifests (wads.js / mods.js) AND accept
    // drag & drop / browse. A manifest entry is { name, path, selected } where
    // "selected" pre-loads it. A missing/empty manifest just hides that picker,
    // leaving drag & drop.

    async setupWadLoader() {
        // Autoload / kiosk mode: when settings.js sets GZDOOMSETTINGS.WADURL, skip
        // the whole picker UI and boot that WAD (+ optional MODURLS) as soon as the
        // runtime is ready (see initModule). Loading progress + status stay visible;
        // the loader interface is hidden. Nothing below runs in that mode.
        if (this.autoStart) return;

        var rando = Math.floor(Math.random() * 1000000);
        this.wadDefs = await this.loadJs('wads.js?v=' + rando, 'WADLIST');
        this.modDefs = await this.loadJs('mods.js?v=' + rando, 'MODLIST');

        // Custom hook: let settings.js adjust the manifests (e.g. preselect a mod
        // by this.lowMemory) right after they load, before the pickers/defaults
        // are built -- so the choice is reflected in the loader UI.
        try { this.modReplacementHook(); } catch (e) { console.error('modReplacementHook error:', e); }

        // Base WAD picker (only when wads.js defines entries).
        if (this.wadDefs.length) {
            let sel = document.getElementById('wadSelect');
            this.wadDefs.forEach((w, i) => sel.appendChild(new Option(w.name || w.path, String(i))));
            let selIdx = this.wadDefs.findIndex((w) => w.selected);
            if (selIdx >= 0) sel.value = String(selIdx);
            document.getElementById('btnSetWad').addEventListener('click', () => {
                let w = this.wadDefs[parseInt(sel.value, 10)];
                if (w) this.setBaseWad(this.makeDefItem(w));
            });
            document.getElementById('wadPicker').style.display = '';
        }

        // Mods picker (only when mods.js defines entries).
        if (this.modDefs.length) {
            let sel = document.getElementById('modSelect');
            this.modDefs.forEach((m, i) => sel.appendChild(new Option(m.name || m.path, String(i))));
            document.getElementById('btnAddMod').addEventListener('click', () => {
                let m = this.modDefs[parseInt(sel.value, 10)];
                if (m) this.addMod(this.makeDefItem(m));
            });
            document.getElementById('modPicker').style.display = '';
        }

        // Per-section drop zones + browse links.
        this.wireDropzone('baseDrop', (files) => this.acceptBaseFiles(files));
        this.wireDropzone('modsDrop', (files) => this.acceptModFiles(files));
        let baseInput = document.getElementById('baseFileInput');
        let modsInput = document.getElementById('modsFileInput');
        document.getElementById('baseBrowse').addEventListener('click', (e) => { e.preventDefault(); baseInput.click(); });
        document.getElementById('modsBrowse').addEventListener('click', (e) => { e.preventDefault(); modsInput.click(); });
        baseInput.addEventListener('change', (e) => this.acceptBaseFiles(e.currentTarget.files));
        modsInput.addEventListener('change', (e) => this.acceptModFiles(e.currentTarget.files));

        this.setupModListDnd();

        // Apply the manifest defaults ("selected").
        let defWad = this.wadDefs.find((w) => w.selected);
        if (defWad) this.setBaseWad(this.makeDefItem(defWad));
        this.modDefs.filter((m) => m.selected).forEach((m) => this.addMod(this.makeDefItem(m)));

        this.renderBaseList();
        this.renderModList();
    }

    // Autoload / kiosk mode. When settings.js sets GZDOOMSETTINGS.WADURL, the
    // WAD/mod picker is bypassed entirely: we pin that base WAD (plus any comma-
    // separated MODURLS, loaded with -file in list order) and let initModule()
    // boot the game the moment the runtime is ready. The Base WAD / Mods loader
    // interface and the Play button are hidden; the loading progress + status
    // stay on screen. URLs are relative to index.html (or absolute). Returns true
    // when autoload is active, false (a no-op) when WADURL is empty.
    setupAutoload() {
        let s = this.settings || {};
        let wadUrl = (s.WADURL || '').trim();
        if (!wadUrl) return false;

        this.autoStart = true;

        // Fixed base WAD + optional mods, straight from the configured URLs.
    this.setBaseWad(this.makeDefItem({
        name: s.WADNAME || 'doom2.wad',
        path: wadUrl
    }));
    
    (s.MODURLS || '').split(',')
        .map((u) => u.trim())
        .filter((u) => u.length)
        .forEach((u, i) => {
            this.addMod(this.makeDefItem({
                name: (s.MODNAMES && s.MODNAMES[i]) ||
                      `mod_${i + 1}.pk3`,
                path: u
            }));
        });

        // Hide the WAD/mod loader interface and the (now redundant) Play button;
        // autoload drives everything, so only loading + status remain visible.
        let grid = document.querySelector('.loader-grid');
        if (grid) grid.style.display = 'none';
        let play = document.getElementById('btnPlay');
        if (play) play.style.display = 'none';
        let settings = document.getElementById('btnSettings');
        if (settings) settings.style.display = 'none';

        return true;
    }

    // Fetch a JS manifest (wads.js / mods.js) and eval it. Each file declares a
    // top-level `var <varName> = [ ... ]`; we eval the fetched source and read
    // that variable's value back out (the trailing reference is the eval's
    // completion value). Missing/unreachable/invalid => [] (picker stays hidden).
    async loadJs(url, varName) {
        try {
            let res = await fetch(url, { cache: 'no-store' });
            if (!res.ok) return [];
            let code = await res.text();
            let data = eval(code + '\n;' + varName);
            return Array.isArray(data) ? data : [];
        } catch (e) {
            console.log('could not load ' + url + ':', e);
            return [];
        }
    }

    // Build an item from a manifest/dropdown entry (served path) or a local file.
    makeDefItem(def) {
        return { id: ++this._uid, label: def.name || def.path.split('/').pop(), path: def.path, tag: this.tagFor(def.path) };
    }
    makeFileItem(name, bytes) {
        return { id: ++this._uid, label: name, file: { name, bytes }, tag: this.tagFor(name, bytes) };
    }

    // Short label for the item (IWAD / PWAD / PK3 / WAD) from magic or extension.
    tagFor(name, bytes) {
        if (bytes && bytes.length >= 4) {
            let magic = String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3]);
            if (magic === 'IWAD') return 'IWAD';
            if (magic === 'PWAD') return 'PWAD';
        }
        let n = (name || '').toLowerCase();
        if (n.endsWith('.ipk3') || n.endsWith('.iwad')) return 'IWAD';
        if (n.endsWith('.pk3') || n.endsWith('.pk7') || n.endsWith('.zip')) return 'PK3';
        if (n.endsWith('.wad')) return 'WAD';
        return '';
    }

    // ---- drag & drop / file input --------------------------------------------

    wireDropzone(id, onFiles) {
        let zone = document.getElementById(id);
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach((ev) =>
            zone.addEventListener(ev, this.preventDefaults, false));
        ['dragenter', 'dragover'].forEach((ev) =>
            zone.addEventListener(ev, () => zone.classList.add('highlight'), false));
        ['dragleave', 'drop'].forEach((ev) =>
            zone.addEventListener(ev, () => zone.classList.remove('highlight'), false));
        zone.addEventListener('drop', (e) => onFiles(e.dataTransfer.files), false);
    }

    preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    // Base is a single slot: last file wins.
    async acceptBaseFiles(fileList) {
        let files = Array.from(fileList || []);
        if (!files.length) return;
        let rec = await this.readFile(files[0]);
        this.setBaseWad(this.makeFileItem(rec.name, rec.bytes));
    }

    // Mods stack: append each dropped file in selection order.
    async acceptModFiles(fileList) {
        for (let f of Array.from(fileList || [])) {
            let rec = await this.readFile(f);
            this.addMod(this.makeFileItem(rec.name, rec.bytes));
        }
    }

    readFile(file) {
        return new Promise((resolve, reject) => {
            let reader = new FileReader();
            reader.onload = () => resolve({ name: file.name, bytes: new Uint8Array(reader.result) });
            reader.onerror = () => reject(reader.error);
            reader.readAsArrayBuffer(file);
        });
    }

    // ---- loader state + rendering --------------------------------------------

    setBaseWad(item) { this.baseWad = item; this.renderBaseList(); }
    clearBase() { this.baseWad = null; this.renderBaseList(); }
    addMod(item) { this.mods.push(item); this.renderModList(); }
    removeMod(id) { this.mods = this.mods.filter((m) => m.id !== id); this.renderModList(); }

    renderBaseList() {
        let list = document.getElementById('baseList');
        list.innerHTML = '';
        if (!this.baseWad) { list.appendChild(this.placeholder('No base WAD selected')); return; }
        list.appendChild(this.makeListItemEl(this.baseWad, false));
    }

    renderModList() {
        let list = document.getElementById('modList');
        list.innerHTML = '';
        if (!this.mods.length) { list.appendChild(this.placeholder('No mods added')); return; }
        this.mods.forEach((m, i) => list.appendChild(this.makeListItemEl(m, true, i + 1)));
    }

    placeholder(text) {
        let ph = document.createElement('div');
        ph.className = 'placeholder';
        ph.textContent = text;
        return ph;
    }

    // Build a list row. reorderable mods get a drag handle + order badge and are
    // draggable; the base slot is a plain row. Both get a delete button.
    makeListItemEl(item, reorderable, order) {
        let el = document.createElement('div');
        el.className = 'list-item';
        el.dataset.id = String(item.id);

        if (reorderable) {
            el.draggable = true;
            let handle = document.createElement('span');
            handle.className = 'drag-handle';
            handle.textContent = '\u2630';
            handle.title = 'Drag to reorder';
            el.appendChild(handle);
            let badge = document.createElement('span');
            badge.className = 'order-badge';
            badge.textContent = String(order);
            el.appendChild(badge);
        }

        let name = document.createElement('span');
        name.className = 'item-name';
        name.textContent = item.label;
        name.title = item.file ? item.label + ' (local file)' : (item.path || item.label);
        el.appendChild(name);

        if (item.tag) {
            let tag = document.createElement('span');
            tag.className = 'item-tag';
            tag.textContent = item.tag;
            el.appendChild(tag);
        }

        let del = document.createElement('button');
        del.type = 'button';
        del.className = 'delete-btn';
        del.title = 'Remove';
        del.innerHTML = '&times;';
        del.addEventListener('click', () => reorderable ? this.removeMod(item.id) : this.clearBase());
        el.appendChild(del);

        if (reorderable) this.wireReorder(el);
        return el;
    }

    // ---- mod reordering (HTML5 drag & drop) ----------------------------------

    wireReorder(el) {
        el.addEventListener('dragstart', (e) => {
            el.classList.add('dragging');
            e.dataTransfer.effectAllowed = 'move';
            try { e.dataTransfer.setData('text/plain', el.dataset.id); } catch (_) { /* IE */ }
        });
        el.addEventListener('dragend', () => {
            el.classList.remove('dragging');
            this.syncModOrderFromDom();
        });
    }

    setupModListDnd() {
        let list = document.getElementById('modList');
        list.addEventListener('dragover', (e) => {
            e.preventDefault();
            let dragging = list.querySelector('.list-item.dragging');
            if (!dragging) return;
            let after = this.getDragAfterElement(list, e.clientY);
            if (after == null) list.appendChild(dragging);
            else list.insertBefore(dragging, after);
        });
    }

    getDragAfterElement(container, y) {
        let els = [...container.querySelectorAll('.list-item:not(.dragging)')];
        return els.reduce((closest, child) => {
            let box = child.getBoundingClientRect();
            let offset = y - box.top - box.height / 2;
            if (offset < 0 && offset > closest.offset) return { offset, element: child };
            return closest;
        }, { offset: Number.NEGATIVE_INFINITY, element: null }).element;
    }

    // Rebuild this.mods to match the DOM order after a drag, then re-render so the
    // order badges refresh.
    syncModOrderFromDom() {
        let ids = [...document.querySelectorAll('#modList .list-item')].map((el) => parseInt(el.dataset.id, 10));
        this.mods.sort((a, b) => ids.indexOf(a.id) - ids.indexOf(b.id));
        this.renderModList();
    }

    // ---- launching -----------------------------------------------------------

    // Write bytes into MEMFS using a stream with canOwn=true (last arg). This
    // lets MEMFS take ownership of the SAME Uint8Array instead of copying it, so
    // a large WAD/PK3 isn't held twice in memory (matches the SwanStation front-
    // end). The array must not be reused afterwards.
    writeFileOwn(path, bytes) {
        let stream = FS.open(path, 'w');
        FS.write(stream, bytes, 0, bytes.length, 0, true);
        FS.close(stream);
    }

    // Fetch a file from the web server and write it into MEMFS (like Bsnes'
    // loadFile). Used to pull the selected IWAD, the add-on pk3, or anything
    // else in at play-time instead of baking it into the .data file.
    //
    // Memory: when the size is known (Content-Length), the body is streamed
    // straight into ONE pre-allocated buffer, so peak JS-heap stays ~1x the
    // file size while still driving #myProgress. We deliberately AVOID the
    // "collect chunks in an array, then concatenate" pattern: that holds the
    // whole file twice (the chunk list + the joined copy) at its peak, and that
    // 2x spike is what tips a memory-constrained browser (e.g. the Xbox Edge
    // browser) into OOM on a large pk3 like Brutal Doom. writeFileOwn then hands
    // this exact buffer to MEMFS with canOwn=true (zero-copy), so the resident
    // cost stays ~1x too.
    async loadFile(url, dest) {
        let response = await fetch(url);
        
        const contentLength = response.headers.get('Content-Length');
        const reader = response.body.getReader();
        let downloaded = 0;
        const totalSize = contentLength ? parseInt(contentLength, 10) : undefined;
        let pointer = 0;

        var byteArray = new Uint8Array(contentLength);

        let finished = false;
        this.resetProgress();
        while(!finished)
        {
            let response = await reader.read();

            let done = response.done;
            let value = response.value;

            if (done) 
            {
                finished = true;
            }
            else
            {
                downloaded += value.length;
    
                let loaded = downloaded;
                let total = totalSize;
                let percent = (loaded / total)*100;
                this.updateProgress(percent);
        
                loaded = Math.ceil(loaded / 1000000);
                total = Math.ceil(total / 1000000);
        
                let formatted = loaded + 'MB / ' + total + 'MB';

                if (performance.memory) {
                    const memory = performance.memory;

                    let stats = 
                    'Loading...' +
                    '<br>usedJSHeapSize: ' + this.formatNumberWithCommas(memory.usedJSHeapSize) +
                    '<br>totalJSHeapSize: ' + this.formatNumberWithCommas(memory.totalJSHeapSize) +
                    '<br>jsHeapSizeLimit: ' + this.formatNumberWithCommas(memory.jsHeapSizeLimit);

                    document.getElementById('status').innerHTML = stats;

                  } else {
                    console.log('performance.memory is not supported in this browser.');
                  }
        
                let tempPointer = 0;
                for(let i = pointer; i < pointer + value.length; i++)
                {
                    byteArray[i] = value[tempPointer];
                    tempPointer++;
                }
        
                pointer += value.length;
        
            }
            
        }

        this.finishProgress();

        this.writeFileOwn(dest, byteArray);
        console.log('wrote ' + dest + ' (' + byteArray.length + ' bytes)');
        return byteArray.length;
    }

    formatNumberWithCommas(number) {
        return number.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    }

    // Stage the game data into MEMFS and return the GZDoom command line:
    //   -iwad <base>  -file <mod1> <mod2> ...   (mods in list order)
    // Each item is either a served path (fetched with loadFile) or a local file
    // (dropped/browsed, written straight into MEMFS).
    async prepareArgs() {
        if (!this.baseWad) {
            throw new Error('Choose a base WAD first');
        }

        let args = ['-iwad', await this.stageItem(this.baseWad)];

        let fileArgs = [];
        for (let m of this.mods) fileArgs.push(await this.stageItem(m));
        if (fileArgs.length) args.push('-file', ...fileArgs);

        // Boot windowed (not GZDoom's default fullscreen). On the web, GZDoom's
        // fullscreen is emscripten "soft fullscreen" (canvas -> position:fixed,
        // filling the viewport), which overrides the CSS box, defeats the zoom
        // controls, and tangles with real browser fullscreen (the tiny/blank
        // canvas bug). Windowed mode lets the #canvasDiv CSS box drive the size,
        // and the Full Screen button uses real browser fullscreen instead.
        args = args.concat(['+vid_fullscreen', '0']);

        // dev convenience: ?args=+map MAP07  -> appended to the command line
        let extra = new URLSearchParams(location.search).get('args');
        if (extra) args = args.concat(extra.trim().split(/\s+/));
        return args;
    }

    // Ensure an item's data is present in MEMFS; return its MEMFS path.
    async stageItem(item) {
        if (item.file) {
            let dest = '/' + item.file.name;
            this.writeFileOwn(dest, item.file.bytes);
            return dest;
        }
    
        let name = item.label || item.path.split('/').pop();
        let dest = '/' + name;
    
        this.setStatus('Loading ' + name + '\u2026');
        await this.loadFile(item.path, dest);
    
        return dest;
    }

    // Overridable hook: adjust the mod/WAD selection. Called from setupWadLoader
    // right after mods.js loads (before the pickers, manifest defaults and the
    // first render), with `this` bound to the app -- so tweaks to this.modDefs /
    // this.wadDefs (e.g. flipping a `selected` flag by this.lowMemory) show up
    // preselected in the loader UI. Default: no-op; override it in settings.js.
    modReplacementHook() {
    }

    async playGame() {
        if (this.started) return;
        this.started = true;
        document.getElementById('btnPlay').disabled = true;

        let args;
        try {
            args = await this.prepareArgs();
        } catch (e) {
            console.error(e);
            this.setStatus('Error: ' + e.message);
            this.started = false;
            document.getElementById('btnPlay').disabled = false;
            return;
        }

        console.log('GZDoom callMain:', args);
        document.getElementById('beforePanel').style.display = 'none';
        if (this.autoStart)
        {
            document.getElementById('appTitle').style.display = 'none';
        }
        else
        {
            document.getElementById('playPanel').style.display = '';
        }
        document.getElementById('canvasDiv').style.display = '';
        this.applyCanvasSize();   // size the box before the wasm creates its SDL window
        this.setStatus('');

        // Seed the engine config into MEMFS right before we hand control to the
        // engine, so it boots with our settings instead of the built-in defaults.
        await this.writeConfigFile();
        this.writeConfigTxt();

        this.args = args;
        Module.callMain(args);
        this.canvas.focus();
        this.syncEngineSize();    // the SDL window exists now; make it adopt our size
        this.mainCalled = true;
    }

    // Seed GZDoom's config file before it boots. The Emscripten MEMFS starts
    // empty on every page load, so unless we write one, the engine generates a
    // fresh gzdoom.ini from built-in defaults (see emscripten.md: "the web config
    // doesn't persist across reloads"). We prefer the player's persisted config
    // from IndexedDB (written by onConfigWritten() whenever the engine saves the
    // ini in-game), and fall back to the gzdoom.ini served next to the page. The
    // chosen bytes are dropped where the Unix build reads them --
    // $HOME/.config/gzdoom/gzdoom.ini, with $HOME being Emscripten's default
    // /home/web_user (M_GetConfigPath -> GetUserFile -> NicePath("$HOME/...")) --
    // just before Module.callMain(), so the game starts with these settings.
    // Best-effort: on any failure we log and let the engine fall back to defaults.
    async writeConfigFile() {
        const path = this.CONFIG_PATH;
        const dir = path.slice(0, path.lastIndexOf('/'));
        try {
            var rando = Math.floor(Math.random() * 1000000);
            // Prefer the player's persisted config; fall back to the served one.
            let bytes = await this.loadConfigFromDB();
            let source = 'IndexedDB';
            if (!bytes || bytes.length === 0) {
                let res = await fetch('gzdoom.ini?rando=' + rando, { cache: 'no-store' });
                if (!res.ok) {
                    console.log('no gzdoom.ini to preload (HTTP ' + res.status + ')');
                    return;
                }
                bytes = new Uint8Array(await res.arrayBuffer());
                source = 'server';
            }
            this.mkdirTree(dir);
            // Let settings.js rewrite the ini text before the engine reads it
            // (e.g. Low Memory Mode key rebinds) via the gzDoomIniHook override.
            let text = new TextDecoder().decode(bytes);
            try { text = this.gzDoomIniHook(text); } catch (e) { console.error('gzDoomIniHook error:', e); }
            FS.writeFile(path, text);
            console.log('seeded config from ' + source + ': ' + path +
                ' (' + text.length + ' bytes)');
        } catch (e) {
            console.log('config preload skipped:', e);
        }
    }

    // Overridable hook: rewrite the gzdoom.ini text before it is seeded into
    // MEMFS (from writeConfigFile), with `this` bound to the app. Return the
    // (possibly modified) text. Default: identity; override it in settings.js.
    gzDoomIniHook(text) {
        return text;
    }

    // ---- settings store ---------------------------------------------------
    // Generic localStorage-backed settings, adapted from the DosBox-X front-end
    // (minus its rivets data-binding). Each setting is a plain property on `this`
    // mapped to a localStorage key; booleans round-trip as "true"/"false" and
    // everything else as a string. Options are also written to /config.txt
    // (writeConfigTxt) which the engine reads at startup (D_ReadStartupConfig in
    // d_main.cpp) -- the "front-end writes a config file the C++ reads on boot"
    // pattern, so a browser-only toggle can reach native code that runs before
    // any CVAR/ini is loaded. Add a new setting by giving it a default in the
    // constructor and a line in retrieveSettings()/saveOptions().

    readFromLocalStorage(localStorageName, name) {
        let v = null;
        try { v = localStorage.getItem(localStorageName); } catch (e) { return; }
        if (v === null) return;                     // absent -> keep the code default
        if (v === 'true') this[name] = true;
        else if (v === 'false') this[name] = false;
        else this[name] = v;
    }

    writeToLocalStorage(localStorageName, name) {
        try {
            let val = this[name];
            if (typeof val === 'boolean') localStorage.setItem(localStorageName, val ? 'true' : 'false');
            else localStorage.setItem(localStorageName, val);
        } catch (e) { /* localStorage may be unavailable */ }
    }

    // Load persisted settings at startup. Add a line here per new setting.
    retrieveSettings() {
        this.readFromLocalStorage(LOW_MEMORY_STORAGE_KEY, 'lowMemory');
    }

    // Persist settings (called from the Settings dialog). Add a line per setting.
    saveOptions() {
        this.writeToLocalStorage(LOW_MEMORY_STORAGE_KEY, 'lowMemory');
    }

    // Write config.txt for the engine to read at boot. One integer per line;
    // line 0 is Low Memory Mode (1/0). progdir is "/" on the web build, so the
    // engine reads this back from /config.txt. Best-effort.
    writeConfigTxt() {
        try {
            let low = this.lowMemory ? '1' : '0';
            let configString = '';
            configString += low + '\r\n';   // line 0: Low Memory Mode
            FS.writeFile('/config.txt', configString);
            console.log('wrote /config.txt (low memory mode=' + low + ')');
        } catch (e) {
            console.log('config.txt write skipped:', e);
        }
    }

    // Settings dialog. Built with the same lightweight overlay as askPassword so
    // it needs no bootstrap JS. Currently a single option: Low Memory Mode.
    openSettings() {
        let overlay = document.createElement('div');
        overlay.className = 'pw-overlay';

        let modal = document.createElement('div');
        modal.className = 'pw-modal';
        modal.style.width = '360px';

        let title = document.createElement('div');
        title.className = 'pw-label';
        title.style.fontSize = '16px';
        title.textContent = 'Settings';

        let row = document.createElement('label');
        row.style.display = 'flex';
        row.style.alignItems = 'flex-start';
        row.style.gap = '10px';
        row.style.cursor = 'pointer';

        let cb = document.createElement('input');
        cb.type = 'checkbox';
        cb.checked = this.lowMemory;
        cb.style.marginTop = '3px';

        let textWrap = document.createElement('div');
        let name = document.createElement('div');
        name.textContent = 'Low Memory Mode';
        name.style.fontWeight = '600';
        let desc = document.createElement('div');
        desc.style.fontSize = '12px';
        desc.style.color = '#9a9a9a';
        desc.textContent = 'Shrinks the renderer\u2019s vertex buffers to roughly halve '
            + 'memory use. Helps on low-RAM devices and browsers.';
        textWrap.appendChild(name);
        textWrap.appendChild(desc);
        row.appendChild(cb);
        row.appendChild(textWrap);

        let buttons = document.createElement('div');
        buttons.className = 'pw-buttons';
        buttons.style.marginTop = '18px';
        let cancel = document.createElement('button');
        cancel.type = 'button';
        cancel.className = 'btn btn-secondary btn-sm';
        cancel.textContent = 'Cancel';
        let save = document.createElement('button');
        save.type = 'button';
        save.className = 'btn btn-info btn-sm';
        save.textContent = 'Save';
        buttons.appendChild(cancel);
        buttons.appendChild(save);

        modal.appendChild(title);
        modal.appendChild(row);
        modal.appendChild(buttons);
        overlay.appendChild(modal);

        let close = () => { if (overlay.parentNode) document.body.removeChild(overlay); };
        cancel.addEventListener('click', close);
        save.addEventListener('click', () => {
            this.lowMemory = cb.checked;
            this.saveOptions();
            // If the engine is already running the change only takes effect on the
            // next launch; otherwise writeConfigTxt() runs when Play is pressed.
            if (this.started) this.writeConfigTxt();
            this.toast(cb.checked ? 'Low Memory Mode on (applies on next launch)'
                : 'Low Memory Mode off (applies on next launch)', 'success');
            close();
        });
        overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(); });

        document.body.appendChild(overlay);
    }

    // Create a directory and any missing parents in MEMFS. (FS.mkdirTree isn't
    // guaranteed to be exported on Module.FS, so build the path by hand and
    // ignore "already exists" errors on each segment.)
    mkdirTree(dir) {
        let cur = '';
        for (let part of dir.split('/')) {
            if (!part) continue;
            cur += '/' + part;
            try { FS.mkdir(cur); } catch (e) { /* EEXIST is fine */ }
        }
    }

    fullscreen() {
        let el = document.getElementById('canvasDiv');
        if (el.requestFullscreen) el.requestFullscreen();
        else if (el.webkitRequestFullScreen) el.webkitRequestFullScreen();
        else if (el.mozRequestFullScreen) el.mozRequestFullScreen();
        this.canvas.focus();
    }

    // Toggle real browser full screen. Called by the engine's SDL gamepad
    // handler (via EM_ASM) when the right thumbstick button (R3) is clicked, so
    // the controller can enter/exit full screen like the on-page button.
    // requestFullscreen() needs a user activation; Chromium grants one from the
    // gamepad button press, and the C++ side calls this in that same frame.
    toggleFullscreen() {
        if (this.isFullscreen()) {
            if (document.exitFullscreen) document.exitFullscreen();
            else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
            else if (document.mozCancelFullScreen) document.mozCancelFullScreen();
            this.canvas.focus();
        } else {
            this.fullscreen();
        }
    }

    // ---- canvas zoom / sizing ------------------------------------------------

    isFullscreen() {
        return !!(document.fullscreenElement || document.webkitFullscreenElement ||
                  document.mozFullScreenElement);
    }

    loadZoom() {
        let w = ZOOM_DEFAULT_WIDTH;
        try {
            let saved = parseInt(localStorage.getItem(ZOOM_STORAGE_KEY), 10);
            if (saved > 0) w = saved;
        } catch (e) { /* localStorage may be unavailable */ }
        this.setZoomWidth(w, false);
    }

    setZoomWidth(width, persist = true) {
        width = Math.round(width / ZOOM_STEP) * ZOOM_STEP;
        width = Math.max(ZOOM_MIN_WIDTH, Math.min(ZOOM_MAX_WIDTH, width));
        this.canvasWidth = width;
        this.canvasHeight = Math.round(width * ZOOM_ASPECT_H / ZOOM_ASPECT_W);
        if (persist) {
            try { localStorage.setItem(ZOOM_STORAGE_KEY, String(width)); } catch (e) { /* ignore */ }
        }
        this.applyCanvasSize();
    }

    zoomIn() {
        if (this.isFullscreen()) return;   // size is locked to the screen while fullscreen
        this.setZoomWidth(this.canvasWidth + ZOOM_STEP);
        this.canvas.focus();
    }

    zoomOut() {
        if (this.isFullscreen()) return;
        this.setZoomWidth(this.canvasWidth - ZOOM_STEP);
        this.canvas.focus();
    }

    // Apply the current zoom size to the #canvasDiv box (CSS drives the display),
    // refresh the label, and nudge the engine to match.
    applyCanvasSize() {
        let div = document.getElementById('canvasDiv');
        if (!div) return;

        if (this.autoStart) {
            if (!this.isFullscreen()) {
                let rect = div.getBoundingClientRect();
                // Distance from the top of the document to the box. Everything
                // above the box has a fixed height, so this is stable regardless
                // of the box's own height or the current scroll position.
                let top = rect.top + (window.scrollY || 0);

                let parent = div.parentElement;
                let availW = window.innerWidth;
                if (parent) {
                    let pcs = getComputedStyle(parent);
                    availW = parent.clientWidth -
                        parseFloat(pcs.paddingLeft || 0) - parseFloat(pcs.paddingRight || 0);
                }
                let availH = window.innerHeight - top - 50;
                if (!(availH > 0)) availH = window.innerHeight;   // safety net

                div.style.maxWidth = 'none';
                div.style.aspectRatio = 'auto';   // our explicit height wins
                div.style.width = Math.floor(availW) + 'px';
                div.style.height = Math.floor(availH) + 'px';
            }
            this.syncEngineSize();
            return;
        }

        // Windowed (picker) mode: the CSS aspect-ratio derives the height, so we
        // only set the inline windowed width -- and only when we're not
        // fullscreen, where the :fullscreen CSS rule owns the box size.
        if (!this.isFullscreen()) {
            div.style.width = this.canvasWidth + 'px';
            // height is derived from the CSS aspect-ratio, so it isn't set here
        }
        this.syncEngineSize();
    }

    // Dispatch window 'resize' events so SDL's emscripten backend re-reads the
    // canvas CSS size and resizes the GL drawable + engine framebuffer to match.
    // Fired a few times to win the race with SDL's own fullscreenchange handler.
    syncEngineSize() {
        if (!this.started) return;
        let fire = () => { try { window.dispatchEvent(new Event('resize')); } catch (e) { /* ignore */ } };
        fire();
        requestAnimationFrame(fire);
        setTimeout(fire, 80);
    }

    // On exit, re-assert the windowed (zoom) size — this is the fix for the
    // "tiny / blank canvas after fullscreen" bug. On enter, the :fullscreen CSS
    // sizes the box; we just resync the engine.
    onFullscreenChange() {
        this.applyCanvasSize();
        this.canvas.focus();
    }

    // ======================================================================
    // Save-state backup (local IndexedDB + optional cloud)
    // ----------------------------------------------------------------------
    // does the heavy lifting:
    //   Module._neil_serialize()   -> zip /Save -> /savestate.gz, then calls
    //                                 back myApp.SaveStateEvent(success)
    //   Module._neil_unserialize() -> read /savestate.gz, wipe /Save, extract
    // We only move the /savestate.gz blob between MEMFS and storage (IndexedDB
    // when logged out, the cloud server when logged in).
    // ======================================================================

    setupSaveSystem() {
        // Storage identifiers.
        this.DB_NAME = 'GZDOOMDB';
        this.DB_STORE = 'GZDOOMSTATES';
        this.SAVE_KEY = 'gzdoom-savestate';   // IndexedDB key (save games)
        this.CONFIG_KEY = 'gzdoom-config';    // IndexedDB key (gzdoom.ini)
        this.CLOUD_NAME = 'gzdoom.savestate'; // server-side name
        this.ARCHIVE_PATH = '/savestate.gz';  // MEMFS path shared with C++
        // MEMFS path the engine reads/writes its config at (Unix layout;
        // $HOME = Emscripten's /home/web_user). See M_GetConfigPath / GetUserFile.
        this.CONFIG_PATH = '/home/web_user/.config/gzdoom/gzdoom.ini';

        // Cloud config. Drop a settings.js that sets window.GZDOOMSETTINGS =
        // { CLOUDSAVEURL: 'https://…' } to enable cloud saves; empty => local
        // (IndexedDB) only, which works with no server.
        this.settings = window['GZDOOMSETTINGS'] || { CLOUDSAVEURL: '' };
        this.cloudEnabled = !!(this.settings && this.settings.CLOUDSAVEURL);
        this.loggedIn = false;
        this.password = '';
        this.autoLoaded = false;   // guard so we only auto-restore once

        // Cloud login/logout buttons (present but hidden until relevant). The
        // Save/Load State backup is fully automated now (auto-restore on boot,
        // auto-backup on in-game saves), so there are no manual backup buttons;
        // saveState()/loadState() are still driven by that automation.
        let btnLogin = document.getElementById('btnCloudLogin');
        let btnLogout = document.getElementById('btnCloudLogout');
        if (btnLogin) btnLogin.addEventListener('click', () => this.promptLogin());
        if (btnLogout) btnLogout.addEventListener('click', () => this.logout());

        this.createDB();

        // Optional silent cloud login using a remembered password.
        if (this.cloudEnabled) {
            try { this.password = localStorage.getItem('gzdoom-password') || ''; } catch (e) { this.password = ''; }
            if (this.password) this.loginSilent();
        }
        this.updateCloudButtons();
    }

    // small status line under the play controls (no toastr in this repo)
    toast(msg, kind) {
        console.log('[save] ' + msg);
        let el = document.getElementById('saveStatus');
        if (!el) return;
        el.textContent = msg;
        el.style.color = kind === 'error' ? '#ff6b6b'
            : kind === 'success' ? '#51cf66'
            : '#adb5bd';
        // Auto-clear after a couple of seconds so the status line doesn't linger.
        if (this._toastTimer) clearTimeout(this._toastTimer);
        this._toastTimer = setTimeout(() => {
            this._toastTimer = null;
            if (el.textContent === msg) el.textContent = '';
        }, 2000);
    }

    // ---- IndexedDB (local) ------------------------------------------------

    createDB() {
        if (typeof indexedDB === 'undefined' || indexedDB == null) {
            console.log('indexedDB not available');
            return;
        }
        let request = indexedDB.open(this.DB_NAME);
        request.onupgradeneeded = (ev) => {
            let db = ev.target.result;
            if (!db.objectStoreNames.contains(this.DB_STORE)) {
                db.createObjectStore(this.DB_STORE);
            }
        };
        request.onerror = () => console.log('error opening ' + this.DB_NAME);
    }

    saveToDatabase(bytes) {
        if (typeof indexedDB === 'undefined' || indexedDB == null) {
            this.toast('Local storage unavailable', 'error');
            return;
        }
        let request = indexedDB.open(this.DB_NAME);
        request.onsuccess = (ev) => {
            let db = ev.target.result;
            let store = db.transaction(this.DB_STORE, 'readwrite').objectStore(this.DB_STORE);
            let put = store.put(bytes, this.SAVE_KEY);
            put.onsuccess = () => this.toast('State saved locally (' + this.formatBytes(bytes.length) + ')', 'success');
            put.onerror = (e) => { console.log(e); this.toast('Error saving locally', 'error'); };
        };
        request.onerror = () => this.toast('Error opening local storage', 'error');
    }

    // Reads the blob from IndexedDB, writes it to MEMFS and asks C++ to extract.
    loadFromDatabase() {
        if (typeof indexedDB === 'undefined' || indexedDB == null) {
            this.toast('Local storage unavailable', 'error');
            return;
        }
        let request = indexedDB.open(this.DB_NAME);
        request.onsuccess = (ev) => {
            let db = ev.target.result;
            let store = db.transaction(this.DB_STORE, 'readwrite').objectStore(this.DB_STORE);
            let get = store.get(this.SAVE_KEY);
            get.onsuccess = () => {
                let bytes = get.result; // Uint8Array | undefined
                if (!bytes) {
                    this.toast('No local backup found', 'info');
                    return;
                }
                this.writeArchiveAndExtract(bytes);
            };
            get.onerror = () => this.toast('Error reading local backup', 'error');
        };
        request.onerror = () => this.toast('Error opening local storage', 'error');
    }

    // ---- config persistence (local) ---------------------------------------
    // The engine's gzdoom.ini lives in MEMFS, which is wiped on reload. When the
    // engine writes it in-game (Options -> "Save config" / the writeini CCMD),
    // C++ (M_SaveDefaults) calls onConfigWritten(); we copy the ini out of MEMFS
    // into IndexedDB so it survives a reload. writeConfigFile() reads it back on
    // the next boot.

    // Called from C++ (M_SaveDefaults) after the engine writes gzdoom.ini.
    onConfigWritten() {
        if (!this.started) return;
        let bytes;
        try {
            bytes = FS.readFile(this.CONFIG_PATH); // Uint8Array
        } catch (e) {
            console.log('config read error', e);
            return;
        }
        this.saveConfigToDatabase(bytes);
    }

    saveConfigToDatabase(bytes) {
        if (typeof indexedDB === 'undefined' || indexedDB == null) return;
        let request = indexedDB.open(this.DB_NAME);
        request.onsuccess = (ev) => {
            let db = ev.target.result;
            let store = db.transaction(this.DB_STORE, 'readwrite').objectStore(this.DB_STORE);
            let put = store.put(bytes, this.CONFIG_KEY);
            put.onsuccess = () => this.toast('Settings saved locally (' + this.formatBytes(bytes.length) + ')', 'success');
            put.onerror = (e) => { console.log(e); this.toast('Error saving settings', 'error'); };
        };
        request.onerror = () => this.toast('Error opening local storage', 'error');
    }

    // Returns a Promise<Uint8Array|null> with the persisted config (if any).
    loadConfigFromDB() {
        return new Promise((resolve) => {
            if (typeof indexedDB === 'undefined' || indexedDB == null) { resolve(null); return; }
            let request = indexedDB.open(this.DB_NAME);
            request.onsuccess = (ev) => {
                let db = ev.target.result;
                let store;
                try {
                    store = db.transaction(this.DB_STORE, 'readonly').objectStore(this.DB_STORE);
                } catch (e) { resolve(null); return; }
                let get = store.get(this.CONFIG_KEY);
                get.onsuccess = () => resolve(get.result || null);
                get.onerror = () => resolve(null);
            };
            request.onerror = () => resolve(null);
        });
    }

    // ---- cloud (server) ---------------------------------------------------

    async loginToServer() {
        try {
            let res = await fetch(this.settings.CLOUDSAVEURL + '/Login?password=' +
                encodeURIComponent(this.password));
            let text = (await res.text()).replace(/"/g, '').trim();
            return text;
        } catch (e) {
            console.log('login error', e);
            return '';
        }
    }

    async loginSilent() {
        if (!this.cloudEnabled) return;
        let result = await this.loginToServer();
        if (result === 'Success') {
            this.loggedIn = true;
            this.toast('Cloud connected', 'success');
        } else {
            this.loggedIn = false;
        }
        this.updateCloudButtons();
    }

    // Masked password prompt (window.prompt shows the text in the clear).
    // Returns a Promise<string|null> — null when the user cancels.
    askPassword(label) {
        return new Promise((resolve) => {
            let overlay = document.createElement('div');
            overlay.className = 'pw-overlay';

            let modal = document.createElement('div');
            modal.className = 'pw-modal';

            let lbl = document.createElement('div');
            lbl.className = 'pw-label';
            lbl.textContent = label || 'Password:';

            let input = document.createElement('input');
            input.type = 'password';
            input.className = 'pw-input form-control';
            input.autocomplete = 'current-password';

            let buttons = document.createElement('div');
            buttons.className = 'pw-buttons';
            let cancel = document.createElement('button');
            cancel.type = 'button';
            cancel.className = 'btn btn-secondary btn-sm';
            cancel.textContent = 'Cancel';
            let ok = document.createElement('button');
            ok.type = 'button';
            ok.className = 'btn btn-info btn-sm';
            ok.textContent = 'Log In';
            buttons.appendChild(cancel);
            buttons.appendChild(ok);

            modal.appendChild(lbl);
            modal.appendChild(input);
            modal.appendChild(buttons);
            overlay.appendChild(modal);

            let close = (val) => {
                if (overlay.parentNode) document.body.removeChild(overlay);
                resolve(val);
            };
            ok.addEventListener('click', () => close(input.value));
            cancel.addEventListener('click', () => close(null));
            input.addEventListener('keydown', (e) => {
                if (e.key === 'Enter') { e.preventDefault(); close(input.value); }
                else if (e.key === 'Escape') { e.preventDefault(); close(null); }
            });
            // Click outside the modal cancels.
            overlay.addEventListener('mousedown', (e) => { if (e.target === overlay) close(null); });

            document.body.appendChild(overlay);
            input.focus();
        });
    }

    async promptLogin() {
        let pw = await this.askPassword('Cloud password:');
        if (pw == null) return;
        this.password = pw;
        let result = await this.loginToServer();
        if (result === 'Success') {
            this.loggedIn = true;
            try { localStorage.setItem('gzdoom-password', this.password); } catch (e) { /* ignore */ }
            this.toast('Logged in to cloud', 'success');
        } else {
            this.loggedIn = false;
            this.password = '';
            try { localStorage.setItem('gzdoom-password', ''); } catch (e) { /* ignore */ }
            this.toast('Login failed', 'error');
        }
        this.updateCloudButtons();
    }

    logout() {
        this.loggedIn = false;
        this.password = '';
        try { localStorage.setItem('gzdoom-password', ''); } catch (e) { /* ignore */ }
        this.toast('Logged out (using local storage)', 'info');
        this.updateCloudButtons();
    }

    updateCloudButtons() {
        let btnLogin = document.getElementById('btnCloudLogin');
        let btnLogout = document.getElementById('btnCloudLogout');
        if (btnLogin) btnLogin.style.display = (this.cloudEnabled && !this.loggedIn) ? '' : 'none';
        if (btnLogout) btnLogout.style.display = (this.cloudEnabled && this.loggedIn) ? '' : 'none';
    }

    async saveToServer(bytes) {
        try {
            let res = await fetch(this.settings.CLOUDSAVEURL + '/SendStaveState?name=' +
                encodeURIComponent(this.CLOUD_NAME) + '&password=' +
                encodeURIComponent(this.password) + '&emulator=gzdoom', {
                method: 'POST',
                body: bytes,
            });
            let text = (await res.text()).replace(/"/g, '').trim();
            if (text === 'Success') {
                this.toast('State saved to cloud (' + this.formatBytes(bytes.length) + ')', 'success');
            } else {
                this.toast('Cloud save failed, saving locally', 'error');
                this.saveToDatabase(bytes);
            }
        } catch (e) {
            console.log('cloud save error', e);
            this.toast('Cloud save error, saving locally', 'error');
            this.saveToDatabase(bytes);
        }
    }

    async loadFromServer() {
        try {
            let res = await fetch(this.settings.CLOUDSAVEURL + '/LoadStaveState?name=' +
                encodeURIComponent(this.CLOUD_NAME) + '&password=' +
                encodeURIComponent(this.password));
            if (!res.ok) {
                this.toast('No cloud backup found', 'info');
                return;
            }
            let buf = await res.arrayBuffer();
            if (!buf || buf.byteLength === 0 || buf.byteLength === 1) {
                this.toast('No cloud backup found', 'info');
                return;
            }
            this.writeArchiveAndExtract(new Uint8Array(buf));
        } catch (e) {
            console.log('cloud load error', e);
            this.toast('Cloud load error', 'error');
        }
    }

    // ---- shared plumbing --------------------------------------------------

    // Write the archive into MEMFS and ask the engine to extract it into /Save.
    writeArchiveAndExtract(bytes) {
        try {
            FS.writeFile(this.ARCHIVE_PATH, bytes);
        } catch (e) {
            console.log('FS write error', e);
            this.toast('Error writing archive', 'error');
            return;
        }
        if (Module && typeof Module._neil_unserialize === 'function') {
            Module._neil_unserialize();
        } else {
            this.toast('Engine not ready', 'error');
        }
    }

    // "Save State" button -> ask the engine to zip /Save. When it's done it
    // calls back into SaveStateEvent().
    saveState() {
        if (!this.started) { this.toast('Start a game first', 'info'); return; }
        if (Module && typeof Module._neil_serialize === 'function') {
            this.toast('Saving…', 'info');
            Module._neil_serialize();
        } else {
            this.toast('Engine not ready', 'error');
        }
    }

    // Called from C++ once /savestate.gz has been written. Route the blob to the
    // cloud (if logged in) or IndexedDB (otherwise).
    SaveStateEvent(success) {
        if (!success) { this.toast('Nothing to save / zip failed', 'error'); return; }
        let bytes;
        try {
            bytes = FS.readFile(this.ARCHIVE_PATH); // Uint8Array
        } catch (e) {
            console.log('read archive error', e);
            this.toast('Error reading archive', 'error');
            return;
        }
        if (this.loggedIn) {
            this.saveToServer(bytes);
        } else {
            this.saveToDatabase(bytes);
        }
    }

    // "Load State" button (and auto-restore on boot). Pull the blob from the
    // cloud (if logged in) or IndexedDB, then hand it to the engine.
    loadState() {
        if (this.loggedIn) {
            this.loadFromServer();
        } else {
            this.loadFromDatabase();
        }
    }

    // Called from C++ after neil_unserialize() finishes extracting.
    LoadStateEvent(success) {
        if (success) this.toast('Save games restored', 'success');
    }

    // Called from C++ (D_DoomLoop) once the engine has fully booted: auto-restore
    // the backed-up saves so they're present before the load menu is opened.
    onGameReady() {
        if (this.autoLoaded) return;
        this.autoLoaded = true;
        this.toast('Restoring saved games…', 'info');
        this.loadState();
    }

    // Called from C++ (i_savestate_web.cpp) when a save-backup should run --
    // immediately for a logged-in menu save, or after the logged-out coalescing
    // countdown settles. The engine already applied the policy and any
    // coalescing, so here we just kick off the same backup flow as the "Save
    // State" button -- the player never has to press it.
    onGameSaved() {
        // Don't race the boot-time auto-restore: if we haven't pulled the
        // existing backup into /Save yet, uploading now could clobber the cloud
        // copy with a half-populated tree.
        if (!this.autoLoaded) return;
        if (!this.started) return;

        // saveState() -> Module._neil_serialize() -> SaveStateEvent() ->
        // cloud (if logged in) or IndexedDB.
        this.saveState();
    }

    formatBytes(n) {
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / (1024 * 1024)).toFixed(1) + ' MB';
    }
}

let myApp = new MyClass();
window['myApp'] = myApp;

// Let settings.js attach custom hooks (myApp.modReplacementHook /
// myApp.gzDoomIniHook) now that the app instance exists. settings.js is loaded
// before script.js (see index.html), so window.postLoad already exists here.
if (typeof window.postLoad === 'function') window.postLoad();

// Only now -- with the hooks wired -- start loading the WAD/mod manifests and
// building the loader UI. Doing this after postLoad() (rather than in the
// constructor) makes the ordering explicit: modReplacementHook is always set
// before setupWadLoader reads mods.js and calls it. No fetch-timing race.
myApp.setupWadLoader();

window['Module'] = {
    noInitialRun: true,
    canvas: document.getElementById('canvas'),
    print: (text) => myApp.print(text),
    printErr: (text) => myApp.print(text),
    onRuntimeInitialized: () => myApp.initModule(),
    setStatus: (text) => { if (text) myApp.setStatus(text); },
};

// load the emscripten-generated glue last (it reads window.Module)
let gzScript = document.createElement('script');
gzScript.src = 'gzdoom.js';
document.head.appendChild(gzScript);
