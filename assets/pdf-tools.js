/* =====================================================================
   RedPixel - Real redPDF Tools implementations
   -----------------------------------------------------------------------
   Previously, executePdfTool() in script.js only actually implemented
   "Image to PDF". Every other tool (PDF to Image, Merge PDF, Split PDF,
   Compress PDF) just showed a fake "Fitur diproses dengan sukses!" toast
   and produced nothing. This file replaces that fake behaviour with real,
   client-side processing of the user's actual uploaded PDF file(s) using
   PDF.js (render/read) and pdf-lib (build/modify PDF documents).
   No sample data, no placeholder output - if something can't be read or
   produced, the user is told exactly why instead of a fake success.
   ===================================================================== */

/* ---------------------------------------------------------------- */
/* Image normalization for Image -> PDF (supports any format the     */
/* browser's own <img> decoder understands: PNG, JPG, WEBP, GIF,     */
/* BMP, AVIF, SVG, ICO, etc. - not just PNG/JPG which is all pdf-lib */
/* can embed natively).                                               */
/* ---------------------------------------------------------------- */
function loadImageAsPngBytes(file) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const width = img.naturalWidth || img.width;
                const height = img.naturalHeight || img.height;
                if (!width || !height) throw new Error('Ukuran gambar tidak terbaca (0x0).');

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/png');
                const pngBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                URL.revokeObjectURL(url);
                resolve({ pngBytes, width, height });
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Browser tidak bisa mendekode file ini sebagai gambar.'));
        };
        img.src = url;
    });
}

/* ---------------------------------------------------------------- */
/* Image -> PDF variant of the loader above: also downscales the image to  */
/* a target resolution and re-encodes it as a quality-controlled JPEG      */
/* instead of a lossless PNG, so full-resolution phone photos don't turn   */
/* into a bloated multi-page PDF. Never upscales an image smaller than     */
/* the target. */
/* ---------------------------------------------------------------- */
function loadImageAsJpegBytesForPdf(file, maxDimensionPx, quality) {
    return new Promise((resolve, reject) => {
        const url = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            try {
                const naturalWidth = img.naturalWidth || img.width;
                const naturalHeight = img.naturalHeight || img.height;
                if (!naturalWidth || !naturalHeight) throw new Error('Ukuran gambar tidak terbaca (0x0).');

                const longSide = Math.max(naturalWidth, naturalHeight);
                const scale = longSide > maxDimensionPx ? maxDimensionPx / longSide : 1;
                const width = Math.max(1, Math.round(naturalWidth * scale));
                const height = Math.max(1, Math.round(naturalHeight * scale));

                const canvas = document.createElement('canvas');
                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                // JPEG has no alpha channel - paint white first so transparent
                // areas (e.g. PNG screenshots) don't turn black.
                ctx.fillStyle = '#ffffff';
                ctx.fillRect(0, 0, width, height);
                ctx.drawImage(img, 0, 0, width, height);

                const dataUrl = canvas.toDataURL('image/jpeg', quality);
                const jpegBytes = Uint8Array.from(atob(dataUrl.split(',')[1]), c => c.charCodeAt(0));
                URL.revokeObjectURL(url);
                resolve({ jpegBytes, width, height });
            } catch (err) {
                URL.revokeObjectURL(url);
                reject(err);
            }
        };
        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error('Browser tidak bisa mendekode file ini sebagai gambar.'));
        };
        img.src = url;
    });
}

/* ---------------------------------------------------------------- */
/* Shared status / result UI helpers                                 */
/* ---------------------------------------------------------------- */
function setPdfProcessingStatus(text) {
    const box = document.getElementById('pdf-processing-status');
    const label = document.getElementById('pdf-processing-status-text');
    if (!box || !label) return;
    if (!text) {
        box.classList.add('hidden');
        return;
    }
    label.innerText = text;
    box.classList.remove('hidden');
}

function showPdfResults(html) {
    const panel = document.getElementById('pdf-results-panel');
    panel.innerHTML = html;
    panel.classList.remove('hidden');
}

