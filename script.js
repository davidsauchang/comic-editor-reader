// ===================== STATE =====================
let project = {
    title: 'Untitled Comic',
    pages: [],
    settings: { defaultWidth: 800, defaultHeight: 1200 }
};
let currentPageIndex = -1;
let selectedPanelId = null;
let zoom = 1;
let mode = 'edit';
let cropper = null;
let pendingImageSrc = null;
let isDragging = false;
let dragOffset = { x: 0, y: 0 };
let isResizing = false;
let resizeDir = '';
let resizeStart = { x: 0, y: 0, w: 0, h: 0, px: 0, py: 0 };

// ===================== DOM REFS =====================
const els = {
    pageList: document.getElementById('pageList'),
    pageCanvas: document.getElementById('pageCanvas'),
    emptyState: document.getElementById('emptyState'),
    fileInput: document.getElementById('fileInput'),
    propertiesPanel: document.getElementById('propertiesPanel'),
    propX: document.getElementById('propX'),
    propY: document.getElementById('propY'),
    propW: document.getElementById('propW'),
    propH: document.getElementById('propH'),
    cropperModal: document.getElementById('cropperModal'),
    cropperImage: document.getElementById('cropperImage'),
    readerView: document.getElementById('readerView'),
    readerPage: document.getElementById('readerPage'),
    readerCounter: document.getElementById('readerCounter'),
    readerProgress: document.getElementById('readerProgress'),
    readerStage: document.getElementById('readerStage'),
    workspace: document.getElementById('workspace'),
    btnEditMode: document.getElementById('btnEditMode'),
    btnReaderMode: document.getElementById('btnReaderMode'),
    pageSizeSelect: document.getElementById('pageSizeSelect')
};

// ===================== INIT =====================
function init() {
    bindEvents();
    loadFromStorage();
    if (project.pages.length === 0) addPage();
    renderPageList();
    selectPage(0);
}

function bindEvents() {
    // Mode toggle
    els.btnEditMode.addEventListener('click', () => setMode('edit'));
    els.btnReaderMode.addEventListener('click', () => setMode('reader'));
    
    // Pages
    document.getElementById('btnAddPage').addEventListener('click', addPage);
    document.getElementById('btnDeletePage').addEventListener('click', deletePage);
    
    // Import
    els.fileInput.addEventListener('change', onFileSelect);
    
    // Properties
    els.propX.addEventListener('change', updateSelectedPanel);
    els.propY.addEventListener('change', updateSelectedPanel);
    els.propW.addEventListener('change', updateSelectedPanel);
    els.propH.addEventListener('change', updateSelectedPanel);
    document.getElementById('btnFront').addEventListener('click', bringToFront);
    document.getElementById('btnBack').addEventListener('click', sendToBack);
    document.getElementById('btnDeletePanel').addEventListener('click', deleteSelectedPanel);
    
    // Cropper
    document.getElementById('btnCloseCropper').addEventListener('click', closeCropper);
    document.getElementById('btnCancelCrop').addEventListener('click', closeCropper);
    document.getElementById('btnApplyCrop').addEventListener('click', applyCrop);
    
    // Reader
    document.getElementById('btnExitReader').addEventListener('click', exitReader);
    document.getElementById('btnPrevPage').addEventListener('click', prevPage);
    document.getElementById('btnNextPage').addEventListener('click', nextPage);
    
    // Toolbar
    els.pageSizeSelect.addEventListener('change', changePageSize);
    document.querySelectorAll('[data-zoom]').forEach(btn => {
        btn.addEventListener('click', () => setZoom(parseFloat(btn.dataset.zoom)));
    });
    
    // Export / Load
    document.getElementById('btnExportHTML').addEventListener('click', exportHTML);
    document.getElementById('btnExportJSON').addEventListener('click', exportJSON);
    document.getElementById('loadInput').addEventListener('change', loadProject);
    
    // Keyboard
    document.addEventListener('keydown', onKeyDown);
}

// ===================== STORAGE =====================
function saveToStorage() {
    try { localStorage.setItem('comicStudioProject', JSON.stringify(project)); }
    catch(e) { console.warn('Storage failed', e); }
}

