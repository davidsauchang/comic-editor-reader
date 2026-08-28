// ============================================================
// 🎨 CANVAS — Rendering Engine for MangaMesh
// ============================================================

import { state, els, elsProps, clearAllSelections } from './state.js';
import { makeElementInteractable, makeTailDraggable, makeCornerDraggable } from './interactions.js';

// ============================================================
// 📐 RENDER CANVAS
// ============================================================

export function renderCanvas() {
    if (!els.pageCanvas || !els.canvasContainer) {
        console.warn("Canvas elements missing from state object layout selectors.");
        return;
    }
    
    els.pageCanvas.innerHTML = '';
    const oldScroller = els.workspace.querySelector('.pages-scroller');
    if (oldScroller) oldScroller.remove();

    if (state.pages.length === 0 || state.currentPage === -1) return;

    // Reset container
    els.canvasContainer.style.display = 'flex';
    els.canvasContainer.style.justifyContent = 'center';
    els.canvasContainer.style.alignItems = 'flex-start';
    els.canvasContainer.style.padding = '20px';
    els.canvasContainer.style.width = '100%';
    els.canvasContainer.style.minWidth = '0';
    els.canvasContainer.style.boxSizing = 'border-box';
    els.canvasContainer.style.overflow = 'auto';
    els.canvasContainer.classList.remove('scroll-mode');

    if (state.viewMode === 'single') {
        // Single View
        els.pageCanvas.style.display = 'block';
        els.pageCanvas.style.position = 'relative';
        els.pageCanvas.style.width = state.pageSize[0] + 'px';
        els.pageCanvas.style.height = state.pageSize[1] + 'px';
        els.pageCanvas.style.flexShrink = '0';
        els.pageCanvas.style.margin = '0 auto';
        els.pageCanvas.style.alignSelf = 'flex-start';
        els.pageCanvas.style.transformOrigin = 'top center';
        els.pageCanvas.style.transform = `scale(${state.zoom})`;
        els.pageCanvas.className = '';
        
        if (state.gridStyle === 'grid') els.pageCanvas.classList.add('texture-grid');
        if (state.gridStyle === 'dots') els.pageCanvas.classList.add('texture-dots');

        paintPageContents(state.pages[state.currentPage], els.pageCanvas);
        
    } else {
        // Scroll View — Reverted to original working layout style
        els.pageCanvas.style.display = 'none';
        els.canvasContainer.classList.add('scroll-mode');
        
        const scroller = document.createElement('div');
        scroller.className = 'pages-scroller';
        // Matches old code: Block display layout instead of rigid flex-gaps
        scroller.style.display = 'block'; 
        scroller.style.width = '100%';
        scroller.style.maxWidth = '100%';
        scroller.style.boxSizing = 'border-box';
        scroller.style.margin = '0 auto';
        scroller.style.textAlign = 'center'; // Centers inline-block child pages
        
        state.pages.forEach((page, idx) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'scroller-page';
            if (idx === state.currentPage) pageDiv.classList.add('active-page-view');
            
            // Layout dimension definitions
            pageDiv.style.width = state.pageSize[0] + 'px';
            pageDiv.style.height = state.pageSize[1] + 'px';
            pageDiv.style.position = 'relative';
            pageDiv.style.boxSizing = 'border-box';
            
            // Matches old code: display inline-block + clean vertical margin block spacing
            pageDiv.style.display = 'inline-block';
            pageDiv.style.margin = '15px auto 25px auto'; 
            
            // Render scaling transforms directly onto the page blocks
            pageDiv.style.transformOrigin = 'top center';
            pageDiv.style.transform = `scale(${state.zoom})`;
            
            if (state.gridStyle === 'grid') pageDiv.classList.add('texture-grid');
            if (state.gridStyle === 'dots') pageDiv.classList.add('texture-dots');

            const flag = document.createElement('div');
            flag.className = 'canvas-page-marker';
            flag.innerText = `PAGE ${idx + 1}` + (idx === state.currentPage ? ' (ACTIVE)' : '');
            pageDiv.appendChild(flag);

            pageDiv.addEventListener('mousedown', () => {
                if (state.currentPage !== idx) {
                    state.currentPage = idx;
                    renderSidebar();
                    document.querySelectorAll('.scroller-page').forEach((p, i) => p.classList.toggle('active-page-view', i === idx));
                    document.querySelectorAll('.canvas-page-marker').forEach((m, i) => {
                        m.innerText = `PAGE ${i + 1}` + (i === state.currentPage ? ' (ACTIVE)' : '');
                    });
                }
            });

            paintPageContents(page, pageDiv);
            scroller.appendChild(pageDiv);
        });
        
        els.canvasContainer.appendChild(scroller);
    }
}