function pdfResultHeader(title, statsHtml) {
    return `
        <div class="bg-white dark:bg-zinc-800 rounded-2xl p-5 border border-gray-200 dark:border-zinc-700 shadow-sm space-y-3">
            <div class="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm">
                <i class="fa-solid fa-circle-check"></i>
                <span>${title}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">${statsHtml}</div>
        </div>
    `;
}

function pdfStatItem(label, value) {
    return `<div class="bg-gray-50 dark:bg-zinc-900 rounded-xl p-3 border border-gray-200 dark:border-zinc-700">
        <div class="text-[10px] uppercase tracking-wide text-gray-500 font-semibold">${label}</div>
        <div class="text-sm font-bold text-gray-800 dark:text-zinc-100 mt-0.5">${value}</div>
    </div>`;
}

/* ---------------------------------------------------------------- */
/* PDF -> Image (the tool explicitly reported as broken)             */
/* ---------------------------------------------------------------- */
async function realExecutePdfToImage() {
    if (state.pdfFiles.length > 1) {
        showToast('PDF to Image memproses satu file dalam satu waktu. Menggunakan file pertama.');
    }
    const file = state.pdfFiles[0];
    const format = document.getElementById('pdf-to-image-format')?.value || 'image/jpeg';
    const scale = parseFloat(document.getElementById('pdf-to-image-scale')?.value || '2');
    const quality = parseInt(document.getElementById('pdf-to-image-quality')?.value || '90', 10) / 100;
    const outputFilename = getPdfOutputFilename('RedPixel_PDF_to_Image');

    setPdfProcessingStatus(`Membaca ${file.name}...`);
    const bytes = await file.arrayBuffer();

    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    } catch (err) {
        setPdfProcessingStatus(null);
        if (err && err.name === 'PasswordException') {
            showToast('PDF dilindungi kata sandi. Buka proteksinya terlebih dahulu.');
        } else {
            showToast('File PDF rusak atau tidak valid, tidak bisa dibaca.');
        }
        return;
    }

    const totalPages = pdf.numPages;
    if (!totalPages) {
        setPdfProcessingStatus(null);
        showToast('PDF tidak memiliki halaman yang bisa diekstrak.');
        return;
    }

    const ext = format === 'image/png' ? 'png' : (format === 'image/webp' ? 'webp' : 'jpg');
    const results = [];

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setPdfProcessingStatus(`Merender halaman ${pageNum} dari ${totalPages}...`);
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');

        // Non-PNG formats have no alpha channel - paint a white background first
        // so transparent PDF regions don't turn black on JPG export.
        if (format !== 'image/png') {
            ctx.fillStyle = '#ffffff';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
        }

        await page.render({ canvasContext: ctx, viewport }).promise;

        const dataUrl = canvas.toDataURL(format, format === 'image/png' ? undefined : quality);
        results.push({
            pageNum,
            dataUrl,
            filename: `${outputFilename}_page${String(pageNum).padStart(2, '0')}.${ext}`
        });
    }

    state.pdfRenderedPages = results;
    setPdfProcessingStatus(null);
    showToast(`Berhasil mengekstrak ${totalPages} halaman menjadi gambar.`);

    const thumbs = results.map(r => `
        <div class="bg-white dark:bg-zinc-800 rounded-2xl border border-gray-200 dark:border-zinc-700 shadow-sm overflow-hidden flex flex-col">
            <img src="${r.dataUrl}" class="w-full h-40 object-contain bg-gray-50 dark:bg-zinc-900 border-b border-gray-200 dark:border-zinc-700" alt="Halaman ${r.pageNum}">
            <div class="p-3 flex items-center justify-between gap-2">
                <span class="text-[11px] font-semibold text-gray-600 dark:text-zinc-300">Halaman ${r.pageNum}</span>
                <button onclick="downloadPdfRenderedPage(${r.pageNum - 1})" class="px-2.5 py-1.5 bg-red-600 hover:bg-red-700 text-white rounded-lg text-[11px] font-bold transition">
                    <i class="fa-solid fa-download"></i>
                </button>
            </div>
        </div>
    `).join('');

    showPdfResults(`
        ${pdfResultHeader('Konversi Selesai', pdfStatItem('Total Halaman', totalPages) + pdfStatItem('Format', ext.toUpperCase()) + pdfStatItem('Resolusi', scale + 'x') + pdfStatItem('Output', `${outputFilename}_pageXX.${ext}`))}
        <div class="flex justify-end">
            <button onclick="downloadAllPdfRenderedPagesZip()" class="px-4 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-xl text-xs font-bold shadow-md transition flex items-center gap-2">
                <i class="fa-solid fa-file-zipper"></i>
                <span>Download Semua (.zip)</span>
            </button>
        </div>
        <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">${thumbs}</div>
    `);
}

