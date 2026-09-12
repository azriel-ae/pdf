/* =====================================================================
   RedPixel Studio & redPDF Tools - Main Application Logic
   Handles Photo Studio (crop/adjust/text/print), Image Converter,
   and redPDF Tools (image<->pdf, merge, split, compress).
   No functional changes were made here — this is the same logic that
   previously lived inline inside index.html, only moved to its own file.
   ===================================================================== */

/* =================================================================== */
/* GLOBAL APPLICATION STATE */
/* =================================================================== */
let state = {
    mainView: 'photo',
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
};

/* =================================================================== */
/* VIEW SWITCHER & NAVIGATION */
/* =================================================================== */
function switchMainView(view) {
    state.mainView = view;
    document.getElementById('main-view-photo').classList.add('hidden');
    document.getElementById('main-view-converter').classList.add('hidden');
    document.getElementById('main-view-pdf').classList.add('hidden');
    document.getElementById('main-view-excel').classList.add('hidden');

    if (view === 'photo') {
        document.getElementById('main-view-photo').classList.remove('hidden');
    } else if (view === 'converter') {
        document.getElementById('main-view-converter').classList.remove('hidden');
    } else if (view === 'pdf') {
        document.getElementById('main-view-pdf').classList.remove('hidden');
    } else if (view === 'excel') {
        document.getElementById('main-view-excel').classList.remove('hidden');
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
/* PHOTO STUDIO & CROPPER LOGIC */
/* =================================================================== */
function triggerFileInput() {
    document.getElementById('image-file-input').click();
}

function handleFileSelect(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(evt) {
        const imgData = evt.target.result;
        state.currentImageSrc = imgData;
        state.originalImageSrc = imgData;

        document.getElementById('drag-drop-zone').classList.add('hidden');
        document.getElementById('cropper-container').classList.remove('hidden');

        loadCropper(imgData);
        showToast('Gambar berhasil diunggah!');
    };
    reader.readAsDataURL(file);
}

function loadCropper(src) {
    const img = document.getElementById('cropper-image');
    img.src = src;

    if (state.cropper) {
        state.cropper.destroy();
    }

    state.cropper = new Cropper(img, {
        aspectRatio: NaN,
        viewMode: 1,
        background: false,
        autoCropArea: 0.9,
        responsive: true
    });
}

function setCropRatio(ratio) {
    if (state.cropper) {
        state.cropper.setAspectRatio(ratio);
    }
}

function applyCrop() {
    if (!state.cropper) {
        showToast('Pilih foto terlebih dahulu!');
        return;
    }
    const croppedCanvas = state.cropper.getCroppedCanvas({
        imageSmoothingEnabled: true,
        imageSmoothingQuality: 'high',
    });
    if (!croppedCanvas) return;

    state.currentImageSrc = croppedCanvas.toDataURL('image/jpeg', 0.95);
    resetFilterSliders();
    loadCropper(state.currentImageSrc);

    // Directly switch to A4 print preview with cropped edited image
    switchView('print');
    updatePrintAreaPreview();
    showToast('Foto berhasil dipotong! Dialihkan ke Lembar Cetak A4.');
}

function initFabricCanvas() {
    state.fabricCanvas = new fabric.Canvas('fabric-canvas', {
        width: 600,
        height: 400,
        backgroundColor: '#ffffff'
    });
}

function addTextToCanvas() {
    if (state.cropper) {
        syncActiveEdits();
    }

    switchView('editor');
    document.getElementById('cropper-container').classList.add('hidden');
    document.getElementById('fabric-container').classList.remove('hidden');

    const txtVal = document.getElementById('text-input').value || 'RedPixel';
    const colorVal = document.getElementById('text-color').value || '#ffffff';

    fabric.Image.fromURL(state.currentImageSrc, function(oImg) {
        state.fabricCanvas.clear();
        state.fabricCanvas.setWidth(oImg.width);
        state.fabricCanvas.setHeight(oImg.height);
        state.fabricCanvas.setBackgroundImage(oImg, state.fabricCanvas.renderAll.bind(state.fabricCanvas));

        const text = new fabric.Text(txtVal, {
            left: oImg.width / 4,
            top: oImg.height / 2,
            fontSize: Math.max(24, Math.round(oImg.width / 20)),
            fill: colorVal,
            fontFamily: 'Inter'
        });

        state.fabricCanvas.add(text);
        state.fabricCanvas.setActiveObject(text);
        showToast('Teks berhasil ditambahkan!');
    });
}

function syncActiveEdits() {
    if (!document.getElementById('fabric-container').classList.contains('hidden') && state.fabricCanvas) {
        state.currentImageSrc = state.fabricCanvas.toDataURL({ format: 'png', quality: 1 });
    } else {
        const b = parseInt(document.getElementById('slider-brightness')?.value || 0);
        const c = parseInt(document.getElementById('slider-contrast')?.value || 0);
        const s = parseInt(document.getElementById('slider-saturate')?.value || 0);

        if (b !== 0 || c !== 0 || s !== 0) {
            bakeFilterToImageData();
        }
    }
}

function updateFilter() {
    if (!state.currentImageSrc) return;
    const b = document.getElementById('slider-brightness').value;
    const c = document.getElementById('slider-contrast').value;
    const s = document.getElementById('slider-saturate').value;

    document.getElementById('val-brightness').innerText = `${b}%`;
    document.getElementById('val-contrast').innerText = `${c}%`;
    document.getElementById('val-saturate').innerText = `${s}%`;

    const img = document.getElementById('cropper-image');
    if (img) {
        img.style.filter = `brightness(${100 + parseInt(b)}%) contrast(${100 + parseInt(c)}%) saturate(${100 + parseInt(s)}%)`;
    }
}

function bakeFilterToImageData() {
    if (!state.currentImageSrc) return;
    const img = new Image();
    img.src = state.currentImageSrc;
    const canvas = document.createElement('canvas');
    canvas.width = img.width || 800;
    canvas.height = img.height || 600;
    const ctx = canvas.getContext('2d');

    const b = document.getElementById('slider-brightness').value;
    const c = document.getElementById('slider-contrast').value;
    const s = document.getElementById('slider-saturate').value;

    ctx.filter = `brightness(${100 + parseInt(b)}%) contrast(${100 + parseInt(c)}%) saturate(${100 + parseInt(s)}%)`;
    ctx.drawImage(img, 0, 0);

    state.currentImageSrc = canvas.toDataURL('image/jpeg', 0.95);
}

function applyFilterToImage() {
    if (!state.currentImageSrc) return;
    bakeFilterToImageData();
    resetFilterSliders();
    loadCropper(state.currentImageSrc);
    showToast('Filter berhasil disimpan!');
}

function resetFilterSliders() {
    document.getElementById('slider-brightness').value = 0;
    document.getElementById('slider-contrast').value = 0;
    document.getElementById('slider-saturate').value = 0;
    document.getElementById('val-brightness').innerText = '0%';
    document.getElementById('val-contrast').innerText = '0%';
    document.getElementById('val-saturate').innerText = '0%';
    const img = document.getElementById('cropper-image');
    if (img) img.style.filter = 'none';
}

function switchTab(tab) {
    state.activeTab = tab;
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-red-600', 'bg-red-50', 'dark:bg-red-950/40', 'dark:text-red-400');
        btn.classList.add('text-gray-500');
    });
    document.getElementById(`tab-${tab}`).classList.add('text-red-600', 'bg-red-50', 'dark:bg-red-950/40', 'dark:text-red-400');

    document.querySelectorAll('.tab-panel').forEach(p => p.classList.add('hidden'));
    document.getElementById(`panel-${tab}`).classList.remove('hidden');

    if (tab === 'print-setup') {
        switchView('print');
    }
}

