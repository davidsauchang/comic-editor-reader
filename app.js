// ===========================================================================
// COMIC LAYOUT CREATOR CORE ENGINE — CLEAN CONSOLIDATED PRODUCTION EDITION
// ===========================================================================

const state = {
    pages: [],
    currentPage: -1,
    zoom: 1,
    viewMode: 'scroll',
    pageSize: [400, 915],
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

const els = {
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

const elsProps = {
    title: document.getElementById('propertiesTitle'),
    sizeGroup: document.getElementById('sizePropGroup'),
    contentGroup: document.getElementById('contentPropGroup'),
    styleGroup: document.getElementById('panelStyleGroup'),
    bubbleStyle: document.getElementById('bubbleStyleSelect'),
    textModifier: document.getElementById('bubbleTextModifier'),
    checkWhiteBorder: document.getElementById('check-white-border')
};

// --- STATE HISTORY SNAPSHOT MANAGER ---

function saveHistoryState() {
    const pagesClone = JSON.stringify(state.pages);
    state.undoStack.push(pagesClone);
    state.redoStack = [];
    
    if (state.undoStack.length > 10) {
        state.undoStack.shift();
    }
}

// --- INITIALIZATION & CORE WORKSPACE CONTROLS ---

document.getElementById('btnAddPage').addEventListener('click', () => addPage());
document.getElementById('btnDeletePage').addEventListener('click', () => deletePage());
els.pageSizeSelect.addEventListener('change', (e) => {
    state.pageSize = e.target.value.split(',').map(Number);
    renderCanvas();
});

document.getElementById('btnSingleView').addEventListener('click', () => switchViewMode('single'));
document.getElementById('btnScrollView').addEventListener('click', () => switchViewMode('scroll'));
document.getElementById('btnToggleMargin').addEventListener('click', () => {
    state.showInnerMargin = !state.showInnerMargin;
    renderCanvas();
});

// --- GRID SYSTEM CONTROLS (UPDATED FOR PERFECT ALIGNMENT) ---
document.getElementById('gridStyleSelect').addEventListener('change', (e) => {
    state.gridStyle = e.target.value;
    renderCanvas();
    updateGridCSSPosition(); // 🌟 Force the visual grid background to align
});

document.getElementById('chkSnapToGrid').addEventListener('change', (e) => {
    state.snapToGrid = e.target.checked;
});

// ⚡ HELPER FUNCTION: Keeps background patterns locked directly to margins
function updateGridCSSPosition() {
    const pageCanvas = document.getElementById('pageCanvas');
    if (pageCanvas) {
        // If your inner margins are active, use their value (e.g. 40px), otherwise default to 0
        const activeMargin = state.showInnerMargin ? (state.innerMarginSize || 40) : 0;
        pageCanvas.style.backgroundPosition = `${activeMargin}px ${activeMargin}px`;
    }
}

// Element Injection Triggers
els.fileInput.addEventListener('change', handleImageUpload);
document.getElementById('btnAddSpeech').addEventListener('click', addSpeechBox);

// Layout Controls
document.getElementById('layer-forward').addEventListener('click', () => moveLayer('forward'));
document.getElementById('layer-backward').addEventListener('click', () => moveLayer('backward'));
document.getElementById('layer-top').addEventListener('click', () => moveLayer('top'));
document.getElementById('layer-bottom').addEventListener('click', () => moveLayer('bottom'));
document.getElementById('btnDeletePanel').addEventListener('click', deleteSelectedElement);

if (elsProps.checkWhiteBorder) {
    elsProps.checkWhiteBorder.addEventListener('change', (e) => {
        if (state.currentPanelId !== null && state.currentPage !== -1) {
            const panel = state.pages[state.currentPage].panels.find(p => p.id === state.currentPanelId);
            if (panel) {
                saveHistoryState();
                panel.hasWhiteBorder = e.target.checked;
                renderCanvas();
            }
        }
    });
}

// 🎨 SAFE LIVE FONT COLOR UPDATE
if (elsProps.fontColor) {
    elsProps.fontColor.addEventListener('change', (e) => {
        if (state.currentSpeechId !== null && state.currentPage !== -1) {
            const activeBubble = state.pages[state.currentPage].speechBubbles.find(b => b.id === state.currentSpeechId);
            if (activeBubble) {
                saveHistoryState();
                activeBubble.fontColor = e.target.value;
                
                const bubbleWrapper = document.querySelector(`[data-id="${state.currentSpeechId}"]`);
                if (bubbleWrapper) {
                    const textNode = bubbleWrapper.querySelector('.speech-text') || bubbleWrapper.querySelector('span');
                    if (textNode) {
                        // 🌟 Override the stylesheet styles instantly
                        textNode.style.setProperty('color', e.target.value, 'important');
                    }
                }
            }
        }
    });
}

// Perspective Distortion Mode Control Hook
const chkDistortMode = document.getElementById('chkDistortMode');
if (chkDistortMode) {
    chkDistortMode.addEventListener('change', (e) => {
        if (state.currentPanelId !== null && state.currentPage !== -1) {
            const panel = state.pages[state.currentPage].panels.find(p => p.id === state.currentPanelId);
            if (panel) {
                saveHistoryState();
                panel.isDistortedMode = e.target.checked;
                
                if (panel.isDistortedMode) {
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
}

// Undo & Redo Controls
function executeUndo() {
    if (state.undoStack.length === 0) return;

    state.redoStack.push(JSON.stringify(state.pages));
    const previousPagesState = state.undoStack.pop();
    state.pages = JSON.parse(previousPagesState);

    if (state.currentPage >= state.pages.length) {
        state.currentPage = state.pages.length - 1;
    }

    clearAllSelections();
    renderSidebar();
    renderCanvas();
}

function executeRedo() {
    if (state.redoStack.length === 0) return;

    state.undoStack.push(JSON.stringify(state.pages));
    const nextPagesState = state.redoStack.pop();
    state.pages = JSON.parse(nextPagesState);

    clearAllSelections();
    renderSidebar();
    renderCanvas();
}

// Global Workspace Click-Away Focus Manager
els.canvasContainer.addEventListener('mousedown', (e) => {
    if (e.target === els.canvasContainer || e.target.id === 'pageCanvas' || e.target.classList.contains('scroller-page')) {
        clearAllSelections();
    }
});

function clearAllSelections() {
    state.currentPanelId = null;
    state.currentSpeechId = null;
    els.propertiesPanel.classList.add('hidden');
    
    document.querySelectorAll('.comic-panel, .speech-box-container').forEach(el => {
        el.classList.remove('selected');
    });
    
    document.querySelectorAll('.tail-control-handle, .panel-corner-handle').forEach(h => h.remove());
}

// --- WORKSPACE VIEW MODE CONTROLLER ---

function switchViewMode(mode) {
    state.viewMode = mode;
    document.getElementById('btnSingleView').classList.toggle('active', mode === 'single');
    document.getElementById('btnScrollView').classList.toggle('active', mode === 'scroll');
    renderCanvas();
}

function applyZoom(val) {
    state.zoom = val;
    let target = null;
    if (state.viewMode === 'single') {
        target = els.pageCanvas;
    } else {
        target = els.workspace.querySelector('.pages-scroller');
    }
    if (target) {
        target.style.transformOrigin = 'top center';
        target.style.transform = `scale(${val})`;
    }
}

// --- PROJECT PAGE LAYER DATA MANAGEMENT ---

function addPage() {
    saveHistoryState();
    
    const newPage = {
        id: Date.now() + Math.random(),
        panels: [],
        speechBubbles: []
    };
    
    state.pages.push(newPage);
    
    state.currentPageIndex = state.pages.length - 1;
    state.currentPage = state.pages.length - 1; 
    
    renderSidebar();
    renderCanvas();
    
    setTimeout(() => {
        const pageList = document.getElementById('pageList');
        if (pageList) pageList.scrollTop = pageList.scrollHeight;
    }, 50);
}

function deletePage() {
    if (state.pages.length <= 1) {
        alert("Your layout canvas workspace requires at least one project page.");
        return;
    }
    saveHistoryState();
    state.pages.splice(state.currentPage, 1);
    state.currentPage = Math.max(0, state.currentPage - 1);
    clearAllSelections();
    renderSidebar();
    renderCanvas();
}

// --- CANVAS RENDERING PIPELINE ENGINE ---

function renderCanvas() {
    els.pageCanvas.innerHTML = '';
    const activeWorkspace = els.workspace;
    const oldScroller = activeWorkspace.querySelector('.pages-scroller');
    if (oldScroller) oldScroller.remove();

    if (state.pages.length === 0 || state.currentPage === -1) return;

    if (state.viewMode === 'single') {
        els.pageCanvas.style.display = 'block';
        els.pageCanvas.style.width = state.pageSize[0] + 'px';
        els.pageCanvas.style.height = state.pageSize[1] + 'px';
        
        els.pageCanvas.className = '';
        if (state.gridStyle === 'grid') els.pageCanvas.classList.add('texture-grid');
        if (state.gridStyle === 'dots') els.pageCanvas.classList.add('texture-dots');

        paintPageContents(state.pages[state.currentPage], els.pageCanvas);
        applyZoom(state.zoom);
    } else {
        els.pageCanvas.style.display = 'none';
        
        const scroller = document.createElement('div');
        scroller.className = 'pages-scroller';
        
        state.pages.forEach((page, idx) => {
            const pageDiv = document.createElement('div');
            pageDiv.className = 'scroller-page';
            if (idx === state.currentPage) pageDiv.classList.add('active-page-view');
            pageDiv.style.width = state.pageSize[0] + 'px';
            pageDiv.style.height = state.pageSize[1] + 'px';
            
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
                    document.querySelectorAll('.scroller-page').forEach((p, i) => {
                        p.classList.toggle('active-page-view', i === idx);
                    });
                    document.querySelectorAll('.canvas-page-marker').forEach((m, i) => {
                        m.innerText = `PAGE ${i + 1}` + (i === state.currentPage ? ' (ACTIVE)' : '');
                    });
                }
            });

            paintPageContents(page, pageDiv);
            scroller.appendChild(pageDiv);
        });
        
        els.canvasContainer.appendChild(scroller);
        applyZoom(state.zoom);
    }
}

function paintPageContents(page, container) {
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

    // 1. Draw Graphic Panels
    if (page.panels) {
        page.panels.forEach(box => {
            const div = document.createElement('div');
            div.className = 'comic-panel';
            div.setAttribute('data-id', box.id);
            if (state.currentPanelId === box.id) div.classList.add('selected');

            // --- MODE A: PERSPECTIVE CORNER DISTORTION RENDERING MODE ---
            if (box.isDistortedMode && box.corners) {
                const xs = box.corners.map(c => c.x);
                const ys = box.corners.map(c => c.y);
                const minX = Math.min(...xs);
                const maxX = Math.max(...xs);
                const minY = Math.min(...ys);
                const maxY = Math.max(...ys);
                const w = maxX - minX;
                const h = maxY - minY;

                div.style.cssText = `
                    left: ${minX}px;
                    top: ${minY}px;
                    width: ${w}px;
                    height: ${h}px;
                    z-index: ${box.zIndex || 10};
                    position: absolute;
                    overflow: visible;
                `;

                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("width", w);
                svg.setAttribute("height", h);
                svg.setAttribute("viewBox", `${minX} ${minY} ${w} ${h}`);
                svg.style.cssText = "position: absolute; left: 0; top: 0; overflow: visible;";

                const defs = document.createElementNS("http://www.w3.org/2000/svg", "defs");
                const pattern = document.createElementNS("http://www.w3.org/2000/svg", "pattern");
                const patternId = `pattern-${box.id}`;
                pattern.setAttribute("id", patternId);
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
                const pointsString = box.corners.map(c => `${c.x},${c.y}`).join(" ");
                polygon.setAttribute("points", pointsString);
                
                const strokeStyle = box.hasWhiteBorder ? "stroke: #ffffff; stroke-width: 8; stroke-linejoin: round;" : "stroke: #000000; stroke-width: 2;";
                polygon.style.cssText = `fill: url(#${patternId}); ${strokeStyle}`;
                svg.appendChild(polygon);
                div.appendChild(svg);

                if (state.currentPanelId === box.id) {
                    box.corners.forEach((corner, index) => {
                        const handle = document.createElement('div');
                        handle.className = 'panel-corner-handle red-handle';
                        handle.style.left = (corner.x - minX) + 'px';
                        handle.style.top = (corner.y - minY) + 'px';
                        div.appendChild(handle);
                        makeCornerDraggable(handle, box, index);
                    });
                }
                
                makeElementInteractable(div, box, 'panel', null);
                container.appendChild(div);

            // --- MODE B: CLASSIC BOUNDING-BOX RECTANGLE MODE ---
            } else {
                if (box.hasWhiteBorder) div.classList.add('has-white-border');
                const borderStyle = box.hasWhiteBorder 
                    ? 'box-sizing: border-box !important; border: 6px solid #ffffff !important;' 
                    : '';

                div.style.cssText = `
                    left: ${box.left}px;
                    top: ${box.top}px;
                    width: ${box.width}px;
                    height: ${box.height}px;
                    z-index: ${box.zIndex || 10};
                    transform: rotate(${box.rotation || 0}deg);
                    ${borderStyle}
                `;

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

    // 2. Draw Speech Balloons
    if (page.speechBubbles) {
        page.speechBubbles.forEach(box => {
            const div = document.createElement('div');
            div.className = 'speech-box-container';
            div.setAttribute('data-id', box.id);
            if (state.currentSpeechId === box.id) div.classList.add('selected');

            const w = box.width;
            const h = box.height;
            const rx = w / 2;
            const ry = h / 2;
            
            const tX = box.tailX !== undefined ? box.tailX : rx;
            const tY = box.tailY !== undefined ? box.tailY : h + 30;

            const strokePadding = 4;
            const minX = Math.min(0, tX) - strokePadding;
            const maxX = Math.max(w, tX) + strokePadding;
            const minY = Math.min(0, tY) - strokePadding;
            const maxY = Math.max(h, tY) + strokePadding;

            const containerW = maxX - minX;
            const containerH = maxY - minY;

            const computedLeft = box.left + minX;
            const computedTop = box.top + minY;

            div.style.cssText = `
                left: ${computedLeft}px;
                top: ${computedTop}px;
                width: ${containerW}px;
                height: ${containerH}px;
                z-index: ${box.zIndex || 50};
                position: absolute;
                transform: rotate(${box.rotation || 0}deg);
                overflow: visible !important;
            `;

            if (box.style === 'title') {
                div.classList.add('transparent-title-style');

                const textContainer = document.createElement('div');
                textContainer.className = 'speech-text-container';
                textContainer.style.cssText = `
                    position: absolute;
                    left: ${-minX}px;
                    top: ${-minY}px;
                    width: ${w}px;
                    height: ${h}px;
                `;
                
                const span = document.createElement('span');
                span.className = 'speech-text';
                span.contentEditable = true;
                span.textContent = box.text || 'ENTER TITLE';

                const appliedFont = box.fontFamily ? box.fontFamily : "'Bangers', 'Impact', sans-serif";
                const appliedSize = box.fontSize ? box.fontSize + 'px' : "28px";
                span.style.fontFamily = appliedFont;
                span.style.fontSize = appliedSize;
                
                // 🎨 INJECTED FONT COLOR FOR TITLES:
                span.style.setProperty('color', box.fontColor || '#000000', 'important');

                span.oninput = () => { 
                    box.text = span.textContent; 
                    if(elsProps.textModifier) elsProps.textModifier.value = box.text; 
                };
                textContainer.appendChild(span);
                div.appendChild(textContainer);

            } else if (box.style === 'classic') {
                const body = document.createElement('div');
                body.className = 'speech-box classic-box-style';
                body.style.cssText = `width: ${w}px; height: ${h}px;`;

                const span = document.createElement('span');
                span.className = 'speech-text';
                span.contentEditable = true;
                span.textContent = box.text;

                const appliedFont = box.fontFamily ? box.fontFamily : "'Arial Black', Gadget, sans-serif";
                const appliedSize = box.fontSize ? box.fontSize + 'px' : "14px";
                span.style.fontFamily = appliedFont;
                span.style.fontSize = appliedSize;
                
                // 🎨 INJECTED FONT COLOR FOR CLASSIC BOXES:
                span.style.setProperty('color', box.fontColor || '#000000', 'important');

                span.oninput = () => { 
                    box.text = span.textContent; 
                    if(elsProps.textModifier) elsProps.textModifier.value = box.text; 
                };

                body.appendChild(span);
                div.appendChild(body);

            } else {
                const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
                svg.setAttribute("class", "speech-svg");
                svg.setAttribute("xmlns", "http://www.w3.org/2000/svg");
                svg.setAttribute("width", containerW);
                svg.setAttribute("height", containerH);
                
                svg.setAttribute("viewBox", `${minX} ${minY} ${containerW} ${containerH}`);
                svg.style.position = "absolute";
                svg.style.left = "0px";
                svg.style.top = "0px";
                svg.style.overflow = "visible";

                const path = document.createElementNS("http://www.w3.org/2000/svg", "path");
                path.setAttribute("class", "speech-path");
                path.style.cssText = "fill: #ffffff !important; stroke: #090909 !important; stroke-width: 2px; stroke-linejoin: round;";
                
                const distToCenter = Math.hypot(tX - rx, tY - ry);
                let pathData = '';

                if (box.style === 'thought') {
                    const steps = 10; 
                    let cloudPoints = [];
                    
                    for (let i = 0; i < steps; i++) {
                        let angle = (i / steps) * Math.PI * 2;
                        let cx = rx + rx * Math.cos(angle);
                        let cy = ry + ry * Math.sin(angle);
                        cloudPoints.push({ x: cx, y: cy });
                    }

                    pathData = `M ${cloudPoints[0].x} ${cloudPoints[0].y}`;
                    for (let i = 0; i < steps; i++) {
                        let nextIdx = (i + 1) % steps;
                        let p1 = cloudPoints[i];
                        let p2 = cloudPoints[nextIdx];
                        
                        let midX = (p1.x + p2.x) / 2;
                        let midY = (p1.y + p2.y) / 2;
                        
                        let arcAngle = (i / steps) * Math.PI * 2 + (Math.PI / steps);
                        let pushFactor = Math.min(w, h) * 0.15; 
                        let pushX = midX + pushFactor * Math.cos(arcAngle);
                        let pushY = midY + pushFactor * Math.sin(arcAngle);
                        
                        pathData += ` Q ${pushX} ${pushY}, ${p2.x} ${p2.y}`;
                    }
                    pathData += ' Z';
                    path.setAttribute("d", pathData);
                    svg.appendChild(path);

                    if (distToCenter > 25) {
                        const angle = Math.atan2(tY - ry, tX - rx);
                        const edgeX = rx + rx * Math.cos(angle);
                        const edgeY = ry + ry * Math.sin(angle);

                        const totalCircles = 2;
                        for (let i = 1; i <= totalCircles; i++) {
                            const ratio = 0.25 + ((i - 1) * 0.45);
                            const circleX = edgeX + (tX - edgeX) * ratio;
                            const circleY = edgeY + (tY - edgeY) * ratio;
                            const circleRadius = i === 1 ? 7 : 4; 

                            const thoughtCircle = document.createElementNS("http://www.w3.org/2000/svg", "circle");
                            thoughtCircle.setAttribute("cx", circleX);
                            thoughtCircle.setAttribute("cy", circleY);
                            thoughtCircle.setAttribute("r", circleRadius);
                            thoughtCircle.style.cssText = "fill: #ffffff !important; stroke: #090909 !important; stroke-width: 2px;";
                            svg.appendChild(thoughtCircle);
                        }
                    }

                } else {
                    if (distToCenter < 20) {
                        pathData = `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
                    } else {
                        const angle = Math.atan2(tY - ry, tX - rx);
                        const baseSpread = 0.25; 
                        const p1x = rx + rx * Math.cos(angle - baseSpread);
                        const p1y = ry + ry * Math.sin(angle - baseSpread);
                        const p2x = rx + rx * Math.cos(angle + baseSpread);
                        const p2y = ry + ry * Math.sin(angle + baseSpread);
                        let largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;
                        pathData = `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${tX} ${tY} Z`;
                    }
                    path.setAttribute("d", pathData);
                    svg.appendChild(path);
                }

                div.appendChild(svg);

                const textContainer = document.createElement('div');
                textContainer.className = 'speech-text-container';
                textContainer.style.cssText = `
                    position: absolute;
                    left: ${-minX}px;
                    top: ${-minY}px;
                    width: ${w}px;
                    height: ${h}px;
                `;
                
                const span = document.createElement('span');
                span.className = 'speech-text';
                span.contentEditable = true;
                span.textContent = box.text;

                const appliedFont = box.fontFamily ? box.fontFamily : "'Arial Black', Gadget, sans-serif";
                const appliedSize = box.fontSize ? box.fontSize + 'px' : "14px";
                span.style.fontFamily = appliedFont;
                span.style.fontSize = appliedSize;
                
                // 🎨 INJECTED FONT COLOR FOR VECTOR BALLOONS (OVALS/THOUGHTS/BURSTS):
                span.style.color = box.fontColor || '#000000';

                span.oninput = () => { 
                    box.text = span.textContent; 
                    if(elsProps.textModifier) elsProps.textModifier.value = box.text; 
                };
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

// --- VECTOR DIALOGUE BUBBLE DRAG SYSTEM ---

function makeTailDraggable(handle, data, container, pathEl) {
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

    const onMoveTail = (e) => {
        if (!isMovingTail) return;

        rawTail.x += e.movementX / state.zoom;
        rawTail.y += e.movementY / state.zoom;

        let displayX = rawTail.x;
        let displayY = rawTail.y;

        if (state.snapToGrid) {
            displayX = Math.round(displayX / state.gridSize) * state.gridSize;
            displayY = Math.round(displayY / state.gridSize) * state.gridSize;
        }

        const w = data.width;
        const h = data.height;
        const rx = w / 2;
        const ry = h / 2;
        
        // Match the 4px stroke padding used in your paint function to prevent positioning offsets
        const strokePadding = 4;
        const minX = Math.min(0, displayX) - strokePadding;
        const minY = Math.min(0, displayY) - strokePadding;

        // Position the handle correctly matching our layout offsets
        handle.style.left = (displayX - minX) + 'px';
        handle.style.top = (displayY - minY) + 'px';

        const distToCenter = Math.hypot(displayX - rx, displayY - ry);
        let pathData = '';

        // ☁️ THOUGHT BUBBLE REAL-TIME DRAG TRACKING
        if (data.style === 'thought') {
            const steps = 10; 
            let cloudPoints = [];
            
            for (let i = 0; i < steps; i++) {
                let angle = (i / steps) * Math.PI * 2;
                cloudPoints.push({ x: rx + rx * Math.cos(angle), y: ry + ry * Math.sin(angle) });
            }

            pathData = `M ${cloudPoints[0].x} ${cloudPoints[0].y}`;
            for (let i = 0; i < steps; i++) {
                let nextIdx = (i + 1) % steps;
                let midX = (cloudPoints[i].x + cloudPoints[nextIdx].x) / 2;
                let midY = (cloudPoints[i].y + cloudPoints[nextIdx].y) / 2;
                let arcAngle = (i / steps) * Math.PI * 2 + (Math.PI / steps);
                let pushFactor = Math.min(w, h) * 0.15; 
                pathData += ` Q ${midX + pushFactor * Math.cos(arcAngle)} ${midY + pushFactor * Math.sin(arcAngle)}, ${cloudPoints[nextIdx].x} ${cloudPoints[nextIdx].y}`;
            }
            pathData += ' Z';

            // Find and manipulate the two floating trail circles inside the parent SVG container
            const svgEl = container.querySelector('.speech-svg');
            if (svgEl) {
                const circles = svgEl.querySelectorAll('circle');
                if (circles.length === 2 && distToCenter > 25) {
                    circles.forEach((circle, i) => {
                        // Keep identical ratio alignment limits: 0.45 down to 0.85
                        const ratio = 0.45 + (i * 0.40);
                        circle.setAttribute("cx", rx + (displayX - rx) * ratio);
                        circle.setAttribute("cy", ry + (displayY - ry) * ratio);
                        circle.setAttribute("r", 9 - ((i + 1) * 2.5));
                    });
                }
            }

        // 🗯️ STANDARD SPEECH OVAL BALLOON REAL-TIME DRAG TRACKING
        } else {
            if (distToCenter < 20) {
                pathData = `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
            } else {
                const angle = Math.atan2(displayY - ry, displayX - rx);
                const baseSpread = 0.25; 
                
                const p1x = rx + rx * Math.cos(angle - baseSpread);
                const p1y = ry + ry * Math.sin(angle - baseSpread);
                const p2x = rx + rx * Math.cos(angle + baseSpread);
                const p2y = ry + ry * Math.sin(angle + baseSpread);

                let largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;
                pathData = `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${displayX} ${displayY} Z`;
            }
        }
        
        pathEl.setAttribute('d', pathData);
    };

    const onUpTail = () => {
        isMovingTail = false;
        window.removeEventListener('mousemove', onMoveTail);
        window.removeEventListener('mouseup', onUpTail);

        saveHistoryState();

        if (state.snapToGrid) {
            data.tailX = Math.round(rawTail.x / state.gridSize) * state.gridSize;
            data.tailY = Math.round(rawTail.y / state.gridSize) * state.gridSize;
        } else {
            data.tailX = rawTail.x;
            data.tailY = rawTail.y;
        }

        renderCanvas();
    };
}

    function onUpCorner() {
        if (isMovingCorner) {
            isMovingCorner = false;
            window.removeEventListener('mousemove', onMoveCorner);
            window.removeEventListener('mouseup', onUpCorner);
            
            saveHistoryState();
            renderCanvas();
        }
    }


// --- INTERACTIVE DRAG & TRANSFORM MATRIX ENGINE ---

function makeElementInteractable(element, data, type, resizeHandle) {
    let isDragging = false;
    let isResizing = false;
    let startX, startY, startLeft, startTop, startWidth, startHeight;

    element.addEventListener('mousedown', (e) => {
        if (e.target.classList.contains('speech-text') || e.target.classList.contains('tail-control-handle') || e.target.classList.contains('panel-corner-handle')) return;
        e.stopPropagation();
        
       if (type === 'panel') {
            state.currentPanelId = data.id;
            state.currentSpeechId = null;
        } else {
            state.currentSpeechId = data.id;
            state.currentPanelId = null;

            if (data.fontFamily) {
                document.getElementById('fontFamilySelect').value = data.fontFamily;
            } else {
                document.getElementById('fontFamilySelect').value = "'Arial Black', Gadget, sans-serif";
            }

            if (data.fontSize) {
                document.getElementById('fontSizeSelect').value = data.fontSize;
            } else {
                document.getElementById('fontSizeSelect').value = "14px";
            }

            // 🌟 ADD THIS SAFELY HERE:
            // Checks if the font color dropdown exists and updates its value to match the clicked bubble
            if (elsProps.fontColor) {
                elsProps.fontColor.value = data.fontColor || "#000000";
            }
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
        let dx = (e.clientX - startX) / state.zoom;
        let dy = (e.clientY - startY) / state.zoom;

        if (isDragging) {
            let targetLeft = startLeft + dx;
            let targetTop = startTop + dy;

            if (state.snapToGrid) {
                targetLeft = Math.round(targetLeft / state.gridSize) * state.gridSize;
                targetTop = Math.round(targetTop / state.gridSize) * state.gridSize;
            }

            data.left = targetLeft;
            data.top = targetTop;
            element.style.left = targetLeft + 'px';
            element.style.top = targetTop + 'px';
            
            data.corners = [
                { x: data.left, y: data.top },
                { x: data.left + data.width, y: data.top },
                { x: data.left + data.width, y: data.top + data.height },
                { x: data.left, y: data.top + data.height }
            ];

            if (els.panelPropX) els.panelPropX.value = Math.round(targetLeft);
            if (els.panelPropY) els.panelPropY.value = Math.round(targetTop);
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

            data.corners = [
                { x: data.left, y: data.top },
                { x: data.left + data.width, y: data.top },
                { x: data.left + data.width, y: data.top + data.height },
                { x: data.left, y: data.top + data.height }
            ];

            if (els.panelPropW) els.panelPropW.value = Math.round(targetWidth);
            if (els.panelPropH) els.panelPropH.value = Math.round(targetHeight);

            if (type === 'speech' && data.style === 'vector') {
                const svg = element.querySelector('.speech-svg');
                const pathEl = element.querySelector('.speech-path');
                const txtCont = element.querySelector('.speech-text-container');
                if (txtCont) txtCont.style.height = targetHeight + 'px';
                
                if (pathEl) {
                    const rx = targetWidth / 2;
                    const ry = targetHeight / 2;
                    const tX = data.tailX !== undefined ? data.tailX : rx;
                    const tY = data.tailY !== undefined ? data.tailY : targetHeight + 30;

                    const distToCenter = Math.hypot(tX - rx, tY - ry);
                    let pathData = '';

                    if (distToCenter < 20) {
                        pathData = `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
                    } else {
                        const angle = Math.atan2(tY - ry, tX - rx);
                        const baseSpread = 0.25;
                        const p1x = rx + rx * Math.cos(angle - baseSpread);
                        const p1y = ry + ry * Math.sin(angle - baseSpread);
                        const p2x = rx + rx * Math.cos(angle + baseSpread);
                        const p2y = ry + ry * Math.sin(angle + baseSpread);

                        let largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;
                        pathData = `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${tX} ${tY} Z`;
                    }
                    pathEl.setAttribute('d', pathData);
                }
            }
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

// --- PROPERTIES INSPECTOR ACTION INTERFACE ---

function openPropertiesPanel(type, data, element) {
    els.propertiesPanel.classList.remove('hidden');
    elsProps.title.innerText = type === 'panel' ? "Transform Panel Asset" : "Transform Speech Box";

    if (els.panelPropX) els.panelPropX.value = Math.round(data.left);
    if (els.panelPropY) els.panelPropY.value = Math.round(data.top);
    if (els.panelPropW) els.panelPropW.value = Math.round(data.width);
    if (els.panelPropH) els.panelPropH.value = Math.round(data.height);

    ['X', 'Y', 'W', 'H'].forEach(prop => {
        const input = document.getElementById(`panelProp${prop}`);
        if (input) {
            input.oninput = (e) => {
                const val = Number(e.target.value);
                if (prop === 'X') { data.left = val; element.style.left = val + 'px'; }
                if (prop === 'Y') { data.top = val; element.style.top = val + 'px'; }
                if (prop === 'W') { data.width = val; element.style.width = val + 'px'; }
                if (prop === 'H') { data.height = val; element.style.height = val + 'px'; }

                data.corners = [
                    { x: data.left, y: data.top },
                    { x: data.left + data.width, y: data.top },
                    { x: data.left + data.width, y: data.top + data.height },
                    { x: data.left, y: data.top + data.height }
                ];
            };
            input.onchange = () => saveHistoryState();
        }
    });

    // --- HARDWARE ACCELERATED DIRECT ACTION SLIDER INTERFACE ---
    const rotateSlider = document.getElementById('propRotation');
    const rotateNum = document.getElementById('propRotationNum');

    if (rotateSlider && rotateNum) {
        // Set values cleanly without breaking active DOM focus
        rotateSlider.value = data.rotation || 0;
        rotateNum.value = data.rotation || 0;

        // Strip previous event listeners completely by cloning nodes
        const newSlider = rotateSlider.cloneNode(true);
        rotateSlider.parentNode.replaceChild(newSlider, rotateSlider);
        
        const newNum = rotateNum.cloneNode(true);
        rotateNum.parentNode.replaceChild(newNum, rotateNum);

        const updateRotationRealtime = (val) => {
            data.rotation = val;
            
            // 1. Locate the live wrapper on the workspace canvas
            const targetAttr = type === 'panel' ? `div.comic-panel[data-id="${data.id}"]` : `div.speech-box-container[data-id="${data.id}"]`;
            const liveDomElement = els.workspace.querySelector(targetAttr) || element;
            
            if (liveDomElement) {
                // Apply wrapper hardware rotation
                liveDomElement.style.transform = `rotate(${val}deg)`;
                
                // ⚡ LIVE RE-VECTOR FIX: Handle both standard speech and thought shapes dynamically
                if (type === 'speech') {
                    const svgEl = liveDomElement.querySelector('.speech-svg');
                    const pathEl = liveDomElement.querySelector('.speech-path');
                    
                    if (svgEl && pathEl) {
                        const w = data.width;
                        const h = data.height;
                        const rx = w / 2;
                        const ry = h / 2;
                        
                        // Track down the current interactive vector anchor offsets
                        const tX = data.tailX !== undefined ? data.tailX : rx;
                        const tY = data.tailY !== undefined ? data.tailY : h + 30;

                        const distToCenter = Math.hypot(tX - rx, tY - ry);
                        let pathData = '';

                        if (data.style === 'thought') {
                            // ☁️ Re-vector the thought cloud curves
                            const steps = 10; 
                            let cloudPoints = [];
                            for (let i = 0; i < steps; i++) {
                                let angle = (i / steps) * Math.PI * 2;
                                cloudPoints.push({ x: rx + rx * Math.cos(angle), y: ry + ry * Math.sin(angle) });
                            }

                            pathData = `M ${cloudPoints[0].x} ${cloudPoints[0].y}`;
                            for (let i = 0; i < steps; i++) {
                                let nextIdx = (i + 1) % steps;
                                let midX = (cloudPoints[i].x + cloudPoints[nextIdx].x) / 2;
                                let midY = (cloudPoints[i].y + cloudPoints[nextIdx].y) / 2;
                                let arcAngle = (i / steps) * Math.PI * 2 + (Math.PI / steps);
                                let pushFactor = Math.min(w, h) * 0.15; 
                                pathData += ` Q ${midX + pushFactor * Math.cos(arcAngle)} ${midY + pushFactor * Math.sin(arcAngle)}, ${cloudPoints[nextIdx].x} ${cloudPoints[nextIdx].y}`;
                            }
                            pathData += ' Z';
                            pathEl.setAttribute('d', pathData);

                            // Update the trailing trail circles on the fly
                            const circles = svgEl.querySelectorAll('circle');
                            if (circles.length === 2 && distToCenter > 25) {
                                const angle = Math.atan2(tY - ry, tX - rx);
                                const edgeX = rx + rx * Math.cos(angle);
                                const edgeY = ry + ry * Math.sin(angle);

                                circles.forEach((circle, i) => {
                                    const ratio = 0.25 + (i * 0.45);
                                    circle.setAttribute("cx", edgeX + (tX - edgeX) * ratio);
                                    circle.setAttribute("cy", edgeY + (tY - edgeY) * ratio);
                                    circle.setAttribute("r", i === 0 ? 7 : 4);
                                });
                            }
                        } else if (data.style === 'vector' || data.style === 'oval') {
                            // 🗯️ Re-vector normal balloon pointy tails
                            if (distToCenter < 20) {
                                pathData = `M ${rx + rx} ${ry} A ${rx} ${ry} 0 1 1 0 ${ry} A ${rx} ${ry} 0 1 1 ${rx + rx} ${ry} Z`;
                            } else {
                                const angle = Math.atan2(tY - ry, tX - rx);
                                const baseSpread = 0.25;
                                const p1x = rx + rx * Math.cos(angle - baseSpread);
                                const p1y = ry + ry * Math.sin(angle - baseSpread);
                                const p2x = rx + rx * Math.cos(angle + baseSpread);
                                const p2y = ry + ry * Math.sin(angle + baseSpread);

                                let largeArc = (Math.PI * 2 - baseSpread * 2) > Math.PI ? 1 : 0;
                                pathData = `M ${p2x} ${p2y} A ${rx} ${ry} 0 ${largeArc} 1 ${p1x} ${p1y} L ${tX} ${tY} Z`;
                            }
                            pathEl.setAttribute('d', pathData);
                        }
                    }
                }
            }
        };

        // 🌟 WIRE UP LIVE DRAG INTERFACE LISTENERS
        newSlider.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            newNum.value = val;
            updateRotationRealtime(val);
        });

        newNum.addEventListener('input', (e) => {
            const val = Number(e.target.value);
            newSlider.value = val;
            updateRotationRealtime(val);
        });

        newSlider.addEventListener('change', () => saveHistoryState());
        newNum.addEventListener('change', () => saveHistoryState());
    }

    if (type === 'speech') {
        elsProps.contentGroup.style.display = 'flex';
        elsProps.styleGroup.style.display = 'none';
        
        elsProps.bubbleStyle.value = data.style || 'vector';
        elsProps.textModifier.value = data.text || '';

        elsProps.bubbleStyle.onchange = (e) => {
            saveHistoryState();
            data.style = e.target.value;
            renderCanvas();
        };
        elsProps.textModifier.oninput = (e) => {
            data.text = e.target.value;
            const textNode = element.querySelector('.speech-text');
            if (textNode) textNode.textContent = e.target.value;
        };
    } else {
        elsProps.contentGroup.style.display = 'none';
        elsProps.styleGroup.style.display = 'flex';
        if (elsProps.checkWhiteBorder) elsProps.checkWhiteBorder.checked = data.hasWhiteBorder || false;
        
        const toggleDistortCheckbox = document.getElementById('chkDistortMode');
        if (toggleDistortCheckbox) toggleDistortCheckbox.checked = data.isDistortedMode || false;
    }
}

// --- SIDEBAR PAGE MONITORING MANAGER ---

function renderSidebar() {
    els.pageList.innerHTML = '';
    state.pages.forEach((page, index) => {
        const div = document.createElement('div');
        div.className = `page-item ${index === state.currentPage ? 'active' : ''}`;
        div.innerText = `Comic Page Block ${index + 1}`;
        div.onclick = () => selectPage(index);
        els.pageList.appendChild(div);
    });
}

if (elsProps.bubbleStyle) {
    elsProps.bubbleStyle.addEventListener('change', function(e) {
        if (state.currentSpeechId !== null && state.currentPage !== -1) {
            const page = state.pages[state.currentPage];
            const bubbleData = page.speechBubbles.find(b => b.id === state.currentSpeechId);
            
            if (bubbleData) {
                saveHistoryState();
                bubbleData.style = e.target.value; 
                renderCanvas();
            }
        }
    });
}

function selectPage(index) {
    state.currentPage = index;
    clearAllSelections();
    renderSidebar();
    renderCanvas();

    if (state.viewMode === 'scroll') {
        const pages = els.canvasContainer.querySelectorAll('.scroller-page');
        if (pages && pages[index]) {
            pages[index].scrollIntoView({
                behavior: 'smooth',
                block: 'center',
                inline: 'nearest'
            });
        }
    }
}

// --- IMAGE UPLOAD HANDLING & CROPPER MODAL COUPLING ---

function handleImageUpload(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(event) {
        els.cropperImage.src = event.target.result;
        els.modal.classList.add('active');

        if (state.currentCropper) state.currentCropper.destroy();
        
        state.currentCropper = new Cropper(els.cropperImage, {
            viewMode: 1,
            dragMode: 'move',
            autoCropArea: 1,
            restore: false,
            modal: true,
            guides: true,
            highlight: false,
            cropBoxMovable: true,
            cropBoxResizable: true,
            toggleDragModeOnDblclick: false
        });
    };
    reader.readAsDataURL(file);
}

document.getElementById('btnCancelCrop').addEventListener('click', () => {
    els.modal.classList.remove('active');
    els.fileInput.value = ''; 
});

document.getElementById('btnApplyCrop').addEventListener('click', () => {
    if (!state.currentCropper) return;
    saveHistoryState();
    const canvas = state.currentCropper.getCroppedCanvas({
        maxWidth: 2048,
        maxHeight: 2048,
        imageSmoothingHigh: true
    });
    
    const croppedSrc = canvas.toDataURL('image/jpeg', 0.9);
    const maxZ = getMaxZIndex();

    const initialLeft = 80;
    const initialTop = 120;
    const initialWidth = 320;
    const initialHeight = 320;

    const targetPanel = {
        id: Date.now() + Math.random(),
        src: croppedSrc,
        left: initialLeft,
        top: initialTop,
        width: initialWidth,
        height: initialHeight,
        rotation: 0,
        zIndex: maxZ + 1,
        hasWhiteBorder: false,
        isDistortedMode: false,
        corners: [
            { x: initialLeft, y: initialTop },
            { x: initialLeft + initialWidth, y: initialTop },
            { x: initialLeft + initialWidth, y: initialTop + initialHeight },
            { x: initialLeft, y: initialTop + initialHeight }
        ]
    };

    state.pages[state.currentPage].panels.push(targetPanel);
    els.modal.classList.remove('active');
    els.fileInput.value = ''; 

    renderCanvas();
});

function addSpeechBox() {
    if (state.currentPage === -1) return;
    saveHistoryState();
    const maxZ = getMaxZIndex();
    const box = {
        id: Date.now() + Math.random(),
        type: 'speech',
        style: 'vector',
        text: 'Boom!',
        fontColor: '#000000', // 🌟 Ensure a baseline black hex exists here
        left: 200,
        top: 200,
        width: 160,
        height: 90,
        tailX: 80,
        tailY: 140,
        rotation: 0,
        zIndex: maxZ + 1
    };
    state.pages[state.currentPage].speechBubbles.push(box);
    renderCanvas();
}

// --- LAYER CONTROL ENGINE SYSTEM ---

function getMaxZIndex() {
    if (state.currentPage === -1) return 10;
    const page = state.pages[state.currentPage];
    let max = 10;
    page.panels.forEach(p => { if((p.zIndex || 10) > max) max = p.zIndex; });
    page.speechBubbles.forEach(s => { if((s.zIndex || 50) > max) max = s.zIndex; });
    return max;
}

// --- GLOBAL FONT INTERACTION HANDLERS ---

document.getElementById('fontFamilySelect').addEventListener('change', (e) => {
    if (state.currentSpeechId !== null && state.currentPage !== -1) {
        const currentBox = state.pages[state.currentPage].speechBubbles.find(b => b.id === state.currentSpeechId);
        if (currentBox) {
            saveHistoryState();
            currentBox.fontFamily = e.target.value;
            renderCanvas();
        }
    }
});

document.getElementById('fontSizeSelect').addEventListener('change', (e) => {
    if (state.currentSpeechId !== null && state.currentPage !== -1) {
        const currentBox = state.pages[state.currentPage].speechBubbles.find(b => b.id === state.currentSpeechId);
        if (currentBox) {
            saveHistoryState();
            currentBox.fontSize = e.target.value;
            renderCanvas();
        }
    }
});

// --- GLOBAL FONT COLOR INTERACTION HANDLER ---
if (document.getElementById('propFontColor')) {
    document.getElementById('propFontColor').addEventListener('change', (e) => {
        if (state.currentSpeechId !== null && state.currentPage !== -1) {
            const currentBox = state.pages[state.currentPage].speechBubbles.find(b => b.id === state.currentSpeechId);
            if (currentBox) {
                saveHistoryState();          // Retains fully functional undo/redo history
                currentBox.fontColor = e.target.value; // Commits choice directly to state memory
                renderCanvas();              // Live redraws all speech balloons instantly!
            }
        }
    });
}

function getActiveElement() {
    if (state.currentPage === -1) return null;
    const page = state.pages[state.currentPage];
    if (state.currentPanelId) {
        return { item: page.panels.find(p => p.id === state.currentPanelId), type: 'panel' };
    }
    if (state.currentSpeechId) {
        return { item: page.speechBubbles.find(s => s.id === state.currentSpeechId), type: 'speech' };
    }
    return null;
}

function moveLayer(action) {
    const active = getActiveElement();
    if (!active || !active.item) return;

    const page = state.pages[state.currentPage];
    let allItems = [];
    page.panels.forEach(p => allItems.push({obj: p, z: p.zIndex || 10}));
    page.speechBubbles.forEach(s => allItems.push({obj: s, z: s.zIndex || 50}));
    
    allItems.sort((a, b) => a.z - b.z);
    let idx = allItems.findIndex(x => x.obj.id === active.item.id);
    if (idx === -1) return;

    if (action === 'forward' && idx < allItems.length - 1) {
        let temp = allItems[idx].z;
        allItems[idx].obj.zIndex = allItems[idx + 1].z;
        allItems[idx + 1].obj.zIndex = temp;
    } else if (action === 'backward' && idx > 0) {
        let temp = allItems[idx].z;
        allItems[idx].obj.zIndex = allItems[idx - 1].z;
        allItems[idx - 1].obj.zIndex = temp;
    } else if (action === 'top') {
        let topZ = allItems[allItems.length - 1].z;
        active.item.zIndex = topZ + 2;
    } else if (action === 'bottom') {
        let botZ = allItems[0].z;
        active.item.zIndex = Math.max(1, botZ - 2);
    }

    renderCanvas();
}

function deleteSelectedElement() {
    if (state.currentPage === -1) return;
    const page = state.pages[state.currentPage];

    if (state.currentPanelId) {
        page.panels = page.panels.filter(p => p.id !== state.currentPanelId);
        state.currentPanelId = null;
    } else if (state.currentSpeechId) {
        page.speechBubbles = page.speechBubbles.filter(s => s.id !== state.currentSpeechId);
        state.currentSpeechId = null;
    }

    clearAllSelections();
    renderCanvas();
}

// --- COMIC COMPILER MULTI-FORMAT EXPORT CORE ---

document.getElementById('btnExportPDF').addEventListener('click', async () => {
    const { jsPDF } = window.jspdf;
    clearAllSelections();
    
    const pdf = new jsPDF({
        orientation: state.pageSize[0] > state.pageSize[1] ? 'l' : 'p',
        unit: 'px',
        format: [state.pageSize[0], state.pageSize[1]]
    });

    for (let i = 0; i < state.pages.length; i++) {
        const mirrorContainer = document.createElement('div');
        mirrorContainer.style.cssText = `
            position: absolute;
            top: -99999px;
            left: -99999px;
            width: ${state.pageSize[0]}px;
            height: ${state.pageSize[1]}px;
            background-color: #ffffff;
            overflow: visible !important;
        `;
        
        if (state.gridStyle === 'grid') mirrorContainer.classList.add('texture-grid');
        if (state.gridStyle === 'dots') mirrorContainer.classList.add('texture-dots');
        
        document.body.appendChild(mirrorContainer);

        const originalMarginSetting = state.showInnerMargin;
        state.showInnerMargin = false;
        
        paintPageContents(state.pages[i], mirrorContainer);
        state.showInnerMargin = originalMarginSetting;

        mirrorContainer.querySelectorAll('.tail-control-handle, .panel-resize-handle, .panel-corner-handle, .margin-guide, .canvas-page-marker').forEach(el => {
            el.remove();
        });

        mirrorContainer.querySelectorAll('.comic-panel.has-white-border').forEach(panel => {
            panel.style.setProperty('outline', '6px solid #ffffff', 'important');
            panel.style.setProperty('outline-offset', '-6px', 'important');
            panel.style.setProperty('box-shadow', '0 0 0 2px #000000', 'important');
        });

        mirrorContainer.querySelectorAll('.speech-box-container, .speech-svg').forEach(el => {
            el.style.setProperty('overflow', 'visible', 'important');
        });

        await new Promise(r => setTimeout(r, 350));

        const canvas = await html2canvas(mirrorContainer, {
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: state.pageSize[0],
            height: state.pageSize[1],
            scrollX: 0, scrollY: 0, x: 0, y: 0
        });

        const imgData = canvas.toDataURL('image/jpeg', 0.95);
        if (i > 0) pdf.addPage([state.pageSize[0], state.pageSize[1]]);
        
        pdf.addImage(imgData, 'JPEG', 0, 0, state.pageSize[0], state.pageSize[1]);
        mirrorContainer.remove();
    }

    pdf.save(`Comic_Layout_Project_${Date.now()}.pdf`);
    renderCanvas();
});

document.getElementById('btnExportImages').addEventListener('click', async () => {
    clearAllSelections();
    const zip = new JSZip();

    for (let i = 0; i < state.pages.length; i++) {
        const mirrorContainer = document.createElement('div');
        mirrorContainer.style.cssText = `
            position: absolute;
            top: -99999px;
            left: -99999px;
            width: ${state.pageSize[0]}px;
            height: ${state.pageSize[1]}px;
            background-color: #ffffff;
            overflow: visible !important;
        `;
        
        if (state.gridStyle === 'grid') mirrorContainer.classList.add('texture-grid');
        if (state.gridStyle === 'dots') mirrorContainer.classList.add('texture-dots');
        
        document.body.appendChild(mirrorContainer);

        const originalMarginSetting = state.showInnerMargin;
        state.showInnerMargin = false;
        
        paintPageContents(state.pages[i], mirrorContainer);
        state.showInnerMargin = originalMarginSetting;

        mirrorContainer.querySelectorAll('.tail-control-handle, .panel-resize-handle, .panel-corner-handle, .margin-guide, .canvas-page-marker').forEach(el => {
            el.remove();
        });

        mirrorContainer.querySelectorAll('.speech-box-container').forEach(container => {
            container.style.setProperty('overflow', 'visible', 'important');
            const svg = container.querySelector('.speech-svg');
            if (svg) {
                svg.setAttribute('width', (container.offsetWidth + 400));
                svg.setAttribute('height', (container.offsetHeight + 400));
                svg.style.width = (container.offsetWidth + 400) + 'px';
                svg.style.height = (container.offsetHeight + 400) + 'px';
                svg.style.position = 'absolute';
                svg.style.top = '-200px';
                svg.style.left = '-200px';
                svg.style.overflow = 'visible';
                
                const path = svg.querySelector('.speech-path');
                if (path) path.style.transform = 'translate(200px, 200px)';
            }
        });

        await new Promise(r => setTimeout(r, 350));

        const canvas = await html2canvas(mirrorContainer, {
            scale: 2, 
            useCORS: true,
            logging: false,
            backgroundColor: '#ffffff',
            width: state.pageSize[0],
            height: state.pageSize[1],
            scrollX: 0, scrollY: 0, x: 0, y: 0
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
});

// --- LOCAL SYSTEM FILESYSTEM STATE BACKUPS (.JSON) ---

document.getElementById('btnSaveProject').addEventListener('click', () => {
    const saveState = { ...state };
    saveState.currentCropper = null;

    const projectBlob = new Blob([JSON.stringify(saveState, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(projectBlob);
    link.download = `Comic_Workspace_Backup_${Date.now()}.json`;
    link.click();
});

document.getElementById('btnLoadProject').onchange = function(e) {
    const file = e.target.files[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = function(e) {
        try {
            const parsedData = JSON.parse(e.target.result);
            if (!parsedData.pages) throw new Error();

            state.pageSize = parsedData.pageSize || [800, 1200];
            state.viewMode = parsedData.viewMode || 'scroll';
            state.gridStyle = parsedData.gridStyle || 'none';
            state.snapToGrid = parsedData.snapToGrid || false;
            state.gridSize = parsedData.gridSize || 20;
            state.pages = parsedData.pages;
            state.currentPage = state.pages.length > 0 ? 0 : -1;
            
            if (els.pageSizeSelect) els.pageSizeSelect.value = state.pageSize.join(',');
            const gridStyleSelect = document.getElementById('gridStyleSelect');
            if (gridStyleSelect) gridStyleSelect.value = state.gridStyle;
            const chkSnapToGrid = document.getElementById('chkSnapToGrid');
            if (chkSnapToGrid) chkSnapToGrid.checked = state.snapToGrid;

            clearAllSelections();
            renderSidebar();
            renderCanvas();
            
            alert("Project loaded successfully!");
        } catch (err) {
            alert("Oops! That file doesn't look like a valid comic project save data format.");
            console.error(err);
        }
        e.target.value = '';
    };
    reader.readAsText(file);
};

// --- GLOBAL KEYBOARD SHORTCUTS ---

window.addEventListener('keydown', (e) => {
    if (document.activeElement && (
        document.activeElement.contentEditable === 'true' || 
        document.activeElement.tagName === 'INPUT' || 
        document.activeElement.tagName === 'TEXTAREA' ||
        document.activeElement.classList.contains('speech-text')
    )) {
        return; 
    }

    const keyPressed = e.key.toLowerCase();

    if ((e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && keyPressed === 'z') {
        e.preventDefault();
        e.stopPropagation();
        executeUndo();
        return;
    }

    const isAltShiftZ = e.altKey && e.shiftKey && keyPressed === 'z';
    const isCtrlY = (e.ctrlKey || e.metaKey) && !e.shiftKey && !e.altKey && keyPressed === 'y';

    if (isAltShiftZ || isCtrlY) {
        e.preventDefault();
        e.stopPropagation();
        executeRedo();
        return;
    }

    if (e.key === 'Delete' || e.key === 'Backspace') {
        if (state.currentPanelId !== null || state.currentSpeechId !== null) {
            e.preventDefault();
            e.stopPropagation();
            saveHistoryState(); 
            deleteSelectedElement();
        }
    }
}, true);

const btnUndo = document.getElementById('btnUndo');
const btnRedo = document.getElementById('btnRedo');
if (btnUndo) btnUndo.addEventListener('click', executeUndo);
if (btnRedo) btnRedo.addEventListener('click', executeRedo);

// Initialize workspace with a baseline canvas page
addPage();