function loadFromStorage() {
    try {
        const saved = localStorage.getItem('comicStudioProject');
        if (saved) project = JSON.parse(saved);
    } catch(e) { console.warn('Load failed', e); }
}

// ===================== PAGES =====================
function addPage() {
    const page = {
        id: 'page_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        width: project.settings.defaultWidth,
        height: project.settings.defaultHeight,
        panels: [],
        background: '#ffffff'
    };
    project.pages.push(page);
    saveToStorage();
    renderPageList();
    selectPage(project.pages.length - 1);
}

function deletePage() {
    if (project.pages.length <= 1) {
        alert('Cannot delete the last page.');
        return;
    }
    if (!confirm('Delete this page?')) return;
    project.pages.splice(currentPageIndex, 1);
    saveToStorage();
    renderPageList();
    selectPage(Math.min(currentPageIndex, project.pages.length - 1));
}

function selectPage(index) {
    if (index < 0 || index >= project.pages.length) return;
    currentPageIndex = index;
    selectedPanelId = null;
    updatePropertiesPanel();
    renderPageList();
    renderCanvas();
}

function renderPageList() {
    els.pageList.innerHTML = '';
    project.pages.forEach((page, idx) => {
        const div = document.createElement('div');
        div.className = 'page-item ' + (idx === currentPageIndex ? 'active' : '');
        div.addEventListener('click', () => selectPage(idx));
        
        const thumb = page.panels[0] ? page.panels[0].src : '';
        div.innerHTML = `
            <div class="page-thumb">
                ${thumb ? `<img src="${thumb}" alt="">` : (idx + 1)}
            </div>
            <div class="page-info">
                <h4>Page ${idx + 1}</h4>
                <p>${page.panels.length} panels</p>
            </div>
        `;
        els.pageList.appendChild(div);
    });
}

function changePageSize() {
    const val = els.pageSizeSelect.value.split(',');
    const w = parseInt(val[0]), h = parseInt(val[1]);
    const page = project.pages[currentPageIndex];
    if (!page) return;
    page.width = w;
    page.height = h;
    saveToStorage();
    renderCanvas();
}

// ===================== CANVAS =====================
function renderCanvas() {
    const page = project.pages[currentPageIndex];
    
    if (!page) {
        els.pageCanvas.style.display = 'none';
        els.emptyState.style.display = 'block';
        return;
    }
    
    els.emptyState.style.display = 'none';
    els.pageCanvas.style.display = 'block';
    els.pageCanvas.style.width = (page.width * zoom) + 'px';
    els.pageCanvas.style.height = (page.height * zoom) + 'px';
    els.pageCanvas.innerHTML = '';
    els.pageCanvas.style.background = page.background;
    
    page.panels.forEach(panel => {
        const el = document.createElement('div');
        el.className = 'panel-layer' + (panel.id === selectedPanelId ? ' selected' : '');
        el.style.left = (panel.x * zoom) + 'px';
        el.style.top = (panel.y * zoom) + 'px';
        el.style.width = (panel.width * zoom) + 'px';
        el.style.height = (panel.height * zoom) + 'px';
        el.style.zIndex = panel.zIndex || 1;
        el.dataset.id = panel.id;
        
        const img = document.createElement('img');
        img.src = panel.src;
        img.style.objectPosition = `${panel.cropX || 50}% ${panel.cropY || 50}%`;
        el.appendChild(img);
        
        ['nw','ne','sw','se'].forEach(dir => {
            const h = document.createElement('div');
            h.className = 'resize-handle ' + dir;
            h.dataset.dir = dir;
            el.appendChild(h);
        });
        
        el.addEventListener('mousedown', (e) => onPanelMouseDown(e, panel.id));
        els.pageCanvas.appendChild(el);
    });
    
    els.pageCanvas.addEventListener('click', (e) => {
        if (e.target === els.pageCanvas) {
            selectedPanelId = null;
            updatePropertiesPanel();
            renderCanvas();
        }
    });
}

function setZoom(z) {
    zoom = z;
    renderCanvas();
}

