function exportToDXF(canvas) {
    let dxf = '';
    const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
    dxf += header.trim() + '\n';

    canvas.getObjects().forEach(obj => {
        if (obj.name === 'grid' || obj.name === 'temp' || (obj.data && obj.data.isDimensionLabel)) return;

        if (obj.data && obj.data.type === 'room') {
            if (obj.type === 'polygon') {
                dxf += polylineToDxf(absolutePolygonPoints(obj), true);
            } else {
                const rect = obj._objects.find(o => o.type === 'rect');
                if (rect) dxf += rectToDxf(rect, obj.getCenterPoint(), obj.angle);
            }
        } else if (obj.data && obj.data.type === 'wall-system' && Array.isArray(obj.points)) {
            const matrix = obj.calcTransformMatrix();
            const offset = obj.pathOffset || { x: 0, y: 0 };
            const absPoints = obj.points.map(p => fabric.util.transformPoint({ x: p.x - offset.x, y: p.y - offset.y }, matrix));
            for (let i = 0; i < absPoints.length - 1; i++) {
                dxf += lineToDxf(absPoints[i], absPoints[i + 1]);
            }
        } else if (obj.data && obj.data.layer === 'dimensions') {
            const line = obj._objects && obj._objects.find(o => o.type === 'line');
            if (line) {
                const matrix = obj.calcTransformMatrix();
                const p1 = fabric.util.transformPoint({ x: line.x1, y: line.y1 }, matrix);
                const p2 = fabric.util.transformPoint({ x: line.x2, y: line.y2 }, matrix);
                dxf += lineToDxf(p1, p2);
            }
        } else if (obj.data && (obj.data.type === 'door' || obj.data.type === 'window' || obj.data.type === 'stairs' || obj.data.type === 'furniture')) {
            const w = obj.getScaledWidth();
            const h = obj.getScaledHeight();
            dxf += boxToDxf(w, h, obj.getCenterPoint(), obj.angle);
        }
    });

    dxf += '0\nENDSEC\n0\nEOF\n';
    return dxf;
}

function lineToDxf(p1, p2) {
    let entityDxf = `0\nLINE\n8\n0\n`;
    entityDxf += `10\n${p1.x}\n20\n${-p1.y}\n`;
    entityDxf += `11\n${p2.x}\n21\n${-p2.y}\n`;
    return entityDxf;
}

function absolutePolygonPoints(obj) {
    const matrix = obj.calcTransformMatrix();
    const offset = obj.pathOffset || { x: 0, y: 0 };
    return obj.points.map(p => fabric.util.transformPoint({ x: p.x - offset.x, y: p.y - offset.y }, matrix));
}

function polylineToDxf(points, closed) {
    let entityDxf = `0\nLWPOLYLINE\n8\n0\n90\n${points.length}\n70\n${closed ? 1 : 0}\n`;
    points.forEach(p => {
        entityDxf += `10\n${p.x}\n20\n${-p.y}\n`;
    });
    return entityDxf;
}

function rectToDxf(rect, center, angle) {
    const w = rect.getScaledWidth();
    const h = rect.getScaledHeight();
    return boxToDxf(w, h, center, angle);
}

function boxToDxf(w, h, center, angle) {
    const angleRad = -angle * Math.PI / 180;

    const corners = [
        {x: -w/2, y: -h/2}, {x: w/2, y: -h/2},
        {x: w/2, y: h/2}, {x: -w/2, y: h/2}
    ];

    const finalCorners = corners.map(c => {
        const rotatedX = c.x * Math.cos(angleRad) - c.y * Math.sin(angleRad);
        const rotatedY = c.x * Math.sin(angleRad) + c.y * Math.cos(angleRad);
        return { x: center.x + rotatedX, y: center.y + rotatedY };
    });

    let entityDxf = `0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n`;
    finalCorners.forEach(c => {
        entityDxf += `10\n${c.x}\n20\n${-c.y}\n`;
    });
    return entityDxf;
}
