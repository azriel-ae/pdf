/* =====================================================================
   Tools - File to Excel
   -----------------------------------------------------------------------
   New feature: converts the user's actual uploaded CSV / JSON / XLS /
   XLSX / TXT / PDF file into a genuine .xlsx workbook using SheetJS.
   No sample/demo data is ever used - if a file can't be meaningfully
   read as a table, the user is told why instead of getting a fake
   "success" with an empty workbook.
   ===================================================================== */

let excelState = {
    file: null,
    ext: null
};

/* ---------------------------------------------------------------- */
/* Upload handling                                                   */
/* ---------------------------------------------------------------- */
function triggerExcelFileInput() {
    document.getElementById('excel-file-input').click();
}

function handleExcelDragOver(e) { e.preventDefault(); document.getElementById('excel-drop-zone').classList.add('border-red-500'); }
function handleExcelDragLeave(e) { e.preventDefault(); document.getElementById('excel-drop-zone').classList.remove('border-red-500'); }
function handleExcelDrop(e) {
    e.preventDefault();
    document.getElementById('excel-drop-zone').classList.remove('border-red-500');
    if (e.dataTransfer.files && e.dataTransfer.files.length) {
        handleExcelFileSelected({ target: { files: e.dataTransfer.files } });
    }
}

const EXCEL_SUPPORTED_EXT = ['csv', 'json', 'xls', 'xlsx', 'txt', 'pdf'];

function handleExcelFileSelected(e) {
    const file = e.target.files[0];
    if (!file) return;

    const ext = (file.name.split('.').pop() || '').toLowerCase();
    if (!EXCEL_SUPPORTED_EXT.includes(ext)) {
        showToast(`Format .${ext} belum didukung. Gunakan CSV, JSON, XLS, XLSX, TXT, atau PDF.`);
        return;
    }

    excelState.file = file;
    excelState.ext = ext;

    document.getElementById('excel-upload-card').classList.add('hidden');
    document.getElementById('excel-workspace-area').classList.remove('hidden');
    document.getElementById('excel-result-panel').classList.add('hidden');
    document.getElementById('excel-result-panel').innerHTML = '';
    document.getElementById('excel-processing-status').classList.add('hidden');

    renderExcelFileCard();
    renderExcelOptionsPanel();
}

function resetExcelWorkspace() {
    excelState = { file: null, ext: null };
    document.getElementById('excel-upload-card').classList.remove('hidden');
    document.getElementById('excel-workspace-area').classList.add('hidden');
    document.getElementById('excel-file-card').innerHTML = '';
    document.getElementById('excel-options-panel').classList.add('hidden');
    document.getElementById('excel-options-panel').innerHTML = '';
    document.getElementById('excel-result-panel').classList.add('hidden');
    document.getElementById('excel-result-panel').innerHTML = '';
    document.getElementById('excel-file-input').value = '';
}

const EXT_ICON = { csv: 'fa-file-csv', json: 'fa-file-code', xls: 'fa-file-excel', xlsx: 'fa-file-excel', txt: 'fa-file-lines', pdf: 'fa-file-pdf' };

function renderExcelFileCard() {
    const card = document.getElementById('excel-file-card');
    const { file, ext } = excelState;
    card.innerHTML = `
        <div class="flex items-center space-x-3 overflow-hidden">
            <div class="p-3 bg-red-100 dark:bg-red-950/50 text-red-600 rounded-xl shrink-0 text-lg">
                <i class="fa-solid ${EXT_ICON[ext] || 'fa-file'}"></i>
            </div>
            <div class="truncate">
                <h4 class="text-sm font-bold text-gray-800 dark:text-zinc-100 truncate">${file.name}</h4>
                <p class="text-[11px] text-gray-500">${(file.size / 1024).toFixed(1)} KB &bull; .${ext.toUpperCase()}</p>
            </div>
        </div>
        <button onclick="resetExcelWorkspace()" class="p-2 text-gray-400 hover:text-red-600 rounded-lg hover:bg-red-50 dark:hover:bg-red-950/40 text-xs shrink-0" title="Hapus file">
            <i class="fa-solid fa-trash"></i>
        </button>
    `;
}

