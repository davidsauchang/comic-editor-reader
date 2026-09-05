// ============================================================
// FOLDER IMPORT - "Drop a Folder & Done"
// ============================================================
// Batch-import a whole folder of page/panel artwork into the
// project. Files are auto-sorted by filename (natural numeric
// order: 01.png, 02.png, ... 10.png) and laid out with one of
// four presets. Every generated panel uses the standard panel
// model, so all existing tools (drag, resize, perspective warp,
// white border, lock, lettering) keep working on the result.
// ============================================================

import { state, saveHistoryState } from './state.js';
import { renderCanvas, renderSidebar } from './canvas.js';

const IMAGE_NAME_RE = /\.(png|jpe?g|gif|webp|bmp|avif)$/i;
const MAX_DIM = 2048; // match cropper flow; avoid huge data URLs

let pendingImages = []; // [{ src, w, h, name }]

// ============================================================
// INIT - wire picker, toolbar button, drop zone, modal
// ============================================================

export function initFolderImport() {
    const folderInput = document.getElementById('folderInput');

    document.getElementById('btnImportFolder')?.addEventListener('click', () => folderInput?.click());
    document.getElementById('btnImportFolderSide')?.addEventListener('click', () => folderInput?.click());

    folderInput?.addEventListener('change', (e) => {
        const files = Array.from(e.target.files || []);
        if (files.length) handleFileList(files);
        e.target.value = '';
    });

    document.getElementById('btnFolderCancel')?.addEventListener('click', closeLayoutModal);
    document.getElementById('btnFolderImport')?.addEventListener('click', applyImport);
    document.getElementById('folderImportModal')?.addEventListener('click', (e) => {
        if (e.target.id === 'folderImportModal') closeLayoutModal();
    });

    // Toggle the gap row only for the webtoon layout.
    document.querySelectorAll('input[name="folderLayout"]').forEach((radio) => {
        radio.addEventListener('change', () => {
            const gapRow = document.getElementById('folderGapRow');
            if (gapRow) gapRow.style.display = (radio.value === 'webtoon' && radio.checked) ? 'flex' : 'none';
        });
    });

    setupDropZone();
}

// ============================================================
// DROP ZONE - drag & drop a folder over the workspace
// ============================================================

function setupDropZone() {
    const overlay = document.getElementById('folderDropOverlay');
    let depth = 0;

    window.addEventListener('dragenter', (e) => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        depth++;
        overlay?.classList.add('visible');
    });

    window.addEventListener('dragover', (e) => {
        if (hasFiles(e.dataTransfer)) e.preventDefault(); // prevent browser navigation
    });

    window.addEventListener('dragleave', (e) => {
        if (!hasFiles(e.dataTransfer)) return;
        depth = Math.max(0, depth - 1);
        if (depth === 0) overlay?.classList.remove('visible');
    });

    window.addEventListener('drop', async (e) => {
        if (!hasFiles(e.dataTransfer)) return;
        e.preventDefault();
        depth = 0;
        overlay?.classList.remove('visible');
        const files = await getDroppedImageFiles(e.dataTransfer);
        if (files.length) {
            handleFileList(files);
        } else {
            alert('No image files found in the dropped folder.');
        }
    });
}

function hasFiles(dt) {
    if (!dt || !dt.types) return false;
    return Array.from(dt.types).some((t) => String(t).toLowerCase() === 'files');
}

function isImageFile(f) {
    return IMAGE_NAME_RE.test(f.name) || (f.type && f.type.startsWith('image/'));
}
// ============================================================
// ENTRY ENUMERATION + FILE LIST SORTING
// ============================================================

// Recursively enumerate the dropped directory tree.
function getDroppedImageFiles(dt) {
    const out = [];
    const items = dt.items ? Array.from(dt.items) : [];
    const entries = items.map((it) => it.webkitGetAsEntry && it.webkitGetAsEntry()).filter(Boolean);

    if (entries.length) {
        // Retain the directory-relative path so subfolder batches still
        // sort predictably (01/1.png before 02/1.png).
        return Promise.all(entries.map((entry) => collectEntry(entry, out)))
            .then(() => out.filter(isImageFile));
    }

    // Fallback: browsers without the entry API.
    return Promise.resolve(Array.from(dt.files || []).filter(isImageFile));
}

