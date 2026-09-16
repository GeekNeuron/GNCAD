import { PIXELS_PER_METER, GRID_SIZE, SNAP_DISTANCE, ROOM_FILL_COLORS } from './config.js';
import { createHistoryManager } from './history.js';
import { saveProject, loadProject, importDxf } from './io.js';
import { createDoorSymbol as createDoorSymbolBase, createWindowSymbol as createWindowSymbolBase, createStairsSymbol as createStairsSymbolBase, createDimensionObject as createDimensionObjectBase } from './symbols.js';

const ICON_SVG_OPEN = '<svg class="icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">';
const ICON_EYE = ICON_SVG_OPEN + '<path d="M10 12a2 2 0 1 0 4 0a2 2 0 0 0 -4 0" /><path d="M21 12c-2.4 4 -5.4 6 -9 6c-3.6 0 -6.6 -2 -9 -6c2.4 -4 5.4 -6 9 -6c3.6 0 6.6 2 9 6" /></svg>';
const ICON_EYE_OFF = ICON_SVG_OPEN + '<path d="M10.585 10.587a2 2 0 0 0 2.829 2.828" /><path d="M16.681 16.673a8.717 8.717 0 0 1 -4.681 1.327c-3.6 0 -6.6 -2 -9 -6c1.272 -2.12 2.712 -3.678 4.32 -4.674m2.86 -1.146a9.055 9.055 0 0 1 1.82 -.18c3.6 0 6.6 2 9 6c-.666 1.11 -1.379 2.067 -2.138 2.87" /><path d="M3 3l18 18" /></svg>';