function switchView(view) {
    state.activeView = view;
    const editorSpace = document.getElementById('editor-workspace');
    const printSpace = document.getElementById('print-workspace');
    const btnEditor = document.getElementById('view-btn-editor');
    const btnPrint = document.getElementById('view-btn-print');

    if (view === 'editor') {
        editorSpace.classList.remove('hidden');
        printSpace.classList.add('hidden');
        btnEditor.className = 'px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-sm';
        btnPrint.className = 'px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-100';
    } else {
        syncActiveEdits();
        editorSpace.classList.add('hidden');
        printSpace.classList.remove('hidden');
        btnPrint.className = 'px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold bg-red-600 text-white shadow-sm';
        btnEditor.className = 'px-3 sm:px-4 py-1.5 rounded-xl text-xs font-bold text-gray-600 dark:text-zinc-300 hover:bg-gray-100';
        updatePrintAreaPreview();
    }
}

/* =================================================================== */
/* PRINT PREVIEW & CETAK (1 HALAMAN FULL A4 UNCROPPED EDITED PHOTO) */
/* =================================================================== */
function updatePrintAreaPreview() {
    syncActiveEdits();

    const printGrid = document.getElementById('print-grid');
    printGrid.innerHTML = '';

    if (!state.currentImageSrc) {
        printGrid.innerHTML = '<p class="text-xs text-gray-400 font-medium p-4 text-center">Belum ada foto hasil edit yang dimuat.</p>';
        return;
    }

    const sizeMode = document.getElementById('print-photo-size').value;
    const fullPageOptions = document.getElementById('print-full-page-options');

    if (sizeMode === 'fit') {
        if (fullPageOptions) fullPageOptions.classList.remove('hidden');

        const orientation = document.getElementById('print-orientation')?.value || 'portrait';
        const scaleMode = document.getElementById('print-scale-mode')?.value || 'fit';

        // A4 physical dimensions swap between portrait/landscape
        const printArea = document.getElementById('print-area');
        if (orientation === 'landscape') {
            printArea.style.width = '297mm';
            printArea.style.height = '210mm';
            printArea.style.minHeight = '210mm';
            printArea.style.maxHeight = '210mm';
        } else {
            printArea.style.width = '210mm';
            printArea.style.height = '297mm';
            printArea.style.minHeight = '297mm';
            printArea.style.maxHeight = '297mm';
        }

        // Full Page A4 Mode - Using user's edited photo uncropped
        const wrapper = document.createElement('div');
        wrapper.className = 'w-full h-full flex items-center justify-center p-0 m-0 overflow-hidden';

        const img = document.createElement('img');
        img.src = state.currentImageSrc;
        img.className = `print-full-page-img w-full h-full ${scaleMode === 'fill' ? 'object-cover' : 'object-contain'}`;
        img.alt = 'Foto Hasil Edit Full A4';

        wrapper.appendChild(img);
        printGrid.appendChild(wrapper);
    } else {
        if (fullPageOptions) fullPageOptions.classList.add('hidden');
        // Pasfoto grid is always plain A4 portrait
        const printArea = document.getElementById('print-area');
        printArea.style.width = '210mm';
        printArea.style.height = '297mm';
        printArea.style.minHeight = '297mm';
        printArea.style.maxHeight = '297mm';
        // Pasfoto Grid Mode
        let count = 12;
        let widthMm = 30;
        let heightMm = 40;

        if (sizeMode === '4x6') {
            count = 8;
            widthMm = 40;
            heightMm = 60;
        } else if (sizeMode === '2x3') {
            count = 18;
            widthMm = 20;
            heightMm = 30;
        }

        const gridWrapper = document.createElement('div');
        gridWrapper.className = 'flex flex-wrap gap-3 justify-center items-center w-full h-full p-4';

        for (let i = 0; i < count; i++) {
            const card = document.createElement('div');
            card.style.width = `${widthMm}mm`;
            card.style.height = `${heightMm}mm`;
            card.className = 'border border-gray-300 overflow-hidden bg-white shadow-sm flex-shrink-0';

            const img = document.createElement('img');
            img.src = state.currentImageSrc;
            img.className = 'w-full h-full object-cover';
            card.appendChild(img);
            gridWrapper.appendChild(card);
        }
        printGrid.appendChild(gridWrapper);
    }
}

