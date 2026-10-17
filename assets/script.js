/* =====================================================================
   Tools & redPDF Tools - Main Application Logic
   Handles Photo Studio (crop/adjust/text/print), Image Converter,
   and redPDF Tools (image<->pdf, merge, split, compress).
   No functional changes were made here — this is the same logic that
   previously lived inline inside index.html, only moved to its own file.
   ===================================================================== */

/* =================================================================== */
/* GLOBAL APPLICATION STATE */
/* =================================================================== */
let state = {
    mainView: 'home',
    activePdfTool: 'image-to-pdf',
    currentImageSrc: null,
    originalImageSrc: null,
    cropper: null,
    fabricCanvas: null,
    activeTab: 'crop',
    activeView: 'editor',
    converterFiles: [],
    batchFormat: 'WEBP',
    converterQuality: 90,
    pdfFiles: [],
    pdfRenderedPages: []
};

window.onload = function() {
    initFabricCanvas();
    initPhotoEditor();
    syncNavActiveState(state.mainView);
};

/* =================================================================== */
/* VIEW SWITCHER & NAVIGATION */
/* =================================================================== */
function switchMainView(view) {
    state.mainView = view;
    document.getElementById('main-view-home').classList.add('hidden');
    document.getElementById('main-view-photo').classList.add('hidden');
    document.getElementById('main-view-converter').classList.add('hidden');
    document.getElementById('main-view-pdf').classList.add('hidden');
    document.getElementById('main-view-excel').classList.add('hidden');

    if (view === 'home') {
        document.getElementById('main-view-home').classList.remove('hidden');
    } else if (view === 'photo') {
        document.getElementById('main-view-photo').classList.remove('hidden');
    } else if (view === 'converter') {
        document.getElementById('main-view-converter').classList.remove('hidden');
    } else if (view === 'pdf') {
        document.getElementById('main-view-pdf').classList.remove('hidden');
    } else if (view === 'excel') {
        document.getElementById('main-view-excel').classList.remove('hidden');
    }

    const photoActions = document.getElementById('photo-header-actions');
    if (photoActions) { photoActions.classList.toggle('hidden', view !== 'photo'); photoActions.classList.toggle('flex', view === 'photo'); }

    syncNavActiveState(view);
    window.scrollTo({ top: 0, behavior: 'instant' in window ? 'instant' : 'auto' });
}

/* Purely visual: highlights the header nav item matching the current view.
   Safe no-op if a given nav button doesn't exist (e.g. on narrow layouts). */
function syncNavActiveState(view) {
    const navIds = { home: 'nav-item-home', photo: 'nav-item-photo' };
    Object.values(navIds).forEach(id => {
        const btn = document.getElementById(id);
        if (!btn) return;
        btn.classList.remove('text-red-600', 'bg-red-50', 'dark:bg-red-950/40', 'dark:text-red-400');
        btn.classList.add('text-gray-600', 'dark:text-zinc-300');
    });
    const activeBtn = document.getElementById(navIds[view]);
    if (activeBtn) {
        activeBtn.classList.remove('text-gray-600', 'dark:text-zinc-300');
        activeBtn.classList.add('text-red-600', 'bg-red-50', 'dark:bg-red-950/40', 'dark:text-red-400');
    }
}

function toggleImageToolsDropdown() {
    const menu = document.getElementById('image-tools-dropdown-menu');
    const chevron = document.getElementById('image-tools-chevron');
    const isHidden = menu.classList.contains('hidden-dropdown');
    if (isHidden) {
        menu.classList.remove('hidden-dropdown');
        menu.classList.add('visible-dropdown');
        chevron.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.remove('visible-dropdown');
        menu.classList.add('hidden-dropdown');
        chevron.style.transform = 'rotate(0deg)';
    }
}

function togglePdfDropdown() {
    const menu = document.getElementById('pdf-dropdown-menu');
    const chevron = document.getElementById('pdf-chevron');
    const isHidden = menu.classList.contains('hidden-dropdown');
    if (isHidden) {
        menu.classList.remove('hidden-dropdown');
        menu.classList.add('visible-dropdown');
        chevron.style.transform = 'rotate(180deg)';
    } else {
        menu.classList.remove('visible-dropdown');
        menu.classList.add('hidden-dropdown');
        chevron.style.transform = 'rotate(0deg)';
    }
}

function toggleMobileMenu() {
    const menu = document.getElementById('mobile-menu');
    menu.classList.toggle('hidden');
}

function toggleMobilePdfAccordion() {
    const content = document.getElementById('mobile-pdf-accordion-content');
    const chevron = document.getElementById('mobile-pdf-chevron');
    content.classList.toggle('hidden');
    chevron.style.transform = content.classList.contains('hidden') ? 'rotate(0deg)' : 'rotate(180deg)';
}

/* Theme is permanently dark (black + red) - no light-mode toggle. */

/* =================================================================== */
/* PHOTO STUDIO                                                         */
/*                                                                       */
/* Model data:                                                           */
/*  - state.photo.base      : foto kerja (hasil crop/rotasi/teks), PNG    */
/*                            lossless pada resolusi asli.                */
/*  - filter (slider)       : non-destruktif, dipakai saat render.        */
/*  - state.photo.orientation : SATU-SATUNYA sumber orientasi. Toolbar,   */
/*                            panel, dialog, pratinjau, dan cetak semua   */
/*                            dibaca dari sini.                           */
/*  - createSheetElement()  : membangun lembar A4 yang sama persis untuk  */
/*                            pratinjau, thumbnail dialog, dan cetak.     */
/* =================================================================== */
const MM_PX = 96 / 25.4;
const PAGE_MM = { portrait: { w: 210, h: 297 }, landscape: { w: 297, h: 210 } };
const GRID_PRESETS = { '3x4': { count: 12, w: 30, h: 40 }, '4x6': { count: 8, w: 40, h: 60 }, '2x3': { count: 18, w: 20, h: 30 } };

state.photo = {
    base: null, original: null,
    orientation: 'portrait', focus: { x: 50, y: 50 }, cropRatio: NaN,
    version: 0, rendered: null, pending: null, trash: [],
    printing: false, previewSeq: 0, previewTimer: null
};
const printDlg = { el: null, open: false, opener: null, choice: 'portrait' };

const $id = (id) => document.getElementById(id);

function initPhotoEditor() {
    if (state.photoInit) return;
    state.photoInit = true;

    const zone = $id('drag-drop-zone');
    zone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); triggerFileInput(); }
    });
    zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('is-over'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('is-over'));
    zone.addEventListener('drop', (e) => {
        e.preventDefault(); zone.classList.remove('is-over');
        const f = e.dataTransfer && e.dataTransfer.files && e.dataTransfer.files[0];
        if (f) loadPhotoFile(f);
    });

    // Tablist: navigasi panah kiri/kanan
    const tabs = $id('tab-crop').parentElement;
    tabs.addEventListener('keydown', (e) => {
        if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
        const list = [...tabs.querySelectorAll('[role=tab]')];
        const i = list.indexOf(document.activeElement);
        if (i < 0) return;
        const next = list[(i + (e.key === 'ArrowRight' ? 1 : list.length - 1)) % list.length];
        next.focus(); next.click();
    });

    // Dialog cetak (listener dipasang sekali)
    printDlg.el = $id('print-dialog');
    $id('print-dialog-cancel').addEventListener('click', () => closePrintDialog());
    $id('print-dialog-backdrop').addEventListener('click', () => { if (!state.photo.printing) closePrintDialog(); });
    $id('print-dialog-confirm').addEventListener('click', confirmPrint);
    printDlg.el.querySelectorAll('input[name=print-dialog-orientation]').forEach(r =>
        r.addEventListener('change', () => { printDlg.choice = r.value; refreshDialogThumbs(); }));
    document.addEventListener('keydown', onDialogKeydown);
    window.addEventListener('afterprint', cleanupPrintJob);

    let raf = null;
    const refit = () => { if (raf) return; raf = requestAnimationFrame(() => { raf = null; fitPreviewScale(); fitFabricCss(); }); };
    window.addEventListener('resize', refit);
    if (window.ResizeObserver) new ResizeObserver(refit).observe($id('print-workspace'));

    syncOrientationUI();
    updatePrintAreaPreview();
}