// ===================== PANEL INTERACTION =====================
function onPanelMouseDown(e, panelId) {
    if (e.target.classList.contains('resize-handle')) {
        startResize(e, panelId, e.target.dataset.dir);
        return;
    }
    selectedPanelId = panelId;
    updatePropertiesPanel();
    renderCanvas();
    
    isDragging = true;
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
    
    document.addEventListener('mousemove', onPanelDrag);
    document.addEventListener('mouseup', stopPanelDrag);
    e.stopPropagation();
}

function onPanelDrag(e) {
    if (!isDragging || !selectedPanelId) return;
    const page = project.pages[currentPageIndex];
    const panel = page.panels.find(p => p.id === selectedPanelId);
    if (!panel) return;
    
    const dx = (e.clientX - dragOffset.x) / zoom;
    const dy = (e.clientY - dragOffset.y) / zoom;
    
    panel.x = Math.max(0, Math.min(page.width - panel.width, panel.x + dx));
    panel.y = Math.max(0, Math.min(page.height - panel.height, panel.y + dy));
    
    dragOffset.x = e.clientX;
    dragOffset.y = e.clientY;
    
    updatePropertiesPanel();
    renderCanvas();
    saveToStorage();
}

function stopPanelDrag() {
    isDragging = false;
    document.removeEventListener('mousemove', onPanelDrag);
    document.removeEventListener('mouseup', stopPanelDrag);
}

// ===================== RESIZE =====================
function startResize(e, panelId, dir) {
    isResizing = true;
    resizeDir = dir;
    selectedPanelId = panelId;
    const page = project.pages[currentPageIndex];
    const panel = page.panels.find(p => p.id === panelId);
    resizeStart = {
        x: e.clientX, y: e.clientY,
        w: panel.width, h: panel.height,
        px: panel.x, py: panel.y
    };
    document.addEventListener('mousemove', onResize);
    document.addEventListener('mouseup', stopResize);
    e.stopPropagation();
    e.preventDefault();
}

function onResize(e) {
    if (!isResizing) return;
    const page = project.pages[currentPageIndex];
    const panel = page.panels.find(p => p.id === selectedPanelId);
    const dx = (e.clientX - resizeStart.x) / zoom;
    const dy = (e.clientY - resizeStart.y) / zoom;
    
    if (resizeDir.includes('e')) panel.width = Math.max(50, resizeStart.w + dx);
    if (resizeDir.includes('w')) {
        const newW = Math.max(50, resizeStart.w - dx);
        panel.x = resizeStart.px + resizeStart.w - newW;
        panel.width = newW;
    }
    if (resizeDir.includes('s')) panel.height = Math.max(50, resizeStart.h + dy);
    if (resizeDir.includes('n')) {
        const newH = Math.max(50, resizeStart.h - dy);
        panel.y = resizeStart.py + resizeStart.h - newH;
        panel.height = newH;
    }
    
    updatePropertiesPanel();
    renderCanvas();
    saveToStorage();
}

function stopResize() {
    isResizing = false;
    document.removeEventListener('mousemove', onResize);
    document.removeEventListener('mouseup', stopResize);
}

// ===================== PROPERTIES =====================
function updatePropertiesPanel() {
    const page = project.pages[currentPageIndex];
    const p = page ? page.panels.find(p => p.id === selectedPanelId) : null;
    
    if (!p) {
        els.propertiesPanel.style.display = 'none';
        return;
    }
    els.propertiesPanel.style.display = 'block';
    els.propX.value = Math.round(p.x);
    els.propY.value = Math.round(p.y);
    els.propW.value = Math.round(p.width);
    els.propH.value = Math.round(p.height);
}

function updateSelectedPanel() {
    const page = project.pages[currentPageIndex];
    const p = page.panels.find(p => p.id === selectedPanelId);
    if (!p) return;
    p.x = parseInt(els.propX.value) || 0;
    p.y = parseInt(els.propY.value) || 0;
    p.width = parseInt(els.propW.value) || 100;
    p.height = parseInt(els.propH.value) || 100;
    renderCanvas();
    saveToStorage();
}