function renderExcelOptionsPanel() {
    const panel = document.getElementById('excel-options-panel');
    const { ext } = excelState;

    if (ext === 'csv' || ext === 'txt') {
        panel.innerHTML = `
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                    <label class="text-xs font-semibold text-gray-600 dark:text-zinc-300 block mb-1">Pemisah Kolom</label>
                    <select id="excel-delimiter" class="w-full px-3 py-2 bg-gray-50 dark:bg-zinc-900 border border-gray-200 dark:border-zinc-700 rounded-xl text-xs font-medium">
                        <option value="auto" selected>Deteksi Otomatis</option>
                        <option value=",">Koma (,)</option>
                        <option value=";">Titik Koma (;)</option>
                        <option value="\t">Tab</option>
                    </select>
                </div>
                <div class="flex items-end pb-2">
                    <label class="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-zinc-300">
                        <input type="checkbox" id="excel-has-header" checked class="accent-red-600 w-4 h-4">
                        Baris pertama adalah header
                    </label>
                </div>
            </div>
        `;
        panel.classList.remove('hidden');
    } else if (ext === 'json') {
        panel.innerHTML = `
            <label class="flex items-center gap-2 text-xs font-semibold text-gray-600 dark:text-zinc-300">
                <input type="checkbox" id="excel-flatten-json" checked class="accent-red-600 w-4 h-4">
                Ratakan (flatten) objek bersarang, mis. <code class="bg-gray-100 dark:bg-zinc-900 px-1 rounded">customer.name</code>
            </label>
        `;
        panel.classList.remove('hidden');
    } else if (ext === 'xls' || ext === 'xlsx') {
        panel.innerHTML = `<p class="text-xs text-gray-500 dark:text-zinc-400"><i class="fa-solid fa-circle-info"></i> Semua sheet dalam file akan disertakan apa adanya di file .xlsx hasil normalisasi.</p>`;
        panel.classList.remove('hidden');
    } else if (ext === 'pdf') {
        panel.innerHTML = `
            <p class="text-xs text-gray-500 dark:text-zinc-400">
                <i class="fa-solid fa-triangle-exclamation text-amber-500"></i>
                Ekstraksi tabel dari PDF bersifat <strong>best-effort</strong> (berdasarkan posisi teks per halaman). Untuk PDF hasil scan/gambar tanpa lapisan teks, ekstraksi tidak akan menghasilkan data &mdash; aplikasi akan melaporkan ini apa adanya (OCR belum tersedia di versi ini), bukan membuat data palsu.
            </p>
        `;
        panel.classList.remove('hidden');
    } else {
        panel.classList.add('hidden');
    }
}

/* ---------------------------------------------------------------- */
/* Status / result UI                                                */
/* ---------------------------------------------------------------- */
function setExcelStatus(text) {
    const box = document.getElementById('excel-processing-status');
    const label = document.getElementById('excel-processing-status-text');
    if (!text) { box.classList.add('hidden'); return; }
    label.innerText = text;
    box.classList.remove('hidden');
}

