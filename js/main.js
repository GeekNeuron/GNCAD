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
        const width = canvas.getWidth() * 10; // Draw a much larger grid
        const height = canvas.getHeight() * 10;
        const gridLines = [];
        for (let x = -width/2; x <= width/2; x += GRID_SIZE) {
            gridLines.push(new fabric.Line([x, -height/2, x, height/2], { stroke: '#e0e0e0', selectable: false, evented: false }));
        }
        for (let y = -height/2; y <= height/2; y += GRID_SIZE) {
            gridLines.push(new fabric.Line([-width/2, y, width/2, y], { stroke: '#e0e0e0', selectable: false, evented: false }));
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
    // ... (All render...Properties and createPropItem helper functions from previous steps go here)
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
            inputEl.addEventListener('change', (e) => onchange(parseFloat(e.target.value)));
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
    function renderPolylineProperties(obj) { /*...from previous step...*/ }
    function renderDimensionProperties(obj) { /*...from previous step...*/ }
    function renderDoorProperties(obj) { /*...from previous step...*/ }
    function renderWindowProperties(obj) { /*...from previous step...*/ }
    function renderStairsProperties(obj) { /*...from previous step...*/ }
    function renderFurnitureProperties(obj) { /*...from previous step...*/ }

    // 7. CORE DRAWING & SYMBOL CREATION
    function createDoorSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 0.8) { /*...from previous step...*/ }
    function createWindowSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 1.2) { /*...from previous step...*/ }
    function createStairsSymbol(x, y, width, height, angle = 0) { /*...from previous step...*/ }
    function finalizeWall() { /*...from previous step...*/ }

    // 8. NAVIGATION (ZOOM & PAN)
    canvas.on('mouse:wheel', function(opt) { /*...from previous step...*/ });

    // 9. CORE EVENT LISTENERS
    canvas.on({
        'selection:created': (e) => updatePropertiesPanel(e.target),
        'selection:updated': (e) => updatePropertiesPanel(e.target),
        'selection:cleared': () => updatePropertiesPanel(null),
        'object:modified': (e) => {
             // Logic to update dimension labels on rooms/etc.
             // ...
             saveState();
        },
        'object:added': () => saveState(),
        'object:removed': () => saveState(),
        'mouse:down': (o) => { /*...The big mouse:down logic from previous steps...*/ },
        'mouse:move': (o) => { /*...The big mouse:move logic from previous steps...*/ },
        'mouse:up': () => { /*...The big mouse:up logic from previous steps...*/ },
        'mouse:dblclick': () => { if (currentMode === 'wall') finalizeWall(); }
    });
    window.addEventListener('keydown', (e) => { /*...The big keydown logic from previous step...*/ });
    window.addEventListener('keyup', (e) => { /*...The keyup logic for spacebar from previous step...*/ });
    
    // 10. FILE & MENU LOGIC
    // (All logic for File menu and Export modal from previous step)
    fileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); fileMenuDropdown.classList.toggle('show'); });
    window.addEventListener('click', () => { if (fileMenuDropdown.classList.contains('show')) fileMenuDropdown.classList.remove('show'); });
    function clearCanvas() { /*...*/ }
    newBtn.addEventListener('click', clearCanvas);
    function saveProject() { /*...*/ }
    saveBtn.addEventListener('click', saveProject);
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => { /*...*/ });
    exportBtn.addEventListener('click', () => { /*...*/ });
    // (modal logic)
    
    // 11. LAYERS & ASSETS LOGIC
    function toggleDimensionVisibility() { /*...from previous step...*/ }
    showDimsCheckbox.addEventListener('change', toggleDimensionVisibility);
    const layerItems = document.querySelectorAll('.layer-item');
    layerItems.forEach(item => { /*...layer toggle logic...*/ });
    const assetFiles = ['sofa.svg', 'chair.svg', 'table.svg', 'plant.svg', 'bed.svg'];
    const assetList = document.getElementById('asset-list');
    assetFiles.forEach(file => { /*...asset loading logic...*/ });
    
    // 12. INITIALIZATION
    drawGrid();
    setMode('select');
    updateUndoRedoButtons();
    saveState();
});

// All helper functions like renderPolylineProperties, createDoorSymbol, etc. need to be pasted in from previous steps. 
// A full copy-paste is required for the user. I will now generate the full, complete main.js file.
