// ============================================================
// 🖱️ INTERACTIONS — Drag, Resize, Tail Control, Properties
// ============================================================

import { state, els, elsProps, saveHistoryState } from './state.js';
import { renderCanvas } from './canvas.js';

// ============================================================
// 🎯 TAIL DRAGGABLE
// ============================================================

export function makeTailDraggable(handle, data, container, pathEl) {
    if (!handle) return;
    
    let isMovingTail = false;
    let rawTail = { x: 0, y: 0 };

    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        
        isMovingTail = true;
        rawTail.x = data.tailX !== undefined ? data.tailX : data.width / 2;
        rawTail.y = data.tailY !== undefined ? data.tailY : data.height + 30;
        
        window.addEventListener('mousemove', onMoveTail);
        window.addEventListener('mouseup', onUpTail);
    });

    function onMoveTail(e) {
        if (!isMovingTail) return;
        
        rawTail.x += e.movementX / state.zoom;
        rawTail.y += e.movementY / state.zoom;
        
        const displayX = state.snapToGrid ? Math.round(rawTail.x / state.gridSize) * state.gridSize : rawTail.x;
        const displayY = state.snapToGrid ? Math.round(rawTail.y / state.gridSize) * state.gridSize : rawTail.y;
        
        const strokePadding = 4;
        const minX = Math.min(0, displayX) - strokePadding;
        const minY = Math.min(0, displayY) - strokePadding;
        
        handle.style.left = (displayX - minX) + 'px';
        handle.style.top = (displayY - minY) + 'px';
        updateTailPath(data, pathEl, displayX, displayY);
    }

    function onUpTail() {
        isMovingTail = false;
        window.removeEventListener('mousemove', onMoveTail);
        window.removeEventListener('mouseup', onUpTail);
        
        saveHistoryState();
        data.tailX = state.snapToGrid ? Math.round(rawTail.x / state.gridSize) * state.gridSize : rawTail.x;
        data.tailY = state.snapToGrid ? Math.round(rawTail.y / state.gridSize) * state.gridSize : rawTail.y;
        renderCanvas();
    }
}

