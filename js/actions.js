// ============================================================
// 📦 ACTIONS — Add/Delete Pages, Elements, and Image Panels
// ============================================================

import { state, els, saveHistoryState, clearAllSelections } from './state.js';
import { renderCanvas, renderSidebar } from './canvas.js';

// ============================================================
// 📄 PAGE ACTIONS
// ============================================================

export function addPage() {
    saveHistoryState();
    state.pages.push({ id: Date.now() + Math.random(), panels: [], speechBubbles: [] });
    state.currentPage = state.pages.length - 1;
    renderSidebar();
    renderCanvas();
}

export function deletePage() {
    if (state.pages.length <= 1) {
        alert("Your layout canvas workspace requires at least one project page.");
        return;
    }
    saveHistoryState();
    state.pages.splice(state.currentPage, 1);
    state.currentPage = Math.max(0, state.currentPage - 1);
    clearAllSelections();
    renderSidebar();
    renderCanvas();
}

// ============================================================
// 🎨 ELEMENT ACTIONS
// ============================================================

export function addSpeechBox() {
    if (state.currentPage === -1) return;
    saveHistoryState();
    const maxZ = getMaxZIndex();
    state.pages[state.currentPage].speechBubbles.push({
        id: Date.now() + Math.random(),
        type: 'speech',
        style: 'vector',
        text: 'Boom!',
        fontColor: '#000000',
        left: 200,
        top: 200,
        width: 160,
        height: 90,
        tailX: 80,
        tailY: 140,
        rotation: 0,
        zIndex: maxZ + 1
    });
    renderCanvas();
}

export function deleteSelectedElement() {
    if (state.currentPage === -1) return;
    const page = state.pages[state.currentPage];
    if (state.currentPanelId) {
        page.panels = page.panels.filter(p => p.id !== state.currentPanelId);
        state.currentPanelId = null;
    } else if (state.currentSpeechId) {
        page.speechBubbles = page.speechBubbles.filter(s => s.id !== state.currentSpeechId);
        state.currentSpeechId = null;
    }
    clearAllSelections();
    renderCanvas();
}

export function duplicateSelectedElement() {
    if (state.currentPage === -1) return;
    const page = state.pages[state.currentPage];
    let item = null;
    let kind = null;
    if (state.currentPanelId) {
        item = page.panels.find(p => p.id === state.currentPanelId);
        kind = 'panels';
    } else if (state.currentSpeechId) {
        item = page.speechBubbles.find(s => s.id === state.currentSpeechId);
        kind = 'speechBubbles';
    }
    if (!item || !kind) return;

    saveHistoryState();

    // Deep copy so the duplicate is independent (corners/tail included).
    const copy = JSON.parse(JSON.stringify(item));
    copy.id = Date.now() + Math.random();
    copy.left = (copy.left || 0) + 24;
    copy.top = (copy.top || 0) + 24;
    copy.zIndex = (item.zIndex || 10) + 2;
    if (copy.corners) {
        copy.corners = copy.corners.map((c) => ({ x: c.x + 24, y: c.y + 24 }));
    }

    page[kind].push(copy);

    // Select the duplicate so the floating bar / properties follow it.
    if (kind === 'panels') {
        state.currentPanelId = copy.id;
        state.currentSpeechId = null;
    } else {
        state.currentSpeechId = copy.id;
        state.currentPanelId = null;
    }
    renderCanvas();
}

// ============================================================
// 🖼️ IMAGE PANEL — Cropper.js Integration
// ============================================================

export function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    if (!file.type.startsWith('image/')) {
        alert('Please select an image file.');
        e.target.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(event) {
        els.cropperImage.src = event.target.result;
        els.modal.classList.add('active');

        if (state.currentCropper) {
            state.currentCropper.destroy();
        }
        
        state.currentCropper = new Cropper(els.cropperImage, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            modal: true,
            guides: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false
        });
    };
    reader.readAsDataURL(file);
}

