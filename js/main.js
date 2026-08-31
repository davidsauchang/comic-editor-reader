// ============================================================
// 📦 MAIN — Application Entry Point
// ============================================================

import { state, clearAllSelections } from './state.js';
import { renderCanvas, applyZoom, renderSidebar, selectPage } from './canvas.js';
import { addPage, deletePage, addSpeechBox, deleteSelectedElement, handleImageUpload, applyCrop, cancelCrop, moveLayer } from './actions.js';
import { saveProject, loadProject, exportPDF, exportImages } from './export.js';
import { initSettings } from './settings.js';
import { syncPropertiesFromPanel } from './interactions.js';
import { initPanelVisibility } from './panel-visibility.js';

// ============================================================
// 🖱️ CLICK AWAY — Deselect on Canvas Click
// ============================================================

const canvasContainer = document.getElementById('canvas-container');

canvasContainer?.addEventListener('mousedown', (e) => {
    // Check if clicking on the container background, page canvas, or scroller page
    if (e.target === canvasContainer || 
        e.target.id === 'pageCanvas' || 
        e.target.classList.contains('scroller-page')) {
        clearAllSelections();
        renderCanvas(); // Re-render to remove selection outlines
    }
});

// ============================================================
// 🎯 VIEW TOGGLE
// ============================================================

const btnSingleView = document.getElementById('btnSingleView');
const btnScrollView = document.getElementById('btnScrollView');

function setViewMode(mode) {
    if (!mode || mode === state.viewMode) return;
    
    state.viewMode = mode;
    
    btnSingleView?.classList.toggle('active', mode === 'single');
    btnScrollView?.classList.toggle('active', mode === 'scroll');
    
    renderCanvas();
    setTimeout(() => applyZoom(state.zoom), 10);
}

btnSingleView?.addEventListener('click', () => setViewMode('single'));
btnScrollView?.addEventListener('click', () => setViewMode('scroll'));

// ============================================================
// 📄 PAGE ACTIONS
// ============================================================

document.getElementById('btnAddPage')?.addEventListener('click', addPage);
document.getElementById('btnDeletePage')?.addEventListener('click', deletePage);

// ============================================================
// 🎨 ELEMENT ACTIONS
// ============================================================

document.getElementById('btnAddSpeech')?.addEventListener('click', addSpeechBox);
document.getElementById('btnDeletePanel')?.addEventListener('click', deleteSelectedElement);

// ============================================================
// 🖼️ IMAGE PANEL — Cropper.js
// ============================================================

const fileInput = document.getElementById('fileInput');
fileInput?.addEventListener('change', handleImageUpload);

document.getElementById('btnApplyCrop')?.addEventListener('click', applyCrop);
document.getElementById('btnCancelCrop')?.addEventListener('click', cancelCrop);

// ============================================================
// 📐 LAYER CONTROLS
// ============================================================

document.getElementById('layer-forward')?.addEventListener('click', () => moveLayer('forward'));
document.getElementById('layer-backward')?.addEventListener('click', () => moveLayer('backward'));
document.getElementById('layer-top')?.addEventListener('click', () => moveLayer('top'));
document.getElementById('layer-bottom')?.addEventListener('click', () => moveLayer('bottom'));

// ============================================================
// 💾 PROJECT ACTIONS
// ============================================================

document.getElementById('btnSaveProject')?.addEventListener('click', saveProject);

const loadProjectInput = document.getElementById('btnLoadProject');
loadProjectInput?.addEventListener('change', (e) => {
    loadProject(e.target.files[0]);
    e.target.value = '';
});

document.getElementById('btnExportPDF')?.addEventListener('click', exportPDF);
document.getElementById('btnExportImages')?.addEventListener('click', exportImages);

// ============================================================
// ⚡ UNDO / REDO
// ============================================================

import { saveHistoryState } from './state.js';

function executeUndo() {
    if (state.undoStack.length === 0) return;
    state.redoStack.push(JSON.stringify(state.pages));
    state.pages = JSON.parse(state.undoStack.pop());
    if (state.currentPage >= state.pages.length) {
        state.currentPage = state.pages.length - 1;
    }
    renderCanvas();
}

function executeRedo() {
    if (state.redoStack.length === 0) return;
    state.undoStack.push(JSON.stringify(state.pages));
    state.pages = JSON.parse(state.redoStack.pop());
    renderCanvas();
}

document.getElementById('btnUndo')?.addEventListener('click', executeUndo);
document.getElementById('btnRedo')?.addEventListener('click', executeRedo);