/* ---------- util ---------- */
function loadImageElement(url) {
    return new Promise((res, rej) => {
        const i = new Image();
        i.onload = () => res(i);
        i.onerror = () => rej(new Error('Gagal memuat gambar'));
        i.src = url;
    });
}
function canvasToBlob(canvas, type = 'image/png', q) {
    return new Promise((res, rej) => canvas.toBlob(b => b ? res(b) : rej(new Error('Gagal membuat gambar')), type, q));
}
function setBusy(on, msg) {
    $id('editor-spinner').classList.toggle('hidden', !on);
    $id('editor-workspace').setAttribute('aria-busy', on ? 'true' : 'false');
    if (msg) $id('editor-spinner-text').textContent = msg;
}
function isFabricActive() { return !$id('fabric-container').classList.contains('hidden'); }
function refreshDimensionsBadge() {
    const b = state.photo.base;
    $id('image-dimensions-badge').textContent = b ? `${b.w} × ${b.h} px` : '0 × 0 px';
}
function flushTrash() {
    const p = state.photo;
    p.trash.forEach(u => URL.revokeObjectURL(u));
    p.trash = [];
}
function invalidateRendered() {
    const p = state.photo;
    if (p.rendered) p.trash.push(p.rendered.url);
    p.rendered = null; p.pending = null;
}

/* ---------- memuat foto ---------- */
function triggerFileInput() { $id('image-file-input').click(); }

function handleFileSelect(e) {
    const file = e.target.files[0];
    e.target.value = '';           // agar file yang sama bisa dipilih lagi
    if (file) loadPhotoFile(file);
}

async function loadPhotoFile(file) {
    if (!file.type.startsWith('image/')) { showToast('File harus berupa gambar.'); return; }
    setBusy(true, 'Memuat foto...');
    try {
        if (isFabricActive()) discardFabric();
        await setBaseFromBlob(file, { isOriginal: true });
        resetFilterSliders();
        state.photo.focus = { x: 50, y: 50 }; syncFocusUI();
        switchView('editor');
        showToast('Gambar berhasil diunggah!');
    } catch (err) {
        showToast('Gagal membuka gambar. Format mungkin tidak didukung browser.');
    } finally { setBusy(false); }
}

async function setBaseFromBlob(blob, { isOriginal = false } = {}) {
    const p = state.photo;
    const url = URL.createObjectURL(blob);
    let el;
    try { el = await loadImageElement(url); }
    catch (e) { URL.revokeObjectURL(url); throw e; }

    const old = p.base, oldOrig = p.original;
    p.base = { url, el, w: el.naturalWidth, h: el.naturalHeight };
    if (isOriginal) p.original = p.base;
    p.version++;
    invalidateRendered();
    state.currentImageSrc = url;
    if (isOriginal) state.originalImageSrc = url;
    refreshDimensionsBadge();
    loadCropper(url);

    if (isOriginal) {
        if (oldOrig) URL.revokeObjectURL(oldOrig.url);
        if (old && (!oldOrig || old.url !== oldOrig.url)) URL.revokeObjectURL(old.url);
    } else if (old && (!p.original || old.url !== p.original.url)) {
        URL.revokeObjectURL(old.url);
    }
    updatePrintAreaPreview();
}

function loadCropper(src) {
    const img = $id('cropper-image');
    if (state.cropper) { state.cropper.destroy(); state.cropper = null; }
    $id('drag-drop-zone').classList.add('hidden');
    $id('fabric-container').classList.add('hidden');
    $id('cropper-container').classList.remove('hidden');
    img.src = src;
    state.cropper = new Cropper(img, {
        aspectRatio: state.photo.cropRatio,
        viewMode: 1, background: false, autoCropArea: 0.9,
        responsive: true, checkOrientation: false
    });
    applyFilterPreview();
}

/* ---------- crop & rotasi ---------- */
function setCropRatio(ratio) {
    state.photo.cropRatio = ratio;
    if (state.cropper) state.cropper.setAspectRatio(ratio);
    document.querySelectorAll('.ratio-btn').forEach(btn => {
        const free = btn.dataset.ratio === 'free';
        const on = free ? isNaN(ratio) : (!isNaN(ratio) && Math.abs(parseFloat(btn.dataset.ratio) - ratio) < 1e-3);
        btn.setAttribute('aria-pressed', on ? 'true' : 'false');
    });
}

async function applyCrop() {
    if (!state.cropper) { showToast('Pilih foto terlebih dahulu!'); return; }
    setBusy(true, 'Memotong foto...');
    try {
        const canvas = state.cropper.getCroppedCanvas({ imageSmoothingEnabled: true, imageSmoothingQuality: 'high' });
        if (!canvas) throw new Error('crop');
        const blob = await canvasToBlob(canvas);       // PNG lossless
        await setBaseFromBlob(blob);
        state.photo.focus = { x: 50, y: 50 }; syncFocusUI();
        await switchView('print');
        showToast('Foto berhasil dipotong! Dialihkan ke Lembar Cetak.');
    } catch (e) { showToast('Gagal memotong foto.'); }
    finally { setBusy(false); }
}

async function rotateImage(deg) {
    if (!state.photo.base) { showToast('Pilih foto terlebih dahulu!'); return; }
    await finalizeEdits();
    const b = state.photo.base;
    setBusy(true, 'Memutar foto...');
    try {
        const swap = Math.abs(deg) % 180 === 90;
        const c = document.createElement('canvas');
        c.width = swap ? b.h : b.w; c.height = swap ? b.w : b.h;
        const ctx = c.getContext('2d');
        ctx.translate(c.width / 2, c.height / 2);
        ctx.rotate(deg * Math.PI / 180);
        ctx.drawImage(b.el, -b.w / 2, -b.h / 2);
        await setBaseFromBlob(await canvasToBlob(c));
    } catch (e) { showToast('Gagal memutar foto.'); }
    finally { setBusy(false); }
}

/* ---------- filter (non-destruktif) ---------- */
function readFilters() {
    const v = (id) => parseInt(($id(id) || {}).value || 0, 10) || 0;
    return { b: v('slider-brightness'), c: v('slider-contrast'), s: v('slider-saturate') };
}
const hasFilters = (f) => !!(f.b || f.c || f.s);
const filterCss = (f) => `brightness(${100 + f.b}%) contrast(${100 + f.c}%) saturate(${100 + f.s}%)`;
const filterKey = (f) => `${f.b},${f.c},${f.s}`;

function applyFilterPreview() {
    const img = $id('cropper-image'), f = readFilters();
    if (img) img.style.filter = hasFilters(f) ? filterCss(f) : 'none';
    // Cropper menduplikasi gambar pada .cropper-view-box; ikut difilter
    document.querySelectorAll('#cropper-container .cropper-canvas img, #cropper-container .cropper-view-box img')
        .forEach(i => { i.style.filter = hasFilters(f) ? filterCss(f) : 'none'; });
}

function updateFilter() {
    if (!state.photo.base) return;
    const f = readFilters();
    $id('val-brightness').textContent = `${f.b}%`;
    $id('val-contrast').textContent = `${f.c}%`;
    $id('val-saturate').textContent = `${f.s}%`;
    applyFilterPreview();
    if (state.activeView === 'print') schedulePreview(120);
}

function resetFilterSliders() {
    ['brightness', 'contrast', 'saturate'].forEach(n => {
        $id('slider-' + n).value = 0; $id('val-' + n).textContent = '0%';
    });
    applyFilterPreview();
}
function clearFilters() {
    resetFilterSliders();
    if (state.activeView === 'print') updatePrintAreaPreview();
}

