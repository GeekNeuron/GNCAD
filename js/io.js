export function saveProject(canvas, meta) {
    const payload = { canvasData: canvas.toJSON(['data', 'name']), meta: meta || {} };
    const json = JSON.stringify(payload);
    const blob = new Blob([json], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-project.gncad';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

export function loadProject(canvas, file, onComplete) {
    const reader = new FileReader();
    reader.onload = (event) => {
        let payload;
        try {
            payload = JSON.parse(event.target.result);
        } catch (err) {
            if (onComplete) onComplete(null);
            return;
        }
        const isWrapped = payload && payload.canvasData;
        const canvasData = isWrapped ? payload.canvasData : payload;
        const meta = isWrapped ? payload.meta : {};
        canvas.loadFromJSON(canvasData, () => {
            if (onComplete) onComplete(meta);
        });
    };
    reader.readAsText(file);
}

export function importDxf(fabric, canvas, cssVar, file, onComplete) {
    const reader = new FileReader();
    reader.onload = (event) => {
        if (typeof window.DxfParser === 'undefined') {
            alert('DXF import is unavailable: the dxf-parser library failed to load. Try reloading the page.');
            return;
        }
        try {
            const dxfParser = new window.DxfParser();
            const dxf = dxfParser.parseSync(event.target.result);
            dxf.entities.forEach(entity => {
                if (entity.type === 'LINE') {
                    canvas.add(new fabric.Line([entity.vertices[0].x, -entity.vertices[0].y, entity.vertices[1].x, -entity.vertices[1].y], { stroke: cssVar('--text-primary'), strokeWidth: 2, data: { layer: 'walls' } }));
                } else if (entity.type === 'LWPOLYLINE') {
                    const points = entity.vertices.map(v => ({ x: v.x, y: -v.y }));
                    canvas.add(new fabric.Polyline(points, { stroke: cssVar('--text-primary'), strokeWidth: 2, fill: null, data: { layer: 'walls' } }));
                }
            });
            canvas.renderAll();
            if (onComplete) onComplete();
        } catch (err) {
            console.error(err);
            alert('Error parsing DXF file.');
        }
    };
    reader.readAsText(file);
}
