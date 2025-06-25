document.addEventListener('DOMContentLoaded', () => {

    // --- 1. CONFIG & SCALE ---
    const PIXELS_PER_METER = 40; // 40 pixels on screen = 1 meter in real life
    const GRID_SIZE = PIXELS_PER_METER / 2; // Grid lines every 50cm

    // --- 2. UI ELEMENTS ---
    const canvasContainer = document.getElementById('canvas-container');
    const propertiesPanel = document.getElementById('properties-panel');
    const panelPlaceholder = document.getElementById('panel-content-placeholder');
    const panelDynamic = document.getElementById('panel-content-dynamic');
    const propWidthInput = document.getElementById('prop-width');
    const propHeightInput = document.getElementById('prop-height');
    const propAreaInput = document.getElementById('prop-area');
    const coordsDisplay = document.getElementById('coords-display');
    const snapCheckbox = document.getElementById('snap-checkbox');
    const assetPanel = document.getElementById('asset-panel-container');

    // --- 3. CANVAS & GRID SETUP ---
    const canvas = new fabric.Canvas('gn-canvas', {
        width: canvasContainer.offsetWidth,
        height: canvasContainer.offsetHeight,
        backgroundColor: '#ffffff',
        selectionColor: 'rgba(66, 133, 244, 0.3)',
        selectionBorderColor: '#4285f4',
        selectionLineWidth: 2
    });

    function drawGrid() {
        const width = canvas.getWidth();
        const height = canvas.getHeight();
        const gridLines = [];
        // Draw vertical lines
        for (let x = 0; x <= width; x += GRID_SIZE) {
            gridLines.push(new fabric.Line([x, 0, x, height], { stroke: '#e0e0e0', selectable: false, evented: false }));
        }
        // Draw horizontal lines
        for (let y = 0; y <= height; y += GRID_SIZE) {
            gridLines.push(new fabric.Line([0, y, width, y], { stroke: '#e0e0e0', selectable: false, evented: false }));
        }
        const gridGroup = new fabric.Group(gridLines, { selectable: false, evented: false });
        canvas.add(gridGroup);
        gridGroup.moveTo(-1); // Send to back
    }
    
    // --- 4. PROPERTIES PANEL LOGIC ---
    function updatePropertiesPanel(obj) {
        if (obj) {
            panelPlaceholder.classList.add('hidden');
            panelDynamic.classList.remove('hidden');

            const widthMeters = (obj.width * obj.scaleX) / PIXELS_PER_METER;
            const heightMeters = (obj.height * obj.scaleY) / PIXELS_PER_METER;
            
            propWidthInput.value = widthMeters.toFixed(2);
            propHeightInput.value = heightMeters.toFixed(2);
            propAreaInput.value = (widthMeters * heightMeters).toFixed(2);
        } else {
            panelPlaceholder.classList.remove('hidden');
            panelDynamic.classList.add('hidden');
        }
    }

    function updateObjectFromPanel() {
        const activeObject = canvas.getActiveObject();
        if (!activeObject) return;
        
        const newWidth = parseFloat(propWidthInput.value) * PIXELS_PER_METER;
        const newHeight = parseFloat(propHeightInput.value) * PIXELS_PER_METER;
        
        activeObject.set({
            scaleX: newWidth / activeObject.width,
            scaleY: newHeight / activeObject.height
        });
        canvas.renderAll();
        updatePropertiesPanel(activeObject);
    }
    propWidthInput.addEventListener('change', updateObjectFromPanel);
    propHeightInput.addEventListener('change', updateObjectFromPanel);

    // --- 5. DRAWING & SNAPPING LOGIC ---
    let currentMode = 'select';
    let isDrawing = false;
    let startPoint = null;
    let activeShape = null;

    const toolButtons = document.querySelectorAll('.tool-btn');
    function setMode(mode) {
        currentMode = mode;
        toolButtons.forEach(btn => btn.classList.remove('active'));
        
        if (mode === 'asset') {
            document.getElementById('asset-tool-btn').classList.add('active');
            propertiesPanel.classList.add('hidden');
            assetPanel.classList.remove('hidden');
        } else {
            document.getElementById(`${mode}-tool-btn`).classList.add('active');
            propertiesPanel.classList.remove('hidden');
            assetPanel.classList.add('hidden');
        }
    }
    
    function snap(value) {
        return snapCheckbox.checked ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
    }

    canvas.on('mouse:down', (o) => {
        const pointer = canvas.getPointer(o.e);
        const snappedPointer = { x: snap(pointer.x), y: snap(pointer.y) };
        
        if (currentMode !== 'select') {
            isDrawing = true;
            startPoint = snappedPointer;
            
            if (currentMode === 'wall') { // 'wall' uses line for now
                activeShape = new fabric.Line([startPoint.x, startPoint.y, startPoint.x, startPoint.y], {
                    stroke: '#333333', strokeWidth: 5, selectable: false
                });
            } else if (currentMode === 'rect') {
                activeShape = new fabric.Rect({
                    left: startPoint.x, top: startPoint.y, width: 0, height: 0,
                    stroke: '#333333', strokeWidth: 2, fill: 'rgba(66, 133, 244, 0.1)', selectable: false
                });
            }
            if(activeShape) canvas.add(activeShape);
        }
    });

    canvas.on('mouse:move', (o) => {
        const pointer = canvas.getPointer(o.e);
        const snappedPointer = { x: snap(pointer.x), y: snap(pointer.y) };
        coordsDisplay.innerText = `X: ${(pointer.x / PIXELS_PER_METER).toFixed(2)}m, Y: ${(pointer.y / PIXELS_PER_METER).toFixed(2)}m`;
        
        if (isDrawing && activeShape) {
            if (currentMode === 'wall') {
                activeShape.set({ x2: snappedPointer.x, y2: snappedPointer.y });
            } else if (currentMode === 'rect') {
                activeShape.set({
                    width: Math.abs(snappedPointer.x - startPoint.x),
                    height: Math.abs(snappedPointer.y - startPoint.y),
                    left: snappedPointer.x > startPoint.x ? startPoint.x : snappedPointer.x,
                    top: snappedPointer.y > startPoint.y ? startPoint.y : snappedPointer.y
                });
            }
            canvas.renderAll();
        }
    });

    canvas.on('mouse:up', () => {
        if (isDrawing) {
            isDrawing = false;
            if(activeShape) activeShape.set('selectable', true);
            setMode('select');
        }
    });

    // --- 6. EVENT LISTENERS ---
    canvas.on({
        'selection:created': (e) => updatePropertiesPanel(e.target),
        'selection:updated': (e) => updatePropertiesPanel(e.target),
        'selection:cleared': () => updatePropertiesPanel(null),
        'object:modified': (e) => updatePropertiesPanel(e.target),
    });
    
    document.getElementById('select-tool-btn').addEventListener('click', () => setMode('select'));
    document.getElementById('wall-tool-btn').addEventListener('click', () => setMode('wall'));
    document.getElementById('rect-tool-btn').addEventListener('click', () => setMode('rect'));
    document.getElementById('asset-tool-btn').addEventListener('click', () => setMode('asset'));
    
    window.addEventListener('resize', () => {
        canvas.setWidth(canvasContainer.offsetWidth);
        canvas.setHeight(canvasContainer.offsetHeight);
        canvas.clear();
        drawGrid();
    });

    // --- 7. ASSET LOADING (Simplified) ---
    const assetFiles = ['sofa.svg', 'chair.svg', 'table.svg'];
    const assetList = document.getElementById('asset-list');
    assetFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.innerHTML = `<img src="assets/furniture/${file}" />`;
        item.addEventListener('click', () => {
             fabric.loadSVGFromURL(`assets/furniture/${file}`, (objects, options) => {
                const obj = fabric.util.groupSVGElements(objects, options);
                obj.set({ left: canvas.width / 2, top: canvas.height / 2 }).scaleToWidth(PIXELS_PER_METER * 1.5); // ~1.5m wide
                canvas.add(obj);
                setMode('select');
            });
        });
        assetList.appendChild(item);
    });

    // --- 8. INITIALIZATION ---
    drawGrid();
    setMode('select');
});