function bringToFront() {
    const page = project.pages[currentPageIndex];
    const p = page.panels.find(p => p.id === selectedPanelId);
    if (!p) return;
    const maxZ = Math.max(0, ...page.panels.map(p => p.zIndex || 1));
    p.zIndex = maxZ + 1;
    renderCanvas();
    saveToStorage();
}

function sendToBack() {
    const page = project.pages[currentPageIndex];
    const p = page.panels.find(p => p.id === selectedPanelId);
    if (!p) return;
    const minZ = Math.min(999, ...page.panels.map(p => p.zIndex || 1));
    p.zIndex = minZ - 1;
    renderCanvas();
    saveToStorage();
}

function deleteSelectedPanel() {
    const page = project.pages[currentPageIndex];
    page.panels = page.panels.filter(p => p.id !== selectedPanelId);
    selectedPanelId = null;
    updatePropertiesPanel();
    renderCanvas();
    saveToStorage();
}

// ===================== IMAGE IMPORT =====================
function onFileSelect(e) {
    const files = Array.from(e.target.files);
    if (!files.length) return;
    
    const file = files[0];
    const reader = new FileReader();
    reader.onload = (ev) => {
        pendingImageSrc = ev.target.result;
        openCropper(pendingImageSrc);
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

// ===================== CROPPER =====================
function openCropper(src) {
    els.cropperModal.classList.add('active');
    
    if (cropper) { cropper.destroy(); cropper = null; }
    
    els.cropperImage.onload = function() {
        if (cropper) cropper.destroy();
        cropper = new Cropper(els.cropperImage, {
            viewMode: 1,
            autoCropArea: 0.8,
            responsive: true,
            background: false
        });
    };
    els.cropperImage.src = src;
}

function closeCropper() {
    els.cropperModal.classList.remove('active');
    if (cropper) { cropper.destroy(); cropper = null; }
    pendingImageSrc = null;
}

function applyCrop() {
    if (!cropper || !pendingImageSrc) {
        console.log('Cropper not ready or no image');
        return;
    }
    const data = cropper.getData();
    const page = project.pages[currentPageIndex];
    
    const panel = {
        id: 'panel_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9),
        src: pendingImageSrc,
        x: 50,
        y: 50,
        width: Math.min(400, page.width - 100),
        height: Math.min(300, page.height - 100),
        cropX: 50,
        cropY: 50,
        zIndex: (Math.max(0, ...page.panels.map(p => p.zIndex || 1)) + 1)
    };
    
    page.panels.push(panel);
    selectedPanelId = panel.id;
    
    closeCropper();
    updatePropertiesPanel();
    renderCanvas();
    renderPageList();
    saveToStorage();
    console.log('Panel added:', panel.id, 'Total panels:', page.panels.length);
}

// ===================== MODE SWITCH =====================
function setMode(m) {
    mode = m;
    els.btnEditMode.classList.toggle('active', m === 'edit');
    els.btnReaderMode.classList.toggle('active', m === 'reader');
    
    if (m === 'reader') enterReader();
    else exitReader();
}

// ===================== READER =====================
let readerPageIndex = 0;

function enterReader() {
    if (project.pages.length === 0) {
        setMode('edit');
        return;
    }
    readerPageIndex = currentPageIndex;
    els.readerView.classList.add('active');
    renderReaderPage();
}

function exitReader() {
    els.readerView.classList.remove('active');
    setMode('edit');
}

function renderReaderPage() {
    const page = project.pages[readerPageIndex];
    
    els.readerCounter.textContent = `${readerPageIndex + 1} / ${project.pages.length}`;
    els.readerProgress.style.width = ((readerPageIndex + 1) / project.pages.length * 100) + '%';
    
    const scale = Math.min(
        (els.readerStage.clientWidth * 0.9) / page.width,
        (els.readerStage.clientHeight * 0.9) / page.height,
        1
    );
    
    els.readerPage.style.width = (page.width * scale) + 'px';
    els.readerPage.style.height = (page.height * scale) + 'px';
    els.readerPage.innerHTML = '';
    els.readerPage.style.background = page.background;
    els.readerPage.style.position = 'relative';
    els.readerPage.style.overflow = 'hidden';
    
    const sorted = [...page.panels].sort((a, b) => (a.zIndex || 1) - (b.zIndex || 1));
    sorted.forEach(panel => {
        const el = document.createElement('div');
        el.style.position = 'absolute';
        el.style.left = (panel.x * scale) + 'px';
        el.style.top = (panel.y * scale) + 'px';
        el.style.width = (panel.width * scale) + 'px';
        el.style.height = (panel.height * scale) + 'px';
        el.style.overflow = 'hidden';
        
        const img = document.createElement('img');
        img.src = panel.src;
        img.style.width = '100%';
        img.style.height = '100%';
        img.style.objectFit = 'cover';
        img.style.objectPosition = `${panel.cropX || 50}% ${panel.cropY || 50}%`;
        el.appendChild(img);
        els.readerPage.appendChild(el);
    });
}

function prevPage() {
    if (readerPageIndex > 0) {
        readerPageIndex--;
        renderReaderPage();
    }
}

function nextPage() {
    if (readerPageIndex < project.pages.length - 1) {
        readerPageIndex++;
        renderReaderPage();
    }
}

function onKeyDown(e) {
    if (mode !== 'reader') return;
    if (e.key === 'ArrowLeft') prevPage();
    if (e.key === 'ArrowRight') nextPage();
    if (e.key === 'Escape') exitReader();
}

// ===================== EXPORT =====================
function exportHTML() {
    let html = `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${project.title}</title>
<style>
* { margin:0; padding:0; box-sizing:border-box; }
body { background:#1a1a2e; font-family:system-ui; }
.page { max-width:800px; margin:20px auto; background:#fff; position:relative; overflow:hidden; box-shadow:0 10px 40px rgba(0,0,0,0.3); }
.panel { position:absolute; overflow:hidden; }
.panel img { width:100%; height:100%; object-fit:cover; }
.nav { text-align:center; padding:20px; }
.nav button { padding:10px 20px; margin:0 5px; cursor:pointer; }
</style>
</head>
<body>
<h1 style="text-align:center; color:#e94560; padding:20px;">${project.title}</h1>
`;
    project.pages.forEach((page, idx) => {
        html += `<div class="page" id="page${idx}" style="width:${page.width}px; height:${page.height}px; display:${idx===0?'block':'none'};">\n`;
        const sorted = [...page.panels].sort((a,b) => (a.zIndex||1)-(b.zIndex||1));
        sorted.forEach(p => {
            html += `  <div class="panel" style="left:${p.x}px; top:${p.y}px; width:${p.width}px; height:${p.height}px;">\n`;
            html += `    <img src="${p.src}" style="object-position:${p.cropX||50}% ${p.cropY||50}%;">\n`;
            html += `  </div>\n`;
        });
        html += `</div>\n`;
    });
    html += `
<div class="nav">
<button onclick="prevP()">Prev</button>
<span id="counter">1 / ${project.pages.length}</span>
<button onclick="nextP()">Next</button>
</div>
<script>
let cp = 0, total = ${project.pages.length};
function showPage(n) {
    for(let i=0;i<total;i++) document.getElementById('page'+i).style.display = 'none';
    document.getElementById('page'+n).style.display = 'block';
    document.getElementById('counter').textContent = (n+1)+' / '+total;
}
function nextP(){ if(cp<total-1){cp++; showPage(cp);} }
function prevP(){ if(cp>0){cp--; showPage(cp);} }
document.addEventListener('keydown',e=>{ if(e.key==='ArrowRight')nextP(); if(e.key==='ArrowLeft')prevP(); });
<\/script>
</body>
</html>`;
    downloadFile(html, project.title.replace(/\s+/g,'_') + '.html', 'text/html');
}

function exportJSON() {
    const data = JSON.stringify(project, null, 2);
    downloadFile(data, project.title.replace(/\s+/g,'_') + '.json', 'application/json');
}

function loadProject(e) {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => {
        try {
            project = JSON.parse(ev.target.result);
            saveToStorage();
            renderPageList();
            selectPage(0);
            alert('Project loaded!');
        } catch(err) {
            alert('Invalid project file');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

function downloadFile(content, filename, type) {
    const blob = new Blob([content], { type });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
}

// ===================== START =====================
init();