// Keyboard shortcuts
window.addEventListener('keydown', (e) => {
    if (document.activeElement?.contentEditable === 'true' || 
        document.activeElement?.tagName === 'INPUT' || 
        document.activeElement?.tagName === 'TEXTAREA') {
        return;
    }

    if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        executeUndo();
        return;
    }

    if (((e.ctrlKey || e.metaKey) && e.key === 'y') || (e.altKey && e.shiftKey && e.key === 'z')) {
        e.preventDefault();
        executeRedo();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.currentPanelId !== null || state.currentSpeechId !== null) {
            e.preventDefault();
            deleteSelectedElement();
        }
    }
});

// ============================================================
// 🔄 PROPERTIES PANEL SYNC
// ============================================================

document.getElementById('panelPropX')?.addEventListener('change', syncPropertiesFromPanel);
document.getElementById('panelPropY')?.addEventListener('change', syncPropertiesFromPanel);
document.getElementById('panelPropW')?.addEventListener('change', syncPropertiesFromPanel);
document.getElementById('panelPropH')?.addEventListener('change', syncPropertiesFromPanel);

// === FIX #7: ROTATION ===
document.getElementById('propRotation')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value);
    document.getElementById('propRotationNum').value = val;
    if (window._currentEditData) {
        window._currentEditData.rotation = val;
        renderCanvas();
    }
});

document.getElementById('propRotationNum')?.addEventListener('change', (e) => {
    const val = parseInt(e.target.value) || 0;
    document.getElementById('propRotation').value = val;
    if (window._currentEditData) {
        window._currentEditData.rotation = val;
        renderCanvas();
    }
});

document.getElementById('bubbleTextModifier')?.addEventListener('input', syncPropertiesFromPanel);
document.getElementById('bubbleStyleSelect')?.addEventListener('change', syncPropertiesFromPanel);
document.getElementById('fontFamilySelect')?.addEventListener('change', syncPropertiesFromPanel);
document.getElementById('fontSizeSelect')?.addEventListener('change', syncPropertiesFromPanel);

// ============================================================
// 👁️ PANEL VISIBILITY — Grid & Snapping / Layer Control context cards
// ============================================================

initPanelVisibility();
document.getElementById('propFontColor')?.addEventListener('change', syncPropertiesFromPanel);

// === FIX #2: WHITE BORDER ===
document.getElementById('check-white-border')?.addEventListener('change', (e) => {
    if (state.currentPanelId !== null && state.currentPage !== -1) {
        const panel = state.pages[state.currentPage].panels.find(p => p.id === state.currentPanelId);
        if (panel) {
            panel.hasWhiteBorder = e.target.checked;
            renderCanvas();
        }
    }
});

// === FIX #3: DISTORTION MODE ===
document.getElementById('chkDistortMode')?.addEventListener('change', (e) => {
    if (state.currentPanelId !== null && state.currentPage !== -1) {
        const panel = state.pages[state.currentPage].panels.find(p => p.id === state.currentPanelId);
        if (panel) {
            panel.isDistortedMode = e.target.checked;
            if (panel.isDistortedMode) {
                // Rebuild the corners from the panel's CURRENT box so that
                // enabling perspective distortion never snaps the image away
                // from its current position. (Corners are page coordinates.)
                panel.corners = [
                    { x: panel.left, y: panel.top },
                    { x: panel.left + panel.width, y: panel.top },
                    { x: panel.left + panel.width, y: panel.top + panel.height },
                    { x: panel.left, y: panel.top + panel.height }
                ];
            }
            renderCanvas();
        }
    }
});

// ============================================================
// SUPPORT EASTER EGG
// ============================================================

const creditTrigger = document.getElementById('creditTrigger');
const supportModal = document.getElementById('supportModal');
const supportOverlay = document.getElementById('supportOverlay');
const supportModalClose = document.getElementById('supportModalClose');

function openSupportModal() {
    supportModal.style.display = 'block';
    supportOverlay.style.display = 'block';
    document.body.style.overflow = 'hidden';
}

function closeSupportModal() {
    supportModal.style.display = 'none';
    supportOverlay.style.display = 'none';
    document.body.style.overflow = '';
}

// Click the credits -> open modal
creditTrigger?.addEventListener('click', openSupportModal);

// Click close button -> close modal
supportModalClose?.addEventListener('click', closeSupportModal);

// Click overlay -> close modal
supportOverlay?.addEventListener('click', closeSupportModal);

// ESC key -> close modal
document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
        closeSupportModal();
    }
});

// ============================================================
// 🚀 INITIALIZATION
// ============================================================

initSettings();
addPage();

// ============================================================
// 📱 PWA — Register Service Worker
// ============================================================

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js')
            .then((registration) => {
                console.log('[PWA] Service Worker registered with scope:', registration.scope);
            })
            .catch((error) => {
                console.log('[PWA] Service Worker registration failed:', error);
            });
    });
} else {
    console.log('[PWA] Service Workers not supported in this browser.');
}

console.log('✅ MangaMesh ready — Happy creating!');