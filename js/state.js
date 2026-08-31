// ============================================================
// 📦 STATE — Central State Management
// ============================================================

export const state = {
    pages: [],
    currentPage: -1,
    zoom: 1,
    viewMode: 'single',
    pageSize: [414, 896],
    showInnerMargin: true,
    innerMarginSize: 40,
    currentPanelId: null,
    currentSpeechId: null,
    currentCropper: null,
    gridStyle: 'none',
    snapToGrid: false,
    gridSize: 20,
    undoStack: [],
    redoStack: []
};

// ============================================================
// 🎯 DOM REFERENCES
// ============================================================

export const els = {
    pageList: document.getElementById('pageList'),
    pageCanvas: document.getElementById('pageCanvas'),
    workspace: document.getElementById('workspace'),
    canvasContainer: document.getElementById('canvas-container'),
    fileInput: document.getElementById('fileInput'),
    cropperImage: document.getElementById('cropperImage'),
    modal: document.getElementById('cropModal'),
    propertiesPanel: document.getElementById('propertiesPanel'),
    panelPropX: document.getElementById('panelPropX'),
    panelPropY: document.getElementById('panelPropY'),
    panelPropW: document.getElementById('panelPropW'),
    panelPropH: document.getElementById('panelPropH'),
    pageSizeSelect: document.getElementById('pageSizeSelect'),
    fontColor: document.getElementById('propFontColor')
};

export const elsProps = {
    title: document.getElementById('propertiesTitle'),
    sizeGroup: document.getElementById('sizePropGroup'),
    contentGroup: document.getElementById('contentPropGroup'),
    styleGroup: document.getElementById('panelStyleGroup'),
    bubbleStyle: document.getElementById('bubbleStyleSelect'),
    textModifier: document.getElementById('bubbleTextModifier'),
    checkWhiteBorder: document.getElementById('check-white-border'),
    fontColor: document.getElementById('propFontColor')
};

// ============================================================
// 🕰️ HISTORY — Undo/Redo
// ============================================================

export function saveHistoryState() {
    const pagesClone = JSON.stringify(state.pages);
    state.undoStack.push(pagesClone);
    state.redoStack = [];
    
    if (state.undoStack.length > 10) {
        state.undoStack.shift();
    }
}

// ============================================================
// 🧹 CLEAR SELECTIONS
// ============================================================

export function clearAllSelections() {
    state.currentPanelId = null;
    state.currentSpeechId = null;
    // 'hidden' on #propertiesPanel (and Grid & Snapping / Layer Control)
    // is driven by js/panel-visibility.js from the '.selected' removal below
    
    document.querySelectorAll('.comic-panel, .speech-box-container').forEach(el => {
        el.classList.remove('selected');
    });
    
    document.querySelectorAll('.tail-control-handle, .panel-corner-handle').forEach(h => h.remove());
}

// ============================================================
// 📐 GRID POSITION
// ============================================================

export function updateGridCSSPosition() {
    const pageCanvas = document.getElementById('pageCanvas');
    if (pageCanvas) {
        const activeMargin = state.showInnerMargin ? (state.innerMarginSize || 40) : 0;
        pageCanvas.style.backgroundPosition = `${activeMargin}px ${activeMargin}px`;
    }
}

// ============================================================
// 💾 UNSAVED-CHANGES MONITOR
// ============================================================
// A lightweight, call-site-free dirty tracker: every ~800ms we snapshot
// the project *content* (pages + persisted settings) and compare it to
// the last-saved baseline. Any edit path — drags, text input, rotation,
// layer swapping, undo/redo, grid toggles, page add/delete, image crop —
// automatically flips `dirty` without touching each call site.
// View-state (zoom, viewMode, currentPage, selections) is excluded so
// simply looking around or switching pages never triggers a warning.

let savedSnapshot = '';
let dirty = false;

function currentSnapshot() {
    return JSON.stringify({
        pages: state.pages,
        gridStyle: state.gridStyle,
        snapToGrid: state.snapToGrid,
        gridSize: state.gridSize,
        pageSize: state.pageSize,
        showInnerMargin: state.showInnerMargin,
        innerMarginSize: state.innerMarginSize
    });
}

// Call after the initial blank page has been created (and after any
// load/save that should become the clean baseline).
export function initUnsavedChangesMonitor() {
    savedSnapshot = currentSnapshot();
    dirty = false;
    setInterval(() => {
        dirty = (currentSnapshot() !== savedSnapshot);
    }, 800);
}

export function markAsSaved() {
    savedSnapshot = currentSnapshot();
    dirty = false;
}

export function isDirty() {
    return dirty;
}