const state = {
    pages: [],
    currentPage: -1,
    selectedPanel: null,
    zoom: 1,
    mode: 'edit',
    viewMode: 'scroll',
    readerIndex: 0,
    pageSize: [800, 1200],
    cropper: null
};

const els = {
    pageList: document.getElementById('pageList'),
    pageCanvas: document.getElementById('pageCanvas'),
    workspace: document.getElementById('workspace'),
    emptyState: document.getElementById('emptyState'),
    propertiesPanel: document.getElementById('propertiesPanel'),
    cropperModal: document.getElementById('cropperModal'),
    cropperImage: document.getElementById('cropperImage'),
    readerView: document.getElementById('readerView'),
    readerPage: document.getElementById('readerPage'),
    readerCounter: document.getElementById('readerCounter'),
    readerProgress: document.getElementById('readerProgress')
};

// Add view toggle to toolbar
document.querySelector('.toolbar').insertAdjacentHTML('beforeend', `
    <div class="toolbar-group">
        <span style="font-size:0.8rem; color:#888;">View:</span>
        <button class="toolbar-btn" id="btnSingleView">Single</button>
        <button class="toolbar-btn active" id="btnScrollView">Scroll</button>
    </div>
`);

// Init - ONLY BIND ONCE
document.getElementById('btnAddPage').onclick = addPage;
document.getElementById('btnDeletePage').onclick = deletePage;
document.getElementById('btnAddBalloon').onclick = () => addElement('balloon');
document.getElementById('btnAddSFX').onclick = () => addElement('sfx');
document.getElementById('fileInput').onchange = handleImageUpload;
document.getElementById('pageSizeSelect').onchange = changePageSize;
document.querySelectorAll('[data-zoom]').forEach(btn => {
    btn.onclick = () => setZoom(parseFloat(btn.dataset.zoom));
});

document.getElementById('btnEditMode').onclick = () => setMode('edit');
document.getElementById('btnReaderMode').onclick = () => setMode('reader');
document.getElementById('btnExitReader').onclick = () => setMode('edit');
document.getElementById('btnPrevPage').onclick = () => navReader(-1);
document.getElementById('btnNextPage').onclick = () => navReader(1);

document.getElementById('btnSingleView').onclick = () => setViewMode('single');
document.getElementById('btnScrollView').onclick = () => setViewMode('scroll');

document.getElementById('btnFront').onclick = () => layerPanel('front');
document.getElementById('btnBack').onclick = () => layerPanel('back');
document.getElementById('btnDeletePanel').onclick = deleteSelectedPanel;

['propX', 'propY', 'propW', 'propH'].forEach(id => {
    document.getElementById(id).onchange = updatePanelProps;
});

document.getElementById('btnExportHTML').onclick = exportHTML;
document.getElementById('btnExportJSON').onclick = exportJSON;
document.getElementById('loadInput').onchange = loadJSON;

document.getElementById('btnCloseCropper').onclick = closeCropper;
document.getElementById('btnCancelCrop').onclick = closeCropper;
document.getElementById('btnApplyCrop').onclick = applyCrop;

// SINGLE addPage DEFINITION - DELETE THE OTHER ONE
function addPage() {
    const page = {
        id: Date.now() + Math.random(), // Extra random to prevent collision
        name: `Page ${state.pages.length + 1}`,
        width: state.pageSize[0],
        height: state.pageSize[1],
        panels: [],
        elements: []
    };
    state.pages.push(page);
    state.currentPage = state.pages.length - 1;
    state.selectedPanel = null;
    renderPages();
    renderCanvas();

    if (state.viewMode === 'scroll') {
        setTimeout(() => {
            const newPageEl = document.querySelector(`.scroller-page[data-page-id="${page.id}"]`);
            newPageEl?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }, 100);
    }
}

function deletePage() {
    if (state.pages.length === 0) return;

    state.pages.splice(state.currentPage, 1);

    if (state.pages.length === 0) {
        state.currentPage = -1;
    } else {
        state.currentPage = Math.max(0, state.currentPage - 1);
    }

    state.selectedPanel = null;
    renderPages();
    renderCanvas();
}