export function applyCrop() {
    if (!state.currentCropper) return;
    if (state.currentPage === -1) {
        alert('Please add a page first.');
        return;
    }
    
    saveHistoryState();
    
    const canvas = state.currentCropper.getCroppedCanvas({
        maxWidth: 2048,
        maxHeight: 2048,
        imageSmoothingQuality: 'high'
    });
    
    const croppedSrc = canvas.toDataURL('image/jpeg', 0.9);
    const maxZ = getMaxZIndex();

    // The cropped canvas carries the *natural* crop pixel dimensions — use
    // them so the panel's aspect ratio matches the crop immediately instead of
    // the old fixed 320×320 square. Fit the crop into the page area (keeping
    // margins), scaling down only as needed; small crops keep their natural
    // pixel size (never upscaled → stays crisp).
    const cropW = canvas.width;
    const cropH = canvas.height;

    const maxPanelW = Math.max(40, state.pageSize[0] - 160);
    const maxPanelH = Math.max(40, state.pageSize[1] - 160);

    let initialWidth = Math.min(cropW, maxPanelW);
    let initialHeight = initialWidth * (cropH / cropW);
    if (initialHeight > maxPanelH) {
        initialHeight = maxPanelH;
        initialWidth = initialHeight * (cropW / cropH);
    }
    initialWidth = Math.round(Math.max(40, initialWidth));
    initialHeight = Math.round(Math.max(40, initialHeight));

    // Center the panel so larger crops stay fully visible on the page.
    const initialLeft = Math.round((state.pageSize[0] - initialWidth) / 2);
    const initialTop = Math.round((state.pageSize[1] - initialHeight) / 2);

    const targetPanel = {
        id: Date.now() + Math.random(),
        src: croppedSrc,
        left: initialLeft,
        top: initialTop,
        width: initialWidth,
        height: initialHeight,
        rotation: 0,
        zIndex: maxZ + 1,
        hasWhiteBorder: false,
        isDistortedMode: false,
        corners: [
            { x: initialLeft, y: initialTop },
            { x: initialLeft + initialWidth, y: initialTop },
            { x: initialLeft + initialWidth, y: initialTop + initialHeight },
            { x: initialLeft, y: initialTop + initialHeight }
        ]
    };

    state.pages[state.currentPage].panels.push(targetPanel);
    els.modal.classList.remove('active');
    
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';

    renderCanvas();
}

export function cancelCrop() {
    els.modal.classList.remove('active');
    const fileInput = document.getElementById('fileInput');
    if (fileInput) fileInput.value = '';
}

// ============================================================
// 🔧 LAYER CONTROLS
// ============================================================

export function moveLayer(action) {
    const active = getActiveElement();
    if (!active || !active.item) return;

    const page = state.pages[state.currentPage];
    let allItems = [];
    page.panels.forEach(p => allItems.push({ obj: p, z: p.zIndex || 10 }));
    page.speechBubbles.forEach(s => allItems.push({ obj: s, z: s.zIndex || 50 }));
    
    allItems.sort((a, b) => a.z - b.z);
    let idx = allItems.findIndex(x => x.obj.id === active.item.id);
    if (idx === -1) return;

    if (action === 'forward' && idx < allItems.length - 1) {
        let temp = allItems[idx].z;
        allItems[idx].obj.zIndex = allItems[idx + 1].z;
        allItems[idx + 1].obj.zIndex = temp;
    } else if (action === 'backward' && idx > 0) {
        let temp = allItems[idx].z;
        allItems[idx].obj.zIndex = allItems[idx - 1].z;
        allItems[idx - 1].obj.zIndex = temp;
    } else if (action === 'top') {
        let topZ = allItems[allItems.length - 1].z;
        active.item.zIndex = topZ + 2;
    } else if (action === 'bottom') {
        let botZ = allItems[0].z;
        active.item.zIndex = Math.max(1, botZ - 2);
    }

    renderCanvas();
}

// ============================================================
// 🛠️ HELPERS
// ============================================================

function getMaxZIndex() {
    if (state.currentPage === -1) return 10;
    const page = state.pages[state.currentPage];
    let max = 10;
    page.panels.forEach(p => { if ((p.zIndex || 10) > max) max = p.zIndex; });
    page.speechBubbles.forEach(s => { if ((s.zIndex || 50) > max) max = s.zIndex; });
    return max;
}

function getActiveElement() {
    if (state.currentPage === -1) return null;
    const page = state.pages[state.currentPage];
    if (state.currentPanelId) {
        return { item: page.panels.find(p => p.id === state.currentPanelId), type: 'panel' };
    }
    if (state.currentSpeechId) {
        return { item: page.speechBubbles.find(s => s.id === state.currentSpeechId), type: 'speech' };
    }
    return null;
}