let _ctxFilterOK;
function supportsCtxFilter() {
    if (_ctxFilterOK === undefined) {
        const c = document.createElement('canvas').getContext('2d');
        c.filter = 'brightness(50%)';
        _ctxFilterOK = (c.filter === 'brightness(50%)');
    }
    return _ctxFilterOK;
}
// Cadangan untuk browser tanpa ctx.filter; meniru urutan & rumus filter CSS.
function applyFilterPixels(ctx, w, h, f) {
    const br = (100 + f.b) / 100, ct = (100 + f.c) / 100, s = (100 + f.s) / 100;
    const m = [0.213 + 0.787 * s, 0.715 - 0.715 * s, 0.072 - 0.072 * s,
               0.213 - 0.213 * s, 0.715 + 0.285 * s, 0.072 - 0.072 * s,
               0.213 - 0.213 * s, 0.715 - 0.715 * s, 0.072 + 0.928 * s];
    const id = ctx.getImageData(0, 0, w, h), d = id.data;
    const cl = (x) => x < 0 ? 0 : x > 255 ? 255 : x;
    for (let i = 0; i < d.length; i += 4) {
        let r = cl(d[i] * br), g = cl(d[i + 1] * br), b = cl(d[i + 2] * br);
        r = cl((r - 127.5) * ct + 127.5); g = cl((g - 127.5) * ct + 127.5); b = cl((b - 127.5) * ct + 127.5);
        d[i] = cl(m[0] * r + m[1] * g + m[2] * b);
        d[i + 1] = cl(m[3] * r + m[4] * g + m[5] * b);
        d[i + 2] = cl(m[6] * r + m[7] * g + m[8] * b);
    }
    ctx.putImageData(id, 0, 0);
}

// Render foto kerja + filter pada resolusi asli (tidak mengubah state).
function renderEditedCanvas() {
    const b = state.photo.base, f = readFilters();
    const c = document.createElement('canvas');
    c.width = b.w; c.height = b.h;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingQuality = 'high';
    if (hasFilters(f) && supportsCtxFilter()) { ctx.filter = filterCss(f); ctx.drawImage(b.el, 0, 0); ctx.filter = 'none'; }
    else { ctx.drawImage(b.el, 0, 0); if (hasFilters(f)) applyFilterPixels(ctx, c.width, c.height, f); }
    return c;
}

// URL gambar hasil edit terbaru; di-cache per (versi foto + filter).
function getEditedUrl() {
    const p = state.photo, key = p.version + '|' + filterKey(readFilters());
    if (p.rendered && p.rendered.key === key) return Promise.resolve(p.rendered.url);
    if (p.pending && p.pending.key === key) return p.pending.promise;
    const promise = (async () => {
        const blob = await canvasToBlob(renderEditedCanvas());
        const url = URL.createObjectURL(blob);
        if (p.rendered) p.trash.push(p.rendered.url);
        p.rendered = { key, url };
        if (p.pending && p.pending.key === key) p.pending = null;
        return url;
    })();
    p.pending = { key, promise };
    return promise;
}

async function applyFilterToImage() {
    const p = state.photo;
    if (!p.base) return;
    await finalizeEdits();
    if (!hasFilters(readFilters())) { showToast('Atur slider filter terlebih dahulu.'); return; }
    setBusy(true, 'Menyimpan filter...');
    try {
        const blob = await canvasToBlob(renderEditedCanvas());
        resetFilterSliders();
        await setBaseFromBlob(blob);
        showToast('Filter berhasil disimpan!');
    } catch (e) { showToast('Gagal menyimpan filter.'); }
    finally { setBusy(false); }
}

/* ---------- teks (Fabric) ---------- */
function initFabricCanvas() {
    state.fabricCanvas = new fabric.Canvas('fabric-canvas', { width: 600, height: 400, backgroundColor: '#ffffff' });
}

function fitFabricCss() {
    const fc = state.fabricCanvas;
    if (!fc || !isFabricActive()) return;
    const box = $id('fabric-container');
    const k = Math.min(1, box.clientWidth / fc.getWidth());
    fc.setDimensions({ width: Math.round(fc.getWidth() * k) + 'px', height: Math.round(fc.getHeight() * k) + 'px' }, { cssOnly: true });
}

async function addTextToCanvas() {
    const p = state.photo, fc = state.fabricCanvas;
    if (!p.base) { showToast('Pilih foto terlebih dahulu!'); return; }
    const txt = $id('text-input').value || 'Tools';
    const color = $id('text-color').value || '#ffffff';
    try {
        if (!isFabricActive()) {
            setBusy(true, 'Menyiapkan kanvas teks...');
            const url = await getEditedUrl();      // filter ikut menjadi latar teks
            const oImg = await new Promise(res => fabric.Image.fromURL(url, res));
            fc.clear();
            fc.setDimensions({ width: oImg.width, height: oImg.height });
            fc.setBackgroundImage(oImg, fc.renderAll.bind(fc));
            $id('cropper-container').classList.add('hidden');
            $id('fabric-container').classList.remove('hidden');
            $id('text-apply-actions').classList.remove('hidden');
            fitFabricCss();
        }
        const t = new fabric.Text(txt, {
            left: fc.getWidth() / 2, top: fc.getHeight() / 2, originX: 'center', originY: 'center',
            fontSize: Math.max(24, Math.round(fc.getWidth() / 20)), fill: color, fontFamily: 'Inter'
        });
        fc.add(t); fc.setActiveObject(t); fc.renderAll();
        showToast('Teks ditambahkan. Seret untuk memindahkan.');
    } catch (e) { showToast('Gagal menambahkan teks.'); }
    finally { setBusy(false); }
}

function discardFabric() {
    const fc = state.fabricCanvas;
    if (fc) { fc.discardActiveObject(); fc.clear(); }
    $id('fabric-container').classList.add('hidden');
    $id('text-apply-actions').classList.add('hidden');
}

function cancelText() {
    if (!isFabricActive()) return;
    discardFabric();
    if (state.photo.base) loadCropper(state.photo.base.url);
}

async function commitText() {
    if (!isFabricActive()) return;
    const fc = state.fabricCanvas;
    setBusy(true, 'Menerapkan teks...');
    try {
        fc.discardActiveObject(); fc.renderAll();
        const c = typeof fc.toCanvasElement === 'function' ? fc.toCanvasElement(1) : fc.lowerCanvasEl;
        const blob = await canvasToBlob(c);
        discardFabric();
        resetFilterSliders();               // filter sudah menyatu di latar
        await setBaseFromBlob(blob);
    } catch (e) { showToast('Gagal menerapkan teks.'); }
    finally { setBusy(false); }
}

// Dipanggil sebelum cetak/ekspor/crop: pastikan tidak ada edit yang belum diterapkan.
async function finalizeEdits() { if (isFabricActive()) await commitText(); }
function syncActiveEdits() { return finalizeEdits(); }

/* ---------- tab & tampilan ---------- */
async function switchTab(tab) {
    if (tab !== 'text') await finalizeEdits();
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        const on = btn.id === `tab-${tab}`;
        btn.setAttribute('aria-selected', on ? 'true' : 'false');
        btn.tabIndex = on ? 0 : -1;
    });
    document.querySelectorAll('.tab-panel').forEach(pn => pn.classList.add('hidden'));
    $id(`panel-${tab}`).classList.remove('hidden');
    if (tab === 'print-setup') switchView('print');
    else if (tab === 'crop' || tab === 'text') switchView('editor');
}

async function switchView(view) {
    if (view === 'print') await finalizeEdits();
    state.activeView = view;
    $id('editor-workspace').classList.toggle('hidden', view !== 'editor');
    $id('print-workspace').classList.toggle('hidden', view !== 'print');
    $id('view-btn-editor').setAttribute('aria-pressed', view === 'editor' ? 'true' : 'false');
    $id('view-btn-print').setAttribute('aria-pressed', view === 'print' ? 'true' : 'false');
    if (view === 'print') updatePrintAreaPreview();
    else { fitFabricCss(); }
}