// ============================================================
// 🖌️ PAINT PAGE CONTENTS
// ============================================================

export function paintPageContents(page, container) {
    if (state.showInnerMargin) {
        const margin = document.createElement('div');
        margin.className = 'margin-guide';
        margin.style.cssText = `
            left: ${state.innerMarginSize}px;
            top: ${state.innerMarginSize}px;
            width: ${state.pageSize[0] - (state.innerMarginSize * 2)}px;
            height: ${state.pageSize[1] - (state.innerMarginSize * 2)}px;
        `;
        container.appendChild(margin);
    }

    // --- Panels ---
    if (page.panels) {
        page.panels.forEach(box => {
            const div = document.createElement('div');
            div.className = 'comic-panel';
            div.setAttribute('data-id', box.id);
            if (state.currentPanelId === box.id) div.classList.add('selected');

            if (box.isDistortedMode && box.corners) {
    // Distorted mode rendering
    const xs = box.corners.map(c => c.x);
    const ys = box.corners.map(c => c.y);
    const minX = Math.min(...xs), maxX = Math.max(...xs);
    const minY = Math.min(...ys), maxY = Math.max(...ys);
    const w = maxX - minX, h = maxY - minY;

    // ✅ FIX: Ensure div captures mouse events
    div.style.cssText = `left: ${minX}px; top: ${minY}px; width: ${w}px; height: ${h}px; z-index: ${box.zIndex || 10}; position: absolute; overflow: visible; pointer-events: auto; cursor: move;`;
    
    const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    svg.setAttribute("width", w);
    svg.setAttribute("height", h);
    svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
    svg.style.cssText = "position: absolute; left: 0; top: 0; overflow: visible; pointer-events: none;";

    const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
    const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
    pattern.setAttribute("id", `pattern-${box.id}`);
    pattern.setAttribute("patternUnits", "userSpaceOnUse");
    pattern.setAttribute("x", minX);
    pattern.setAttribute("y", minY);
    pattern.setAttribute("width", w);
    pattern.setAttribute("height", h);

    const svgImg = document.createElementNS("http://www.w3.org/2000/svg", "image");
    svgImg.setAttributeNS("http://www.w3.org/1999/xlink", "href", box.src);
    svgImg.setAttribute("width", w);
    svgImg.setAttribute("height", h);
    svgImg.setAttribute("preserveAspectRatio", "xMidYMid slice");
    
    pattern.appendChild(svgImg);
    defs.appendChild(pattern);
    svg.appendChild(defs);

    const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    polygon.setAttribute("points", box.corners.map(c => `${c.x},${c.y}`).join(" "));
    polygon.style.cssText = `fill: url(#pattern-${box.id}); ${box.hasWhiteBorder ? "stroke: #ffffff; stroke-width: 8; stroke-linejoin: round;" : "stroke: #000000; stroke-width: 2;"} pointer-events: none;`;
    svg.appendChild(polygon);
    div.appendChild(svg);

    // === FIX #3: DISTORTION MODE CORNER HANDLES ===
    if (state.currentPanelId === box.id) {
        box.corners.forEach((corner, index) => {
            const handle = document.createElement('div');
            handle.className = 'panel-corner-handle red-handle';
            handle.style.cssText = `left: ${corner.x - minX}px; top: ${corner.y - minY}px; pointer-events: auto; cursor: grab;`;
            div.appendChild(handle);
            makeCornerDraggable(handle, box, index);
        });
    }

    makeElementInteractable(div, box, 'panel', null);
    container.appendChild(div);
}
 else {
                // Normal mode
                if (box.hasWhiteBorder) div.classList.add('has-white-border');
                // === FIX #7: ROTATION ===
                // White outline is handled by the .has-white-border class via
                // an outside box-shadow, so the image stays full size.
                div.style.cssText = `left: ${box.left}px; top: ${box.top}px; width: ${box.width}px; height: ${box.height}px; z-index: ${box.zIndex || 10}; transform: rotate(${box.rotation || 0}deg);`;
                
                const img = document.createElement('img');
                img.src = box.src;
                div.appendChild(img);
                const cornerResize = document.createElement('div');
                cornerResize.className = 'panel-resize-handle';
                div.appendChild(cornerResize);
                makeElementInteractable(div, box, 'panel', cornerResize);
                container.appendChild(div);
            }
        });
    }

    // --- Speech Bubbles ---
    if (page.speechBubbles) {
        page.speechBubbles.forEach(box => {
            const div = document.createElement('div');
            div.className = 'speech-box-container';
            div.setAttribute('data-id', box.id);
            if (state.currentSpeechId === box.id) div.classList.add('selected');

            const w = box.width, h = box.height;
            const rx = w / 2, ry = h / 2;
            const tX = box.tailX !== undefined ? box.tailX : rx;
            const tY = box.tailY !== undefined ? box.tailY : h + 30;

            const strokePadding = 4;
            const minX = Math.min(0, tX) - strokePadding;
            const maxX = Math.max(w, tX) + strokePadding;
            const minY = Math.min(0, tY) - strokePadding;
            const maxY = Math.max(h, tY) + strokePadding;

            // === FIX #7: ROTATION ===
            div.style.cssText = `left: ${box.left + minX}px; top: ${box.top + minY}px; width: ${maxX - minX}px; height: ${maxY - minY}px; z-index: ${box.zIndex || 50}; position: absolute; transform: rotate(${box.rotation || 0}deg); overflow: visible !important;`;

            const textContainer = document.createElement('div');
            textContainer.className = 'speech-text-container';
            textContainer.style.cssText = `position: absolute; left: ${-minX}px; top: ${-minY}px; width: ${w}px; height: ${h}px;`;
            
            const span = document.createElement('span');
            span.className = 'speech-text';
            span.contentEditable = true;
            span.textContent = box.text || (box.style === 'title' ? 'ENTER TITLE' : 'Boom!');
            span.style.fontFamily = box.fontFamily || (box.style === 'title' ? "'Bangers', 'Impact', sans-serif" : "'Arial Black', Gadget, sans-serif");
            span.style.fontSize = box.fontSize ? box.fontSize + 'px' : "14px";
            span.style.setProperty('color', box.fontColor || '#000000', 'important');
            span.oninput = () => { box.text = span.textContent; if(elsProps.textModifier) elsProps.textModifier.value = box.text; };

            // === FIX #5: TITLE STYLE ===
            if (box.style === 'title') {
                div.classList.add('transparent-title-style');
                // Title text should be white with black outline
                span.style.color = '#ffffff';
                span.style.textShadow = '-2px -2px 0 #000, 2px -2px 0 #000, -2px 2px 0 #000, 2px 2px 0 #000, 0px 3px 8px rgba(0,0,0,0.8)';
                textContainer.appendChild(span);
                div.appendChild(textContainer);

            } else if (box.style === 'classic') {
                const body = document.createElement('div');
                body.className = 'speech-box classic-box-style';
                body.style.cssText = `width: ${w}px; height: ${h}px;`;
                body.appendChild(span);
                div.appendChild(body);

            // === FIX #4: THOUGHT BUBBLES ===
            } else if (box.style === 'thought') {
                // THOUGHT BUBBLE — Cloud with trailing circles
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "speech-svg");
                svg.setAttribute("width", maxX - minX);
                svg.setAttribute("height", maxY - minY);
                svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
                svg.style.cssText = "position: absolute; left: 0; top: 0; overflow: visible;";

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", "speech-path");
                path.style.cssText = "fill: #ffffff !important; stroke: #090909 !important; stroke-width: 2px; stroke-linejoin: round;";

                // Generate cloud path
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

                let pathData = `M ${cloudPoints[0].x} ${cloudPoints[0].y}`;
                for (let i = 0; i < steps; i++) {
                    const nextIdx = (i + 1) % steps;
                    const p1 = cloudPoints[i];
                    const p2 = cloudPoints[nextIdx];
                    const midX = (p1.x + p2.x) / 2;
                    const midY = (p1.y + p2.y) / 2;
                    const arcAngle = (i / steps) * Math.PI * 2 + (Math.PI / steps);
                    const pushFactor = Math.min(w, h) * 0.18;
                    pathData += ` Q ${midX + pushFactor * Math.cos(arcAngle)} ${midY + pushFactor * Math.sin(arcAngle)}, ${p2.x} ${p2.y}`;
                }
                pathData += ' Z';
                path.setAttribute("d", pathData);
                svg.appendChild(path);

                // Trailing circles (thought bubbles)
                const distToCenter = Math.hypot(tX - rx, tY - ry);
                if (distToCenter > 25) {
                    const angle = Math.atan2(tY - ry, tX - rx);
                    const edgeX = rx + rx * Math.cos(angle);
                    const edgeY = ry + ry * Math.sin(angle);

                    const circles = [
                        { ratio: 0.30, radius: 8 },
                        { ratio: 0.55, radius: 5 },
                        { ratio: 0.75, radius: 3 }
                    ];

                    circles.forEach(({ ratio, radius }) => {
                        const circleX = edgeX + (tX - edgeX) * ratio;
                        const circleY = edgeY + (tY - edgeY) * ratio;
                        const circle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                        circle.setAttribute("cx", circleX);
                        circle.setAttribute("cy", circleY);
                        circle.setAttribute("r", radius);
                        circle.style.cssText = "fill: #ffffff !important; stroke: #090909 !important; stroke-width: 2px;";
                        svg.appendChild(circle);
                    });
                }

                div.appendChild(svg);
                textContainer.appendChild(span);
                div.appendChild(textContainer);

                // Tail handle for thought bubbles
                if (state.currentSpeechId === box.id) {
                    const tailHandle = document.createElement('div');
                    tailHandle.className = 'tail-control-handle';
                    tailHandle.style.cssText = `left:${tX - minX}px; top:${tY - minY}px;`;
                    div.appendChild(tailHandle);
                    makeTailDraggable(tailHandle, box, div, path);
                }

            } else {
                // Default: Vector speech bubble
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "speech-svg");
                svg.setAttribute("width", maxX - minX);
                svg.setAttribute("height", maxY - minY);
                svg.setAttribute("viewBox", `${minX} ${minY} ${maxX - minX} ${maxY - minY}`);
                svg.style.cssText = "position: absolute; left: 0; top: 0; overflow: visible;";

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", "speech-path");
                path.style.cssText = "fill: #ffffff !important; stroke: #090909 !important; stroke-width: 2px; stroke-linejoin: round;";
                
                const pathD = generateSpeechPath(w, h, tX, tY);
                path.setAttribute("d", pathD);
                
                svg.appendChild(path);
                div.appendChild(svg);
                textContainer.appendChild(span);
                div.appendChild(textContainer);

                if (state.currentSpeechId === box.id) {
                    const tailHandle = document.createElement('div');
                    tailHandle.className = 'tail-control-handle';
                    tailHandle.style.cssText = `left:${tX - minX}px; top:${tY - minY}px;`;
                    div.appendChild(tailHandle);
                    makeTailDraggable(tailHandle, box, div, path);
                }
            }

            const cornerResize = document.createElement('div');
            cornerResize.className = 'panel-resize-handle';
            cornerResize.style.cssText = `left: ${w - minX}px; top: ${h - minY}px;`;
            div.appendChild(cornerResize);

            makeElementInteractable(div, box, 'speech', cornerResize);
            container.appendChild(div);
        });
    }
}