function collectEntry(entry, out) {
    return new Promise((resolve) => {
        if (entry.isFile) {
            entry.file((file) => {
                try { file._relPath = entry.fullPath; } catch (_) { /* ignore */ }
                out.push(file);
                resolve();
            }, () => resolve());
        } else if (entry.isDirectory) {
            const reader = entry.createReader();
            // readEntries() returns in batches - loop until empty.
            const readAll = () => {
                reader.readEntries((batch) => {
                    if (!batch.length) { resolve(); return; }
                    Promise.all(batch.map((ch) => collectEntry(ch, out))).then(readAll);
                }, () => resolve());
            };
            readAll();
        } else {
            resolve();
        }
    });
}

// ============================================================
// FILE LIST -> SORTED IMAGES -> MODAL
// ============================================================

function handleFileList(fileList) {
    const images = fileList
        .filter(isImageFile)
        .sort((a, b) => {
            const pa = a.webkitRelativePath || a._relPath || a.name;
            const pb = b.webkitRelativePath || b._relPath || b.name;
            return pa.localeCompare(pb, undefined, { numeric: true, sensitivity: 'base' });
        });

    if (!images.length) {
        alert('No image files found. Supported: PNG, JPG, GIF, WEBP, BMP, AVIF.');
        return;
    }

    const summary = document.getElementById('folderImportSummary');
    if (summary) {
        summary.textContent = images.length + ' image' + (images.length === 1 ? '' : 's') + ' found - sorting by filename and loading...';
    }

    // Read files into data URLs (async).
    pendingImages = [];
    const modal = document.getElementById('folderImportModal');
    const importBtn = document.getElementById('btnFolderImport');
    if (importBtn) importBtn.disabled = true;
    if (modal) modal.classList.add('active');

    Promise.all(images.map(readImageToDataURL))
        .then((results) => {
            pendingImages = results.filter(Boolean);
            const loaded = pendingImages.length;
            if (importBtn) importBtn.disabled = loaded === 0;
            if (summary) {
                summary.textContent = loaded === 0
                    ? 'No images could be loaded.'
                    : loaded + ' of ' + images.length + ' image' + (loaded === 1 ? '' : 's') + ' loaded. Choose a layout below.';
            }
        });
}

// Measure + embed the file. If it already fits under MAX_DIM we keep the
// original bytes (perfect fidelity for clean PNG lineart). Larger images
// are downscaled to MAX_DIM on a canvas (same budget as the cropper).
function readImageToDataURL(file) {
    return new Promise((resolve) => {
        const objectUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const w = img.naturalWidth || 1;
            const h = img.naturalHeight || 1;
            const name = (file.webkitRelativePath || file._relPath || file.name).replace(/\\/g, '/');

            if (w <= MAX_DIM && h <= MAX_DIM) {
                const reader = new FileReader();
                reader.onload = () => {
                    URL.revokeObjectURL(objectUrl);
                    resolve({ src: reader.result, w: w, h: h, name: name });
                };
                reader.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
                reader.readAsDataURL(file);
                return;
            }

            const scale = Math.min(1, MAX_DIM / Math.max(w, h));
            const cw = Math.round(w * scale);
            const ch = Math.round(h * scale);
            const canvas = document.createElement('canvas');
            canvas.width = cw;
            canvas.height = ch;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, cw, ch);
            const mime = /png|webp|gif/i.test(file.type) ? 'image/png' : 'image/jpeg';
            const src = canvas.toDataURL(mime, 0.92);
            URL.revokeObjectURL(objectUrl);
            resolve({ src: src, w: cw, h: ch, name: name });
        };
        img.onerror = () => { URL.revokeObjectURL(objectUrl); resolve(null); };
        img.src = objectUrl;
    });
}
// ============================================================
// APPLY - build pages from the chosen layout
// ============================================================

function applyImport() {
    if (!pendingImages.length) return;

    const layout = document.querySelector('input[name="folderLayout"]:checked')?.value || 'webtoon';
    const gapInput = document.getElementById('folderGapInput');
    const gap = Math.max(0, Math.min(200, parseInt(gapInput?.value, 10) || 16));

    let result;
    if (layout === 'grid22') result = buildGrid(2);
    else if (layout === 'grid23') result = buildGrid(3);
    else if (layout === 'single') result = buildSingle();
    else result = buildWebtoon(gap);

    saveHistoryState();

    state.pages = result.pages;
    if (result.customPageSize) {
        state.pageSize = result.customPageSize;
        syncPageSizeSelect(result.customPageSize);
    }

    state.currentPage = 0;
    state.currentPanelId = null;
    state.currentSpeechId = null;

    closeLayoutModal();
    pendingImages = [];
    renderSidebar();
    renderCanvas();
}

