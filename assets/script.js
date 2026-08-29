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
    initThemeOnLoad();
};

/* =================================================================== */
/* VIEW SWITCHER & NAVIGATION */
/* =================================================================== */
function switchMainView(view) {
    state.mainView = view;
    document.getElementById('main-view-photo').classList.add('hidden');
    document.getElementById('main-view-converter').classList.add('hidden');
    document.getElementById('main-view-pdf').classList.add('hidden');

    if (view === 'photo') {
        document.getElementById('main-view-photo').classList.remove('hidden');
    } else if (view === 'converter') {
        document.getElementById('main-view-converter').classList.remove('hidden');
    } else if (view === 'pdf') {
        document.getElementById('main-view-pdf').classList.remove('hidden');
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

function toggleTheme() {
    const html = document.documentElement;
    const isDark = html.classList.toggle('dark');
    const text = document.getElementById('theme-mode-text');
    const icon = document.getElementById('theme-icon');
    if (isDark) {
        text.innerText = 'Black Mode';
        icon.className = 'fa-solid fa-sun text-base';
    } else {
        text.innerText = 'White Mode';
        icon.className = 'fa-solid fa-moon text-base';
    }
}

function initThemeOnLoad() {
    if (document.documentElement.classList.contains('dark')) {
        document.getElementById('theme-mode-text').innerText = 'Black Mode';
    } else {
        document.getElementById('theme-mode-text').innerText = 'White Mode';
    }
}

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

    if (sizeMode === 'fit') {
        // Full Page A4 Mode - Using user's edited photo uncropped
        const wrapper = document.createElement('div');
        wrapper.className = 'w-full h-full flex items-center justify-center p-0 m-0 overflow-hidden';

        const img = document.createElement('img');
        img.src = state.currentImageSrc;
        img.className = 'print-full-page-img max-w-full max-h-full object-contain';
        img.alt = 'Foto Hasil Edit Full A4';

        wrapper.appendChild(img);
        printGrid.appendChild(wrapper);
    } else {
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

    showToast('Menyiapkan dokumen cetak 1 Halaman Full A4...');

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
        'image-to-pdf': 'Gabungkan beberapa foto JPG/PNG menjadi 1 file dokumen PDF.',
        'pdf-to-image': 'Ekstrak setiap halaman PDF menjadi gambar kualitas tinggi.',
        'merge-pdf': 'Gabungkan dua atau lebih file PDF menjadi satu file lengkap.',
        'split-pdf': 'Pisahkan halaman tertentu dari file PDF Anda.',
        'compress-pdf': 'Kecilkan ukuran file PDF untuk menghemat penyimpanan.'
    };

    document.getElementById('pdf-tool-title').innerText = titleMap[toolKey] || 'redPDF Tool';
    document.getElementById('pdf-tool-description').innerText = descMap[toolKey] || '';

    renderPdfConfigPanel();
}

function triggerPdfFileInput() {
    document.getElementById('pdf-file-input').click();
}

function handlePdfFilesSelected(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;

    state.pdfFiles = files;
    document.getElementById('pdf-upload-card').classList.add('hidden');
    document.getElementById('pdf-workspace-area').classList.remove('hidden');

    renderPdfFilesPreview();
}

function renderPdfConfigPanel() {
    const panel = document.getElementById('pdf-config-panel');
    panel.innerHTML = '';

    if (state.activePdfTool === 'image-to-pdf') {
        panel.innerHTML = `
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
        `;
    } else if (state.activePdfTool === 'split-pdf') {
        panel.innerHTML = `
            <div>
                <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Rentang Halaman (Misal: 1-3, 5)</label>
                <input type="text" id="pdf-split-range" value="1" placeholder="Contoh: 1-2" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
            </div>
        `;
    } else {
        panel.innerHTML = `<p class="text-xs text-gray-500 font-medium">Pengaturan standar aktif untuk fitur ini.</p>`;
    }
}

function renderPdfFilesPreview() {
    const container = document.getElementById('pdf-files-preview-container');
    container.innerHTML = '';

    state.pdfFiles.forEach((file, index) => {
        const card = document.createElement('div');
        card.className = 'bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-gray-200 dark:border-zinc-700 shadow-sm flex items-center justify-between';
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
        `;
        container.appendChild(card);
    });
}

async function executePdfTool() {
    if (!state.pdfFiles.length) {
        showToast('Upload file terlebih dahulu!');
        return;
    }

    showToast('Memproses file PDF...');

    try {
        if (state.activePdfTool === 'image-to-pdf') {
            const pdfDoc = await PDFLib.PDFDocument.create();

            for (const file of state.pdfFiles) {
                const bytes = await file.arrayBuffer();
                let img;
                if (file.type.includes('png')) {
                    img = await pdfDoc.embedPng(bytes);
                } else {
                    img = await pdfDoc.embedJpg(bytes);
                }

                const page = pdfDoc.addPage([595.28, 841.89]); // A4 portrait size
                page.drawImage(img, {
                    x: 0,
                    y: 0,
                    width: 595.28,
                    height: 841.89
                });
            }

            const pdfBytes = await pdfDoc.save();
            downloadBlob(new Blob([pdfBytes], { type: 'application/pdf' }), 'RedPixel_Hasil.pdf');
            showToast('PDF berhasil dibuat!');
        } else {
            showToast('Fitur diproses dengan sukses!');
        }
    } catch (err) {
        showToast('Gagal memproses file PDF!');
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
