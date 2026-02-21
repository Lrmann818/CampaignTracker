// js/pages/map/mapHistory.js

const DEFAULT_MAX_HISTORY = 50;

function sanitizeSnapshot(snapshot) {
  if (typeof snapshot !== "string") return null;

  try {
    // JSON round-trip guarantees snapshots are serializable and detached.
    return JSON.parse(JSON.stringify(snapshot));
  } catch {
    return null;
  }
}

function sanitizeHistoryStack(value, maxLen) {
  if (!Array.isArray(value)) return [];

  const out = [];
  for (const entry of value) {
    const safe = sanitizeSnapshot(entry);
    if (safe !== null) out.push(safe);
  }

  if (out.length <= maxLen) return out;
  return out.slice(out.length - maxLen);
}

export function createMapHistory({
  undo,
  redo,
  maxLen = DEFAULT_MAX_HISTORY,
  getCurrentSnapshot
} = {}) {
  const limit = Number.isFinite(maxLen) && maxLen > 0 ? Math.floor(maxLen) : DEFAULT_MAX_HISTORY;
  let undoStack = sanitizeHistoryStack(undo, limit);
  let redoStack = sanitizeHistoryStack(redo, limit);

  const captureCurrentSnapshot = () => {
    if (typeof getCurrentSnapshot !== "function") return null;
    return sanitizeSnapshot(getCurrentSnapshot());
  };

  const canUndo = () => undoStack.length > 0;
  const canRedo = () => redoStack.length > 0;

  const push = (snapshot) => {
    const safeSnapshot = sanitizeSnapshot(snapshot);
    if (safeSnapshot === null) return false;
    undoStack.push(safeSnapshot);
    if (undoStack.length > limit) undoStack.shift();
    redoStack.length = 0;
    return true;
  };

  const undoAction = () => {
    if (!canUndo()) return null;
    const current = captureCurrentSnapshot();
    if (current !== null) redoStack.push(current);
    return undoStack.pop() ?? null;
  };

  const redoAction = () => {
    if (!canRedo()) return null;
    const current = captureCurrentSnapshot();
    if (current !== null) undoStack.push(current);
    return redoStack.pop() ?? null;
  };

  const clear = () => {
    undoStack = [];
    redoStack = [];
  };

  const replace = ({ undo: nextUndo, redo: nextRedo } = {}) => {
    undoStack = sanitizeHistoryStack(nextUndo, limit);
    redoStack = sanitizeHistoryStack(nextRedo, limit);
  };

  const exportState = () => ({
    undo: undoStack.slice(),
    redo: redoStack.slice()
  });

  return {
    push,
    undo: undoAction,
    redo: redoAction,
    canUndo,
    canRedo,
    clear,
    replace,
    exportState
  };
}
