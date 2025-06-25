/**
 * GNCAD DXF Exporter
 * Converts Fabric.js canvas objects to a basic DXF format string.
 * Supports: lines, polylines (for rects), circles.
 * Note: This is a simplified exporter.
 */
function exportToDXF(canvas) {
    let dxf = '';

    const header = `
0
SECTION
2
HEADER
9
$ACADVER
1
AC1009
0
ENDSEC
0
SECTION
2
TABLES
0
TABLE
2
LTYPE
70
1
0
LTYPE
2
CONTINUOUS
3
Solid line
72
65
73
0
40
0.0
0
ENDTAB
0
ENDSEC
0
SECTION
2
ENTITIES
`;
    dxf += header.trim() + '\n';

    canvas.getObjects().forEach(obj => {
        // We handle group (SVG) objects by iterating their inner objects
        if (obj.type === 'group') {
             obj._objects.forEach(member => {
                dxf += objectToDxf(member, obj.left, obj.top, obj.scaleX, obj.scaleY, obj.angle);
             });
        } else {
             dxf += objectToDxf(obj, obj.left, obj.top, obj.scaleX, obj.scaleY, obj.angle);
        }
    });

    dxf += '0\nENDSEC\n0\nEOF\n';
    return dxf;
}

function objectToDxf(obj, groupLeft = 0, groupTop = 0, groupScaleX = 1, groupScaleY = 1, groupAngle = 0) {
    let entityDxf = '';
    
    // Note: This exporter is basic and does not handle grouped object rotation/scaling perfectly.
    // For simplicity, we use the object's original properties within a group.
    const left = groupLeft;
    const top = groupTop;

    switch (obj.type) {
        case 'line':
            entityDxf += `0\nLINE\n8\n0\n`; // Layer 0
            entityDxf += `10\n${obj.x1}\n20\n${-obj.y1}\n`; // Start point (Y is inverted in DXF)
            entityDxf += `11\n${obj.x2}\n21\n${-obj.y2}\n`; // End point
            break;

        case 'rect':
            // Represent rect as a closed polyline
            const w = obj.width * obj.scaleX;
            const h = obj.height * obj.scaleY;
            const x = obj.left;
            const y = -obj.top; // Invert Y
            
            entityDxf += `0\nLWPOLYLINE\n8\n0\n90\n4\n70\n1\n`; // 4 vertices, closed
            entityDxf += `10\n${x - w/2}\n20\n${y + h/2}\n`;
            entityDxf += `10\n${x + w/2}\n20\n${y + h/2}\n`;
            entityDxf += `10\n${x + w/2}\n20\n${y - h/2}\n`;
            entityDxf += `10\n${x - w/2}\n20\n${y - h/2}\n`;
            break;
            
        case 'circle':
            entityDxf += `0\nCIRCLE\n8\n0\n`;
            entityDxf += `10\n${obj.left}\n20\n${-obj.top}\n`; // Center point
            entityDxf += `40\n${obj.radius * obj.scaleX}\n`; // Radius
            break;
    }
    return entityDxf;
}
