// js/dxf-exporter.js

function exportToDXF(canvas) {
    let dxf = '';
    const header = `0\nSECTION\n2\nHEADER\n9\n$ACADVER\n1\nAC1009\n0\nENDSEC\n0\nSECTION\n2\nTABLES\n0\nTABLE\n2\nLTYPE\n70\n1\n0\nLTYPE\n2\nCONTINUOUS\n3\nSolid line\n72\n65\n73\n0\n40\n0.0\n0\nENDTAB\n0\nENDSEC\n0\nSECTION\n2\nENTITIES\n`;
    dxf += header.trim() + '\n';

    canvas.getObjects().forEach(obj => {
        if (obj.name === 'grid' || obj.name === 'temp' || (obj.data && obj.data.isDimensionLabel)) return;

        if (obj.data && obj.data.type === 'room') {
            const rect = obj._objects.find(o => o.type === 'rect');
            if(rect) dxf += rectToDxf(rect, obj.getCenterPoint(), obj.angle);
        } else if (obj.data && obj.data.type === 'wall-system') {
            obj._objects.forEach(line => {
                if (line.type === 'line') {
                     const p1 = new fabric.Point(line.x1, line.y1);
                     const p2 = new fabric.Point(line.x2, line.y2);
                     const matrix = obj.calcTransformMatrix();
                     const transformedP1 = fabric.util.transformPoint(p1, matrix);
                     const transformedP2 = fabric.util.transformPoint(p2, matrix);
                     dxf += lineToDxf(transformedP1, transformedP2);
                }
            });
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

function rectToDxf(rect, center, angle) {
    const w = rect.getScaledWidth();
    const h = rect.getScaledHeight();
    const angleRad = -angle * Math.PI / 180; // DXF uses clockwise angles
    
    // Get corners relative to center
    const corners = [
        {x: -w/2, y: -h/2}, {x: w/2, y: -h/2},
        {x: w/2, y: h/2}, {x: -w/2, y: h/2}
    ];

    // Rotate and translate corners
    const finalCorners = corners.map(c => {
        const rotatedX = c.x * Math.cos(angleRad) - c.y * Math.sin(angleRad);
        const rotatedY = c.x * Math.sin(angleRad) + c.y * Math.cos(angleRad);
        return { x: center.x + rotatedX, y: center.y + rotatedY };
    });

    let entityDxf = `0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n`; // 4 vertices, closed
    finalCorners.forEach(c => {
        entityDxf += `10\n${c.x}\n20\n${-c.y}\n`;
    });
    return entityDxf;
}