function downloadPdfRenderedPage(index) {
    const item = state.pdfRenderedPages[index];
    if (!item) return;
    const link = document.createElement('a');
    link.href = item.dataUrl;
    link.download = item.filename;
    link.click();
}

async function downloadAllPdfRenderedPagesZip() {
    if (!state.pdfRenderedPages.length) return;
    showToast('Menyiapkan file ZIP...');
    const zip = new JSZip();
    for (const item of state.pdfRenderedPages) {
        const base64 = item.dataUrl.split(',')[1];
        zip.file(item.filename, base64, { base64: true });
    }
    const blob = await zip.generateAsync({ type: 'blob' });
    downloadBlob(blob, `${getPdfOutputFilename('RedPixel_PDF_to_Image')}.zip`);
    showToast('ZIP berhasil diunduh!');
}

/* ---------------------------------------------------------------- */
/* Merge PDF                                                          */
/* ---------------------------------------------------------------- */
async function realExecuteMergePdf() {
    if (state.pdfFiles.length < 2) {
        showToast('Pilih minimal 2 file PDF untuk digabungkan.');
        return;
    }

    const outputFilename = getPdfOutputFilename('RedPixel_Merged');
    setPdfProcessingStatus('Membaca file PDF...');
    const mergedDoc = await PDFLib.PDFDocument.create();
    let totalSourcePages = 0;
    const perFileInfo = [];

    for (const file of state.pdfFiles) {
        setPdfProcessingStatus(`Menggabungkan ${file.name}...`);
        let bytes, srcDoc;
        try {
            bytes = await file.arrayBuffer();
            srcDoc = await PDFLib.PDFDocument.load(bytes, { ignoreEncryption: false });
        } catch (err) {
            setPdfProcessingStatus(null);
            showToast(`Gagal membaca "${file.name}": file rusak atau dilindungi kata sandi.`);
            return;
        }
        const pageIndices = srcDoc.getPageIndices();
        const copiedPages = await mergedDoc.copyPages(srcDoc, pageIndices);
        copiedPages.forEach(p => mergedDoc.addPage(p));
        totalSourcePages += pageIndices.length;
        perFileInfo.push({ name: file.name, pages: pageIndices.length });
    }

    setPdfProcessingStatus('Menulis file PDF hasil gabungan...');
    const mergedBytes = await mergedDoc.save();
    const blob = new Blob([mergedBytes], { type: 'application/pdf' });
    setPdfProcessingStatus(null);

    downloadBlob(blob, `${outputFilename}.pdf`);
    showToast(`${state.pdfFiles.length} PDF berhasil digabungkan!`);

    const listHtml = perFileInfo.map(f => `<li class="flex justify-between"><span class="truncate pr-2">${f.name}</span><span class="text-gray-500 shrink-0">${f.pages} hal.</span></li>`).join('');

    showPdfResults(`
        ${pdfResultHeader('Merge PDF Selesai', pdfStatItem('File Digabung', state.pdfFiles.length) + pdfStatItem('Total Halaman', totalSourcePages) + pdfStatItem('Ukuran Output', formatBytes(mergedBytes.byteLength)) + pdfStatItem('Output', `${outputFilename}.pdf`))}
        <div class="bg-white dark:bg-zinc-800 rounded-2xl p-4 border border-gray-200 dark:border-zinc-700 shadow-sm">
            <p class="text-xs font-bold text-gray-600 dark:text-zinc-300 mb-2">Urutan penggabungan:</p>
            <ul class="text-xs text-gray-700 dark:text-zinc-300 space-y-1">${listHtml}</ul>
        </div>
    `);
}

