document.addEventListener('DOMContentLoaded', () => {

    // 1. CONFIG & SCALE
    const PIXELS_PER_METER = 40;
    const GRID_SIZE = PIXELS_PER_METER / 2;

    // 2. STATE VARIABLES
    let currentMode = 'select';
    let currentLayer = 'walls';
    let isDrawing = false;
    let startPoint = null;
    let activeShape = null;
    let dimensionFirstPoint = null;
    let wallPoints = [];
    let tempWallLine = null;
    let history = [];
    let redoStack = [];
    let isProcessingHistory = false;
    const historyLimit = 50;

    // 3. UI ELEMENTS
    const canvasContainer = document.getElementById('canvas-container');
    const panelContent = document.getElementById('panel-content');
    const panelPlaceholder = document.getElementById('panel-content-placeholder');
    const assetPanel = document.getElementById('asset-panel-container');
    const propertiesPanel = document.getElementById('properties-panel');
    const coordsDisplay = document.getElementById('coords-display');
    const zoomDisplay = document.getElementById('zoom-display');
    const toolTip = document.getElementById('tool-tip');
    const snapCheckbox = document.getElementById('snap-checkbox');
    const showDimsCheckbox = document.getElementById('show-dims-checkbox');
    const toolButtons = document.querySelectorAll('.tool-btn');
    const fileMenuBtn = document.getElementById('file-menu-btn');
    const fileMenuDropdown = document.getElementById('file-menu-dropdown');
    const newBtn = document.getElementById('new-btn');
    const saveBtn = document.getElementById('save-btn');
    const loadBtn = document.getElementById('load-btn');
    const exportBtn = document.getElementById('export-btn');
    const fileInput = document.getElementById('file-input');
    const undoBtn = document.getElementById('undo-btn');
    const redoBtn = document.getElementById('redo-btn');
    const modalOverlay = document.getElementById('export-modal-overlay');
    const modal = document.getElementById('export-modal');
    const closeModalBtn = document.getElementById('close-modal-btn');
    const downloadBtn = document.getElementById('download-btn');
    const qualityWrapper = document.getElementById('quality-wrapper');

    // 4. CANVAS & GRID SETUP
    const canvas = new fabric.Canvas('gn-canvas', {
        width: canvasContainer.offsetWidth,
        height: canvasContainer.offsetHeight,
        backgroundColor: '#ffffff',
        selectionColor: 'rgba(66, 133, 244, 0.3)',
        selectionBorderColor: '#4285f4',
        selectionLineWidth: 2
    });

    function drawGrid() {
        const width = canvas.getWidth() * 10;
        const height = canvas.getHeight() * 10;
        const gridLines = [];
        for (let x = -width / 2; x <= width / 2; x += GRID_SIZE) {
            gridLines.push(new fabric.Line([x, -height / 2, x, height / 2], { stroke: '#e0e0e0', selectable: false, evented: false }));
        }
        for (let y = -height / 2; y <= height / 2; y += GRID_SIZE) {
            gridLines.push(new fabric.Line([-width / 2, y, width / 2, y], { stroke: '#e0e0e0', selectable: false, evented: false }));
        }
        const gridGroup = new fabric.Group(gridLines, { selectable: false, evented: false, name: 'grid' });
        canvas.add(gridGroup);
        gridGroup.moveTo(-1);
    }

    // 5. UNDO / REDO LOGIC
    function saveState() {
        if (isProcessingHistory) return;
        redoStack = [];
        const jsonState = JSON.stringify(canvas.toJSON(['data', 'isTemp', 'name']));
        history.push(jsonState);
        if (history.length > historyLimit) history.shift();
        updateUndoRedoButtons();
    }
    function undo() {
        if (history.length > 1) {
            isProcessingHistory = true;
            redoStack.push(history.pop());
            const prevState = history[history.length - 1];
            canvas.loadFromJSON(prevState, () => {
                canvas.renderAll();
                isProcessingHistory = false;
                updateUndoRedoButtons();
                updatePropertiesPanel(canvas.getActiveObject());
            });
        }
    }
    function redo() {
        if (redoStack.length > 0) {
            isProcessingHistory = true;
            const nextState = redoStack.pop();
            history.push(nextState);
            canvas.loadFromJSON(nextState, () => {
                canvas.renderAll();
                isProcessingHistory = false;
                updateUndoRedoButtons();
                updatePropertiesPanel(canvas.getActiveObject());
            });
        }
    }
    function updateUndoRedoButtons() {
        undoBtn.disabled = history.length <= 1;
        redoBtn.disabled = redoStack.length === 0;
    }

    // 6. DYNAMIC PROPERTIES PANEL LOGIC
    function updatePropertiesPanel(obj) {
        panelContent.innerHTML = '';
        if (!obj) {
            panelContent.appendChild(panelPlaceholder);
            return;
        }
        const layer = obj.data ? obj.data.layer : null;
        const type = obj.data ? obj.data.type : null;

        if (layer === 'walls' && type === 'room') renderRectProperties(obj);
        else if (layer === 'walls' && type === 'wall-system') renderPolylineProperties(obj);
        else if (layer === 'dimensions') renderDimensionProperties(obj);
        else if (layer === 'furniture' && type === 'door') renderDoorProperties(obj);
        else if (layer === 'furniture' && type === 'window') renderWindowProperties(obj);
        else if (layer === 'furniture' && type === 'stairs') renderStairsProperties(obj);
        else if (layer === 'furniture') renderFurnitureProperties(obj);
        else panelContent.innerHTML = '<div id="panel-content-placeholder">Properties not available.</div>';
    }

    function createPropItem(label, value, unit = '', isEditable = false, onchange = null) {
        const propItem = document.createElement('div');
        propItem.className = 'prop-item';
        const labelEl = document.createElement('label');
        labelEl.innerText = label;
        propItem.appendChild(labelEl);
        const inputEl = document.createElement('input');
        inputEl.type = isEditable ? 'number' : 'text';
        inputEl.value = value;
        if (!isEditable) inputEl.disabled = true;
        if (unit) inputEl.value += ` ${unit}`;
        if (isEditable && onchange) {
            inputEl.addEventListener('change', (e) => onchange(parseFloat(e.target.value) || 0));
        }
        propItem.appendChild(inputEl);
        panelContent.appendChild(propItem);
    }

    function renderRectProperties(obj) {
        const rect = obj._objects.find(o => o.type === 'rect');
        const widthMeters = (rect.getScaledWidth() / PIXELS_PER_METER).toFixed(2);
        const heightMeters = (rect.getScaledHeight() / PIXELS_PER_METER).toFixed(2);
        const areaMeters = (widthMeters * heightMeters).toFixed(2);
        createPropItem('Width', widthMeters, 'm', true, (newValue) => {
            const newWidth = newValue * PIXELS_PER_METER;
            rect.set('width', newWidth / rect.scaleX);
            obj.setCoords();
            canvas.renderAll();
            updatePropertiesPanel(obj);
        });
        createPropItem('Height', heightMeters, 'm', true, (newValue) => {
            const newHeight = newValue * PIXELS_PER_METER;
            rect.set('height', newHeight / rect.scaleY);
            obj.setCoords();
            canvas.renderAll();
            updatePropertiesPanel(obj);
        });
        createPropItem('Area', areaMeters, 'm²');
    }

    function renderPolylineProperties(obj) {
        let totalLength = 0;
        const lines = obj._objects.filter(o => o.type === 'line');
        lines.forEach(line => {
            totalLength += Math.sqrt(Math.pow(line.x2 - line.x1, 2) + Math.pow(line.y2 - line.y1, 2));
        });
        const lengthMeters = (totalLength / PIXELS_PER_METER).toFixed(2);
        createPropItem('Total Length', lengthMeters, 'm');
    }
    
    function renderDimensionProperties(obj) {
        const textObject = obj._objects.find(o => o.type === 'text');
        if (textObject) createPropItem('Measured', textObject.text.replace(' m', ''), 'm');
    }
    
    function renderDoorProperties(obj) {
        const doorLeaf = obj._objects.find(o => o.type === 'rect');
        const widthMeters = (doorLeaf.width / PIXELS_PER_METER).toFixed(2);
        createPropItem('Width', widthMeters, 'm');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => {
            obj.set('angle', newValue);
            canvas.renderAll();
        });
    }
    
    function renderWindowProperties(obj) {
        const widthMeters = (obj.data.width / PIXELS_PER_METER).toFixed(2);
        createPropItem('Width', widthMeters, 'm', true, (newValue) => {
            const newWidthPixels = newValue * PIXELS_PER_METER;
            obj._objects.forEach(line => {
                line.set({ x1: -newWidthPixels / 2, x2: newWidthPixels / 2 });
            });
            obj.data.width = newWidthPixels;
            obj.setCoords();
            canvas.renderAll();
        });
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => {
            obj.set('angle', newValue);
            canvas.renderAll();
        });
    }
    
    function renderStairsProperties(obj) {
        const outline = obj._objects.find(o => o.type === 'rect');
        const widthMeters = (outline.getScaledWidth() / PIXELS_PER_METER).toFixed(2);
        const heightMeters = (outline.getScaledHeight() / PIXELS_PER_METER).toFixed(2);
        createPropItem('Width', widthMeters, 'm');
        createPropItem('Length', heightMeters, 'm');
    }

    function renderFurnitureProperties(obj) {
        const widthMeters = (obj.getScaledWidth() / PIXELS_PER_METER).toFixed(2);
        const heightMeters = (obj.getScaledHeight() / PIXELS_PER_METER).toFixed(2);
        createPropItem('Width', widthMeters, 'm');
        createPropItem('Height', heightMeters, 'm');
    }

    // 7. CORE DRAWING & SYMBOL CREATION
    function createDoorSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 0.8) {
        const doorLeaf = new fabric.Rect({ left: 0, top: 0, width: width, height: 5, fill: '#ffffff', stroke: '#333333', strokeWidth: 2, originX: 'left', originY: 'top' });
        const arcPath = `M 0 0 A ${width} ${width} 0 0 1 ${width} ${width}`;
        const doorSwing = new fabric.Path(arcPath, { fill: null, stroke: '#999999', strokeDashArray: [5, 5], strokeWidth: 1 });
        const doorGroup = new fabric.Group([doorLeaf, doorSwing], { left: x, top: y, angle: angle, selectable: true, originX: 'left', originY: 'top', data: { layer: 'furniture', type: 'door' } });
        canvas.add(doorGroup);
        return doorGroup;
    }

    function createWindowSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 1.2) {
        const wallThickness = 5;
        const line1 = new fabric.Line([-width / 2, -wallThickness, width / 2, -wallThickness], { stroke: '#333', strokeWidth: 2 });
        const line2 = new fabric.Line([-width / 2, 0, width / 2, 0], { stroke: '#333', strokeWidth: 2 });
        const line3 = new fabric.Line([-width / 2, wallThickness, width / 2, wallThickness], { stroke: '#333', strokeWidth: 2 });
        const windowGroup = new fabric.Group([line1, line2, line3], { left: x, top: y, angle: angle, selectable: true, originX: 'center', originY: 'center', data: { layer: 'furniture', type: 'window', width: width } });
        canvas.add(windowGroup);
        return windowGroup;
    }

    function createStairsSymbol(x, y, width, height, angle = 0) {
        const items = [];
        const stepCount = Math.max(1, Math.floor(height / (PIXELS_PER_METER * 0.3)));
        const stepDepth = height / stepCount;
        const outline = new fabric.Rect({ width: width, height: height, stroke: '#333', strokeWidth: 2, fill: 'transparent' });
        items.push(outline);
        for (let i = 1; i < stepCount; i++) {
            items.push(new fabric.Line([0, i * stepDepth, width, i * stepDepth], { stroke: '#999', strokeWidth: 1 }));
        }
        const directionLine = new fabric.Line([width / 2, height, width / 2, stepDepth], { stroke: '#333', strokeWidth: 1 });
        items.push(directionLine);
        const arrowHead = new fabric.Triangle({ width: 10, height: 15, fill: '#333', left: width / 2, top: stepDepth, originX: 'center', originY: 'bottom', angle: 180 });
        items.push(arrowHead);
        const stairsGroup = new fabric.Group(items, { left: x, top: y, angle: angle, selectable: true, data: { layer: 'furniture', type: 'stairs' } });
        canvas.add(stairsGroup);
        saveState();
        return stairsGroup;
    }
    
    function createDimensionObject(p1, p2) {
        const distancePixels = Math.sqrt(Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2));
        const distanceMeters = (distancePixels / PIXELS_PER_METER).toFixed(2);
        const text = `${distanceMeters} m`;
        const angle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
        const line = new fabric.Line([0, 0, distancePixels, 0], { stroke: '#d93025', strokeWidth: 1 });
        const textObject = new fabric.Text(text, { fontSize: 12, fill: '#d93025', textAlign: 'center', top: -16, left: distancePixels / 2, originX: 'center' });
        const tick1 = new fabric.Line([0, -5, 0, 5], { stroke: '#d93025', strokeWidth: 1 });
        const tick2 = new fabric.Line([distancePixels, -5, distancePixels, 5], { stroke: '#d93025', strokeWidth: 1 });
        const dimGroup = new fabric.Group([line, textObject, tick1, tick2], { left: p1.x, top: p1.y, angle: angle, selectable: true, data: { layer: 'dimensions' } });
        canvas.add(dimGroup);
        saveState();
    }
    
    function finalizeWall() {
        if (wallPoints.length > 1) {
            const wallItems = [];
            for (let i = 0; i < wallPoints.length - 1; i++) {
                const p1 = wallPoints[i], p2 = wallPoints[i + 1];
                wallItems.push(new fabric.Line([p1.x, p1.y, p2.x, p2.y], { stroke: '#333', strokeWidth: 5, originX: 'center', originY: 'center' }));
            }
            const wallGroup = new fabric.Group(wallItems, { selectable: true, data: { layer: 'walls', type: 'wall-system' } });
            canvas.add(wallGroup);
            saveState();
        }
        canvas.getObjects().forEach(obj => { if (obj.name === 'temp') canvas.remove(obj); });
        if (tempWallLine) canvas.remove(tempWallLine);
        wallPoints = [];
        tempWallLine = null;
        isDrawing = false;
        toolTip.innerText = '';
        setMode('select');
        canvas.renderAll();
    }

    // 8. HELPER FUNCTIONS
    function snap(value) {
        return snapCheckbox.checked ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
    }

    function findClosestWallPoint(pointer) {
        const walls = canvas.getObjects().filter(obj => obj.data && (obj.data.type === 'wall-system' || obj.data.type === 'room'));
        let closestWall = null, minDistance = Infinity, bestPoint = null, wallAngle = 0;
        walls.forEach(wallGroup => {
            wallGroup._objects.forEach(wallSegment => {
                if (wallSegment.type !== 'line' && wallSegment.type !== 'rect') return;
                let segments = [];
                if (wallSegment.type === 'rect') {
                    const r = wallSegment;
                    const matrix = wallGroup.calcTransformMatrix();
                    const tl = fabric.util.transformPoint({ y: r.top - r.height/2, x: r.left - r.width/2 }, matrix);
                    const tr = fabric.util.transformPoint({ y: r.top - r.height/2, x: r.left + r.width/2 }, matrix);
                    const bl = fabric.util.transformPoint({ y: r.top + r.height/2, x: r.left - r.width/2 }, matrix);
                    const br = fabric.util.transformPoint({ y: r.top + r.height/2, x: r.left + r.width/2 }, matrix);
                    segments.push({ p1: tl, p2: tr }, { p1: tr, p2: br }, { p1: br, p2: bl }, { p1: bl, p2: tl });
                } else { // It's a line
                    const matrix = wallGroup.calcTransformMatrix();
                    const p1 = fabric.util.transformPoint({x: wallSegment.x1, y: wallSegment.y1}, matrix);
                    const p2 = fabric.util.transformPoint({x: wallSegment.x2, y: wallSegment.y2}, matrix);
                    segments.push({ p1, p2 });
                }
                segments.forEach(seg => {
                    const { p1, p2 } = seg;
                    const l2 = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
                    if (l2 === 0) return;
                    let t = ((pointer.x - p1.x) * (p2.x - p1.x) + (pointer.y - p1.y) * (p2.y - p1.y)) / l2;
                    t = Math.max(0, Math.min(1, t));
                    const closestPointOnSegment = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
                    const dist = Math.sqrt(Math.pow(pointer.x - closestPointOnSegment.x, 2) + Math.pow(pointer.y - closestPointOnSegment.y, 2));
                    if (dist < minDistance) {
                        minDistance = dist;
                        closestWall = wallSegment;
                        bestPoint = closestPointOnSegment;
                        wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
                    }
                });
            });
        });
        return { point: bestPoint, angle: wallAngle, distance: minDistance, wall: closestWall };
    }

    // 9. NAVIGATION (ZOOM & PAN)
    canvas.on('mouse:wheel', function(opt) {
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 10) zoom = 10;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        zoomDisplay.innerText = `Zoom: ${Math.round(zoom * 100)}%`;
        opt.e.preventDefault();
        opt.e.stopPropagation();
    });

    // 10. CORE EVENT LISTENERS
    canvas.on({
        'selection:created': (e) => updatePropertiesPanel(e.target),
        'selection:updated': (e) => updatePropertiesPanel(e.target),
        'selection:cleared': () => updatePropertiesPanel(null),
        'object:modified': (e) => {
            const target = e.target;
            if (target.data && target.data.type === 'room') {
                const rect = target._objects.find(o => o.type === 'rect');
                const widthText = target._objects.find(o => o.data.type === 'width');
                const heightText = target._objects.find(o => o.data.type === 'height');
                const newWidth = rect.getScaledWidth();
                const newHeight = rect.getScaledHeight();
                widthText.text = `${(newWidth / PIXELS_PER_METER).toFixed(2)}m`;
                heightText.text = `${(newHeight / PIXELS_PER_METER).toFixed(2)}m`;
                widthText.set({ left: rect.left + newWidth / 2, top: rect.top + newHeight + 10 });
                heightText.set({ left: rect.left - 10, top: rect.top + newHeight / 2 });
            }
            saveState();
        },
        'object:added': () => saveState(),
        'object:removed': () => saveState(),
    });

    canvas.on('mouse:down', (o) => {
        if (o.target && o.target.selectable && currentMode !== 'select') return;
        if (o.target && currentMode === 'select') return;

        const pointer = canvas.getPointer(o.e);

        if (currentMode === 'door' || currentMode === 'window') {
            const result = findClosestWallPoint(pointer);
            if (result && result.distance < 20) {
                if (currentMode === 'door') createDoorSymbol(result.point.x, result.point.y, result.angle);
                else if (currentMode === 'window') createWindowSymbol(result.point.x, result.point.y, result.angle);
            } else {
                if (currentMode === 'door') createDoorSymbol(pointer.x, pointer.y, 0);
                else if (currentMode === 'window') createWindowSymbol(pointer.x, pointer.y, 0);
            }
            setMode('select');
            return;
        }

        const snappedPointer = { x: snap(pointer.x), y: snap(pointer.y) };
        if (currentMode === 'dimension') {
            if (!dimensionFirstPoint) {
                dimensionFirstPoint = snappedPointer;
                canvas.add(new fabric.Circle({ radius: 3, fill: 'red', left: dimensionFirstPoint.x - 3, top: dimensionFirstPoint.y - 3, selectable: false, evented: false, name: 'temp' }));
            } else {
                createDimensionObject(dimensionFirstPoint, snappedPointer);
                dimensionFirstPoint = null;
                setMode('select');
            }
            return;
        }

        if (currentMode === 'wall') {
            isDrawing = true;
            toolTip.innerText = 'Press ESC or Double-Click to finish.';
            wallPoints.push(snappedPointer);
            canvas.add(new fabric.Circle({ left: snappedPointer.x - 3, top: snappedPointer.y - 3, radius: 3, fill: '#4285f4', selectable: false, evented: false, name: 'temp' }));
            if (wallPoints.length > 1) {
                const prevPoint = wallPoints[wallPoints.length - 2];
                canvas.add(new fabric.Line([prevPoint.x, prevPoint.y, snappedPointer.x, snappedPointer.y], { stroke: '#999999', strokeWidth: 5, selectable: false, evented: false, name: 'temp' }));
            }
            if (tempWallLine) canvas.remove(tempWallLine);
            tempWallLine = new fabric.Line([snappedPointer.x, snappedPointer.y, snappedPointer.x, snappedPointer.y], { stroke: 'rgba(66, 133, 244, 0.5)', strokeWidth: 5, selectable: false, evented: false });
            canvas.add(tempWallLine);
            return;
        }

        if (currentMode === 'rect' || currentMode === 'stairs') {
            isDrawing = true;
            startPoint = snappedPointer;
            activeShape = new fabric.Rect({ left: startPoint.x, top: startPoint.y, width: 0, height: 0, stroke: 'rgba(66, 133, 244, 0.5)', strokeWidth: 2, fill: 'rgba(66, 133, 244, 0.1)', selectable: false });
            canvas.add(activeShape);
            return;
        }
    });

    canvas.on('mouse:move', (o) => {
        if (canvas.isGrabMode) return;
        const pointer = canvas.getPointer(o.e);
        const snappedPointer = { x: snap(pointer.x), y: snap(pointer.y) };
        coordsDisplay.innerText = `X: ${(pointer.x / PIXELS_PER_METER).toFixed(2)}m, Y: ${(pointer.y / PIXELS_PER_METER).toFixed(2)}m`;
        if (!isDrawing) return;
        if (currentMode === 'wall' && tempWallLine) {
            tempWallLine.set({ x2: snappedPointer.x, y2: snappedPointer.y });
        } else if ((currentMode === 'rect' || currentMode === 'stairs') && activeShape) {
            const width = snappedPointer.x - startPoint.x;
            const height = snappedPointer.y - startPoint.y;
            activeShape.set({ width: Math.abs(width), height: Math.abs(height), left: width > 0 ? startPoint.x : snappedPointer.x, top: height > 0 ? startPoint.y : snappedPointer.y });
        }
        canvas.renderAll();
    });

    canvas.on('mouse:up', () => {
        if (currentMode === 'wall') return;
        if (isDrawing) {
            if (activeShape) {
                if (currentMode === 'rect') {
                    const roomRect = activeShape;
                    roomRect.set({ selectable: false, evented: false });
                    const widthText = new fabric.Text(`${(roomRect.width / PIXELS_PER_METER).toFixed(2)}m`, { left: roomRect.left + roomRect.width / 2, top: roomRect.top + roomRect.height + 10, fontSize: 12, fill: '#333', originX: 'center', data: { isDimensionLabel: true, type: 'width' }, visible: showDimsCheckbox.checked });
                    const heightText = new fabric.Text(`${(roomRect.height / PIXELS_PER_METER).toFixed(2)}m`, { left: roomRect.left - 10, top: roomRect.top + roomRect.height / 2, angle: -90, fontSize: 12, fill: '#333', originY: 'center', originX: 'center', data: { isDimensionLabel: true, type: 'height' }, visible: showDimsCheckbox.checked });
                    const roomGroup = new fabric.Group([roomRect, widthText, heightText], { selectable: true, data: { layer: 'walls', type: 'room' }, subTargetCheck: true });
                    canvas.remove(activeShape);
                    canvas.add(roomGroup);
                } else if (currentMode === 'stairs') {
                    createStairsSymbol(activeShape.left, activeShape.top, activeShape.width, activeShape.height);
                    canvas.remove(activeShape);
                }
            }
            isDrawing = false;
            activeShape = null;
            setMode('select');
        }
    });

    canvas.on('mouse:dblclick', () => { if (currentMode === 'wall') finalizeWall(); });
    
    window.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') {
            e.preventDefault();
            if (!canvas.isGrabMode) {
                canvas.isGrabMode = true;
                canvas.defaultCursor = 'grab';
                canvas.selection = false;
                canvas.renderAll();
            }
            return;
        }
        switch (e.key.toLowerCase()) {
            case 'v': setMode('select'); break;
            case 'l': setMode('wall'); break;
            case 'r': setMode('rect'); break;
            case 'p': setMode('door'); break;
            case 'w': setMode('window'); break;
            case 's': setMode('stairs'); break;
            case 'd': setMode('dimension'); break;
            case 'a': setMode('asset'); break;
        }
        if (e.key === 'Escape' && currentMode === 'wall') finalizeWall();
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.remove(activeObject);
                canvas.discardActiveObject();
                canvas.renderAll();
            }
        }
        if (e.ctrlKey && e.key === 'z') { e.preventDefault(); undo(); }
        if (e.ctrlKey && e.key === 'y') { e.preventDefault(); redo(); }
    });
    
    window.addEventListener('keyup', (e) => {
        if (e.code === 'Space') {
            e.preventDefault();
            canvas.isGrabMode = false;
            canvas.defaultCursor = 'default';
            canvas.selection = true;
            canvas.renderAll();
        }
    });
    
    // 11. FILE & MENU LOGIC
    fileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); fileMenuDropdown.classList.toggle('show'); });
    window.addEventListener('click', () => { if (fileMenuDropdown.classList.contains('show')) fileMenuDropdown.classList.remove('show'); });
    function clearCanvas() { if (confirm('Are you sure? All unsaved work will be lost.')) { canvas.clear(); history = []; redoStack = []; drawGrid(); saveState(); } }
    newBtn.addEventListener('click', clearCanvas);
    function saveProject() { const json = JSON.stringify(canvas.toJSON(['data', 'isTemp', 'name'])); const blob = new Blob([json], { type: 'application/json' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'my-project.gncad'; document.body.appendChild(a); a.click(); document.body.removeChild(a); URL.revokeObjectURL(url); }
    saveBtn.addEventListener('click', saveProject);
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            canvas.loadFromJSON(event.target.result, () => {
                canvas.renderAll();
                syncLayerUI();
                fileInput.value = '';
                history = [];
                saveState();
            });
        };
        reader.readAsText(file);
    });
    exportBtn.addEventListener('click', () => { modalOverlay.classList.remove('hidden'); modal.classList.remove('hidden'); });
    function closeModal() { modalOverlay.classList.add('hidden'); modal.classList.add('hidden'); }
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    document.querySelector('input[name="format"]').addEventListener('change', (e) => { qualityWrapper.style.display = e.target.value === 'jpeg' ? 'block' : 'none'; });
    downloadBtn.addEventListener('click', () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const scale = parseFloat(document.getElementById('export-scale').value);
        const quality = parseFloat(document.getElementById('export-quality').value);
        const options = { format: format, multiplier: scale };
        if (format === 'jpeg') options.quality = quality;
        const dataURL = canvas.toDataURL(options);
        const link = document.createElement('a');
        link.download = `gncad-export.${format}`;
        link.href = dataURL;
        link.click();
        closeModal();
    });

    // 12. LAYERS & ASSETS & DIMENSIONS LOGIC
    function toggleDimensionVisibility() {
        const isVisible = showDimsCheckbox.checked;
        canvas.getObjects().forEach(obj => {
            if (obj.type === 'group') {
                obj._objects.forEach(child => {
                    if (child.data && child.data.isDimensionLabel) child.set('visible', isVisible);
                });
            }
        });
        canvas.renderAll();
    }
    showDimsCheckbox.addEventListener('change', toggleDimensionVisibility);

    function syncLayerUI() {
        const layers = {};
        canvas.getObjects().forEach(obj => {
            if (obj.data && obj.data.layer) {
                if (layers[obj.data.layer] === undefined) layers[obj.data.layer] = obj.visible;
            }
        });
        document.querySelectorAll('.layer-item').forEach(item => {
            const layerName = item.dataset.layer;
            const isVisible = layers[layerName] !== undefined ? layers[layerName] : true;
            const toggle = item.querySelector('.visibility-toggle');
            toggle.dataset.visible = isVisible;
            toggle.textContent = isVisible ? 'visibility' : 'visibility_off';
        });
    }

    const layerItems = document.querySelectorAll('.layer-item');
    layerItems.forEach(item => {
        const toggle = item.querySelector('.visibility-toggle');
        const layerName = item.dataset.layer;
        toggle.addEventListener('click', () => {
            const isVisible = toggle.dataset.visible === 'true';
            const newVisibility = !isVisible;
            toggle.dataset.visible = newVisibility;
            toggle.textContent = newVisibility ? 'visibility' : 'visibility_off';
            canvas.getObjects().forEach(obj => {
                if (obj.data && obj.data.layer === layerName) obj.set('visible', newVisibility);
            });
            canvas.renderAll();
            saveState();
        });
    });

    const assetFiles = ['sofa.svg', 'chair.svg', 'table.svg', 'plant.svg', 'bed.svg'];
    const assetList = document.getElementById('asset-list');
    assetFiles.forEach(file => {
        const item = document.createElement('div');
        item.className = 'asset-item';
        item.innerHTML = `<img src="assets/furniture/${file}" />`;
        item.addEventListener('click', () => {
            fabric.loadSVGFromURL(`assets/furniture/${file}`, (objects, options) => {
                const obj = fabric.util.groupSVGElements(objects, options);
                obj.set({ left: canvas.getCenter().left, top: canvas.getCenter().top, data: { layer: 'furniture' } }).scaleToWidth(PIXELS_PER_METER * 1.5);
                canvas.add(obj);
                setMode('select');
            });
        });
        assetList.appendChild(item);
    });

    function setMode(mode) {
        if (currentMode === 'wall' && wallPoints.length > 0) finalizeWall();
        currentMode = mode;
        isDrawing = false;
        dimensionFirstPoint = null;
        switch (mode) {
            case 'wall': case 'rect': currentLayer = 'walls'; break;
            case 'dimension': currentLayer = 'dimensions'; break;
            case 'door': case 'window': case 'stairs': case 'asset': currentLayer = 'furniture'; break;
            default: currentLayer = null;
        }
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
    toolButtons.forEach(btn => {
        btn.addEventListener('click', () => setMode(btn.id.replace('-tool-btn', '')));
    });

    // 13. INITIALIZATION
    drawGrid();
    setMode('select');
    updateUndoRedoButtons();
    saveState();
});