/* ---------- orientasi (sumber tunggal) ---------- */
function setOrientation(o) {
    if (o !== 'portrait' && o !== 'landscape') return;
    state.photo.orientation = o;
    syncOrientationUI();
    updatePrintAreaPreview();
}
function syncOrientationUI() {
    const o = state.photo.orientation;
    document.querySelectorAll('[data-orientation-btn]').forEach(b =>
        b.setAttribute('aria-pressed', b.dataset.orientationBtn === o ? 'true' : 'false'));
    const sel = $id('print-orientation'); if (sel) sel.value = o;
}

/* ---------- lembar cetak ---------- */
function currentSheetOptions() {
    const p = state.photo;
    let m = parseFloat($id('print-margin').value);
    if (!isFinite(m)) m = 5;
    m = Math.max(0, Math.min(20, m));
    return {
        orientation: p.orientation,
        layout: $id('print-photo-size').value,
        scaleMode: $id('print-scale-mode').value,
        margin: m, focus: p.focus
    };
}

function createSheetElement(url, o) {
    const pg = PAGE_MM[o.orientation];
    const sheet = document.createElement('div');
    sheet.className = 'print-sheet';
    sheet.dataset.orientation = o.orientation;
    sheet.style.setProperty('--sheet-w', pg.w + 'mm');
    sheet.style.setProperty('--sheet-h', pg.h + 'mm');
    sheet.style.setProperty('--sheet-m', o.margin + 'mm');
    const box = document.createElement('div');
    box.className = 'print-sheet__box';
    if (!url) {
        const msg = document.createElement('p');
        msg.className = 'print-sheet__empty';
        msg.textContent = 'Belum ada foto yang dimuat.';
        box.appendChild(msg);
    } else if (o.layout === 'fit') {
        const img = new Image();
        img.className = 'print-sheet__img';
        img.alt = 'Foto hasil edit'; img.draggable = false; img.decoding = 'sync';
        img.src = url;
        img.style.objectFit = o.scaleMode === 'fill' ? 'cover' : 'contain';
        img.style.objectPosition = `${o.focus.x}% ${o.focus.y}%`;
        box.appendChild(img);
    } else {
        const g = GRID_PRESETS[o.layout] || GRID_PRESETS['3x4'];
        box.classList.add('print-sheet__box--grid');
        for (let i = 0; i < g.count; i++) {
            const img = new Image();
            img.className = 'print-sheet__cell';
            img.alt = ''; img.draggable = false; img.decoding = 'sync'; img.src = url;
            img.style.width = g.w + 'mm'; img.style.height = g.h + 'mm';
            box.appendChild(img);
        }
    }
    sheet.appendChild(box);
    return sheet;
}

function schedulePreview(ms) {
    const p = state.photo;
    clearTimeout(p.previewTimer);
    p.previewTimer = setTimeout(updatePrintAreaPreview, ms);
}

async function updatePrintAreaPreview() {
    const p = state.photo, seq = ++p.previewSeq;
    const grid = $id('print-grid');
    if (!grid) return;
    const fillOpts = $id('print-fill-options');
    const o0 = currentSheetOptions();
    $id('print-scale-field').classList.toggle('hidden', o0.layout !== 'fit');
    fillOpts.classList.toggle('hidden', !(o0.layout === 'fit' && o0.scaleMode === 'fill'));

    let url = null;
    if (p.base) {
        try { url = await getEditedUrl(); }
        catch (e) { showToast('Gagal membuat pratinjau.'); return; }
        if (seq !== p.previewSeq) return;      // ada pembaruan yang lebih baru
    }
    const o = currentSheetOptions();
    grid.replaceChildren(createSheetElement(url, o));
    fitPreviewScale();
    updatePrintInfo();
    if (printDlg.open) refreshDialogThumbs();
    flushTrash();
}

function fitPreviewScale() {
    const stage = $id('print-workspace'), area = $id('print-area');
    const sheet = $id('print-grid').firstElementChild;
    if (!sheet || stage.classList.contains('hidden')) return;
    const pg = PAGE_MM[state.photo.orientation];
    const wpx = pg.w * MM_PX, hpx = pg.h * MM_PX;
    const cs = getComputedStyle(stage);
    const availW = stage.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight);
    const availH = Math.max(360, window.innerHeight - 200);
    const k = Math.max(0.1, Math.min(1, availW / wpx, availH / hpx));
    sheet.style.transform = `scale(${k})`;
    sheet.style.transformOrigin = 'top left';
    area.style.width = Math.round(wpx * k) + 'px';
    area.style.height = Math.round(hpx * k) + 'px';
}

function effectiveDpi(o) {
    const b = state.photo.base;
    if (!b || o.layout !== 'fit') return null;
    const pg = PAGE_MM[o.orientation];
    const bw = Math.max(1, pg.w - 2 * o.margin), bh = Math.max(1, pg.h - 2 * o.margin);
    const pick = o.scaleMode === 'fill' ? Math.max : Math.min;
    const mmPerPx = pick(bw / b.w, bh / b.h);
    return { dpi: Math.round(25.4 / mmPerPx), bw, bh };
}

function updatePrintInfo() {
    const note = $id('print-quality-note'), o = currentSheetOptions();
    const e = effectiveDpi(o);
    const parts = [];
    if (e) {
        let q = e.dpi >= 200 ? 'baik' : e.dpi >= 150 ? 'cukup' : 'rendah; memperbesar tidak menambah ketajaman';
        parts.push(`Area cetak ${e.bw} × ${e.bh} mm, resolusi efektif ±${e.dpi} dpi (${q}).`);
        if (o.scaleMode === 'fill') parts.push('Mode Fill memotong tepi foto yang tidak muat.');
    } else if (o.layout !== 'fit') {
        parts.push('Pasfoto diisi dengan crop proporsional (tanpa distorsi).');
    }
    if (o.margin < 4) parts.push('Banyak printer tidak bisa mencetak sampai tepi (±4–6 mm); bagian tepi bisa terpotong.');
    note.textContent = parts.join(' ');
}

function onPrintSettingsChanged() { updatePrintAreaPreview(); }
function onFocusChanged() {
    const f = state.photo.focus;
    f.x = parseInt($id('print-focus-x').value, 10); f.y = parseInt($id('print-focus-y').value, 10);
    document.querySelectorAll('#print-grid .print-sheet__img').forEach(i => { i.style.objectPosition = `${f.x}% ${f.y}%`; });
}
function syncFocusUI() { $id('print-focus-x').value = state.photo.focus.x; $id('print-focus-y').value = state.photo.focus.y; }
function resetFocus() { state.photo.focus = { x: 50, y: 50 }; syncFocusUI(); onFocusChanged(); }

/* ---------- dialog orientasi cetak ---------- */
async function openPrintDialog() {
    const p = state.photo;
    if (!p.base) { showToast('Silakan upload atau pilih foto terlebih dahulu sebelum mencetak!'); return; }
    if (printDlg.open || p.printing) return;
    await finalizeEdits();
    printDlg.opener = document.activeElement;
    printDlg.choice = p.orientation;
    printDlg.el.querySelectorAll('input[name=print-dialog-orientation]').forEach(r => { r.checked = (r.value === printDlg.choice); });
    printDlg.el.classList.remove('hidden');
    document.body.classList.add('pe-modal-open');
    printDlg.open = true;
    await refreshDialogThumbs();
    const checked = printDlg.el.querySelector('input:checked');
    if (checked) checked.focus();
}
function handleDirectPrint() { return openPrintDialog(); }   // kompatibilitas nama lama