function showExcelSuccess({ file, rows, cols, sheets, duplicates, workbookBlob, outName, note }) {
    const panel = document.getElementById('excel-result-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-gray-200 dark:border-zinc-700 shadow-sm space-y-4">
            <div class="flex items-center gap-2 text-green-600 dark:text-green-400 font-bold text-sm">
                <i class="fa-solid fa-circle-check"></i>
                <span>Konversi Selesai</span>
            </div>
            <div class="flex items-center justify-center gap-3 text-xs font-semibold text-gray-600 dark:text-zinc-300">
                <span class="px-3 py-1.5 bg-gray-100 dark:bg-zinc-900 rounded-lg truncate max-w-[45%]">${file.name}</span>
                <i class="fa-solid fa-arrow-right text-red-600"></i>
                <span class="px-3 py-1.5 bg-red-50 dark:bg-red-950/40 text-red-600 rounded-lg truncate max-w-[45%]">${outName}</span>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
                ${pdfStatItem('Baris', rows.toLocaleString('id-ID'))}
                ${pdfStatItem('Kolom', cols)}
                ${pdfStatItem('Sheet', sheets)}
                ${pdfStatItem('Duplikat', duplicates)}
            </div>
            ${note ? `<p class="text-[11px] text-gray-500 dark:text-zinc-400">${note}</p>` : ''}
            <div class="flex flex-col sm:flex-row gap-2 pt-1">
                <button id="excel-download-btn" class="flex-1 bg-green-600 hover:bg-green-700 text-white font-bold py-2.5 rounded-xl text-xs shadow-md transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-download"></i>
                    <span>Download Excel</span>
                </button>
                <button onclick="resetExcelWorkspace()" class="flex-1 bg-gray-100 dark:bg-zinc-700 hover:bg-gray-200 text-gray-700 dark:text-zinc-200 font-bold py-2.5 rounded-xl text-xs transition flex items-center justify-center gap-2">
                    <i class="fa-solid fa-rotate-left"></i>
                    <span>Konversi File Lain</span>
                </button>
            </div>
        </div>
    `;
    document.getElementById('excel-download-btn').onclick = () => downloadBlob(workbookBlob, outName);
}

function showExcelFailure(reason) {
    const panel = document.getElementById('excel-result-panel');
    panel.classList.remove('hidden');
    panel.innerHTML = `
        <div class="bg-white dark:bg-zinc-800 rounded-2xl p-6 border border-red-200 dark:border-red-900 shadow-sm space-y-2">
            <div class="flex items-center gap-2 text-red-600 dark:text-red-400 font-bold text-sm">
                <i class="fa-solid fa-circle-xmark"></i>
                <span>Konversi Gagal</span>
            </div>
            <p class="text-xs text-gray-600 dark:text-zinc-300">${reason}</p>
        </div>
    `;
}

/* ---------------------------------------------------------------- */
/* Parsers                                                            */
/* ---------------------------------------------------------------- */

// Minimal RFC4180-ish CSV/delimited-text parser: handles quoted fields,
// escaped quotes (""), and delimiters/newlines inside quotes.
function parseDelimitedText(text, delimiter) {
    const rows = [];
    let row = [];
    let field = '';
    let inQuotes = false;

    for (let i = 0; i < text.length; i++) {
        const c = text[i];
        if (inQuotes) {
            if (c === '"') {
                if (text[i + 1] === '"') { field += '"'; i++; }
                else { inQuotes = false; }
            } else {
                field += c;
            }
        } else {
            if (c === '"') {
                inQuotes = true;
            } else if (c === delimiter) {
                row.push(field);
                field = '';
            } else if (c === '\n') {
                row.push(field);
                rows.push(row);
                row = [];
                field = '';
            } else if (c === '\r') {
                // skip, \n handles the line break
            } else {
                field += c;
            }
        }
    }
    // last field/row
    if (field.length || row.length) {
        row.push(field);
        rows.push(row);
    }
    return rows.filter(r => !(r.length === 1 && r[0].trim() === ''));
}

function detectDelimiter(sampleText) {
    const firstLines = sampleText.split(/\r?\n/).slice(0, 10).filter(Boolean);
    const candidates = [',', ';', '\t'];
    let best = ',';
    let bestScore = -1;
    for (const d of candidates) {
        const counts = firstLines.map(l => l.split(d).length - 1);
        if (!counts.length) continue;
        const avg = counts.reduce((a, b) => a + b, 0) / counts.length;
        const consistent = counts.every(c => c === counts[0]) && counts[0] > 0;
        const score = avg + (consistent ? 5 : 0);
        if (score > bestScore) { bestScore = score; best = d; }
    }
    return bestScore > 0 ? best : ',';
}

function flattenObject(obj, prefix = '', out = {}) {
    if (obj === null || obj === undefined) {
        out[prefix || 'value'] = obj;
        return out;
    }
    if (Array.isArray(obj)) {
        // Arrays of primitives -> joined string; arrays of objects -> indexed flatten
        const allPrimitive = obj.every(v => typeof v !== 'object' || v === null);
        if (allPrimitive) {
            out[prefix || 'value'] = obj.join('; ');
        } else {
            obj.forEach((v, i) => flattenObject(v, prefix ? `${prefix}.${i}` : `${i}`, out));
        }
        return out;
    }
    if (typeof obj === 'object') {
        const keys = Object.keys(obj);
        if (!keys.length) { out[prefix || 'value'] = ''; return out; }
        keys.forEach(k => flattenObject(obj[k], prefix ? `${prefix}.${k}` : k, out));
        return out;
    }
    out[prefix || 'value'] = obj;
    return out;
}

function jsonToRows(data, flatten) {
    let arr;
    if (Array.isArray(data)) {
        arr = data;
    } else if (typeof data === 'object' && data !== null) {
        arr = [data];
    } else {
        return { error: 'JSON tidak berisi objek atau array objek yang bisa dikonversi ke tabel.' };
    }
    if (!arr.length) return { error: 'JSON berisi array kosong, tidak ada data untuk dikonversi.' };

    const flatRows = arr.map(item => {
        if (typeof item !== 'object' || item === null) return { value: item };
        return flatten ? flattenObject(item) : item;
    });

    // Union of all keys, preserving first-seen order
    const headerSet = [];
    flatRows.forEach(r => Object.keys(r).forEach(k => { if (!headerSet.includes(k)) headerSet.push(k); }));

    const aoa = [headerSet];
    flatRows.forEach(r => {
        aoa.push(headerSet.map(h => {
            const v = r[h];
            if (v === undefined) return '';
            if (typeof v === 'object') return JSON.stringify(v);
            return v;
        }));
    });

    return { aoa, headers: headerSet };
}

// Best-effort PDF table extraction: clusters text items into lines by Y
// position, then into columns by detecting horizontal gaps between items.
async function extractPdfTable(file) {
    const bytes = await file.arrayBuffer();
    let pdf;
    try {
        pdf = await pdfjsLib.getDocument({ data: bytes }).promise;
    } catch (err) {
        return { error: 'File PDF rusak, kosong, atau dilindungi kata sandi.' };
    }

    const allRows = [];
    let totalChars = 0;

    for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
        const page = await pdf.getPage(pageNum);
        const content = await page.getTextContent();
        totalChars += content.items.reduce((s, it) => s + (it.str ? it.str.length : 0), 0);
        if (!content.items.length) continue;

        // Group items into lines by rounded Y
        const lineMap = new Map();
        content.items.forEach(item => {
            if (!item.str || !item.str.trim()) return;
            const y = Math.round(item.transform[5] / 3) * 3; // 3pt tolerance
            if (!lineMap.has(y)) lineMap.set(y, []);
            lineMap.get(y).push(item);
        });

        // Sort lines top-to-bottom (PDF y grows upward)
        const sortedYs = Array.from(lineMap.keys()).sort((a, b) => b - a);

        sortedYs.forEach(y => {
            const items = lineMap.get(y).sort((a, b) => a.transform[4] - b.transform[4]);
            // Detect column breaks: gap > ~1.8x the typical character width
            const cells = [];
            let current = items[0].str;
            let currentEndX = items[0].transform[4] + (items[0].width || items[0].str.length * 5);
            for (let i = 1; i < items.length; i++) {
                const it = items[i];
                const gap = it.transform[4] - currentEndX;
                const avgCharWidth = (it.width || it.str.length * 5) / Math.max(it.str.length, 1);
                if (gap > Math.max(avgCharWidth * 2.2, 8)) {
                    cells.push(current.trim());
                    current = it.str;
                } else {
                    current += it.str;
                }
                currentEndX = it.transform[4] + (it.width || it.str.length * 5);
            }
            cells.push(current.trim());
            allRows.push(cells.filter(c => c !== ''));
        });
    }

    if (totalChars === 0) {
        return { error: 'PDF ini tidak memiliki lapisan teks yang bisa dibaca (kemungkinan hasil scan/gambar). Dibutuhkan OCR untuk mengekstrak isinya, dan OCR belum tersedia di versi ini. Tidak ada data yang dibuat.' };
    }
    if (!allRows.length) {
        return { error: 'Tidak ada baris teks yang berhasil diekstrak dari PDF ini.' };
    }

    // Normalize row lengths to the max column count found
    const maxCols = Math.max(...allRows.map(r => r.length));
    const aoa = allRows.map(r => {
        const padded = r.slice();
        while (padded.length < maxCols) padded.push('');
        return padded;
    });

    return { aoa, warning: 'Hasil ekstraksi PDF bersifat heuristik (berbasis posisi teks), bukan pembacaan tabel yang sempurna. Mohon periksa kembali hasilnya.' };
}

/* ---------------------------------------------------------------- */
/* Main dispatcher                                                    */
/* ---------------------------------------------------------------- */
async function executeFileToExcel() {
    const { file, ext } = excelState;
    if (!file) { showToast('Upload file terlebih dahulu!'); return; }

    document.getElementById('excel-result-panel').classList.add('hidden');
    setExcelStatus('Membaca file...');

    try {
        const wb = XLSX.utils.book_new();
        let totalRows = 0, totalCols = 0, sheetCount = 0, duplicateCount = 0, note = '';

        if (ext === 'csv' || ext === 'txt') {
            const text = await file.text();
            if (!text.trim()) { setExcelStatus(null); showExcelFailure('File kosong, tidak ada data untuk dikonversi.'); return; }

            setExcelStatus('Mendeteksi struktur data...');
            const delimSel = document.getElementById('excel-delimiter')?.value || 'auto';
            const delimiter = delimSel === 'auto' ? detectDelimiter(text) : delimSel;
            const hasHeader = document.getElementById('excel-has-header')?.checked ?? true;

            const rows = parseDelimitedText(text, delimiter);
            if (!rows.length) { setExcelStatus(null); showExcelFailure('Tidak ada baris data yang bisa dibaca dari file ini.'); return; }

            const colCount = Math.max(...rows.map(r => r.length));
            if (ext === 'txt' && colCount < 2) {
                setExcelStatus(null);
                showExcelFailure('File TXT ini tampak sebagai teks bebas (bukan data tabel/terstruktur), sehingga tidak bisa dikonversi ke Excel secara andal tanpa membuat data yang tidak berarti.');
                return;
            }

            setExcelStatus('Membangun workbook Excel...');
            const seen = new Map();
            const dataRows = hasHeader ? rows.slice(1) : rows;
            dataRows.forEach(r => {
                const key = JSON.stringify(r);
                seen.set(key, (seen.get(key) || 0) + 1);
            });
            duplicateCount = Array.from(seen.values()).filter(c => c > 1).reduce((sum, c) => sum + (c - 1), 0);

            const ws = XLSX.utils.aoa_to_sheet(rows);
            ws['!cols'] = Array.from({ length: colCount }, (_, i) => ({ wch: Math.min(40, Math.max(10, ...rows.map(r => (r[i] || '').toString().length))) }));
            if (hasHeader && rows.length) {
                ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: rows.length - 1, c: colCount - 1 } }) };
            }
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            totalRows = dataRows.length;
            totalCols = colCount;
            sheetCount = 1;

        } else if (ext === 'json') {
            const text = await file.text();
            let data;
            try { data = JSON.parse(text); }
            catch (err) { setExcelStatus(null); showExcelFailure('JSON tidak valid / gagal di-parse. Periksa kembali format file Anda.'); return; }

            setExcelStatus('Meratakan struktur JSON...');
            const flatten = document.getElementById('excel-flatten-json')?.checked ?? true;
            const result = jsonToRows(data, flatten);
            if (result.error) { setExcelStatus(null); showExcelFailure(result.error); return; }

            setExcelStatus('Membangun workbook Excel...');
            const dataRows = result.aoa.slice(1);
            const seen = new Map();
            dataRows.forEach(r => { const k = JSON.stringify(r); seen.set(k, (seen.get(k) || 0) + 1); });
            duplicateCount = Array.from(seen.values()).filter(c => c > 1).reduce((sum, c) => sum + (c - 1), 0);

            const ws = XLSX.utils.aoa_to_sheet(result.aoa);
            ws['!cols'] = result.headers.map((h, i) => ({ wch: Math.min(40, Math.max(10, h.length)) }));
            ws['!autofilter'] = { ref: XLSX.utils.encode_range({ s: { r: 0, c: 0 }, e: { r: result.aoa.length - 1, c: result.headers.length - 1 } }) };
            XLSX.utils.book_append_sheet(wb, ws, 'Data');
            totalRows = dataRows.length;
            totalCols = result.headers.length;
            sheetCount = 1;

        } else if (ext === 'xls' || ext === 'xlsx') {
            setExcelStatus('Membaca workbook...');
            const buf = await file.arrayBuffer();
            let srcWb;
            try { srcWb = XLSX.read(buf, { type: 'array' }); }
            catch (err) { setExcelStatus(null); showExcelFailure('File XLS/XLSX rusak atau tidak bisa dibaca.'); return; }

            if (!srcWb.SheetNames.length) { setExcelStatus(null); showExcelFailure('File spreadsheet ini tidak memiliki sheet apapun.'); return; }

            setExcelStatus('Menormalkan sheet...');
            srcWb.SheetNames.forEach(name => {
                const sheet = srcWb.Sheets[name];
                XLSX.utils.book_append_sheet(wb, sheet, name.substring(0, 31));
                const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
                totalRows += Math.max(0, rows.length - 1);
                totalCols = Math.max(totalCols, ...rows.map(r => r.length), 0);
            });
            sheetCount = srcWb.SheetNames.length;
            note = 'Sheet, header, dan nilai asli dipertahankan dari file sumber.';

        } else if (ext === 'pdf') {
            setExcelStatus('Membaca PDF...');
            const result = await extractPdfTable(file);
            if (result.error) { setExcelStatus(null); showExcelFailure(result.error); return; }

            setExcelStatus('Membangun workbook Excel...');
            const ws = XLSX.utils.aoa_to_sheet(result.aoa);
            const colCount = Math.max(...result.aoa.map(r => r.length));
            ws['!cols'] = Array.from({ length: colCount }, () => ({ wch: 22 }));
            XLSX.utils.book_append_sheet(wb, ws, 'Extracted');
            totalRows = result.aoa.length;
            totalCols = colCount;
            sheetCount = 1;
            note = result.warning;
        }

        if (totalRows === 0) {
            setExcelStatus(null);
            showExcelFailure('Tidak ada data yang berhasil diekstrak dari file ini. Tidak ada file Excel yang dibuat (Tools tidak akan melaporkan sukses palsu).');
            return;
        }

        setExcelStatus('Menyelesaikan file .xlsx...');
        const wbOut = XLSX.write(wb, { bookType: 'xlsx', type: 'array' });
        const blob = new Blob([wbOut], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
        const outName = file.name.replace(/\.[^.]+$/, '') + '.xlsx';

        setExcelStatus(null);
        showToast('Konversi ke Excel berhasil!');
        showExcelSuccess({ file, rows: totalRows, cols: totalCols, sheets: sheetCount, duplicates: duplicateCount, workbookBlob: blob, outName, note });

    } catch (err) {
        console.error(err);
        setExcelStatus(null);
        showExcelFailure(`Terjadi kesalahan saat memproses file: ${err.message || err}`);
    }
}
