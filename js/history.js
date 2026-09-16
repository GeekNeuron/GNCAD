import { HISTORY_LIMIT } from './config.js';

export function createHistoryManager(canvas, { undoBtn, redoBtn, onRestore } = {}) {
    let history = [];
    let redoStack = [];
    let isProcessingHistory = false;

    function updateUndoRedoButtons() {
        if (undoBtn) undoBtn.disabled = history.length <= 1;
        if (redoBtn) redoBtn.disabled = redoStack.length === 0;
    }

    function saveState() {
        if (isProcessingHistory) return;
        redoStack = [];
        const jsonState = JSON.stringify(canvas.toJSON(['data', 'name']));
        history.push(jsonState);
        if (history.length > HISTORY_LIMIT) history.shift();
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
                if (onRestore) onRestore();
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
                if (onRestore) onRestore();
            });
        }
    }

    function reset() {
        history = [];
        redoStack = [];
        updateUndoRedoButtons();
    }

    return { saveState, undo, redo, updateUndoRedoButtons, reset };
}
