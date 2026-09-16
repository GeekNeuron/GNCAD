import { PIXELS_PER_METER } from './config.js';

export function createDoorSymbol(fabric, canvas, cssVar, x, y, angle = 0, wallThickness = 5, width = PIXELS_PER_METER * 0.8) {
    const bgColor = getComputedStyle(document.body).getPropertyValue('--bg-canvas-container').trim();
    const doorMask = new fabric.Rect({ width: width, height: wallThickness, fill: bgColor, originX: 'center', originY: 'center' });
    const doorLeaf = new fabric.Rect({ left: -width / 2, top: 0, width: width, height: 3, fill: 'transparent', stroke: cssVar('--text-primary'), strokeWidth: 1.5, originX: 'left', originY: 'center' });
    const arcPath = `M ${-width / 2} 0 A ${width} ${width} 0 0 1 ${width / 2} ${-width}`;
    const doorSwing = new fabric.Path(arcPath, { fill: 'transparent', stroke: cssVar('--text-secondary'), strokeDashArray: [3, 3], strokeWidth: 1, originX: 'left', originY: 'bottom' });
    const doorGroup = new fabric.Group([doorMask, doorLeaf, doorSwing], { left: x, top: y, angle: angle, selectable: true, originX: 'center', originY: 'center', data: { layer: 'furniture', type: 'door' } });
    canvas.add(doorGroup);
    return doorGroup;
}

export function createWindowSymbol(fabric, canvas, cssVar, x, y, angle = 0, wallThickness = 5, width = PIXELS_PER_METER * 1.2) {
    const bgColor = getComputedStyle(document.body).getPropertyValue('--bg-canvas-container').trim();
    const windowMask = new fabric.Rect({ width: width, height: wallThickness, fill: bgColor, originX: 'center', originY: 'center' });
    const frameLine = new fabric.Line([-width / 2, 0, width / 2, 0], { stroke: cssVar('--text-primary'), strokeWidth: wallThickness });
    const glassLine = new fabric.Line([-width / 2, 0, width / 2, 0], { stroke: '#87CEEB', strokeWidth: wallThickness - 3 < 1 ? 1 : wallThickness - 3 });
    const windowGroup = new fabric.Group([windowMask, frameLine, glassLine], { left: x, top: y, angle: angle, selectable: true, originX: 'center', originY: 'center', data: { layer: 'furniture', type: 'window', width: width } });
    canvas.add(windowGroup);
    return windowGroup;
}

export function createStairsSymbol(fabric, canvas, cssVar, x, y, width, height, angle = 0) {
    const items = [];
    const stepCount = Math.max(2, Math.floor(height / (PIXELS_PER_METER * 0.3)));
    const stepDepth = height / stepCount;
    const outline = new fabric.Rect({ width: width, height: height, stroke: cssVar('--text-primary'), strokeWidth: 2, fill: cssVar('--bg-panels'), originX: 'center', originY: 'center' });
    items.push(outline);
    for (let i = 1; i < stepCount; i++) {
        items.push(new fabric.Line([-width / 2, -height / 2 + i * stepDepth, width / 2, -height / 2 + i * stepDepth], { stroke: cssVar('--text-secondary'), strokeWidth: 1 }));
    }
    const directionLine = new fabric.Line([0, height / 2 - (stepDepth / 2), 0, -height / 2 + stepDepth / 2], { stroke: cssVar('--text-primary'), strokeWidth: 1 });
    items.push(directionLine);
    const arrowHead = new fabric.Triangle({ width: 10, height: 15, fill: cssVar('--text-primary'), left: 0, top: -height / 2 + stepDepth / 2, originX: 'center', originY: 'bottom', angle: 180 });
    items.push(arrowHead);
    const stairsGroup = new fabric.Group(items, { left: x, top: y, angle: angle, originX: 'left', originY: 'top', selectable: true, data: { layer: 'furniture', type: 'stairs' } });
    canvas.add(stairsGroup);
    return stairsGroup;
}

export function createDimensionObject(fabric, canvas, p1, p2) {
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
    return dimGroup;
}