/* ---------------------------------------------------------------- */
/* Split PDF                                                          */
/* ---------------------------------------------------------------- */
function parsePageRange(rangeStr, maxPages) {
    // Accepts "1-3, 5, 8-9" style input. Returns { pages: [0-indexed...], error }
    const cleaned = (rangeStr || '').trim();
    if (!cleaned) return { pages: null, error: 'Rentang halaman kosong.' };

    const pages = new Set();
    const parts = cleaned.split(',').map(p => p.trim()).filter(Boolean);
    if (!parts.length) return { pages: null, error: 'Rentang halaman tidak valid.' };

    for (const part of parts) {
        const rangeMatch = part.match(/^(\d+)\s*-\s*(\d+)$/);
        const singleMatch = part.match(/^(\d+)$/);
        if (rangeMatch) {
            let start = parseInt(rangeMatch[1], 10);
            let end = parseInt(rangeMatch[2], 10);
            if (start > end) [start, end] = [end, start];
            if (start < 1 || end > maxPages) {
                return { pages: null, error: `Halaman ${start}-${end} di luar jangkauan (PDF hanya punya ${maxPages} halaman).` };
            }
            for (let i = start; i <= end; i++) pages.add(i - 1);
        } else if (singleMatch) {
            const p = parseInt(singleMatch[1], 10);
            if (p < 1 || p > maxPages) {
                return { pages: null, error: `Halaman ${p} di luar jangkauan (PDF hanya punya ${maxPages} halaman).` };
            }
            pages.add(p - 1);
        } else {
            return { pages: null, error: `Format "${part}" tidak dikenali. Gunakan contoh: 1-3, 5` };
        }
    }

    return { pages: Array.from(pages).sort((a, b) => a - b), error: null };
}

async function realExecuteSplitPdf() {
    const file = state.pdfFiles[0];
    const rangeInput = document.getElementById('pdf-split-range')?.value || '';
    const outputFilename = getPdfOutputFilename('RedPixel_Split');

    setPdfProcessingStatus(`Membaca ${file.name}...`);
    let bytes, srcDoc;
    try {
        bytes = await file.arrayBuffer();
        srcDoc = await PDFLib.PDFDocument.load(bytes);
    } catch (err) {
        setPdfProcessingStatus(null);
        showToast('File PDF rusak, kosong, atau dilindungi kata sandi.');
        return;
    }

    const maxPages = srcDoc.getPageCount();
    const { pages, error } = parsePageRange(rangeInput, maxPages);

    if (error) {
        setPdfProcessingStatus(null);
        showToast(error);
        return;
    }

    setPdfProcessingStatus(`Mengambil ${pages.length} halaman...`);
    const newDoc = await PDFLib.PDFDocument.create();
    const copiedPages = await newDoc.copyPages(srcDoc, pages);
    copiedPages.forEach(p => newDoc.addPage(p));

    const newBytes = await newDoc.save();
    const blob = new Blob([newBytes], { type: 'application/pdf' });
    setPdfProcessingStatus(null);

    downloadBlob(blob, `${outputFilename}.pdf`);
    showToast(`Berhasil mengambil ${pages.length} halaman dari ${maxPages} halaman.`);

    showPdfResults(pdfResultHeader(
        'Split PDF Selesai',
        pdfStatItem('File Asal', file.name) +
        pdfStatItem('Halaman Diambil', pages.length) +
        pdfStatItem('Ukuran Output', formatBytes(newBytes.byteLength)) +
        pdfStatItem('Output', `${outputFilename}.pdf`)
    ));
}

