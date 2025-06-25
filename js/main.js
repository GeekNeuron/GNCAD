document.addEventListener('DOMContentLoaded', () => {

    // --- Canvas Initialization ---
    const canvasContainer = document.getElementById('canvas-container');
    const canvas = new fabric.Canvas('gn-canvas', {
        width: canvasContainer.offsetWidth - 40, // Adjust for padding
        height: canvasContainer.offsetHeight - 40,
        backgroundColor: 'var(--canvas-bg)'
    });
    
    // --- Theme Toggle ---
    const header = document.getElementById('main-header');
    header.addEventListener('click', () => {
        document.body.classList.toggle('light-theme');
        document.body.classList.toggle('dark-theme');
        // Update canvas background color on theme change
        const currentBg = getComputedStyle(document.documentElement).getPropertyValue('--canvas-bg');
        canvas.setBackgroundColor(currentBg, canvas.renderAll.bind(canvas));
    });

    // --- Asset Loading ---
    const assets = ['sofa.svg', 'chair.svg', 'table.svg', 'plant.svg', 'bed.svg'];
    const assetList = document.getElementById('asset-list');

    assets.forEach(assetName => {
        const assetItem = document.createElement('div');
        assetItem.className = 'asset-item';
        assetItem.innerHTML = `<img src="assets/furniture/${assetName}" alt="${assetName.split('.')[0]}">`;
        
        assetItem.addEventListener('click', () => {
            fabric.loadSVGFromURL(`assets/furniture/${assetName}`, (objects, options) => {
                const obj = fabric.util.groupSVGElements(objects, options);
                obj.set({
                    left: canvas.width / 2,
                    top: canvas.height / 2,
                }).scaleToWidth(100); // Set a default size
                canvas.add(obj).renderAll();
                canvas.setActiveObject(obj);
            });
        });
        assetList.appendChild(assetItem);
    });

    // --- Export Functionality ---
    const exportJpgBtn = document.getElementById('export-jpg-btn');
    exportJpgBtn.addEventListener('click', () => {
        const dataURL = canvas.toDataURL({
            format: 'jpeg',
            quality: 1.0, // High quality
            multiplier: 3 // High resolution (3x original size)
        });
        const link = document.createElement('a');
        link.download = 'gncad-export.jpg';
        link.href = dataURL;
        link.click();
    });

    const exportDxfBtn = document.getElementById('export-dxf-btn');
    exportDxfBtn.addEventListener('click', () => {
        // Use the function from dxf-exporter.js
        const dxfContent = exportToDXF(canvas);
        const link = document.createElement('a');
        const blob = new Blob([dxfContent], { type: 'application/dxf' });
        link.href = URL.createObjectURL(blob);
        link.download = 'gncad-export.dxf';
        link.click();
    });
    
    // --- Keyboard Shortcuts ---
    window.addEventListener('keydown', (e) => {
        // Delete selected object with 'Delete' or 'Backspace' key
        if (e.key === 'Delete' || e.key === 'Backspace') {
            const activeObject = canvas.getActiveObject();
            if (activeObject) {
                canvas.remove(activeObject);
                canvas.renderAll();
            }
        }
    });

    // --- Responsive Canvas ---
    window.addEventListener('resize', () => {
        canvas.setWidth(canvasContainer.offsetWidth - 40);
        canvas.setHeight(canvasContainer.offsetHeight - 40);
        canvas.renderAll();
    });

});