function handleDirectPrint() {
    if (!state.currentImageSrc) {
        showToast('Silakan upload atau pilih foto terlebih dahulu sebelum mencetak!');
        return;
    }

    syncActiveEdits();
    switchView('print');
    updatePrintAreaPreview();

    // @page size is static CSS by default (A4 portrait); when the user picks
    // Landscape we swap it in for this print job via an injected <style> tag,
    // since @page can't read a JS variable directly.
    const sizeMode = document.getElementById('print-photo-size').value;
    const orientation = sizeMode === 'fit' ? (document.getElementById('print-orientation')?.value || 'portrait') : 'portrait';

    let orientationStyle = document.getElementById('dynamic-print-orientation-style');
    if (!orientationStyle) {
        orientationStyle = document.createElement('style');
        orientationStyle.id = 'dynamic-print-orientation-style';
        document.head.appendChild(orientationStyle);
    }
    orientationStyle.innerHTML = orientation === 'landscape'
        ? '@page { size: A4 landscape; margin: 0; }'
        : '@page { size: A4 portrait; margin: 0; }';

    showToast('Menyiapkan dokumen cetak A4...');

    setTimeout(() => {
        window.print();
    }, 300);
}

function downloadEditedPhoto() {
    syncActiveEdits();
    if (!state.currentImageSrc) {
        showToast('Tidak ada gambar untuk diunduh!');
        return;
    }

    const filename = (document.getElementById('photo-filename-input').value || 'Foto_RedPixel').trim();
    const format = document.getElementById('photo-format-select').value || 'jpg';

    const link = document.createElement('a');
    link.download = `${filename}.${format}`;
    link.href = state.currentImageSrc;
    link.click();
    showToast('Download foto berhasil dimulai!');
}

