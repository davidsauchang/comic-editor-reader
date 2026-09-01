// ============================================================
// ðŸ–±ï¸ INTERACTIONS â€” Drag, Resize, Tail Control, Properties
// ============================================================

import { state, els, elsProps, saveHistoryState } from './state.js';
import { renderCanvas } from './canvas.js';

// ============================================================
// ðŸŽ¯ TAIL DRAGGABLE â€” Speech Bubble Tail (with Touch)
// ============================================================

export function makeTailDraggable(handle, data, container, pathEl) {
    if (!handle) return;

    let isMovingTail = false;

    // Drag-start snapshots so we can track the pointer in *screen* space and
    // convert its delta into *page* space (page is scaled by state.zoom).
    // The handle lives inside the rotated wrapper at a fixed offset from the
    // tail, so we also snapshot its starting local position and shift it by
    // the same delta â€” this keeps the handle glued to the pointer even when
    // the tail moves past the bubble's left/top edge (negative coords).
    let startScreenX = 0, startScreenY = 0;
    let startTailX = 0, startTailY = 0;
    let startHandleX = 0, startHandleY = 0;
    let currentTailX = 0, currentTailY = 0;

    // Pointer Events unify mouse + touch + pen with a single code path, and
    // pointer capture keeps the drag receiving events even when the finger
    // slides off the small handle during a fast pull.
    // `touch-action: none` is critical on mobile: it tells the browser NOT to
    // interpret the gesture as a page scroll/zoom, so the tail actually follows
    // the finger instead of the touch being hijacked.
    handle.style.touchAction = 'none';
    handle.style.userSelect = 'none';
    handle.style.webkitUserSelect = 'none';

    handle.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        e.stopPropagation();
        if (handle.setPointerCapture) {
            try {
                handle.setPointerCapture(e.pointerId);
            } catch (err) { /* capture not supported â€” drag still works */ }
        }
        startTailDrag(e.clientX, e.clientY);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!isMovingTail) return;
        e.preventDefault();
        handleTailMove(e.clientX, e.clientY);
    });

    function finishDrag() {
        if (!isMovingTail) return;
        isMovingTail = false;
        saveHistoryState();
        data.tailX = currentTailX;
        data.tailY = currentTailY;
        renderCanvas();
    }

    handle.addEventListener('pointerup', finishDrag);
    handle.addEventListener('pointercancel', finishDrag);

    function startTailDrag(clientX, clientY) {
        isMovingTail = true;
        startScreenX = clientX;
        startScreenY = clientY;
        startTailX = data.tailX !== undefined ? data.tailX : data.width / 2;
        startTailY = data.tailY !== undefined ? data.tailY : data.height + 30;

        // Handle local position = tail - renderMin, where
        // renderMin = Math.min(0, tail) - 4 was used when canvas.js drew it.
        const strokePadding = 4;
        const renderMinX = Math.min(0, startTailX) - strokePadding;
        const renderMinY = Math.min(0, startTailY) - strokePadding;

        let hx = parseFloat(handle.style.left);
        let hy = parseFloat(handle.style.top);
        startHandleX = Number.isFinite(hx) ? hx : startTailX - renderMinX;
        startHandleY = Number.isFinite(hy) ? hy : startTailY - renderMinY;

        currentTailX = startTailX;
        currentTailY = startTailY;
    }

    function handleTailMove(clientX, clientY) {
        // Convert the screen-space pointer delta into page coordinates, then
        // rotate that delta back into the bubble's local frame so the tail
        // follows the pointer exactly even when the bubble is rotated.
        let dx = (clientX - startScreenX) / state.zoom;
        let dy = (clientY - startScreenY) / state.zoom;

        const rotation = data.rotation || 0;
        if (rotation !== 0) {
            const rad = (rotation * Math.PI) / 180;
            const cos = Math.cos(rad);
            const sin = Math.sin(rad);
            // Inverse of the wrapper's CSS rotate() (clockwise-positive).
            const dxLocal = dx * cos + dy * sin;
            const dyLocal = -dx * sin + dy * cos;
            dx = dxLocal;
            dy = dyLocal;
        }

        const rawX = startTailX + dx;
        const rawY = startTailY + dy;

        const displayX = state.snapToGrid ? Math.round(rawX / state.gridSize) * state.gridSize : rawX;
        const displayY = state.snapToGrid ? Math.round(rawY / state.gridSize) * state.gridSize : rawY;

        currentTailX = displayX;
        currentTailY = displayY;

        // Shift the handle by the same delta as the tail's local-coordinate
        // movement (container-local coords map 1:1 to bubble-local coords).
        handle.style.left = (displayX - startTailX) + startHandleX + 'px';
        handle.style.top = (displayY - startTailY) + startHandleY + 'px';
        updateTailPath(data, pathEl, displayX, displayY);
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
// ðŸ–±ï¸ ELEMENT INTERACTABLE â€” Drag & Resize (with Touch)
// ============================================================

export function makeElementInteractable(element, data, type, resizeHandle) {
    if (!element) return;
    
    let isDragging = false, isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    // --- Mouse ---
    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('speech-text') || 
            e.target.classList.contains('tail-control-handle') || 
            e.target.classList.contains('panel-corner-handle')) return;
        // Lock Panel: prevent moving/resizing a locked image panel, but still
        // allow it to be clicked for selection.
        if (type === 'panel' && data.isLocked && state.currentPage !== -1 && state.currentPanelId === data.id) return;
        e.stopPropagation();
        startDrag(e.clientX, e.clientY, e);
    });

    // â”€â”€ Touch â”€â”€
    element.addEventListener('touchstart', (e) => {
        if (e.target.classList.contains('speech-text') || 
            e.target.classList.contains('tail-control-handle') || 
            e.target.classList.contains('panel-corner-handle')) return;
        if (type === 'panel' && data.isLocked && state.currentPage !== -1 && state.currentPanelId === data.id) return;
        e.preventDefault();
        e.stopPropagation();
        const touch = e.changedTouches[0];
        startDrag(touch.clientX, touch.clientY, e);
    }, { passive: false });

    function startDrag(clientX, clientY, e) {
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

        startX = clientX;
        startY = clientY;
        startLeft = data.left;
        startTop = data.top;
        startWidth = data.width;
        startHeight = data.height;

        window.addEventListener('mousemove', onMouseMove);
        window.addEventListener('touchmove', onTouchMove, { passive: false });
        window.addEventListener('mouseup', onMouseUp);
        window.addEventListener('touchend', onTouchEnd);
    }

    function onMouseMove(e) {
        handleMove(e.clientX, e.clientY);
    }

    function onTouchMove(e) {
        e.preventDefault();
        const touch = e.changedTouches[0];
        handleMove(touch.clientX, touch.clientY);
    }

    function handleMove(clientX, clientY) {
        const dx = (clientX - startX) / state.zoom;
        const dy = (clientY - startY) / state.zoom;

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
        endDrag();
    }

    function onTouchEnd() {
        endDrag();
    }

    function endDrag() {
        if (isDragging || isResizing) {
            saveHistoryState();
            isDragging = false;
            isResizing = false;
            window.removeEventListener('mousemove', onMouseMove);
            window.removeEventListener('touchmove', onTouchMove);
            window.removeEventListener('mouseup', onMouseUp);
            window.removeEventListener('touchend', onTouchEnd);
            // NEW: If dropped onto a different page (scroll view), move the
            // element there and place it on the top layer of that page.
            transferToHoveredPage(data);
            renderCanvas();
        }
    }

    // ============================================================
    // ðŸ—‚ï¸ DRAG-TO-ANOTHER-PAGE (scroll view)
    // Moves an image panel or speech balloon to whichever page it was
    // dropped on, positioning it at the same spot and putting it on the
    // top layer (highest z-index) of the destination page.
    // ============================================================
    function transferToHoveredPage(data) {
        if (state.viewMode !== 'scroll') return;
        if (state.pages.length < 2) return;

        // Locate the dragged element in the live DOM and its source page.
        const node = document.querySelector(`[data-id="${data.id}"]`);
        if (!node) return;
        const srcPage = node.closest('.scroller-page');
        if (!srcPage || !srcPage.parentNode) return;
        const srcIdx = Array.prototype.indexOf.call(srcPage.parentNode.children, srcPage);
        if (srcIdx < 0) return;

        // Element's visual center in viewport coords.
        const er = node.getBoundingClientRect();
        const cX = er.left + er.width / 2;
        const cY = er.top + er.height / 2;

        // Find which page contains that center point.
        const pageNodes = els.canvasContainer.querySelectorAll('.scroller-page');
        let targetIdx = -1;
        pageNodes.forEach((pn, i) => {
            const r = pn.getBoundingClientRect();
            if (cX >= r.left && cX <= r.right && cY >= r.top && cY <= r.bottom) {
                targetIdx = i;
            }
        });
        if (targetIdx === -1 || targetIdx === srcIdx) return;

        const sourcePage = state.pages[srcIdx];
        const targetPage = state.pages[targetIdx];
        const targetRect = pageNodes[targetIdx].getBoundingClientRect();

        // Resolve which array holds the element.
        const arr = type === 'panel' ? sourcePage.panels : sourcePage.speechBubbles;
        const item = arr ? arr.find(el => el.id === data.id) : null;
        if (!item) return;

        // Compute the same visual spot in page-local coordinates of the target.
        const newLeft = ((er.left - targetRect.left) / targetRect.width) * state.pageSize[0];
        const newTop  = ((er.top  - targetRect.top ) / targetRect.height) * state.pageSize[1];
        const offsetX = newLeft - (data.left || 0);
        const offsetY = newTop  - (data.top  || 0);

        // Remove from source page.
        if (type === 'panel') {
            sourcePage.panels = sourcePage.panels.filter(p => p.id !== data.id);
        } else {
            sourcePage.speechBubbles = sourcePage.speechBubbles.filter(s => s.id !== data.id);
        }

        // Translate all of the item's page-local coordinates by the same offset.
        item.left = (item.left || 0) + offsetX;
        item.top  = (item.top  || 0) + offsetY;
        if (item.corners) {
            item.corners = item.corners.map(c => ({ x: c.x + offsetX, y: c.y + offsetY }));
        }
        // NOTE: tailX/tailY are NOT translated â€” they are bubble-LOCAL
        // coordinates (canvas.js draws them inside the SVG viewBox, and
        // tail-dragging stores local deltas), so they must stay relative
        // to the bubble so the tail travels with it to the new page.

        // Place on the top layer of the destination page.
        item.zIndex = getPageMaxZIndex(targetPage) + 1;

        if (type === 'panel') {
            targetPage.panels.push(item);
        } else {
            targetPage.speechBubbles.push(item);
        }

        // Make the destination page active and keep the element selected.
        state.currentPage = targetIdx;
        state.currentPanelId = type === 'panel' ? item.id : null;
        state.currentSpeechId = type === 'speech' ? item.id : null;
    }

    function getPageMaxZIndex(pageData) {
        let max = 10;
        (pageData.panels || []).forEach(p => { if ((p.zIndex || 10) > max) max = p.zIndex; });
        (pageData.speechBubbles || []).forEach(s => { if ((s.zIndex || 50) > max) max = s.zIndex; });
        return max;
    }
}