// ============================================================
// 🎯 GENERATE SPEECH PATH
// ============================================================

function generateSpeechPath(w, h, tailX, tailY) {
    const rx = w / 2;
    const ry = h / 2;
    const radius = Math.min(w, h) * 0.15;
    const tailWidth = 20;

    const distToCenter = Math.hypot(tailX - rx, tailY - ry);
    
    if (distToCenter < 20) {
        return `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
    }

    const angle = Math.atan2(tailY - ry, tailX - rx);
    const baseSpread = 0.25;
    const p1x = rx + rx * Math.cos(angle - baseSpread);
    const p1y = ry + ry * Math.sin(angle - baseSpread);
    const p2x = rx + rx * Math.cos(angle + baseSpread);
    const p2y = ry + ry * Math.sin(angle + baseSpread);
    const largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;

    return `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${tailX} ${tailY} Z`;
}

// ============================================================
// 🔍 APPLY ZOOM
// ============================================================

export function applyZoom(val) {
    const normalizedZoom = Math.round(val * 100) / 100;
    state.zoom = normalizedZoom;
    
    if (state.viewMode === 'single') {
        const target = els.pageCanvas;
        if (target) {
            target.style.transformOrigin = 'top center';
            target.style.transform = `scale(${normalizedZoom})`;
        }
    } else {
        // Target the parent wrapper instead of individual pages
        // Target the parent wrapper instead of individual pages
const scroller = els.canvasContainer.querySelector('.pages-scroller');
if (scroller) {
    scroller.style.transformOrigin = 'top center';
    scroller.style.transform = `scale(${normalizedZoom})`;
}
    }

    const zoomSelect = document.getElementById('zoomSelect');
    if (zoomSelect) {
        zoomSelect.value = normalizedZoom.toString();
    }
}

// ============================================================
// 📋 RENDER SIDEBAR
// ============================================================

export function renderSidebar() {
    els.pageList.innerHTML = '';
    state.pages.forEach((page, index) => {
        const div = document.createElement('div');
        div.className = `page-item ${index === state.currentPage ? 'active' : ''}`;
        div.innerText = `Comic Page Block ${index + 1}`;
        div.onclick = () => selectPage(index);
        els.pageList.appendChild(div);
    });
}

// ============================================================
// 📄 SELECT PAGE
// ============================================================

export function selectPage(index) {
    state.currentPage = index;
    clearAllSelections();
    renderSidebar();
    renderCanvas();
    if (state.viewMode === 'scroll') {
        const pages = els.canvasContainer.querySelectorAll('.scroller-page');
        if (pages && pages[index]) pages[index].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}