function resetToHomeScreen() {
    state.currentImageSrc = null;
    state.originalImageSrc = null;

    if (state.cropper) {
        state.cropper.destroy();
        state.cropper = null;
    }

    document.getElementById('drag-drop-zone').classList.remove('hidden');
    document.getElementById('cropper-container').classList.add('hidden');
    document.getElementById('fabric-container').classList.add('hidden');

    switchView('editor');
    showToast('Siap untuk foto baru!');
}

function resetImageOriginal() {
    if (!state.originalImageSrc) return;
    state.currentImageSrc = state.originalImageSrc;
    resetFilterSliders();
    loadCropper(state.currentImageSrc);
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
            ${pdfFilenameFieldHTML('RedPixel_Hasil')}
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
            ${pdfFilenameFieldHTML('RedPixel_Split')}
            <div>
                <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Rentang Halaman (Misal: 1-3, 5)</label>
                <input type="text" id="pdf-split-range" value="1" placeholder="Contoh: 1-2, 5" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                <p class="text-[11px] text-gray-500 mt-1">Halaman di luar jumlah halaman PDF akan ditolak dengan pesan error (tidak ada halaman kosong yang dibuat).</p>
            </div>
        `;
    } else if (state.activePdfTool === 'pdf-to-image') {
        panel.innerHTML = `
            ${pdfFilenameFieldHTML('RedPixel_PDF_to_Image')}
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
            ${pdfFilenameFieldHTML('RedPixel_Compressed')}
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
            ${pdfFilenameFieldHTML('RedPixel_Merged')}
            <p class="text-[11px] text-gray-500">File akan digabungkan sesuai urutan pada daftar di bawah. Gunakan "Tambah File" untuk menambah lebih banyak PDF.</p>
        `;
    } else {
        panel.innerHTML = `${pdfFilenameFieldHTML('RedPixel_Hasil')}`;
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
            const outputFilename = getPdfOutputFilename('RedPixel_Hasil');

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