function updateTailPath(data, pathEl, tailX, tailY) {
    if (!pathEl) return;
    const w = data.width, h = data.height;
    const rx = w / 2, ry = h / 2;
    const tX = tailX !== undefined ? tailX : data.tailX || rx;
    const tY = tailY !== undefined ? tailY : data.tailY || h + 30;

    const distToCenter = Math.hypot(tX - rx, tY - ry);
    
    let path;
    if (data.style === 'thought') {
        const steps = 12;
        let cloudPoints = [];
        for (let i = 0; i < steps; i++) {
            const angle = (i / steps) * Math.PI * 2;
            const wobble = 1 + 0.15 * Math.sin(angle * 3);
            cloudPoints.push({
                x: rx + rx * wobble * Math.cos(angle),
                y: ry + ry * wobble * Math.sin(angle)
            });
        }

        path = `M ${cloudPoints[0].x} ${cloudPoints[0].y}`;
        for (let i = 0; i < steps; i++) {
            const nextIdx = (i + 1) % steps;
            const p1 = cloudPoints[i];
            const p2 = cloudPoints[nextIdx];
            const midX = (p1.x + p2.x) / 2;
            const midY = (p1.y + p2.y) / 2;
            const arcAngle = (i / steps) * Math.PI * 2 + (Math.PI / steps);
            const pushFactor = Math.min(w, h) * 0.18;
            path += ` Q ${midX + pushFactor * Math.cos(arcAngle)} ${midY + pushFactor * Math.sin(arcAngle)}, ${p2.x} ${p2.y}`;
        }
        path += ' Z';
    } else {
        if (distToCenter < 20) {
            path = `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
        } else {
            const angle = Math.atan2(tY - ry, tX - rx);
            const baseSpread = 0.25;
            const p1x = rx + rx * Math.cos(angle - baseSpread);
            const p1y = ry + ry * Math.sin(angle - baseSpread);
            const p2x = rx + rx * Math.cos(angle + baseSpread);
            const p2y = ry + ry * Math.sin(angle + baseSpread);
            const largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;
            path = `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${tX} ${tY} Z`;
        }
    }
    pathEl.setAttribute('d', path);
}

// ============================================================
// 🖱️ ELEMENT INTERACTABLE
// ============================================================

export function makeElementInteractable(element, data, type, resizeHandle) {
    if (!element) return;
    
    let isDragging = false, isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('speech-text') || 
            e.target.classList.contains('tail-control-handle') || 
            e.target.classList.contains('panel-corner-handle')) return;
        e.stopPropagation();
        
        if (type === 'panel') {
            state.currentPanelId = data.id;
            state.currentSpeechId = null;
        } else {
            state.currentSpeechId = data.id;
            state.currentPanelId = null;
            populateSpeechProperties(data);
        }

        document.querySelectorAll('.comic-panel, .speech-box-container').forEach(el => el.classList.remove('selected'));
        element.classList.add('selected');
        openPropertiesPanel(type, data, element);

        if (e.target === resizeHandle) {
            isResizing = true;
        } else {
            isDragging = true;
        }

        startX = e.clientX;
        startY = e.clientY;
        startLeft = data.left;
        startTop = data.top;
        startWidth = data.width;
        startHeight = data.height;

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('mouseup', onMouseUp);
    });

    function onMouseMove(e) {
        const dx = (e.clientX - startX) / state.zoom;
        const dy = (e.clientY - startY) / state.zoom;

        if (isDragging) {
            let targetLeft = startLeft + dx;
            let targetTop = startTop + dy;
            if (state.snapToGrid) {
                targetLeft = Math.round(targetLeft / state.gridSize) * state.gridSize;
                targetTop = Math.round(targetTop / state.gridSize) * state.gridSize;
            }
            
            const deltaX = targetLeft - data.left;
            const deltaY = targetTop - data.top;
            
            data.left = targetLeft;
            data.top = targetTop;
            element.style.left = targetLeft + 'px';
            element.style.top = targetTop + 'px';

            if (data.isDistortedMode && data.corners) {
                data.corners = data.corners.map(c => ({
                    x: c.x + deltaX,
                    y: c.y + deltaY
                }));
                updateDistortionPolygon(element, data);
            }

            updatePropertiesPanel(data);
        }

        if (isResizing) {
            let targetWidth = Math.max(40, startWidth + dx);
            let targetHeight = Math.max(40, startHeight + dy);
            if (state.snapToGrid) {
                targetWidth = Math.round(targetWidth / state.gridSize) * state.gridSize;
                targetHeight = Math.round(targetHeight / state.gridSize) * state.gridSize;
            }
            
            data.width = targetWidth;
            data.height = targetHeight;
            element.style.width = targetWidth + 'px';
            element.style.height = targetHeight + 'px';

            if (data.isDistortedMode && data.corners) {
                const cx = data.left + data.width / 2;
                const cy = data.top + data.height / 2;
                data.corners = data.corners.map(c => ({
                    x: cx + (c.x - cx) * (targetWidth / startWidth),
                    y: cy + (c.y - cy) * (targetHeight / startHeight)
                }));
                updateDistortionPolygon(element, data);
            }

            updatePropertiesPanel(data);
        }
    }

    function onMouseUp() {
        if (isDragging || isResizing) {
            saveHistoryState();
            isDragging = false;
            isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('mouseup', onMouseUp);
            renderCanvas();
        }
    }
}

// ============================================================
// ✅ HELPER: Update SVG polygon without full re-render
// ============================================================

function updateDistortionPolygon(element, data) {
    const svg = element.querySelector('svg');
    if (!svg) return;
    
    const polygon = svg.querySelector('polygon');
    if (!polygon) return;
    
    // Get current bounds of corners
    const xs = data.corners.map(c => c.x);
    const ys = data.corners.map(c => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    
    // ✅ Update panel div position to match corners (ABSOLUTE)
    element.style.left = minX + 'px';
    element.style.top = minY + 'px';
    element.style.width = w + 'px';
    element.style.height = h + 'px';
    
    // ✅ Update polygon points (relative to panel div)
    const points = data.corners.map(c => `${c.x - minX},${c.y - minY}`).join(' ');
    polygon.setAttribute('points', points);
    
    // ✅ Update SVG viewBox to match (RELATIVE to panel div)
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    
    // ✅ Update pattern position (relative to panel div)
    const pattern = svg.querySelector('pattern');
    if (pattern) {
        pattern.setAttribute('x', 0);
        pattern.setAttribute('y', 0);
        pattern.setAttribute('width', w);
        pattern.setAttribute('height', h);
        
        const img = pattern.querySelector('image');
        if (img) {
            img.setAttribute('width', w);
            img.setAttribute('height', h);
        }
    }
}

// ============================================================
// 🎯 CORNER DRAGGABLE — For Distortion Mode
// ============================================================

export function makeCornerDraggable(handle, data, cornerIndex) {
    if (!handle) return;
    let isDragging = false;
    let startX, startY, startCornerX, startCornerY;
    
    handle.addEventListener('mousedown', (e) => {
        e.stopPropagation();
        e.preventDefault();
        isDragging = true;
        
        startX = e.clientX;
        startY = e.clientY;
        startCornerX = data.corners[cornerIndex].x;
        startCornerY = data.corners[cornerIndex].y;
        
        window.addEventListener('mousemove', onMove);
        window.addEventListener('mouseup', onUp);
    });
    
    function onMove(e) {
        if (!isDragging) return;
        const dx = (e.clientX - startX) / state.zoom;
        const dy = (e.clientY - startY) / state.zoom;
        
        let newX = startCornerX + dx;
        let newY = startCornerY + dy;
        
        if (state.snapToGrid) {
            newX = Math.round(newX / state.gridSize) * state.gridSize;
            newY = Math.round(newY / state.gridSize) * state.gridSize;
        }
        
        data.corners[cornerIndex].x = newX;
        data.corners[cornerIndex].y = newY;
        
        const panelElement = handle.closest('.comic-panel');
        if (panelElement) {
            updateDistortionPolygon(panelElement, data);
        }
        
        const xs = data.corners.map(c => c.x);
        const ys = data.corners.map(c => c.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        handle.style.left = (data.corners[cornerIndex].x - minX) + 'px';
        handle.style.top = (data.corners[cornerIndex].y - minY) + 'px';
    }
    
    function onUp() {
        if (isDragging) {
            isDragging = false;
            window.removeEventListener('mousemove', onMove);
            window.removeEventListener('mouseup', onUp);
            saveHistoryState();
            renderCanvas();
        }
    }
}

// ============================================================
// 📋 PROPERTIES PANEL
// ============================================================

export function openPropertiesPanel(type, data, element) {
    if (!els.propertiesPanel) return;
    
    els.propertiesPanel.classList.remove('hidden');
    elsProps.title.innerText = type === 'panel' ? '🖼️ Transform Panel Asset' : '💬 Transform Speech Box';
    
    if (els.panelPropX) els.panelPropX.value = Math.round(data.left);
    if (els.panelPropY) els.panelPropY.value = Math.round(data.top);
    if (els.panelPropW) els.panelPropW.value = Math.round(data.width);
    if (els.panelPropH) els.panelPropH.value = Math.round(data.height);
    
    const rotationInput = document.getElementById('propRotation');
    const rotationNum = document.getElementById('propRotationNum');
    if (rotationInput && data.rotation !== undefined) {
        rotationInput.value = data.rotation || 0;
        if (rotationNum) rotationNum.value = data.rotation || 0;
    }
    
    if (type === 'speech') {
        if (elsProps.contentGroup) elsProps.contentGroup.style.display = 'flex';
        if (elsProps.styleGroup) elsProps.styleGroup.style.display = 'none';
        if (elsProps.bubbleStyle) elsProps.bubbleStyle.value = data.style || 'vector';
        if (elsProps.textModifier) elsProps.textModifier.value = data.text || '';
        if (elsProps.fontColor) elsProps.fontColor.value = data.fontColor || '#000000';
    } else {
        if (elsProps.contentGroup) elsProps.contentGroup.style.display = 'none';
        if (elsProps.styleGroup) elsProps.styleGroup.style.display = 'flex';
        const whiteBorderCheck = document.getElementById('check-white-border');
        if (whiteBorderCheck) whiteBorderCheck.checked = data.hasWhiteBorder || false;
        const distortCheck = document.getElementById('chkDistortMode');
        if (distortCheck) distortCheck.checked = data.isDistortedMode || false;
    }
    
    window._currentEditElement = element;
    window._currentEditData = data;
    window._currentEditType = type;
}

function populateSpeechProperties(data) {
    const fontSelect = document.getElementById('fontFamilySelect');
    if (fontSelect) fontSelect.value = data.fontFamily || "'Arial Black', Gadget, sans-serif";
    const sizeSelect = document.getElementById('fontSizeSelect');
    if (sizeSelect) sizeSelect.value = data.fontSize || '14';
    if (elsProps.fontColor) elsProps.fontColor.value = data.fontColor || '#000000';
}

function updatePropertiesPanel(data) {
    if (!els.propertiesPanel || els.propertiesPanel.classList.contains('hidden')) return;
    if (els.panelPropX) els.panelPropX.value = Math.round(data.left);
    if (els.panelPropY) els.panelPropY.value = Math.round(data.top);
    if (els.panelPropW) els.panelPropW.value = Math.round(data.width);
    if (els.panelPropH) els.panelPropH.value = Math.round(data.height);
}

// ============================================================
// 🔄 SYNC PROPERTIES FROM PANEL
// ============================================================

export function syncPropertiesFromPanel() {
    const data = window._currentEditData;
    if (!data) return;
    
    const x = parseInt(els.panelPropX?.value);
    const y = parseInt(els.panelPropY?.value);
    const w = parseInt(els.panelPropW?.value);
    const h = parseInt(els.panelPropH?.value);
    if (!isNaN(x)) data.left = x;
    if (!isNaN(y)) data.top = y;
    if (!isNaN(w) && w > 0) data.width = w;
    if (!isNaN(h) && h > 0) data.height = h;
    
    const rotation = parseInt(document.getElementById('propRotationNum')?.value);
    if (!isNaN(rotation)) {
        data.rotation = rotation;
        const slider = document.getElementById('propRotation');
        if (slider) slider.value = rotation;
    }
    
    if (window._currentEditType === 'speech') {
        if (elsProps.bubbleStyle) data.style = elsProps.bubbleStyle.value;
        if (elsProps.textModifier) data.text = elsProps.textModifier.value;
        if (elsProps.fontColor) data.fontColor = elsProps.fontColor.value;
        const fontSelect = document.getElementById('fontFamilySelect');
        if (fontSelect) data.fontFamily = fontSelect.value;
        const sizeSelect = document.getElementById('fontSizeSelect');
        if (sizeSelect) data.fontSize = parseInt(sizeSelect.value) || 14;
    }
    
    if (window._currentEditType === 'panel') {
        const whiteBorder = document.getElementById('check-white-border');
        if (whiteBorder) data.hasWhiteBorder = whiteBorder.checked;
        const distort = document.getElementById('chkDistortMode');
        if (distort) data.isDistortedMode = distort.checked;
    }
    
    renderCanvas();
}