function renderPages() {
    els.pageList.replaceChildren();

    state.pages.forEach((page, i) => {
        const div = document.createElement('div');
        div.className = 'page-item' + (i === state.currentPage? ' active' : '');
        div.textContent = page.name;
        div.dataset.pageIndex = i;

        div.addEventListener('click', (e) => {
            e.preventDefault();
            e.stopPropagation();
            e.stopImmediatePropagation(); // Extra safety

            const clickedIndex = parseInt(e.currentTarget.dataset.pageIndex);

            // ONLY switch, never add
            if (clickedIndex!== state.currentPage) {
                state.currentPage = clickedIndex;
                state.selectedPanel = null;
                renderPages();

                if (state.viewMode === 'scroll') {
                    renderScrollerView();
                    setTimeout(() => {
                        document.querySelector(`.scroller-page[data-page-id="${state.pages[clickedIndex].id}"]`)
                         ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }, 50);
                } else {
                    renderCanvas();
                }
            }
            return false; // Extra safety
        });

        els.pageList.appendChild(div);
    });
}

function renderCanvas() {
    const oldScroller = els.workspace.querySelector('.pages-scroller');
    if (oldScroller) oldScroller.remove();

    if (state.pages.length === 0) {
        els.emptyState.style.display = 'block';
        els.pageCanvas.style.display = 'none';
        els.workspace.classList.remove('scroller-mode');
        els.propertiesPanel.style.display = 'none';
        return;
    }

    els.emptyState.style.display = 'none';

    if (state.viewMode === 'scroll') {
        renderScrollerView();
    } else {
        renderSingleView();
    }
}

function renderSingleView() {
    els.workspace.classList.remove('scroller-mode');
    els.workspace.style.alignItems = 'center';
    els.workspace.style.justifyContent = 'center';
    els.pageCanvas.style.display = 'block';

    const page = state.pages[state.currentPage];
    if (!page) return;

    els.pageCanvas.style.width = page.width + 'px';
    els.pageCanvas.style.height = page.height + 'px';
    els.pageCanvas.style.transform = `scale(${state.zoom})`;
    els.pageCanvas.innerHTML = '';

    renderPageContent(page, els.pageCanvas);
    els.pageCanvas.onclick = () => selectPanel(null);
}

function renderScrollerView() {
    els.workspace.classList.add('scroller-mode');
    els.pageCanvas.style.display = 'none';

    const scroller = document.createElement('div');
    scroller.className = 'pages-scroller';

    state.pages.forEach((page, idx) => {
        const pageWrapper = document.createElement('div');
        pageWrapper.className = 'scroller-page';
        pageWrapper.dataset.pageId = page.id;
        pageWrapper.dataset.pageIndex = idx;
        pageWrapper.style.width = page.width + 'px';
        pageWrapper.style.height = page.height + 'px';
        pageWrapper.style.transform = `scale(${state.zoom})`;

        if (idx === state.currentPage) {
            pageWrapper.style.outline = '3px solid var(--accent)';
        }

        const label = document.createElement('div');
        label.className = 'scroller-page-label';
        label.textContent = page.name;
        pageWrapper.appendChild(label);

        renderPageContent(page, pageWrapper, idx);

        pageWrapper.onclick = (e) => {
            if (e.target === pageWrapper || e.target === label) {
                e.stopPropagation();
                state.currentPage = idx;
                renderPages();
                renderScrollerView();
                selectPanel(null);
            }
        };

        scroller.appendChild(pageWrapper);
    });

    els.workspace.appendChild(scroller);
}

function renderPageContent(page, container, pageIdx = null) {
    page.panels.forEach((panel, idx) => {
        const div = document.createElement('div');
        div.className = 'comic-panel';
        div.style.left = panel.x + 'px';
        div.style.top = panel.y + 'px';
        div.style.width = panel.w + 'px';
        div.style.height = panel.h + 'px';
        div.style.zIndex = panel.z || idx;

        const img = document.createElement('img');
        img.src = panel.src;
        img.draggable = false;
        div.appendChild(img);

        div.onclick = (e) => {
            e.stopPropagation();
            if (pageIdx!== null) state.currentPage = pageIdx;
            selectPanel(panel, div);
        };

        makeDraggable(div, panel);
        container.appendChild(div);
    });

    page.elements.forEach(el => {
        const div = document.createElement('div');
        div.className = el.type === 'balloon'? 'comic-balloon' : 'comic-sfx';
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        div.contentEditable = true;
        div.textContent = el.text;
        div.onblur = () => el.text = div.textContent;
        div.onclick = (e) => {
            e.stopPropagation();
            if (pageIdx!== null) state.currentPage = pageIdx;
        };
        makeDraggable(div, el);
        container.appendChild(div);
    });
}