function closePrintDialog() {
    if (!printDlg.open) return;
    printDlg.open = false;
    printDlg.el.classList.add('hidden');
    document.body.classList.remove('pe-modal-open');
    if (printDlg.opener && document.contains(printDlg.opener) && printDlg.opener.focus) printDlg.opener.focus();
}

async function refreshDialogThumbs() {
    const p = state.photo;
    if (!p.base) return;
    let url; try { url = await getEditedUrl(); } catch (e) { return; }
    const base = currentSheetOptions();
    const LONG = 150;
    printDlg.el.querySelectorAll('[data-thumb]').forEach(holder => {
        const ori = holder.dataset.thumb, pg = PAGE_MM[ori];
        const k = LONG / (Math.max(pg.w, pg.h) * MM_PX);
        holder.style.width = Math.round(pg.w * MM_PX * k) + 'px';
        holder.style.height = Math.round(pg.h * MM_PX * k) + 'px';
        const s = createSheetElement(url, Object.assign({}, base, { orientation: ori }));
        s.style.transform = `scale(${k})`; s.style.transformOrigin = 'top left';
        holder.replaceChildren(s);
    });
    const e = effectiveDpi(Object.assign({}, base, { orientation: printDlg.choice }));
    $id('print-dialog-info').textContent =
        `Margin ${base.margin} mm · ${base.layout === 'fit' ? (base.scaleMode === 'fill' ? 'Fill' : 'Fit (foto utuh)') : 'Pasfoto'}` +
        (e ? ` · ±${e.dpi} dpi` : '');
}

function onDialogKeydown(e) {
    if (!printDlg.open) return;
    if (e.key === 'Escape') { e.preventDefault(); if (!state.photo.printing) closePrintDialog(); return; }
    if (e.key !== 'Tab') return;
    const f = [...printDlg.el.querySelectorAll('button:not([disabled]), input:not([disabled])')]
        .filter(x => x.offsetParent !== null);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (!printDlg.el.contains(document.activeElement)) { e.preventDefault(); first.focus(); }
    else if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
}

const nextFrames = (n) => new Promise(res => { const f = () => (--n <= 0 ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); });

async function confirmPrint() {
    const p = state.photo;
    if (p.printing) return;                       // cegah dialog cetak ganda
    p.printing = true;
    const btn = $id('print-dialog-confirm'), cancel = $id('print-dialog-cancel');
    btn.disabled = true; cancel.disabled = true; btn.textContent = 'Menyiapkan...';
    try {
        p.orientation = printDlg.choice;          // pilihan dialog -> sumber tunggal
        syncOrientationUI();
        await finalizeEdits();
        const url = await getEditedUrl();
        const opts = currentSheetOptions();
        const root = $id('print-root');
        root.replaceChildren(createSheetElement(url, opts));
        await Promise.all([...root.querySelectorAll('img')].map(i => i.decode ? i.decode().catch(() => {}) : Promise.resolve()));

        // @page tidak bisa membaca JS: suntikkan untuk pekerjaan cetak ini saja.
        let st = $id('dynamic-print-orientation-style');
        if (!st) { st = document.createElement('style'); st.id = 'dynamic-print-orientation-style'; document.head.appendChild(st); }
        st.textContent = `@page { size: A4 ${opts.orientation}; margin: 0; }`;
        document.body.classList.add('printing-photo');

        closePrintDialog();
        updatePrintAreaPreview();
        await nextFrames(2);
        window.print();
    } catch (err) {
        showToast('Gagal menyiapkan dokumen cetak.');
        cleanupPrintJob();
        closePrintDialog();
    } finally {
        p.printing = false;
        btn.disabled = false; cancel.disabled = false; btn.textContent = 'Lanjutkan Cetak';
    }
}

function cleanupPrintJob() {
    document.body.classList.remove('printing-photo');
    const st = $id('dynamic-print-orientation-style'); if (st) st.remove();
    const root = $id('print-root'); if (root) root.replaceChildren();
    flushTrash();
}

/* ---------- ekspor ---------- */
async function downloadEditedPhoto() {
    const p = state.photo;
    if (!p.base) { showToast('Tidak ada gambar untuk diunduh!'); return; }
    await finalizeEdits();
    const format = $id('photo-format-select').value || 'jpg';
    const name = sanitizeFilenameBase($id('photo-filename-input').value) || 'Foto_Tools';
    setBusy(true, 'Menyiapkan unduhan...');
    try {
        let canvas = renderEditedCanvas();
        if (format === 'jpg') {               // JPG tanpa transparansi: latar putih
            const flat = document.createElement('canvas');
            flat.width = canvas.width; flat.height = canvas.height;
            const ctx = flat.getContext('2d');
            ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, flat.width, flat.height);
            ctx.drawImage(canvas, 0, 0);
            canvas = flat;
        }
        const mime = format === 'png' ? 'image/png' : format === 'webp' ? 'image/webp' : 'image/jpeg';
        const blob = await canvasToBlob(canvas, mime, format === 'png' ? undefined : 0.95);
        const a = document.createElement('a');
        const url = URL.createObjectURL(blob);
        a.href = url; a.download = `${name}.${format}`;
        document.body.appendChild(a); a.click(); a.remove();
        setTimeout(() => URL.revokeObjectURL(url), 1500);
        showToast('Download foto berhasil dimulai!');
    } catch (e) { showToast('Gagal mengekspor gambar.'); }
    finally { setBusy(false); }
}

/* ---------- reset ---------- */
function resetToHomeScreen() {
    const p = state.photo;
    if (state.cropper) { state.cropper.destroy(); state.cropper = null; }
    discardFabric();
    if (p.base) URL.revokeObjectURL(p.base.url);
    if (p.original && (!p.base || p.original.url !== p.base.url)) URL.revokeObjectURL(p.original.url);
    invalidateRendered(); flushTrash();
    p.base = null; p.original = null; p.version++;
    p.focus = { x: 50, y: 50 }; syncFocusUI();
    state.currentImageSrc = null; state.originalImageSrc = null;
    resetFilterSliders(); setCropRatio(NaN);
    $id('cropper-image').removeAttribute('src');
    $id('cropper-container').classList.add('hidden');
    $id('drag-drop-zone').classList.remove('hidden');
    refreshDimensionsBadge();
    switchView('editor');
    updatePrintAreaPreview();
    showToast('Siap untuk foto baru!');
}

function resetImageOriginal() {
    const p = state.photo;
    if (!p.original) return;
    if (isFabricActive()) discardFabric();
    const old = p.base;
    p.base = p.original; p.version++;
    invalidateRendered();
    state.currentImageSrc = p.original.url;
    resetFilterSliders();
    p.focus = { x: 50, y: 50 }; syncFocusUI();
    setCropRatio(NaN);
    refreshDimensionsBadge();
    loadCropper(p.original.url);
    if (old && old.url !== p.original.url) URL.revokeObjectURL(old.url);
    updatePrintAreaPreview();
    showToast('Foto dikembalikan ke bentuk asli!');
}

/* =================================================================== */
/* IMAGE CONVERTER LOGIC */
/* =================================================================== */
function triggerConverterFileInput() {
    document.getElementById('converter-file-input').click();
}

function handleConverterFiles(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    files.forEach(file => {
        const reader = new FileReader();
        reader.onload = function(evt) {
            state.converterFiles.push({
                id: Date.now() + Math.random(),
                file: file,
                dataUrl: evt.target.result,
                originalName: file.name,
                originalSize: file.size,
                targetFormat: state.batchFormat,
                convertedUrl: null,
                convertedSize: null
            });
            renderConverterFileList();
        };
        reader.readAsDataURL(file);
    });

    document.getElementById('converter-upload-card').classList.add('hidden');
    document.getElementById('converter-workspace-area').classList.remove('hidden');
}

function handleConverterDragOver(e) {
    e.preventDefault();
}

function handleConverterDragLeave(e) {
    e.preventDefault();
}