document.addEventListener('DOMContentLoaded', () => {

let roomColorIndex = 0;

    function cssVar(name) {
        return getComputedStyle(document.body).getPropertyValue(name).trim();
    }

    function createDoorSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 0.8) {
        return createDoorSymbolBase(fabric, canvas, cssVar, x, y, angle, currentStrokeWidth, width);
    }
    function createWindowSymbol(x, y, angle = 0, width = PIXELS_PER_METER * 1.2) {
        return createWindowSymbolBase(fabric, canvas, cssVar, x, y, angle, currentStrokeWidth, width);
    }
    function createStairsSymbol(x, y, width, height, angle = 0) {
        return createStairsSymbolBase(fabric, canvas, cssVar, x, y, width, height, angle);
    }
    function createDimensionObject(p1, p2) {
        return createDimensionObjectBase(fabric, canvas, p1, p2);
    }

    let currentMode = 'select';
    let currentLayer = 'walls';
    let currentStrokeWidth = 5;
    let isDrawing = false;
    let isDefiningAngle = false;
    let startPoint = null;
    let activeShape = null;
    let dimensionFirstPoint = null;
    let wallPoints = [];
    let tempWallLine = null;
    let lastMousePos = { x: 0, y: 0 };

    const canvasContainer = document.getElementById('canvas-container');
    const panelContent = document.getElementById('panel-content');
    const panelPlaceholder = document.getElementById('panel-content-placeholder');
    const assetPanel = document.getElementById('asset-panel-container');
    const propertiesPanel = document.getElementById('properties-panel');
    const coordsDisplay = document.getElementById('coords-display');
    const zoomDisplay = document.getElementById('zoom-display');
    const toolTip = document.getElementById('tool-tip');
    const snapCheckbox = document.getElementById('snap-checkbox');
    const showRulersCheckbox = document.getElementById('show-rulers-checkbox');
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
    const rulerTopCanvas = document.getElementById('ruler-top');
    const rulerLeftCanvas = document.getElementById('ruler-left');
    const crosshairCanvas = document.getElementById('crosshair-canvas');
    const wallThicknessSelector = document.getElementById('wall-thickness-selector');
    const importDxfBtn = document.getElementById('import-dxf-btn');
    const exportDxfBtn = document.getElementById('export-dxf-btn');
    const dxfFileInput = document.getElementById('dxf-file-input');
    const appHeader = document.getElementById('app-header');

    const rulerTopCtx = rulerTopCanvas.getContext('2d');
    const rulerLeftCtx = rulerLeftCanvas.getContext('2d');
    const crosshairCtx = crosshairCanvas.getContext('2d');

    const canvas = new fabric.Canvas('gn-canvas', {
        width: canvasContainer.offsetWidth,
        height: canvasContainer.offsetHeight,
        backgroundColor: 'transparent',
        selectionColor: 'rgba(66, 133, 244, 0.3)',
        selectionBorderColor: '#4285f4',
        selectionLineWidth: 2,
    });

    function createGridPattern() {
        const gridCanvas = document.createElement('canvas');
        gridCanvas.width = GRID_SIZE;
        gridCanvas.height = GRID_SIZE;
        const ctx = gridCanvas.getContext('2d');
        ctx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--grid-color').trim();
        ctx.lineWidth = 0.5;
        ctx.strokeRect(0.5, 0.5, GRID_SIZE, GRID_SIZE);
        return new fabric.Pattern({ source: gridCanvas, repeat: 'repeat' });
    }

    function setupRulers() {
        rulerTopCanvas.width = canvasContainer.offsetWidth;
        rulerTopCanvas.height = 20;
        rulerLeftCanvas.width = 20;
        rulerLeftCanvas.height = canvasContainer.offsetHeight;
        crosshairCanvas.width = canvasContainer.offsetWidth;
        crosshairCanvas.height = canvasContainer.offsetHeight;
        drawRulers();
    }
    
    function drawRulers() {
        const rulersVisible = showRulersCheckbox.checked;
        rulerTopCanvas.style.display = rulersVisible ? 'block' : 'none';
        rulerLeftCanvas.style.display = rulersVisible ? 'block' : 'none';
        document.getElementById('ruler-corner').style.display = rulersVisible ? 'block' : 'none';

        if (!rulersVisible) return;

        const zoom = canvas.getZoom();
        const vpt = canvas.viewportTransform;
        const panX = vpt[4];
        const panY = vpt[5];
        const fontColor = getComputedStyle(document.body).getPropertyValue('--ruler-text').trim();
        const bgColor = getComputedStyle(document.body).getPropertyValue('--ruler-bg').trim();
        
        rulerTopCtx.clearRect(0, 0, rulerTopCanvas.width, rulerTopCanvas.height);
        rulerTopCtx.fillStyle = bgColor;
        rulerTopCtx.fillRect(0,0, rulerTopCanvas.width, rulerTopCanvas.height);
        rulerTopCtx.font = "10px Inter";
        rulerTopCtx.fillStyle = fontColor;
        rulerTopCtx.strokeStyle = fontColor;
        rulerTopCtx.lineWidth = 0.5;
        
        for (let i = 0; i < rulerTopCanvas.width / zoom; i += GRID_SIZE) {
            const screenX = i * zoom + panX;
            if (screenX > rulerTopCanvas.width) break;
            if (screenX < 0) continue;
            rulerTopCtx.beginPath();
            rulerTopCtx.moveTo(screenX, 15);
            rulerTopCtx.lineTo(screenX, 20);
            rulerTopCtx.stroke();
            if (i % (GRID_SIZE * 2) === 0) {
                 const meter = Math.round(i / PIXELS_PER_METER);
                 rulerTopCtx.fillText(`${meter}`, screenX + 2, 12);
            }
        }

        rulerLeftCtx.clearRect(0, 0, rulerLeftCanvas.width, rulerLeftCanvas.height);
        rulerLeftCtx.fillStyle = bgColor;
        rulerLeftCtx.fillRect(0,0, rulerLeftCanvas.width, rulerLeftCanvas.height);
        rulerLeftCtx.font = "10px Inter";
        rulerLeftCtx.fillStyle = fontColor;
        rulerLeftCtx.strokeStyle = fontColor;
        rulerLeftCtx.lineWidth = 0.5;
        
        for (let i = 0; i < rulerLeftCanvas.height / zoom; i += GRID_SIZE) {
            const screenY = i * zoom + panY;
            if (screenY > rulerLeftCanvas.height) break;
            if (screenY < 0) continue;
            rulerLeftCtx.beginPath();
            rulerLeftCtx.moveTo(15, screenY);
            rulerLeftCtx.lineTo(20, screenY);
            rulerLeftCtx.stroke();
            if (i % (GRID_SIZE * 2) === 0) {
                 const meter = Math.round(i / PIXELS_PER_METER);
                 rulerLeftCtx.save();
                 rulerLeftCtx.translate(12, screenY + 2);
                 rulerLeftCtx.rotate(-Math.PI / 2);
                 rulerLeftCtx.fillText(`${meter}`, 0, 0);
                 rulerLeftCtx.restore();
            }
        }
    }
    
    function drawCrosshairs(pointer) {
        crosshairCtx.clearRect(0, 0, crosshairCanvas.width, crosshairCanvas.height);
        if (!showRulersCheckbox.checked || !pointer) return;
        
        crosshairCtx.strokeStyle = getComputedStyle(document.body).getPropertyValue('--accent-primary').trim();
        crosshairCtx.lineWidth = 0.5;
        
        crosshairCtx.beginPath();
        crosshairCtx.moveTo(pointer.x, 0);
        crosshairCtx.lineTo(pointer.x, crosshairCanvas.height);
        crosshairCtx.moveTo(0, pointer.y);
        crosshairCtx.lineTo(crosshairCanvas.width, pointer.y);
        crosshairCtx.stroke();
    }

    const historyManager = createHistoryManager(canvas, {
        undoBtn, redoBtn,
        onRestore: () => { updatePropertiesPanel(canvas.getActiveObject()); drawRulers(); }
    });
    const { saveState, undo, redo, updateUndoRedoButtons } = historyManager;
    undoBtn.addEventListener('click', undo);
    redoBtn.addEventListener('click', redo);

    function updatePropertiesPanel(obj) {
        panelContent.innerHTML = '';
        if (!obj || !obj.data) {
            panelContent.appendChild(panelPlaceholder);
            return;
        }
        const { layer, type } = obj.data;
        
        if (type === 'room') renderRectProperties(obj);
        else if (type === 'wall-system') renderPolylineProperties(obj);
        else if (layer === 'dimensions') renderDimensionProperties(obj);
        else if (type === 'door') renderDoorProperties(obj);
        else if (type === 'window') renderWindowProperties(obj);
        else if (type === 'stairs') renderStairsProperties(obj);
        else if (layer === 'furniture') renderFurnitureProperties(obj);
        else panelContent.appendChild(panelPlaceholder);
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

    function polygonArea(points) {
        let area = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            area += points[i].x * points[j].y - points[j].x * points[i].y;
        }
        return Math.abs(area / 2);
    }

    function polygonPerimeter(points) {
        let perimeter = 0;
        for (let i = 0; i < points.length; i++) {
            const j = (i + 1) % points.length;
            perimeter += Math.hypot(points[j].x - points[i].x, points[j].y - points[i].y);
        }
        return perimeter;
    }

    function renderPolygonRoomProperties(obj) {
        const scaleX = obj.scaleX || 1, scaleY = obj.scaleY || 1;
        const points = obj.points.map(p => ({ x: p.x * scaleX, y: p.y * scaleY }));
        const areaM2 = polygonArea(points) / (PIXELS_PER_METER * PIXELS_PER_METER);
        const perimeterM = polygonPerimeter(points) / PIXELS_PER_METER;
        createPropItem('Perimeter', perimeterM.toFixed(2), 'm');
        createPropItem('Area', areaM2.toFixed(2), 'm²');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function renderRectProperties(obj) {
        if (obj.type === 'polygon') { renderPolygonRoomProperties(obj); return; }
        const rect = obj._objects.find(o => o.type === 'rect');
        const widthMeters = (rect.getScaledWidth() / PIXELS_PER_METER).toFixed(2);
        const heightMeters = (rect.getScaledHeight() / PIXELS_PER_METER).toFixed(2);
        createPropItem('Width', widthMeters, 'm', true, (newValue) => {
            const newWidth = newValue * PIXELS_PER_METER;
            obj.set('width', newWidth);
            rect.set('width', newWidth);
            updateRoomDimensions(obj);
            canvas.renderAll();
        });
        createPropItem('Height', heightMeters, 'm', true, (newValue) => {
            const newHeight = newValue * PIXELS_PER_METER;
            obj.set('height', newHeight);
            rect.set('height', newHeight);
            updateRoomDimensions(obj);
            canvas.renderAll();
        });
        createPropItem('Area', (widthMeters * heightMeters).toFixed(2), 'm²');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function renderPolylineProperties(obj) {
    let totalLength = 0;
    if (obj.points) { 
        for (let i = 0; i < obj.points.length - 1; i++) {
            totalLength += new fabric.Point(obj.points[i].x, obj.points[i].y)
                .distanceFrom(new fabric.Point(obj.points[i + 1].x, obj.points[i + 1].y));
        }
    }
    const lengthMeters = (totalLength / PIXELS_PER_METER).toFixed(2);
    createPropItem('Total Length', lengthMeters, 'm');
}

    function renderDimensionProperties(obj) {
        const textObject = obj._objects.find(o => o.type === 'text');
        if (textObject) createPropItem('Measured', textObject.text.replace(' m', ''), 'm');
    }

    function renderDoorProperties(obj) {
        const doorLeaf = obj._objects.find(o => o.type === 'rect');
        createPropItem('Width', (doorLeaf.width / PIXELS_PER_METER).toFixed(2), 'm');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function renderWindowProperties(obj) {
        createPropItem('Width', (obj.data.width / PIXELS_PER_METER).toFixed(2), 'm', true, (newValue) => {
            const newWidthPixels = newValue * PIXELS_PER_METER;
            obj._objects.forEach(line => {
                line.set({ x1: -newWidthPixels / 2, x2: newWidthPixels / 2 });
            });
            obj.data.width = newWidthPixels;
            obj.setCoords();
            canvas.renderAll();
        });
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function renderStairsProperties(obj) {
        const outline = obj._objects.find(o => o.type === 'rect');
        createPropItem('Width', (outline.getScaledWidth() / PIXELS_PER_METER).toFixed(2), 'm');
        createPropItem('Length', (outline.getScaledHeight() / PIXELS_PER_METER).toFixed(2), 'm');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function renderFurnitureProperties(obj) {
        createPropItem('Width', (obj.getScaledWidth() / PIXELS_PER_METER).toFixed(2), 'm');
        createPropItem('Height', (obj.getScaledHeight() / PIXELS_PER_METER).toFixed(2), 'm');
        createPropItem('Angle', obj.angle.toFixed(0), '°', true, (newValue) => { obj.set('angle', newValue); canvas.renderAll(); });
    }

    function finalizeWall() {
    if (wallPoints.length > 1) {
        const finalWall = new fabric.Polyline(wallPoints, {
            stroke: cssVar('--text-primary'),
            strokeWidth: currentStrokeWidth,
            fill: null,
            selectable: true,
            data: { layer: 'walls', type: 'wall-system' },
            objectCaching: false,
            strokeLineJoin: 'miter'
        });
        canvas.add(finalWall);
    }

    canvas.getObjects().forEach(obj => {
        if (obj.name === 'temp') {
            canvas.remove(obj);
        }
    });

    if (tempWallLine) canvas.remove(tempWallLine);
    wallPoints = [];
    tempWallLine = null;
    isDrawing = false;
    toolTip.innerText = '';
    setMode('select');
    canvas.renderAll();
}
    
    function updateRoomDimensions(roomGroup) {
        const rect = roomGroup._objects.find(o => o.type === 'rect');
        const widthText = roomGroup._objects.find(o => o.data.type === 'width');
        const heightText = roomGroup._objects.find(o => o.data.type === 'height');

        const newWidth = rect.getScaledWidth();
        const newHeight = rect.getScaledHeight();

        widthText.set({ text: `${(newWidth / PIXELS_PER_METER).toFixed(2)}m`, left: newWidth / 2, top: newHeight - 16 });
        heightText.set({ text: `${(newHeight / PIXELS_PER_METER).toFixed(2)}m`, left: 4, top: newHeight / 2 });

        roomGroup.setCoords();
        canvas.requestRenderAll();
    }

    function lineIntersection(p1, p2, p3, p4) {
        const d1x = p2.x - p1.x, d1y = p2.y - p1.y;
        const d2x = p4.x - p3.x, d2y = p4.y - p3.y;
        const denom = d1x * d2y - d1y * d2x;
        if (Math.abs(denom) < 1e-6) return null;
        const t = ((p3.x - p1.x) * d2y - (p3.y - p1.y) * d2x) / denom;
        return { x: p1.x + t * d1x, y: p1.y + t * d1y };
    }

    function pointToSegmentDistance(pt, p1, p2) {
        const l2 = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
        if (l2 === 0) return Math.hypot(pt.x - p1.x, pt.y - p1.y);
        let t = ((pt.x - p1.x) * (p2.x - p1.x) + (pt.y - p1.y) * (p2.y - p1.y)) / l2;
        t = Math.max(0, Math.min(1, t));
        const proj = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
        return Math.hypot(pt.x - proj.x, pt.y - proj.y);
    }

    function getWallAbsPoints(wall) {
        const matrix = wall.calcTransformMatrix();
        const offset = wall.pathOffset || { x: 0, y: 0 };
        return wall.points.map(p => fabric.util.transformPoint({ x: p.x - offset.x, y: p.y - offset.y }, matrix));
    }

    function offsetWallPoints(points, delta) {
        if (points.length < 2) return points.slice();
        const segments = [];
        for (let i = 0; i < points.length - 1; i++) {
            const a = points[i], b = points[i + 1];
            const len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
            const nx = -(b.y - a.y) / len * delta, ny = (b.x - a.x) / len * delta;
            segments.push({ a: { x: a.x + nx, y: a.y + ny }, b: { x: b.x + nx, y: b.y + ny } });
        }
        const result = [segments[0].a];
        for (let i = 0; i < segments.length - 1; i++) {
            const joint = lineIntersection(segments[i].a, segments[i].b, segments[i + 1].a, segments[i + 1].b);
            result.push(joint || segments[i].b);
        }
        result.push(segments[segments.length - 1].b);
        return result;
    }

    const CLIPPER_SCALE = 1000;
    function offsetPolygonPoints(points, delta) {
        const path = points.map(p => ({ X: Math.round(p.x * CLIPPER_SCALE), Y: Math.round(p.y * CLIPPER_SCALE) }));
        const co = new ClipperLib.ClipperOffset();
        co.AddPath(path, ClipperLib.JoinType.jtMiter, ClipperLib.EndType.etClosedPolygon);
        const solution = new ClipperLib.Paths();
        co.Execute(solution, delta * CLIPPER_SCALE);
        if (!solution.length) return null;
        return solution[0].map(p => ({ x: p.X / CLIPPER_SCALE, y: p.Y / CLIPPER_SCALE }));
    }

    function performTrim(pointer) {
        const walls = canvas.getObjects().filter(o => o.data && o.data.type === 'wall-system' && Array.isArray(o.points) && o.points.length >= 2);
        if (walls.length < 2) { toolTip.innerText = 'Need at least two walls to trim.'; return; }

        let best = null;
        walls.forEach(wall => {
            const pts = getWallAbsPoints(wall);
            const endSegments = [{ p1: pts[0], p2: pts[1], isStart: true }];
            if (pts.length > 2) endSegments.push({ p1: pts[pts.length - 2], p2: pts[pts.length - 1], isStart: false });
            endSegments.forEach(seg => {
                const dist = pointToSegmentDistance(pointer, seg.p1, seg.p2);
                if (dist < 25 && (!best || dist < best.dist)) best = { wall, ...seg, dist };
            });
        });
        if (!best) { toolTip.innerText = 'Click closer to the end of a wall to trim it.'; return; }

        let bestIntersection = null;
        walls.forEach(otherWall => {
            if (otherWall === best.wall) return;
            const oPts = getWallAbsPoints(otherWall);
            for (let i = 0; i < oPts.length - 1; i++) {
                const ix = lineIntersection(best.p1, best.p2, oPts[i], oPts[i + 1]);
                if (ix) {
                    const d = Math.hypot(ix.x - pointer.x, ix.y - pointer.y);
                    if (!bestIntersection || d < bestIntersection.dist) bestIntersection = { point: ix, dist: d };
                }
            }
        });
        if (!bestIntersection) { toolTip.innerText = 'No intersecting wall found near that end.'; return; }

        const inverted = fabric.util.invertTransform(best.wall.calcTransformMatrix());
        const local = fabric.util.transformPoint(bestIntersection.point, inverted);
        const offset = best.wall.pathOffset || { x: 0, y: 0 };
        const newLocalPoint = { x: local.x + offset.x, y: local.y + offset.y };

        const newPoints = best.wall.points.slice();
        if (best.isStart) newPoints[0] = newLocalPoint; else newPoints[newPoints.length - 1] = newLocalPoint;
        best.wall.set({ points: newPoints });
        best.wall.setCoords();
        canvas.renderAll();
        saveState();
    }

    function finalizeActiveShape() {
        if (!activeShape) return;
        const { left, top, width, height, angle } = activeShape;
        canvas.remove(activeShape);

        if (width > 2 && height > 2) {
            if (currentMode === 'rect') {
                const fillColor = ROOM_FILL_COLORS[roomColorIndex % ROOM_FILL_COLORS.length];
                roomColorIndex++;
                const rect = new fabric.Rect({
                    width, height,
                    fill: fillColor,
                    stroke: cssVar('--text-primary'),
                    strokeWidth: 2,
                    originX: 'left', originY: 'top'
                });
                const widthText = new fabric.Text(`${(width / PIXELS_PER_METER).toFixed(2)}m`, {
                    fontSize: 12, fill: cssVar('--text-primary'),
                    originX: 'center', originY: 'top',
                    left: width / 2, top: height - 16,
                    data: { type: 'width' }
                });
                const heightText = new fabric.Text(`${(height / PIXELS_PER_METER).toFixed(2)}m`, {
                    fontSize: 12, fill: cssVar('--text-primary'),
                    originX: 'left', originY: 'center',
                    left: 4, top: height / 2,
                    data: { type: 'height' }
                });
                const roomGroup = new fabric.Group([rect, widthText, heightText], {
                    left, top, angle,
                    originX: 'left', originY: 'top',
                    selectable: true,
                    data: { layer: 'walls', type: 'room' }
                });
                canvas.add(roomGroup);
                canvas.setActiveObject(roomGroup);
            } else if (currentMode === 'stairs') {
                const stairsGroup = createStairsSymbol(left, top, width, height, angle);
                canvas.setActiveObject(stairsGroup);
            }
        }

        activeShape = null;
        canvas.renderAll();
        setMode('select');
        saveState();
    }

    function cancelActiveShape() {
        if (activeShape) {
            canvas.remove(activeShape);
            activeShape = null;
            canvas.renderAll();
        }
        isDrawing = false;
        isDefiningAngle = false;
    }

    function snap(value) {
        return snapCheckbox.checked ? Math.round(value / GRID_SIZE) * GRID_SIZE : value;
    }

    function findClosestWallPoint(pointer) {
        const walls = canvas.getObjects().filter(obj => obj.data && (obj.data.type === 'wall-system' || obj.data.type === 'room'));
        let minDistance = Infinity, bestPoint = null, wallAngle = 0;

        function considerSegment(p1, p2) {
            const l2 = Math.pow(p2.x - p1.x, 2) + Math.pow(p2.y - p1.y, 2);
            if (l2 === 0) return;
            let t = ((pointer.x - p1.x) * (p2.x - p1.x) + (pointer.y - p1.y) * (p2.y - p1.y)) / l2;
            t = Math.max(0, Math.min(1, t));
            const closestPointOnSegment = { x: p1.x + t * (p2.x - p1.x), y: p1.y + t * (p2.y - p1.y) };
            const dist = Math.sqrt(Math.pow(pointer.x - closestPointOnSegment.x, 2) + Math.pow(pointer.y - closestPointOnSegment.y, 2));
            if (dist < minDistance) {
                minDistance = dist;
                bestPoint = closestPointOnSegment;
                wallAngle = Math.atan2(p2.y - p1.y, p2.x - p1.x) * 180 / Math.PI;
            }
        }

        walls.forEach(wallObj => {
            const matrix = wallObj.calcTransformMatrix();
            if (wallObj.data.type === 'wall-system' && Array.isArray(wallObj.points)) {
                const offset = wallObj.pathOffset || { x: 0, y: 0 };
                const absPoints = wallObj.points.map(p => fabric.util.transformPoint({ x: p.x - offset.x, y: p.y - offset.y }, matrix));
                for (let i = 0; i < absPoints.length - 1; i++) considerSegment(absPoints[i], absPoints[i + 1]);
            } else if (wallObj.data.type === 'room' && wallObj._objects) {
                const rect = wallObj._objects.find(o => o.type === 'rect');
                if (rect) {
                    const tl = fabric.util.transformPoint({ x: 0, y: 0 }, matrix);
                    const tr = fabric.util.transformPoint({ x: rect.width, y: 0 }, matrix);
                    const bl = fabric.util.transformPoint({ x: 0, y: rect.height }, matrix);
                    const br = fabric.util.transformPoint({ x: rect.width, y: rect.height }, matrix);
                    considerSegment(tl, tr); considerSegment(tr, br); considerSegment(br, bl); considerSegment(bl, tl);
                }
            }
        });

        return { point: bestPoint, angle: wallAngle, distance: minDistance };
    }

    canvas.on('mouse:wheel', function(opt) {
        opt.e.preventDefault();
        opt.e.stopPropagation();
        const delta = opt.e.deltaY;
        let zoom = canvas.getZoom();
        zoom *= 0.999 ** delta;
        if (zoom > 10) zoom = 10;
        if (zoom < 0.1) zoom = 0.1;
        canvas.zoomToPoint({ x: opt.e.offsetX, y: opt.e.offsetY }, zoom);
        zoomDisplay.innerText = `Zoom: ${Math.round(zoom * 100)}%`;
        drawRulers();
    });

    canvas.on({
        'selection:created': (e) => updatePropertiesPanel(e.target),
        'selection:updated': (e) => updatePropertiesPanel(e.target),
        'selection:cleared': () => updatePropertiesPanel(null),
        'object:modified': (e) => {
            const target = e.target;
            if (target.data && target.data.type === 'room') {
                updateRoomDimensions(target);
            }
            saveState();
        },
    });

    canvas.on('mouse:down', (o) => {
        if (o.target && o.target.selectable && currentMode !== 'select') return;
        if (o.target && currentMode === 'select') return;

        const pointer = canvas.getPointer(o.e);
        
        if (isDefiningAngle) {
            finalizeActiveShape();
            return;
        }

        if (currentMode === 'trim') {
            performTrim(pointer);
            return;
        }

        if (currentMode === 'asset') {
            if (selectedAssetId) {
                placeFurniture(selectedAssetId, pointer.x, pointer.y);
            } else {
                toolTip.innerText = 'Pick a furniture item from the Assets panel first.';
            }
            return;
        }

        if (currentMode === 'door' || currentMode === 'window') {
            const result = findClosestWallPoint(pointer);
            if (result && result.distance < 20) {
                if (currentMode === 'door') createDoorSymbol(result.point.x, result.point.y, result.angle);
                else createWindowSymbol(result.point.x, result.point.y, result.angle);
            } else {
                if (currentMode === 'door') createDoorSymbol(pointer.x, pointer.y, 0);
                else createWindowSymbol(pointer.x, pointer.y, 0);
            }
            saveState();
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
            canvas.add(new fabric.Circle({ left: snappedPointer.x, top: snappedPointer.y, radius: currentStrokeWidth/2, fill: '#999', originX: 'center', originY: 'center', selectable: false, evented: false, name: 'temp'}));
            if (wallPoints.length > 1) {
                const prevPoint = wallPoints[wallPoints.length - 2];
                canvas.add(new fabric.Line([prevPoint.x, prevPoint.y, snappedPointer.x, snappedPointer.y], { stroke: '#999', strokeWidth: currentStrokeWidth, selectable: false, evented: false, name: 'temp' }));
            }
            if (tempWallLine) canvas.remove(tempWallLine);
            tempWallLine = new fabric.Line([snappedPointer.x, snappedPointer.y, snappedPointer.x, snappedPointer.y], { stroke: 'rgba(66, 133, 244, 0.5)', strokeWidth: currentStrokeWidth, selectable: false, evented: false });
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
        lastMousePos = {x: o.e.offsetX, y: o.e.offsetY};
        drawCrosshairs(lastMousePos);
        if (canvas.isGrabMode) { drawRulers(); return; }

        const pointer = canvas.getPointer(o.e);
        const snappedPointer = { x: snap(pointer.x), y: snap(pointer.y) };
        coordsDisplay.innerText = `X: ${(pointer.x / PIXELS_PER_METER).toFixed(2)}m, Y: ${(pointer.y / PIXELS_PER_METER).toFixed(2)}m`;
        
        if (isDefiningAngle && activeShape) {
            const angle = fabric.util.radiansToDegrees(Math.atan2(snappedPointer.y - activeShape.top, snappedPointer.x - activeShape.left));
            activeShape.set('angle', angle);
            canvas.renderAll();
            return;
        }

        if (!isDrawing || !activeShape) return;
        
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
                if (currentMode === 'rect' || currentMode === 'stairs') {
                    isDrawing = false;
                    isDefiningAngle = true;
                    toolTip.innerText = 'Move mouse to set angle, click to finalize.';
                    return;
                }
            }
        }
    });

    canvas.on('mouse:dblclick', () => { if (currentMode === 'wall') finalizeWall(); });
    
    window.addEventListener('keydown', (e) => {
        const activeElement = document.activeElement;
        if (activeElement.tagName === 'INPUT' || activeElement.tagName === 'TEXTAREA') return;
        if (e.code === 'Space') { e.preventDefault(); if (!canvas.isGrabMode) { canvas.isGrabMode = true; canvas.defaultCursor = 'grab'; canvas.selection = false; canvas.renderAll(); } return; }
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
        if (e.key === 'Escape') {
             if (currentMode === 'wall') finalizeWall();
             if (isDefiningAngle || activeShape) {
                 cancelActiveShape();
                 setMode('select');
             }
        }
        if (e.key === 'Delete' || e.key === 'Backspace') {
            canvas.getActiveObjects().forEach(obj => canvas.remove(obj));
            canvas.discardActiveObject().renderAll();
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
            drawRulers();
        }
    });

    fileMenuBtn.addEventListener('click', (e) => { e.stopPropagation(); fileMenuDropdown.classList.toggle('show'); });
    window.addEventListener('click', () => { if (fileMenuDropdown.classList.contains('show')) fileMenuDropdown.classList.remove('show'); });
    function clearCanvas() { if (confirm('Are you sure? All unsaved work will be lost.')) { canvas.clear(); historyManager.reset(); canvas.backgroundColor = createGridPattern(); canvas.renderAll(); syncLayerUI(); drawRulers(); saveState(); } }
    newBtn.addEventListener('click', clearCanvas);
    saveBtn.addEventListener('click', () => saveProject(canvas));
    loadBtn.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        loadProject(canvas, file, () => {
            canvas.backgroundColor = createGridPattern(); canvas.renderAll(); syncLayerUI(); drawRulers(); fileInput.value = ''; historyManager.reset(); saveState();
        });
    });
    exportBtn.addEventListener('click', () => { modalOverlay.classList.remove('hidden'); modal.classList.remove('hidden'); });
    function closeModal() { modalOverlay.classList.add('hidden'); modal.classList.add('hidden'); }
    closeModalBtn.addEventListener('click', closeModal);
    modalOverlay.addEventListener('click', closeModal);
    document.querySelectorAll('input[name="format"]').forEach((radio) => {
        radio.addEventListener('change', (e) => { qualityWrapper.style.display = e.target.value === 'jpeg' ? 'block' : 'none'; });
    });
    downloadBtn.addEventListener('click', () => {
        const format = document.querySelector('input[name="format"]:checked').value;
        const scale = parseFloat(document.getElementById('export-scale').value);
        const options = { format: format, multiplier: scale, quality: 1.0 };
        const link = document.createElement('a');
        link.href = canvas.toDataURL(options);
        link.download = `gncad-export.${format}`;
        link.click();
        closeModal();
    });
    exportDxfBtn.addEventListener('click', () => { const dxfString = exportToDXF(canvas); const blob = new Blob([dxfString], { type: 'application/dxf' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = 'gncad-export.dxf'; a.click(); URL.revokeObjectURL(url);});
    importDxfBtn.addEventListener('click', () => dxfFileInput.click());
    dxfFileInput.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        importDxf(fabric, canvas, cssVar, file, () => saveState());
    });
    appHeader.addEventListener('click', (e) => {
        if (e.target.id === 'app-header' || e.target.tagName === 'H1') {
            document.body.classList.toggle('light-theme');
            document.body.classList.toggle('dark-theme');
            canvas.backgroundColor = createGridPattern(); canvas.renderAll(); drawRulers();
        }
    });
    showRulersCheckbox.addEventListener('change', () => {
        drawRulers();
        drawCrosshairs(lastMousePos);
    });
    wallThicknessSelector.addEventListener('click', (e) => {
        if (e.target.classList.contains('thickness-option')) {
            wallThicknessSelector.querySelectorAll('.thickness-option').forEach(el => el.classList.remove('active'));
            e.target.classList.add('active');
            currentStrokeWidth = parseInt(e.target.dataset.thickness, 10);
        }
    });

    const layerList = document.getElementById('layer-list');
    layerList.querySelectorAll('.visibility-toggle').forEach(toggle => { toggle.innerHTML = ICON_EYE; });
    layerList.addEventListener('click', (e) => {
        const toggle = e.target.closest('.visibility-toggle');
        if (!toggle) return;
        const layerItem = toggle.closest('.layer-item');
        const layerName = layerItem.dataset.layer;
        const newVisible = toggle.dataset.visible !== 'true';
        toggle.dataset.visible = String(newVisible);
        toggle.innerHTML = newVisible ? ICON_EYE : ICON_EYE_OFF;
        canvas.getObjects().forEach(obj => {
            if (obj.data && obj.data.layer === layerName) {
                obj.visible = newVisible;
            }
        });
        canvas.renderAll();
    });

    function syncLayerUI() {
        layerList.querySelectorAll('.layer-item').forEach(item => {
            const toggle = item.querySelector('.visibility-toggle');
            toggle.dataset.visible = 'true';
            toggle.innerHTML = ICON_EYE;
        });
        canvas.getObjects().forEach(obj => { obj.visible = true; });
        canvas.renderAll();
    }

    const FURNITURE_CATALOG = {
        'Living Room': [
            { id: 'sofa', name: 'Sofa', file: 'sofa.svg', sizeMeters: 1.8 },
            { id: 'armchair', name: 'Armchair', file: 'armchair.svg', sizeMeters: 0.9 },
            { id: 'coffee-table', name: 'Coffee Table', file: 'coffee-table.svg', sizeMeters: 1.0 },
            { id: 'tv', name: 'TV', file: 'tv.svg', sizeMeters: 1.0 },
            { id: 'bookshelf', name: 'Bookshelf', file: 'bookshelf.svg', sizeMeters: 1.0 },
            { id: 'rug', name: 'Rug', file: 'rug.svg', sizeMeters: 2.0 },
        ],
        'Bedroom': [
            { id: 'bed', name: 'Bed', file: 'bed.svg', sizeMeters: 2.0 },
            { id: 'wardrobe', name: 'Wardrobe', file: 'wardrobe.svg', sizeMeters: 1.2 },
            { id: 'nightstand', name: 'Nightstand', file: 'nightstand.svg', sizeMeters: 0.5 },
            { id: 'dresser', name: 'Dresser', file: 'dresser.svg', sizeMeters: 1.2 },
            { id: 'mirror', name: 'Mirror', file: 'mirror.svg', sizeMeters: 0.8 },
        ],
        'Kitchen': [
            { id: 'table', name: 'Dining Table', file: 'table.svg', sizeMeters: 1.2 },
            { id: 'chair', name: 'Chair', file: 'chair.svg', sizeMeters: 0.5 },
            { id: 'fridge', name: 'Fridge', file: 'fridge.svg', sizeMeters: 0.8 },
            { id: 'stove', name: 'Stove', file: 'stove.svg', sizeMeters: 0.7 },
            { id: 'sink-kitchen', name: 'Kitchen Sink', file: 'sink-kitchen.svg', sizeMeters: 0.7 },
            { id: 'dishwasher', name: 'Dishwasher', file: 'dishwasher.svg', sizeMeters: 0.6 },
            { id: 'microwave', name: 'Microwave', file: 'microwave.svg', sizeMeters: 0.5 },
            { id: 'cabinet', name: 'Cabinet', file: 'cabinet.svg', sizeMeters: 1.0 },
        ],
        'Bathroom': [
            { id: 'bathtub', name: 'Bathtub', file: 'bathtub.svg', sizeMeters: 1.5 },
            { id: 'shower', name: 'Shower', file: 'shower.svg', sizeMeters: 0.9 },
            { id: 'toilet', name: 'Toilet', file: 'toilet.svg', sizeMeters: 0.5 },
            { id: 'sink-bathroom', name: 'Sink', file: 'sink-bathroom.svg', sizeMeters: 0.5 },
            { id: 'washing-machine', name: 'Washing Machine', file: 'washing-machine.svg', sizeMeters: 0.6 },
        ],
        'Outdoor': [
            { id: 'plant', name: 'Plant', file: 'plant.svg', sizeMeters: 0.4 },
            { id: 'tree', name: 'Tree', file: 'tree.svg', sizeMeters: 2.0 },
            { id: 'umbrella', name: 'Umbrella', file: 'umbrella.svg', sizeMeters: 1.8 },
        ],
    };
    const FURNITURE_ITEMS = Object.values(FURNITURE_CATALOG).flat();
    let selectedAssetId = null;
    const assetList = document.getElementById('asset-list');

    Object.entries(FURNITURE_CATALOG).forEach(([category, items]) => {
        const heading = document.createElement('div');
        heading.className = 'asset-category-heading';
        heading.textContent = category;
        assetList.appendChild(heading);

        const grid = document.createElement('div');
        grid.className = 'asset-category-grid';
        items.forEach(item => {
            const el = document.createElement('div');
            el.className = 'asset-item';
            el.dataset.assetId = item.id;
            el.title = item.name;
            el.innerHTML = `<img src="assets/furniture/${item.file}" alt="${item.name}" draggable="false">`;
            grid.appendChild(el);
        });
        assetList.appendChild(grid);
    });

    assetList.addEventListener('click', (e) => {
        const item = e.target.closest('.asset-item');
        if (!item) return;
        assetList.querySelectorAll('.asset-item').forEach(el => el.classList.remove('active'));
        item.classList.add('active');
        selectedAssetId = item.dataset.assetId;
        toolTip.innerText = `${item.title} selected — click on the canvas to place it.`;
    });

    function placeFurniture(assetId, x, y) {
        const itemDef = FURNITURE_ITEMS.find(i => i.id === assetId);
        if (!itemDef) return;
        fabric.loadSVGFromURL(`assets/furniture/${itemDef.file}`, (objects, options) => {
            objects.forEach(o => {
                if (o.stroke) o.set('stroke', cssVar('--text-primary'));
            });
            const svgGroup = fabric.util.groupSVGElements(objects, options);
            const targetSizePx = itemDef.sizeMeters * PIXELS_PER_METER;
            const scale = targetSizePx / Math.max(svgGroup.width, svgGroup.height, 1);
            svgGroup.set({
                left: x, top: y,
                originX: 'center', originY: 'center',
                scaleX: scale, scaleY: scale,
                selectable: true,
                data: { layer: 'furniture', type: 'furniture', name: itemDef.name }
            });
            canvas.add(svgGroup);
            canvas.setActiveObject(svgGroup);
            canvas.renderAll();
            saveState();
        });
    }

    function setMode(mode) {
        let postModeMessage = null;

        if (mode === 'mirror') {
            const active = canvas.getActiveObject();
            if (active) {
                active.set('flipX', !active.flipX);
                active.setCoords();
                canvas.renderAll();
                saveState();
            } else {
                postModeMessage = 'Select an object first, then click Mirror.';
            }
            mode = 'select';
        } else if (mode === 'offset') {
            const active = canvas.getActiveObject();
            if (active && active.data && active.data.type === 'wall-system') {
                const newPoints = offsetWallPoints(getWallAbsPoints(active), GRID_SIZE);
                const offsetWall = new fabric.Polyline(newPoints, {
                    stroke: active.stroke,
                    strokeWidth: active.strokeWidth,
                    strokeLineJoin: 'miter',
                    fill: null,
                    selectable: true,
                    objectCaching: false,
                    data: { layer: 'walls', type: 'wall-system' }
                });
                canvas.add(offsetWall);
                canvas.setActiveObject(offsetWall);
                canvas.renderAll();
                saveState();
            } else if (active && active.data && active.data.type === 'room') {
                const ring = offsetPolygonPoints(active.getCoords(), GRID_SIZE);
                if (ring) {
                    const minX = Math.min(...ring.map(p => p.x));
                    const minY = Math.min(...ring.map(p => p.y));
                    const roomFill = (active._objects && active._objects[0]) ? active._objects[0].fill : ROOM_FILL_COLORS[0];
                    const offsetRoom = new fabric.Polygon(ring.map(p => ({ x: p.x - minX, y: p.y - minY })), {
                        left: minX, top: minY,
                        fill: roomFill,
                        stroke: cssVar('--text-primary'),
                        strokeWidth: 2,
                        selectable: true,
                        data: { layer: 'walls', type: 'room' }
                    });
                    canvas.add(offsetRoom);
                    canvas.setActiveObject(offsetRoom);
                    canvas.renderAll();
                    saveState();
                } else {
                    postModeMessage = 'Offset distance is too large for this room.';
                }
            } else if (active) {
                active.clone((cloned) => {
                    cloned.set({
                        left: active.left + GRID_SIZE,
                        top: active.top + GRID_SIZE,
                        data: active.data ? Object.assign({}, active.data) : undefined
                    });
                    canvas.add(cloned);
                    canvas.setActiveObject(cloned);
                    canvas.renderAll();
                    saveState();
                });
            } else {
                postModeMessage = 'Select an object first, then click Offset.';
            }
            mode = 'select';
        }

        if (currentMode === 'wall' && mode !== 'wall' && wallPoints.length > 0) finalizeWall();
        if (currentMode !== mode && activeShape) cancelActiveShape();

        currentMode = mode;
        isDrawing = false; isDefiningAngle = false; dimensionFirstPoint = null;
        toolTip.innerText = '';
        wallThicknessSelector.classList.add('hidden');
        if (mode === 'wall') wallThicknessSelector.classList.remove('hidden');

        assetPanel.classList.toggle('hidden', mode !== 'asset');

        const crosshairModes = ['wall', 'rect', 'stairs', 'dimension', 'door', 'window'];
        canvas.defaultCursor = crosshairModes.includes(mode) ? 'crosshair' : 'default';
        canvas.selection = mode === 'select';
        canvas.discardActiveObject();
        canvas.renderAll();

        switch (mode) {
            case 'select': toolTip.innerText = ''; break;
            case 'wall': toolTip.innerText = 'Click to start drawing a wall.'; break;
            case 'rect': toolTip.innerText = 'Click and drag to draw a room.'; break;
            case 'stairs': toolTip.innerText = 'Click and drag to draw a staircase.'; break;
            case 'door': toolTip.innerText = 'Click near a wall to place a door.'; break;
            case 'window': toolTip.innerText = 'Click near a wall to place a window.'; break;
            case 'dimension': toolTip.innerText = 'Click two points to measure.'; break;
            case 'trim': toolTip.innerText = 'Click near the end of a wall to trim/extend it to the nearest wall.'; break;
            case 'asset': toolTip.innerText = 'Select a furniture item, then click on the canvas.'; break;
        }

        toolButtons.forEach(btn => btn.classList.remove('active'));
        const activeBtn = document.getElementById(`${mode}-tool-btn`);
        if (activeBtn) activeBtn.classList.add('active');

        if (postModeMessage) toolTip.innerText = postModeMessage;
    }
    toolButtons.forEach(btn => { btn.addEventListener('click', () => setMode(btn.id.replace('-tool-btn', ''))); });

    function init() {
        canvas.backgroundColor = createGridPattern();
        canvas.renderAll();
        setupRulers();
        setMode('select');
        updateUndoRedoButtons();
        saveState();
    }
    
    init();
});