// ============================================================
// âœ… HELPER: Update SVG polygon without full re-render
// ============================================================

function updateDistortionPolygon(element, data) {
    const svg = element.querySelector('svg');
    if (!svg) return;
    
    const polygon = svg.querySelector('polygon');
    if (!polygon) return;
    
    const xs = data.corners.map(c => c.x);
    const ys = data.corners.map(c => c.y);
    const minX = Math.min(...xs);
    const maxX = Math.max(...xs);
    const minY = Math.min(...ys);
    const maxY = Math.max(...ys);
    const w = maxX - minX;
    const h = maxY - minY;
    
    element.style.left = minX + 'px';
    element.style.top = minY + 'px';
    element.style.width = w + 'px';
    element.style.height = h + 'px';
    
    const points = data.corners.map(c => `${c.x - minX},${c.y - minY}`).join(' ');
    polygon.setAttribute('points', points);
    
    svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', h);
    
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
// ðŸŽ¯ CORNER DRAGGABLE â€” For Distortion Mode (with Touch)
// ============================================================

export function makeCornerDraggable(handle, data, cornerIndex) {
    if (!handle) return;
    let isDragging = false;
    let startX, startY, startCornerX, startCornerY;

    // Pointer Events unify mouse + touch + pen, and `touch-action: none`
    // tells mobile browsers the gesture is a drag, not a scroll. Pointer
    // capture keeps receiving moves if the finger slides off the handle.
    handle.style.touchAction = 'none';
    handle.style.userSelect = 'none';
    handle.style.webkitUserSelect = 'none';

    handle.addEventListener('pointerdown', (e) => {
        if (isDragging) return;
        e.preventDefault();
        e.stopPropagation();
        if (handle.setPointerCapture) {
            try { handle.setPointerCapture(e.pointerId); } catch (err) {}
        }
        startCornerDrag(e.clientX, e.clientY);
    });

    handle.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        handleCornerMove(e.clientX, e.clientY);
    });

    handle.addEventListener('pointerup', endCornerDrag);
    handle.addEventListener('pointercancel', endCornerDrag);

    function startCornerDrag(clientX, clientY) {
        isDragging = true;
        startX = clientX;
        startY = clientY;
        startCornerX = data.corners[cornerIndex].x;
        startCornerY = data.corners[cornerIndex].y;
    }

    function handleCornerMove(clientX, clientY) {
        const dx = (clientX - startX) / state.zoom;
        const dy = (clientY - startY) / state.zoom;

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

        // Update handle position relative to panel
        const xs = data.corners.map(c => c.x);
        const ys = data.corners.map(c => c.y);
        const minX = Math.min(...xs);
        const minY = Math.min(...ys);
        handle.style.left = (data.corners[cornerIndex].x - minX) + 'px';
        handle.style.top = (data.corners[cornerIndex].y - minY) + 'px';
    }

    function endCornerDrag() {
        if (!isDragging) {
            isDragging = false;
            return;
        }
        isDragging = false;
        saveHistoryState();
        renderCanvas();
    }
}

// ============================================================
// ðŸ“‹ PROPERTIES PANEL
// ============================================================

export function openPropertiesPanel(type, data, element) {
    if (!els.propertiesPanel) return;
    
    // The card's visibility (`hidden` class) is driven centrally by
    // js/panel-visibility.js from the '.selected' class added in startDrag;
    // this function only populates the transform fields.
    elsProps.title.innerText = type === 'panel' ? 'ðŸ–¼ï¸ Transform Panel Asset' : 'ðŸ’¬ Transform Speech Box';
    
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
        const lockCheck = document.getElementById('check-lock-panel');
        if (lockCheck) lockCheck.checked = data.isLocked || false;
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
// ðŸ”„ SYNC PROPERTIES FROM PANEL
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
