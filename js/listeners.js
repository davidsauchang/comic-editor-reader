// js/settings.js
import { state } from './state.js';
import { renderCanvas, applyZoom } from './canvas.js';
import { updateGridCSSPosition } from './state.js';

export function initSettings() {
    // Page Size
    document.getElementById('pageSizeSelect')?.addEventListener('change', (e) => {
        state.pageSize = e.target.value.split(',').map(Number);
        renderCanvas();
    });

    // Grid Style
    document.getElementById('gridStyleSelect')?.addEventListener('change', (e) => {
        state.gridStyle = e.target.value;
        renderCanvas();
        updateGridCSSPosition();
    });

    // Zoom
    document.getElementById('zoomSelect')?.addEventListener('change', (e) => {
        applyZoom(parseFloat(e.target.value));
    });

    // Margin Toggle
    document.getElementById('btnToggleMargin')?.addEventListener('change', (e) => {
        state.showInnerMargin = e.target.checked;
        renderCanvas();
    });

    // Snap to Grid
    document.getElementById('chkSnapToGrid')?.addEventListener('change', (e) => {
        state.snapToGrid = e.target.checked;
    });
}