function setViewMode(mode) {
    state.viewMode = mode;
    document.getElementById('btnSingleView').classList.toggle('active', mode === 'single');
    document.getElementById('btnScrollView').classList.toggle('active', mode === 'scroll');
    renderCanvas();
}

function selectPanel(panel, element) {
    document.querySelectorAll('.comic-panel.selected').forEach(el => {
        el.classList.remove('selected');
    });

    state.selectedPanel = panel;

    if (panel && element) {
        element.classList.add('selected');
        els.propertiesPanel.style.display = 'block';
        document.getElementById('propX').value = Math.round(panel.x);
        document.getElementById('propY').value = Math.round(panel.y);
        document.getElementById('propW').value = Math.round(panel.w);
        document.getElementById('propH').value = Math.round(panel.h);
    } else {
        els.propertiesPanel.style.display = 'none';
    }
}

function updatePanelProps() {
    if (!state.selectedPanel) return;
    state.selectedPanel.x = parseInt(document.getElementById('propX').value) || 0;
    state.selectedPanel.y = parseInt(document.getElementById('propY').value) || 0;
    state.selectedPanel.w = parseInt(document.getElementById('propW').value) || 100;
    state.selectedPanel.h = parseInt(document.getElementById('propH').value) || 100;
    renderCanvas();
}

function makeDraggable(element, data) {
    let isDown = false, startX, startY, startLeft, startTop;

    element.onmousedown = (e) => {
        if (e.target.contentEditable === 'true') return;
        isDown = true;
        startX = e.clientX;
        startY = e.clientY;
        startLeft = data.x;
        startTop = data.y;
        e.preventDefault();
    };

    document.onmousemove = (e) => {
        if (!isDown) return;
        data.x = startLeft + (e.clientX - startX) / state.zoom;
        data.y = startTop + (e.clientY - startY) / state.zoom;
        element.style.left = data.x + 'px';
        element.style.top = data.y + 'px';

        if (state.selectedPanel === data) {
            document.getElementById('propX').value = Math.round(data.x);
            document.getElementById('propY').value = Math.round(data.y);
        }
    };

    document.onmouseup = () => {
        isDown = false;
    };
}

function handleImageUpload(e) {
    if (state.currentPage === -1) {
        alert('Add a page first!');
        return;
    }

    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        els.cropperModal.classList.add('active');

        if (state.cropper) {
            state.cropper.destroy();
            state.cropper = null;
        }

        els.cropperImage.src = reader.result;

        els.cropperImage.onload = () => {
            setTimeout(() => {
                state.cropper = new Cropper(els.cropperImage, {
                    aspectRatio: NaN,
                    viewMode: 1,
                    dragMode: 'move',
                    autoCropArea: 0.8,
                    restore: false,
                    guides: true,
                    center: true,
                    highlight: false,
                    cropBoxMovable: true,
                    cropBoxResizable: true,
                    toggleDragModeOnDblclick: false,
                    background: false
                });
            }, 150);
        };
    };
    reader.readAsDataURL(file);
    e.target.value = '';
}

function closeCropper() {
    if (state.cropper) {
        state.cropper.destroy();
        state.cropper = null;
    }
    els.cropperModal.classList.remove('active');
    els.cropperImage.src = '';
}

function applyCrop() {
    if (!state.cropper) return;

    const canvas = state.cropper.getCroppedCanvas({
        imageSmoothingQuality: 'high'
    });

    const page = state.pages[state.currentPage];
    if (!page) return;

    page.panels.push({
        x: 50,
        y: 50,
        w: canvas.width > 500? 500 : canvas.width,
        h: canvas.height > 500? 500 : canvas.height,
        src: canvas.toDataURL('image/png'),
        z: page.panels.length
    });

    closeCropper();
    renderCanvas();
}

function addElement(type) {
    if (state.currentPage === -1) return;
    const page = state.pages[state.currentPage];
    page.elements.push({
        type,
        x: 100,
        y: 100,
        text: type === 'balloon'? 'Text here' : 'BOOM!'
    });
    renderCanvas();
}

function deleteSelectedPanel() {
    if (!state.selectedPanel || state.currentPage === -1) return;
    const page = state.pages[state.currentPage];
    const idx = page.panels.indexOf(state.selectedPanel);
    if (idx > -1) page.panels.splice(idx, 1);
    state.selectedPanel = null;
    renderCanvas();
}