function handleConverterDrop(e) {
    e.preventDefault();
    if (e.dataTransfer.files) {
        handleConverterFiles({ target: { files: e.dataTransfer.files } });
    }
}

function updateConverterQuality(val) {
    state.converterQuality = parseInt(val);
    document.getElementById('converter-quality-val').innerText = `${val}%`;
}

function updateBatchOutputFormat(fmt) {
    state.batchFormat = fmt;
    state.converterFiles.forEach(f => f.targetFormat = fmt);
    renderConverterFileList();
}

function applyBatchFilenamePrefix(prefix) {
    renderConverterFileList();
}

function renderConverterFileList() {
    const container = document.getElementById('converter-file-list');
    container.innerHTML = '';

    const prefix = document.getElementById('batch-filename-prefix').value.trim();

    state.converterFiles.forEach((item, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-gray-200 dark:border-zinc-700 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4';

        const nameWithoutExt = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
        const finalName = prefix ? `${prefix}_${index + 1}` : nameWithoutExt;

        card.innerHTML = `
            <div class="flex items-center space-x-3 w-full sm:w-auto">
                <img src="${item.dataUrl}" class="w-14 h-14 object-cover rounded-xl border border-gray-200 dark:border-zinc-700">
                <div>
                    <h4 class="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate max-w-[180px]">${finalName}.${item.targetFormat.toLowerCase()}</h4>
                    <p class="text-[10px] text-gray-500">${(item.originalSize / 1024).toFixed(1)} KB</p>
                </div>
            </div>
            <div class="flex items-center space-x-2 w-full sm:w-auto justify-end">
                <button onclick="removeConverterFile('${item.id}')" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 text-xs">
                    <i class="fa-solid fa-trash"></i>
                </button>
            </div>
        `;
        container.appendChild(card);
    });
}

function removeConverterFile(id) {
    state.converterFiles = state.converterFiles.filter(f => f.id != id);
    if (state.converterFiles.length === 0) {
        resetConverterWorkspace();
    } else {
        renderConverterFileList();
    }
}

function resetConverterWorkspace() {
    state.converterFiles = [];
    document.getElementById('converter-upload-card').classList.remove('hidden');
    document.getElementById('converter-workspace-area').classList.add('hidden');
    document.getElementById('converter-file-list').innerHTML = '';
}

function convertAllImages() {
    if (!state.converterFiles.length) return;
    showToast('Mengonversi semua gambar...');

    const prefix = document.getElementById('batch-filename-prefix').value.trim();

    state.converterFiles.forEach((item, index) => {
        const img = new Image();
        img.src = item.dataUrl;
        img.onload = function() {
            const canvas = document.createElement('canvas');
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext('2d');

            if (item.targetFormat === 'JPG' || item.targetFormat === 'JPEG') {
                const bgColor = document.getElementById('converter-bg-color').value || 'white';
                ctx.fillStyle = bgColor;
                ctx.fillRect(0, 0, canvas.width, canvas.height);
            }

            ctx.drawImage(img, 0, 0);

            let mimeType = 'image/jpeg';
            if (item.targetFormat === 'PNG') mimeType = 'image/png';
            if (item.targetFormat === 'WEBP') mimeType = 'image/webp';

            const quality = state.converterQuality / 100;
            const resultUrl = canvas.toDataURL(mimeType, quality);

            const nameWithoutExt = item.originalName.substring(0, item.originalName.lastIndexOf('.')) || item.originalName;
            const finalName = prefix ? `${prefix}_${index + 1}` : nameWithoutExt;

            const link = document.createElement('a');
            link.download = `${finalName}.${item.targetFormat.toLowerCase()}`;
            link.href = resultUrl;
            link.click();
        };
    });

    showToast('Konversi selesai! File diunduh otomatis.');
}

/* =================================================================== */
/* redPDF TOOLS LOGIC */
/* =================================================================== */

/* Shared "Nama File Output" field used by every redPDF tool, so the user
   can type their own filename before exporting (image-to-pdf, pdf-to-image,
   merge-pdf, split-pdf, compress-pdf all read from the same #pdf-output-filename
   input via getPdfOutputFilename()). */
function pdfFilenameFieldHTML(defaultValue) {
    return `
        <div>
            <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Nama File Output</label>
            <input type="text" id="pdf-output-filename" value="${defaultValue}" placeholder="Isi nama file..." class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-semibold focus:outline-none focus:border-red-600">
        </div>
    `;
}