function syncPageSizeSelect(w, h) {
    const select = document.getElementById('pageSizeSelect');
    if (!select) return;
    const value = w + ',' + h;
    let existing = select.querySelector('option[value="' + value + '"]');
    if (!existing) {
        existing = document.createElement('option');
        existing.value = value;
        existing.textContent = 'Custom Webtoon (' + w + 'x' + h + ')';
        select.appendChild(existing);
    }
    select.value = value;
}

// ------------------------------------------------------------
// Layout 1 - Vertical Webtoon Strip (stacked, adjustable gap)
// ------------------------------------------------------------
function buildWebtoon(gap) {
    const margin = state.innerMarginSize || 40;
    const pageW = state.pageSize[0];
    const usableW = Math.max(60, pageW - margin * 2);

    const panels = [];
    let cursorY = margin;
    let contentH = margin * 2;

    pendingImages.forEach((img, i) => {
        const w = Math.round(usableW);
        const h = Math.max(40, Math.round(usableW * (img.h / img.w)));
        panels.push(makePanel(img, margin, cursorY, w, h));
        cursorY += h;
        contentH += h;
        if (i < pendingImages.length - 1) {
            cursorY += gap;
            contentH += gap;
        }
    });

    const pageH = Math.max(state.pageSize[1], contentH);
    return {
        customPageSize: [pageW, pageH],
        pages: [{ id: makeId(), panels: panels, speechBubbles: [] }]
    };
}

// ------------------------------------------------------------
// Layout 2 & 3 - Standard Page Grid (2x2 / 2x3 cells per page)
// ------------------------------------------------------------
function buildGrid(rows) {
    const cols = 2;
    const margin = state.innerMarginSize || 40;
    const pw = state.pageSize[0];
    const ph = state.pageSize[1];
    const usableW = Math.max(60, pw - margin * 2);
    const usableH = Math.max(60, ph - margin * 2);
    const cellW = usableW / cols;
    const cellH = usableH / rows;
    const perPage = cols * rows;

    const pages = [];
    for (let i = 0; i < pendingImages.length; i += perPage) {
        const chunk = pendingImages.slice(i, i + perPage);
        const panels = chunk.map((img, j) => {
            const col = j % cols;
            const row = Math.floor(j / cols);
            const left = margin + col * cellW;
            const top = margin + row * cellH;
            const right = (col === cols - 1) ? pw - margin : margin + (col + 1) * cellW;
            const bottom = (row === rows - 1) ? ph - margin : margin + (row + 1) * cellH;
            const w = right - left;
            const h = bottom - top;
            return makePanel(img, Math.round(left), Math.round(top), Math.round(w), Math.round(h));
        });
        pages.push({ id: makeId(), panels: panels, speechBubbles: [] });
    }

    return { pages: pages, customPageSize: null };
}

// ------------------------------------------------------------
// Layout 4 - 1 Panel Per Page (storyboard / thumbnailing)
// ------------------------------------------------------------
function buildSingle() {
    const margin = state.innerMarginSize || 40;
    const pw = state.pageSize[0];
    const ph = state.pageSize[1];
    const usableW = pw - margin * 2;
    const usableH = ph - margin * 2;

    const pages = pendingImages.map((img) => {
        const scale = Math.min(usableW / img.w, usableH / img.h);
        const w = Math.max(40, Math.round(img.w * scale));
        const h = Math.max(40, Math.round(img.h * scale));
        const left = Math.round(margin + (usableW - w) / 2);
        const top = Math.round(margin + (usableH - h) / 2);
        return {
            id: makeId(),
            panels: [makePanel(img, left, top, w, h)],
            speechBubbles: []
        };
    });

    return { pages: pages, customPageSize: null };
}

// ------------------------------------------------------------
// PANEL FACTORY - identical shape to the cropper flow
// ------------------------------------------------------------
function makePanel(img, left, top, width, height) {
    return {
        id: makeId(),
        src: img.src,
        name: img.name || '',
        left: left,
        top: top,
        width: width,
        height: height,
        rotation: 0,
        zIndex: 10,
        hasWhiteBorder: false,
        isDistortedMode: false,
        isLocked: false,
        corners: [
            { x: left, y: top },
            { x: left + width, y: top },
            { x: left + width, y: top + height },
            { x: left, y: top + height }
        ]
    };
}

function makeId() {
    return Date.now() + Math.random();
}

function closeLayoutModal() {
    document.getElementById('folderImportModal')?.classList.remove('active');
}