function layerPanel(dir) {
    if (!state.selectedPanel || state.currentPage === -1) return;
    const page = state.pages[state.currentPage];
    const panels = page.panels;
    const idx = panels.indexOf(state.selectedPanel);

    if (dir === 'front' && idx < panels.length - 1) {
        [panels[idx], panels[idx + 1]] = [panels[idx + 1], panels[idx]];
    } else if (dir === 'back' && idx > 0) {
        [panels[idx], panels[idx - 1]] = [panels[idx - 1], panels[idx]];
    }

    panels.forEach((p, i) => p.z = i);
    renderCanvas();
}

function changePageSize() {
    const [w, h] = document.getElementById('pageSizeSelect').value.split(',').map(Number);
    state.pageSize = [w, h];
    if (state.currentPage > -1) {
        state.pages[state.currentPage].width = w;
        state.pages[state.currentPage].height = h;
        renderCanvas();
    }
}

function setZoom(z) {
    state.zoom = z;
    renderCanvas();
}

function setMode(mode) {
    state.mode = mode;
    document.getElementById('btnEditMode').classList.toggle('active', mode === 'edit');
    document.getElementById('btnReaderMode').classList.toggle('active', mode === 'reader');

    if (mode === 'reader') {
        if (state.pages.length === 0) {
            alert('Add a page first!');
            setMode('edit');
            return;
        }
        state.readerIndex = 0;
        renderReader();
        els.readerView.classList.add('active');
    } else {
        els.readerView.classList.remove('active');
    }
}

function renderReader() {
    if (state.pages.length === 0) return;

    const page = state.pages[state.readerIndex];
    els.readerPage.innerHTML = '';

    const container = document.createElement('div');
    container.style.position = 'relative';
    container.style.width = page.width + 'px';
    container.style.height = page.height + 'px';
    container.style.background = 'white';
    container.style.transform = 'scale(0.8)';
    container.style.transformOrigin = 'top center';

    page.panels.forEach(p => {
        const img = document.createElement('img');
        img.src = p.src;
        img.style.position = 'absolute';
        img.style.left = p.x + 'px';
        img.style.top = p.y + 'px';
        img.style.width = p.w + 'px';
        img.style.height = p.h + 'px';
        img.style.objectFit = 'cover';
        container.appendChild(img);
    });

    page.elements.forEach(el => {
        const div = document.createElement('div');
        div.className = el.type === 'balloon'? 'comic-balloon' : 'comic-sfx';
        div.style.position = 'absolute';
        div.style.left = el.x + 'px';
        div.style.top = el.y + 'px';
        div.textContent = el.text;
        container.appendChild(div);
    });

    els.readerPage.appendChild(container);
    els.readerCounter.textContent = `${state.readerIndex + 1} / ${state.pages.length}`;
    els.readerProgress.style.width = `${((state.readerIndex + 1) / state.pages.length) * 100}%`;
}

function navReader(dir) {
    state.readerIndex += dir;
    if (state.readerIndex < 0) state.readerIndex = 0;
    if (state.readerIndex >= state.pages.length) state.readerIndex = state.pages.length - 1;
    renderReader();
}

function exportHTML() {
    alert('Export HTML: Coming soon! Use Save Project for now.');
}

function exportJSON() {
    const data = JSON.stringify(state.pages, null, 2);
    const blob = new Blob([data], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'comic-project.json';
    a.click();
    URL.revokeObjectURL(url);
}

function loadJSON(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
        try {
            state.pages = JSON.parse(reader.result);
            state.currentPage = state.pages.length > 0? 0 : -1;
            renderPages();
            renderCanvas();
        } catch (err) {
            alert('Invalid project file');
        }
    };
    reader.readAsText(file);
    e.target.value = '';
}

// Keyboard shortcuts
document.addEventListener('keydown', (e) => {
    if (state.mode === 'reader') {
        if (e.key === 'ArrowLeft') navReader(-1);
        if (e.key === 'ArrowRight') navReader(1);
        if (e.key === 'Escape') setMode('edit');
    } else {
        if (e.key === 'Delete' && state.selectedPanel) deleteSelectedPanel();
        if (e.key === 'Escape') selectPanel(null);
    }
});

// Start with scroll view and one page
setViewMode('scroll');
addPage();
