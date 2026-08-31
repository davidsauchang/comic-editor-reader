// ============================================================
// 👁️ PANEL VISIBILITY — context cards in the right sidebar
// ============================================================
// The right sidebar holds context cards whose visibility follows the
// canvas selection (identical behaviour on mobile and desktop):
//   • PAGE-LEVEL    — "Grid & Snapping": visible when a page (or
//     nothing) is selected, hidden when an image panel or speech
//     balloon is selected.
//   • ELEMENT-LEVEL — "Transform Element" (#propertiesPanel) and
//     "Layer Control": visible ONLY while an image panel or speech
//     balloon is selected.
// The cards live statically in the HTML; this module drives only
// their `hidden` class — field population stays in interactions.js.
//
// Selection state is reflected on canvas elements via the '.selected'
// class (added on tap/drag-start, removed by clearAllSelections() and
// on every renderCanvas() rebuild), so watching class/childList
// mutations on the canvas host covers every selection path: element
// taps, page taps, canvas-background taps, undo/redo, view switches,
// deletes… — without touching any call sites.

let gridBox = null;
let propertiesBox = null;
let layerBox = null;
let selectionObserver = null;

// ============================================================
// 🔍 Locate the two cards (via their controls, not :has())
// ============================================================

function getGridBox() {
    if (gridBox && gridBox.isConnected) return gridBox;
    gridBox = document.getElementById('gridStyleSelect')?.closest('.section-box') || null;
    return gridBox;
}

function getLayerBox() {
    if (layerBox && layerBox.isConnected) return layerBox;
    layerBox = document.getElementById('layer-forward')?.closest('.section-box') || null;
    return layerBox;
}

// #propertiesPanel IS the .section-box card itself (no closest() needed)
function getPropertiesBox() {
    if (propertiesBox && propertiesBox.isConnected) return propertiesBox;
    propertiesBox = document.getElementById('propertiesPanel');
    return propertiesBox;
}

// ============================================================
// 🧩 Shared selection probe
// ============================================================

function elementIsSelected() {
    return !!document.querySelector(
        '#canvas-container .comic-panel.selected,' +
        '#canvas-container .speech-box-container.selected'
    );
}

// ============================================================
// 👁️ VISIBILITY — page-level tool vs. element-level tools
// ============================================================

// Grid & Snapping: page-level → visible unless an element is selected
function updateGridVisibility() {
    const box = getGridBox();
    if (!box || !box.isConnected) return;
    box.classList.toggle('hidden', elementIsSelected());
}

// Transform Element + Layer Control: element-level → visible only while an
// element is selected (they share the exact same condition)
function updateElementCardsVisibility() {
    const show = elementIsSelected();

    const props = getPropertiesBox();
    if (props && props.isConnected) props.classList.toggle('hidden', !show);

    const layer = getLayerBox();
    if (layer && layer.isConnected) layer.classList.toggle('hidden', !show);
}

// ============================================================
// 🔄 OBSERVER — catches every selection path without touching call sites
// ============================================================

function watchSelectionChanges() {
    const host = document.getElementById('canvas-container');
    if (!host || selectionObserver) return;
    selectionObserver = new MutationObserver(() => {
        updateGridVisibility();
        updateElementCardsVisibility();
    });
    selectionObserver.observe(host, {
        subtree: true,
        childList: true,
        attributes: true,
        attributeFilter: ['class']
    });
}

// ============================================================
// 🚀 INIT
// ============================================================

export function initPanelVisibility() {
    watchSelectionChanges();
    updateGridVisibility();
    updateElementCardsVisibility();
}