/* ---------------------------------------------------------------- */
/* Compress PDF (real re-encode: render each page to canvas, re-embed  */
/* as a quality-reduced JPEG - not a fake renamed copy).               */
/* ---------------------------------------------------------------- */
async function realExecuteCompressPdf() {
    const file = state.pdfFiles[0];
    const level = document.getElementById('pdf-compress-level')?.value || 'medium';
    const outputFilename = getPdfOutputFilename('RedPixel_Compressed');

    const settings = {
        low: { scale: 2.0, quality: 0.85 },
        medium: { scale: 1.5, quality: 0.65 },
        high: { scale: 1.0, quality: 0.45 }
    }[level];

    setPdfProcessingStatus(`Membaca ${file.name}...`);
    const originalBytes = await file.arrayBuffer();
    const originalSize = originalBytes.byteLength;

    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: originalBytes.slice(0) }).promise;
    } catch (err) {
        setPdfProcessingStatus(null);
        showToast('File PDF rusak atau dilindungi kata sandi, tidak bisa dikompres.');
        return;
    }

    const totalPages = pdf.numPages;
    const newDoc = await PDFLib.PDFDocument.create();

    for (let pageNum = 1; pageNum <= totalPages; pageNum++) {
        setPdfProcessingStatus(`Memadatkan halaman ${pageNum} dari ${totalPages}...`);
        const page = await pdf.getPage(pageNum);
        const viewport = page.getViewport({ scale: settings.scale });

        const canvas = document.createElement('canvas');
        canvas.width = Math.ceil(viewport.width);
        canvas.height = Math.ceil(viewport.height);
        const ctx = canvas.getContext('2d');
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        await page.render({ canvasContext: ctx, viewport }).promise;

        const jpegDataUrl = canvas.toDataURL('image/jpeg', settings.quality);
        const jpegBytes = Uint8Array.from(atob(jpegDataUrl.split(',')[1]), c => c.charCodeAt(0));
        const embeddedImg = await newDoc.embedJpg(jpegBytes);

        // Keep the page at its original point size (72dpi PDF units) regardless
        // of the render scale, so the output PDF's physical page size is unchanged.
        const originalViewport = page.getViewport({ scale: 1 });
        const newPage = newDoc.addPage([originalViewport.width, originalViewport.height]);
        newPage.drawImage(embeddedImg, {
            x: 0, y: 0,
            width: originalViewport.width,
            height: originalViewport.height
        });
    }

    setPdfProcessingStatus('Menulis file PDF hasil kompresi...');
    const newBytes = await newDoc.save();
    setPdfProcessingStatus(null);

    const newSize = newBytes.byteLength;
    const blob = new Blob([newBytes], { type: 'application/pdf' });

    if (newSize >= originalSize) {
        showToast('Hasil kompresi tidak lebih kecil dari file asli (PDF ini mungkin sudah padat atau berbasis teks murni). File tetap bisa diunduh.');
    } else {
        showToast(`PDF berhasil dipadatkan: ${formatBytes(originalSize)} \u2192 ${formatBytes(newSize)}`);
    }

    downloadBlob(blob, `${outputFilename}.pdf`);

    const reduction = originalSize > 0 ? Math.round((1 - newSize / originalSize) * 100) : 0;
    showPdfResults(`
        ${pdfResultHeader('Kompresi Selesai', pdfStatItem('Ukuran Asli', formatBytes(originalSize)) + pdfStatItem('Ukuran Baru', formatBytes(newSize)) + pdfStatItem('Pengurangan', reduction + '%') + pdfStatItem('Output', `${outputFilename}.pdf`))}
        <p class="text-[11px] text-gray-500 dark:text-zinc-400 px-1">Catatan: setiap halaman dirender ulang sebagai gambar JPEG, sehingga teks pada hasil kompresi tidak lagi bisa diseleksi/dicari. Cocok untuk PDF hasil scan atau berisi gambar besar.</p>
    `);
}

/* ---------------------------------------------------------------- */
/* Small shared helper                                               */
/* ---------------------------------------------------------------- */
function formatBytes(bytes) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}