// Strips characters that are invalid in filenames on common OSes and trims
// stray spaces/dots, so a name typed by the user never produces a broken download.
function sanitizeFilenameBase(name) {
    return (name || '').replace(/[\\/:*?"<>|]/g, '').replace(/\.+$/, '').trim();
}

function getPdfOutputFilename(defaultBase) {
    const input = document.getElementById('pdf-output-filename');
    const cleaned = input ? sanitizeFilenameBase(input.value) : '';
    return cleaned || defaultBase;
}

// image-to-pdf's page size/orientation selects existed in the UI but were
// never actually read - addPage() always hardcoded A4. This reads them so
// "Letter" and "Landscape" actually take effect.
function getPdfPageDimensions() {
    const sizeKey = document.getElementById('pdf-page-size')?.value || 'A4';
    const orientation = document.getElementById('pdf-orientation')?.value || 'portrait';
    const sizes = {
        A4: { w: 595.28, h: 841.89 },
        LETTER: { w: 612, h: 792 }
    };
    const base = sizes[sizeKey] || sizes.A4;
    return orientation === 'landscape' ? { w: base.h, h: base.w } : { w: base.w, h: base.h };
}

function selectPdfTool(toolKey) {
    state.activePdfTool = toolKey;
    switchMainView('pdf');

    const titleMap = {
        'image-to-pdf': 'Image to PDF Converter',
        'pdf-to-image': 'PDF to Image Extractor',
        'merge-pdf': 'Merge Multiple PDF Files',
        'split-pdf': 'Split & Extract PDF Pages',
        'compress-pdf': 'Compress PDF File Size'
    };

    const descMap = {
        'image-to-pdf': 'Gabungkan foto (JPG, PNG, WEBP, GIF, BMP, AVIF, dll) menjadi 1 file dokumen PDF.',
        'pdf-to-image': 'Ekstrak setiap halaman PDF menjadi gambar kualitas tinggi.',
        'merge-pdf': 'Gabungkan dua atau lebih file PDF menjadi satu file lengkap.',
        'split-pdf': 'Pisahkan halaman tertentu dari file PDF Anda.',
        'compress-pdf': 'Kecilkan ukuran file PDF untuk menghemat penyimpanan.'
    };

    document.getElementById('pdf-tool-title').innerText = titleMap[toolKey] || 'redPDF Tool';
    document.getElementById('pdf-tool-description').innerText = descMap[toolKey] || '';

    // The shared file input's accept filter depends on the tool: image-to-pdf
    // needs image files, every other redPDF tool needs actual PDF files.
    const fileInput = document.getElementById('pdf-file-input');
    const uploadHint = document.getElementById('pdf-upload-hint');
    if (toolKey === 'image-to-pdf') {
        fileInput.setAttribute('accept', 'image/*');
        if (uploadHint) uploadHint.innerText = 'Pilih satu atau beberapa file gambar dari perangkat Anda';
    } else {
        fileInput.setAttribute('accept', 'application/pdf,.pdf');
        if (uploadHint) uploadHint.innerText = 'Pilih file PDF dari perangkat Anda';
    }

    // Switching tools invalidates the previous selection/results (different tools need
    // different numbers of files: single-file vs multi-file for Merge PDF).
    state.pdfFiles = [];
    state.pdfRenderedPages = [];
    document.getElementById('pdf-upload-card').classList.remove('hidden');
    document.getElementById('pdf-workspace-area').classList.add('hidden');
    document.getElementById('pdf-files-preview-container').innerHTML = '';
    document.getElementById('pdf-results-panel').classList.add('hidden');
    document.getElementById('pdf-results-panel').innerHTML = '';
    document.getElementById('pdf-processing-status').classList.add('hidden');

    renderPdfConfigPanel();
}

function triggerPdfFileInput() {
    document.getElementById('pdf-file-input').click();
}

function handlePdfFilesSelected(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    const wantsImages = state.activePdfTool === 'image-to-pdf';
    const isPdfFile = f => f.type === 'application/pdf' || f.name.toLowerCase().endsWith('.pdf');
    const isImageFile = f => f.type.startsWith('image/') || /\.(png|jpe?g|webp|gif|bmp|avif|svg|ico|tiff?)$/i.test(f.name);

    const matching = files.filter(wantsImages ? isImageFile : isPdfFile);
    const rejected = files.length - matching.length;

    if (rejected) {
        showToast(`${rejected} file dilewati (${wantsImages ? 'bukan file gambar' : 'bukan file PDF'}).`);
    }
    if (!matching.length) {
        e.target.value = '';
        return;
    }

    // Single-file tools replace the selection; Merge PDF and Image to PDF accumulate files
    if (state.activePdfTool === 'merge-pdf' || state.activePdfTool === 'image-to-pdf') {
        state.pdfFiles = state.pdfFiles.concat(matching);
    } else {
        state.pdfFiles = matching;
    }

    document.getElementById('pdf-upload-card').classList.add('hidden');
    document.getElementById('pdf-workspace-area').classList.remove('hidden');
    document.getElementById('pdf-results-panel').classList.add('hidden');
    document.getElementById('pdf-results-panel').innerHTML = '';
    document.getElementById('pdf-processing-status').classList.add('hidden');
    e.target.value = '';

    renderPdfFilesPreview();
    showToast(`${matching.length} file ${wantsImages ? 'gambar' : 'PDF'} ditambahkan.`);
}

function removePdfFile(index) {
    state.pdfFiles.splice(index, 1);
    if (!state.pdfFiles.length) {
        clearAllPdfFiles();
        return;
    }
    renderPdfFilesPreview();
}

function clearAllPdfFiles() {
    state.pdfFiles = [];
    state.pdfRenderedPages = [];
    document.getElementById('pdf-upload-card').classList.remove('hidden');
    document.getElementById('pdf-workspace-area').classList.add('hidden');
    document.getElementById('pdf-files-preview-container').innerHTML = '';
    document.getElementById('pdf-results-panel').classList.add('hidden');
    document.getElementById('pdf-results-panel').innerHTML = '';
    document.getElementById('pdf-processing-status').classList.add('hidden');
}

function renderPdfConfigPanel() {
    const panel = document.getElementById('pdf-config-panel');
    panel.innerHTML = '';

    if (state.activePdfTool === 'image-to-pdf') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('Tools_Hasil')}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Ukuran Halaman PDF</label>
                    <select id="pdf-page-size" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                        <option value="A4">A4 (Standard)</option>
                        <option value="LETTER">Letter</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Orientasi</label>
                    <select id="pdf-orientation" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                        <option value="portrait">Portrait (Tegak)</option>
                        <option value="landscape">Landscape (Mendatar)</option>
                    </select>
                </div>
            </div>
            <div>
                <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Kualitas & Ukuran Gambar</label>
                <select id="pdf-image-quality-level" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                    <option value="low">Ringan (ukuran PDF paling kecil)</option>
                    <option value="medium" selected>Sedang (seimbang) &mdash; direkomendasikan</option>
                    <option value="high">Tinggi (kualitas terbaik, ukuran lebih besar)</option>
                </select>
                <p class="text-[11px] text-gray-500 mt-1">Setiap gambar otomatis dipadatkan jadi JPEG dan disesuaikan resolusinya dengan ukuran halaman, supaya file PDF tidak membengkak.</p>
            </div>
        `;
    } else if (state.activePdfTool === 'split-pdf') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('Tools_Split')}
            <div>
                <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Rentang Halaman (Misal: 1-3, 5)</label>
                <input type="text" id="pdf-split-range" value="1" placeholder="Contoh: 1-2, 5" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                <p class="text-[11px] text-gray-500 mt-1">Halaman di luar jumlah halaman PDF akan ditolak dengan pesan error (tidak ada halaman kosong yang dibuat).</p>
            </div>
        `;
    } else if (state.activePdfTool === 'pdf-to-image') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('Tools_PDF_to_Image')}
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Format Gambar</label>
                    <select id="pdf-to-image-format" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                        <option value="image/png">PNG (Lossless)</option>
                        <option value="image/jpeg" selected>JPG / JPEG</option>
                        <option value="image/webp">WEBP</option>
                    </select>
                </div>
                <div>
                    <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Resolusi Render</label>
                    <select id="pdf-to-image-scale" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                        <option value="1">1x (Cepat)</option>
                        <option value="2" selected>2x (Direkomendasikan)</option>
                        <option value="3">3x (Kualitas Tinggi)</option>
                    </select>
                </div>
            </div>
            <div>
                <div class="flex justify-between text-xs font-semibold text-gray-600 dark:text-zinc-300 mb-1">
                    <span>Kualitas (untuk JPG/WEBP)</span>
                    <span id="pdf-to-image-quality-val">90%</span>
                </div>
                <input type="range" id="pdf-to-image-quality" min="30" max="100" value="90" oninput="document.getElementById('pdf-to-image-quality-val').innerText = this.value + '%'" class="w-full accent-red-600 h-2 bg-gray-200 dark:bg-zinc-700 rounded-lg">
            </div>
        `;
    } else if (state.activePdfTool === 'compress-pdf') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('Tools_Compressed')}
            <div>
                <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Tingkat Kompresi</label>
                <select id="pdf-compress-level" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                    <option value="low">Ringan (kualitas tinggi, ukuran turun sedikit)</option>
                    <option value="medium" selected>Sedang (seimbang)</option>
                    <option value="high">Kuat (ukuran turun banyak, kualitas turun)</option>
                </select>
                <p class="text-[11px] text-gray-500 mt-1">
                    Setiap halaman dirender ulang lalu dipadatkan sebagai gambar JPEG di dalam PDF baru. Cocok untuk PDF hasil scan/berisi gambar besar. PDF berbasis teks murni mungkin tidak banyak mengecil dan teksnya tidak lagi bisa diseleksi setelah kompresi &mdash; unduh hanya jika hasil ukurannya memang lebih kecil.
                </p>
            </div>
        `;
    } else if (state.activePdfTool === 'merge-pdf') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('Tools_Merged')}
            <p class="text-[11px] text-gray-500">File akan digabungkan sesuai urutan pada daftar di bawah. Gunakan "Tambah File" untuk menambah lebih banyak PDF.</p>
        `;
    } else {
        panel.innerHTML = `${pdfFilenameFieldHTML('Tools_Hasil')}`;
    }
}

function renderPdfFilesPreview() {
    const container = document.getElementById('pdf-files-preview-container');
    const countLabel = document.getElementById('pdf-files-count-label');
    container.innerHTML = '';

    if (countLabel) {
        const totalKb = state.pdfFiles.reduce((sum, f) => sum + f.size, 0) / 1024;
        countLabel.innerText = `${state.pdfFiles.length} file dipilih \u2022 ${totalKb.toFixed(1)} KB total`;
    }

    const isImageMode = state.activePdfTool === 'image-to-pdf';

    state.pdfFiles.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between gap-2';

        if (isImageMode) {
            const previewUrl = URL.createObjectURL(file);
            card.innerHTML = `
                <div class="flex items-center space-x-3 overflow-hidden">
                    <img src="${previewUrl}" class="w-12 h-12 object-cover rounded-lg border border-gray-200 dark:border-zinc-700 shrink-0" alt="${file.name}">
                    <div class="truncate">
                        <span class="text-[10px] font-bold text-red-600 bg-red-50 dark:bg-red-950/40 px-1.5 py-0.5 rounded">Hal. ${index + 1}</span>
                        <h4 class="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">${file.name}</h4>
                        <p class="text-[10px] text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                </div>
                <button onclick="removePdfFile(${index})" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs shrink-0" title="Hapus file ini">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        } else {
            card.innerHTML = `
                <div class="flex items-center space-x-3 overflow-hidden">
                    <div class="p-3 bg-red-100 text-red-600 rounded-xl shrink-0">
                        <i class="fa-solid fa-file-pdf text-lg"></i>
                    </div>
                    <div class="truncate">
                        <h4 class="text-xs font-bold text-gray-800 dark:text-zinc-100 truncate">${file.name}</h4>
                        <p class="text-[10px] text-gray-500">${(file.size / 1024).toFixed(1)} KB</p>
                    </div>
                </div>
                <button onclick="removePdfFile(${index})" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs shrink-0" title="Hapus file ini">
                    <i class="fa-solid fa-trash"></i>
                </button>
            `;
        }
        container.appendChild(card);
    });

    if (isImageMode && state.pdfFiles.length > 1) {
        const hint = document.createElement('div');
        hint.className = 'sm:col-span-2 lg:col-span-3 text-xs text-gray-500 dark:text-zinc-400 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl p-3';
        hint.innerHTML = '<i class="fa-solid fa-circle-info text-red-500"></i> Halaman PDF dibuat sesuai urutan file di atas (Hal. 1, 2, 3, ...). Hapus lalu tambahkan ulang jika ingin mengubah urutan.';
        container.appendChild(hint);
    }

    if (state.activePdfTool === 'merge-pdf' && state.pdfFiles.length < 2) {
        const hint = document.createElement('div');
        hint.className = 'sm:col-span-2 lg:col-span-3 text-xs text-amber-600 dark:text-amber-400 font-semibold bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900 rounded-xl p-3';
        hint.innerHTML = '<i class="fa-solid fa-circle-info"></i> Merge PDF membutuhkan minimal 2 file PDF. Klik "Tambah File" untuk menambahkan lebih banyak.';
        container.appendChild(hint);
    }
}

