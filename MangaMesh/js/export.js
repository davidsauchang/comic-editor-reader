// ============================================================
// 📤 EXPORT — PDF, ZIP, and Project Save/Load
// ============================================================

import { state, clearAllSelections } from './state.js';
import { renderCanvas, paintPageContents } from './canvas.js';

// ============================================================
// 📄 PDF EXPORT
// ============================================================

export async function exportPDF() {
    const { jsPDF } = window.jspdf;
    clearAllSelections();
    
    const pdf = new jsPDF({
        orientation: state.pageSize[0] > state.pageSize[1] ? 'l' : 'p',
        unit: 'px',
        format: [state.pageSize[0], state.pageSize[1]]
    });

    for (let i = 0; i < state.pages.length; i++) {
        const mirrorContainer = createMirrorContainer(i);
        document.body.appendChild(mirrorContainer);

        const originalMarginSetting = state.showInnerMargin;
        state.showInnerMargin = false;
        paintPageContents(state.pages[i], mirrorContainer);
        state.showInnerMargin = originalMarginSetting;

        cleanupMirrorContainer(mirrorContainer);

        await new Promise(r => setTimeout(r, 350));

        const canvas = await html2canvas(mirrorContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: state.pageSize[0],
            height: state.pageSize[1],
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage([state.pageSize[0], state.pageSize[1]]);
        pdf.addImage(imgData, 'JPEG', 0, 0, state.pageSize[0], state.pageSize[1]);
        mirrorContainer.remove();
    }

    pdf.save(`Comic_Layout_Project_${Date.now()}.pdf`);
    renderCanvas();
}

// ============================================================
// 🖼️ ZIP EXPORT
// ============================================================

export async function exportImages() {
    clearAllSelections();
    const zip = new JSZip();

    for (let i = 0; i < state.pages.length; i++) {
        const mirrorContainer = createMirrorContainer(i);
        document.body.appendChild(mirrorContainer);

        const originalMarginSetting = state.showInnerMargin;
        state.showInnerMargin = false;
        paintPageContents(state.pages[i], mirrorContainer);
        state.showInnerMargin = originalMarginSetting;

        cleanupMirrorContainer(mirrorContainer);

        await new Promise(r => setTimeout(r, 350));

        const canvas = await html2canvas(mirrorContainer, {
            scale: 2,
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: state.pageSize[0],
            height: state.pageSize[1],
            scrollX: 0,
            scrollY: 0,
            x: 0,
            y: 0
        });

        const imgData = canvas.toDataURL('image/png').split(',')[1];
        zip.file(`Comic_Page_${i + 1}.png`, imgData, { base64: true });
        mirrorContainer.remove();
    }

    zip.generateAsync({ type: 'blob' }).then(content => {
        const link = document.createElement('a');
        link.href = URL.createObjectURL(content);
        link.download = `Comic_Pages_Bundle_${Date.now()}.zip`;
        link.click();
    });

    renderCanvas();
}

// ============================================================
// 💾 PROJECT SAVE/LOAD
// ============================================================

export function saveProject() {
    const saveState = { ...state };
    saveState.currentCropper = null;

    const projectBlob = new Blob([JSON.stringify(saveState, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(projectBlob);
    link.download = `Comic_Workspace_Backup_${Date.now()}.json`;
    link.click();
}

export function loadProject(file) {
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (!parsedData.pages) throw new Error();

            state.pageSize = parsedData.pageSize || [414, 896];
            state.viewMode = parsedData.viewMode || 'single';
            state.gridStyle = parsedData.gridStyle || 'none';
            state.snapToGrid = parsedData.snapToGrid || false;
            state.gridSize = parsedData.gridSize || 20;
            state.pages = parsedData.pages;
            state.currentPage = state.pages.length > 0 ? 0 : -1;
            
            const pageSizeSelect = document.getElementById('pageSizeSelect');
            if (pageSizeSelect) pageSizeSelect.value = state.pageSize.join(',');
            
            const gridStyleSelect = document.getElementById('gridStyleSelect');
            if (gridStyleSelect) gridStyleSelect.value = state.gridStyle;
            
            const chkSnapToGrid = document.getElementById('chkSnapToGrid');
            if (chkSnapToGrid) chkSnapToGrid.checked = state.snapToGrid;

            clearAllSelections();
            renderCanvas();
            
            alert("Project loaded successfully!");
        } catch (err) {
            alert("Oops! That file doesn't look like a valid comic project save data format.");
            console.error(err);
        }
    };
    reader.readAsText(file);
}

// ============================================================
// 🛠️ HELPERS
// ============================================================

function createMirrorContainer(index) {
    const container = document.createElement('div');
    container.style.cssText = `
        position: absolute;
        top: -99999px;
        left: -99999px;
        width: ${state.pageSize[0]}px;
        height: ${state.pageSize[1]}px;
        background-color: #ffffff;
        overflow: visible !important;
    `;
    
    if (state.gridStyle === 'grid') container.classList.add('texture-grid');
    if (state.gridStyle === 'dots') container.classList.add('texture-dots');
    
    return container;
}

function cleanupMirrorContainer(container) {
    container.querySelectorAll('.tail-control-handle, .panel-resize-handle, .panel-corner-handle, .margin-guide, .canvas-page-marker').forEach(el => {
        el.remove();
    });

    container.querySelectorAll('.comic-panel.has-white-border').forEach(panel => {
        // White outline drawn OUTSIDE the image (matches on-canvas look).
        panel.style.setProperty('box-shadow', '0 0 0 6px #ffffff', 'important');
    });

    container.querySelectorAll('.speech-box-container, .speech-svg').forEach(el => {
        el.style.setProperty('overflow', 'visible', 'important');
    });
}