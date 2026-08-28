// ============================================================
// ⚙️ SETTINGS — Workspace Settings & Controls
// ============================================================

import { state, updateGridCSSPosition } from './state.js';
import { renderCanvas, applyZoom } from './canvas.js';

export function initSettings() {
    
    // --- Page Size ---
    const pageSizeSelect = document.getElementById('pageSizeSelect');
    pageSizeSelect?.addEventListener('change', (e) => {
        const sizes = e.target.value.split(',').map(Number);
        if (sizes.length === 2 && sizes.every(n => !isNaN(n) && n > 0)) {
            state.pageSize = sizes;
            renderCanvas();
        }
    });

    // --- Grid Style ---
    const gridStyleSelect = document.getElementById('gridStyleSelect');
    gridStyleSelect?.addEventListener('change', (e) => {
        state.gridStyle = e.target.value;
        renderCanvas();
        updateGridCSSPosition();
    });

    // --- Zoom ---
    const zoomSelect = document.getElementById('zoomSelect');
    zoomSelect?.addEventListener('change', (e) => {
        const targetZoom = parseFloat(e.target.value);
        if (!isNaN(targetZoom) && targetZoom > 0) {
            applyZoom(targetZoom);
        }
    });

    // --- Inner Margin Toggle ---
    const marginToggle = document.getElementById('btnToggleMargin');
    marginToggle?.addEventListener('change', (e) => {
        state.showInnerMargin = e.target.checked;
        renderCanvas();
    });

    // --- Snap to Grid Toggle ---
    const snapToggle = document.getElementById('chkSnapToGrid');
    snapToggle?.addEventListener('change', (e) => {
        state.snapToGrid = e.target.checked;
    });
}