/* NOTE: image-to-pdf stays inline here (kept exactly as before, it already worked).
   pdf-to-image, merge-pdf, split-pdf and compress-pdf used to just show a fake
   "success" toast without doing anything - real implementations now live in
   assets/pdf-tools.js and are invoked below. See setPdfProcessingStatus() /
   showPdfResults() in that file for the shared status + result UI. */
async function executePdfTool() {
    if (!state.pdfFiles.length) {
        showToast('Upload file terlebih dahulu!');
        return;
    }

    const resultsPanel = document.getElementById('pdf-results-panel');
    resultsPanel.classList.add('hidden');
    resultsPanel.innerHTML = '';

    try {
        if (state.activePdfTool === 'image-to-pdf') {
            const { w: PAGE_W, h: PAGE_H } = getPdfPageDimensions(); // PDF points
            const outputFilename = getPdfOutputFilename('Tools_Hasil');

            // Quality level controls both the JPEG compression and the max pixel
            // resolution each image is downscaled to before being embedded - this
            // is what keeps the output PDF from becoming huge when photos straight
            // from a phone camera (often 3000-4000px+) are used.
            const qualityLevel = document.getElementById('pdf-image-quality-level')?.value || 'medium';
            const qualitySettings = {
                low: { dpi: 96, jpegQuality: 0.6 },
                medium: { dpi: 150, jpegQuality: 0.75 },
                high: { dpi: 220, jpegQuality: 0.88 }
            }[qualityLevel] || { dpi: 150, jpegQuality: 0.75 };
            // Cap resolution based on the page's longer side (in inches) at the chosen DPI -
            // no point embedding pixels far beyond what the printed/viewed page can show.
            const maxDimensionPx = Math.round((Math.max(PAGE_W, PAGE_H) / 72) * qualitySettings.dpi);

            const pdfDoc = await PDFLib.PDFDocument.create();
            let addedCount = 0;
            const skipped = [];

            for (const file of state.pdfFiles) {
                setPdfProcessingStatus(`Memproses ${file.name}...`);
                let imgData;
                try {
                    // pdf-lib can only embed PNG/JPG directly, but we want to accept
                    // ANY format the browser can decode (WEBP, GIF, BMP, AVIF, SVG, ...).
                    // So we draw the image onto a canvas, downscale it to a sensible
                    // print/view resolution, and re-encode as compressed JPEG - this
                    // normalizes every supported format AND keeps file size in check,
                    // using the browser's own real image decoder (no fake conversion).
                    imgData = await loadImageAsJpegBytesForPdf(file, maxDimensionPx, qualitySettings.jpegQuality);
                } catch (err) {
                    console.error(`Gagal memuat ${file.name}:`, err);
                    skipped.push(file.name);
                    continue;
                }

                const embeddedImg = await pdfDoc.embedJpg(imgData.jpegBytes);

                // Fit the image inside the page keeping its aspect ratio (centered),
                // instead of stretching it to fill the page which would distort any
                // image that isn't already in the same ratio as the page.
                const scale = Math.min(PAGE_W / embeddedImg.width, PAGE_H / embeddedImg.height);
                const w = embeddedImg.width * scale;
                const h = embeddedImg.height * scale;
                const x = (PAGE_W - w) / 2;
                const y = (PAGE_H - h) / 2;

                const page = pdfDoc.addPage([PAGE_W, PAGE_H]);
                page.drawImage(embeddedImg, { x, y, width: w, height: h });
                addedCount++;
            }

            if (addedCount === 0) {
                setPdfProcessingStatus(null);
                showToast('Tidak ada gambar yang berhasil diproses. Formatnya mungkin tidak didukung oleh browser Anda.');
                return;
            }

            setPdfProcessingStatus('Menulis file PDF...');
            const pdfBytes = await pdfDoc.save();
            setPdfProcessingStatus(null);
            downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), `${outputFilename}.pdf`);

            if (skipped.length) {
                showToast(`PDF dibuat dari ${addedCount} gambar. ${skipped.length} file dilewati (gagal dibaca): ${skipped.join(', ')}`);
            } else {
                showToast(`PDF berhasil dibuat dari ${addedCount} gambar!`);
            }

            showPdfResults(pdfResultHeader(
                'Image to PDF Selesai',
                pdfStatItem('Jumlah Halaman', addedCount) +
                pdfStatItem('File Dilewati', skipped.length) +
                pdfStatItem('Ukuran File', formatBytes(pdfBytes.byteLength)) +
                pdfStatItem('Output', `${outputFilename}.pdf`)
            ));
        } else if (state.activePdfTool === 'pdf-to-image') {
            await realExecutePdfToImage();
        } else if (state.activePdfTool === 'merge-pdf') {
            await realExecuteMergePdf();
        } else if (state.activePdfTool === 'split-pdf') {
            await realExecuteSplitPdf();
        } else if (state.activePdfTool === 'compress-pdf') {
            await realExecuteCompressPdf();
        } else {
            showToast('Tool PDF ini belum dikenali.');
        }
    } catch (err) {
        setPdfProcessingStatus(null);
        console.error(err);
        showToast(`Gagal memproses file PDF: ${err.message || err}`);
    }
}

function downloadBlob(blob, filename) {
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = filename;
    link.click();
}

function showToast(msg) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'bg-zinc-900 text-white dark:bg-white dark:text-zinc-900 text-xs font-semibold px-4 py-3 rounded-xl shadow-2xl flex items-center space-x-2 transition-all duration-300 pointer-events-auto border border-zinc-700';
    toast.innerHTML = `<i class="fa-solid fa-circle-check text-green-500 text-sm"></i><span>${msg}</span>`;
    container.appendChild(toast);

    setTimeout(() => {
        toast.classList.add('opacity-0', 'translate-y-2');
        setTimeout(() => toast.remove(), 300);
    }, 3000);
}
