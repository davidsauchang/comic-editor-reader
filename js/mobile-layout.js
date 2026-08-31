// ============================================================
// 📱 MOBILE LAYOUT — Grid & Snapping card placement + visibility
// ============================================================
// On mobile (≤768px) the "Grid & Snapping" card is relocated from the
// bottom control bar into the floating right sidebar (after the
// "Organize Pages" card), and behaves as a page-level tool:
//   • visible when a page is clicked (or nothing is selected)
//   • hidden when an image panel or speech balloon is selected
//     (the "Transform Element" properties card takes over instead)
// The "Layer Control" card in the right sidebar behaves as the inverse:
//   • visible when an image panel or speech balloon is selected
//   • hidden when a page (or nothing) is selected
// On desktop the grid card is returned to its original slot in the left
// sidebar and stays always visible; the desktop layout is unaffected.

const MOBILE_MQ = window.matchMedia('(max-width: 768px)');

let gridBox = null;
let layerBox = null;         // the "Layer Control" card in the right sidebar
let home = null;             // original DOM slot ({ parent, next }) for desktop
let selectionObserver = null;

// ============================================================
// 🔍 Locate the Grid & Snapping card (via its #gridStyleSelect)
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

// ============================================================
// 📦 DOM RELOCATION
// ============================================================

function moveIntoRightSidebar() {
    const box = getGridBox();
    if (!box) return;
    if (box.parentElement?.id === 'sidebar-right') return;

    // Remember the desktop slot the first time, so it can be restored
    if (!home) {
        home = { parent: box.parentElement, next: box.nextElementSibling };
    }

    const anchor =
        document.querySelector('#sidebar-right #pageList')?.closest('.section-box') ||
        document.getElementById('propertiesPanel');
    if (anchor) {
        anchor.after(box);   // right after "Organize Pages", before Transform
    }
}

function restoreToHome() {
    const box = getGridBox();
    if (!box || !home || !home.parent?.isConnected) return;
    if (box.parentElement === home.parent) return;
    home.parent.insertBefore(box, home.next);
}

// ============================================================
// 👁️ VISIBILITY — page-level tool vs. element properties
// ============================================================

function updateGridVisibility() {
    const box = getGridBox();
    if (!box || !box.isConnected) return;

    if (!MOBILE_MQ.matches) {
        // Desktop: the card stays visible in the left sidebar
        box.classList.remove('hidden');
        return;
    }

    // Any selected image panel or speech balloon → hide the card
    const elementSelected = document.querySelector(
        '#canvas-container .comic-panel.selected,' +
        '#canvas-container .speech-box-container.selected'
    );
    box.classList.toggle('hidden', !!elementSelected);
}

// ============================================================
// 🎚️ LAYER CONTROL — element-level tool (inverse of Grid & Snapping)
// ============================================================
// The "Layer Control" card in the right sidebar is the complement of the
// Grid & Snapping card: layer operations only make sense for a selected
// element, so it shows when an image panel or speech balloon is selected
// and hides when a page (or nothing) is selected — on mobile AND desktop,
// exactly matching the behaviour of the "Transform Element" card.

function updateLayerControlVisibility() {
    const box = getLayerBox();
    if (!box || !box.isConnected) return;

    const elementSelected = document.querySelector(
        '#canvas-container .comic-panel.selected,' +
        '#canvas-container .speech-box-container.selected'
    );
    box.classList.toggle('hidden', !elementSelected);
}

// ============================================================
// 🔄 OBSERVER — catches every selection path without touching call sites
// ============================================================
// Selection state is reflected on canvas elements via the '.selected'
// class (added on tap/drag-start, removed by clearAllSelections() and on
// every renderCanvas() rebuild), so watching class/childList mutations on
// the canvas host covers all of them: element taps, page taps,
// canvas-background taps, undo/redo, view switches, deletes…

function watchSelectionChanges() {
    const host = document.getElementById('canvas-container');
    if (!host || selectionObserver) return;
    selectionObserver = new MutationObserver(() => {
        updateGridVisibility();
        updateLayerControlVisibility();
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

function applyMobileLayout() {
    if (MOBILE_MQ.matches) {
        moveIntoRightSidebar();
    } else {
        restoreToHome();
    }
    watchSelectionChanges();          // needed on both breakpoints (Layer Control)
    updateGridVisibility();
    updateLayerControlVisibility();
}

export function initMobileLayout() {
    applyMobileLayout();

    // Re-apply when the viewport crosses the breakpoint
    if (typeof MOBILE_MQ.addEventListener === 'function') {
        MOBILE_MQ.addEventListener('change', applyMobileLayout);
    } else if (typeof MOBILE_MQ.addListener === 'function') {
        MOBILE_MQ.addListener(applyMobileLayout);   // legacy Safari
    }
}
