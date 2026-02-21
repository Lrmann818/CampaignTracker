// js/pages/map/mapController.js

import { createMapCanvases, renderMap } from "./mapCanvas.js";
import { colorFromKey } from "./mapUtils.js";
import { persistDrawingSnapshot } from "./mapPersistence.js";
import { createMapHistory } from "./mapHistory.js";
import {
  restoreFromDataUrl,
  clearDrawing as clearDrawingAction
} from "./mapDrawing.js";
import { createMapGestures } from "./mapGestures.js";
import { createMapPointerHandlers } from "./mapPointerHandlers.js";
import { createMapBackgroundActions } from "./mapBackgroundActions.js";
import { initMapListUI } from "./mapListUI.js";
import { initMapToolbarUI } from "./mapToolbarUI.js";
import { safeAsync } from "../../ui/safeAsync.js";
import { createStateActions } from "../../domain/stateActions.js";

const MAP_HISTORY_MAX_LEN = 50;

/**
 * @typedef {{
 *   init: () => void,
 *   destroy: () => void,
 *   render: () => void,
 *   load: (incomingMapState?: unknown) => void,
 *   serialize: () => unknown
 * }} MapController
 */

function toJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return null;

  const t = typeof value;
  if (t === "string" || t === "boolean") return value;
  if (t === "number") return Number.isFinite(value) ? value : null;
  if (t === "undefined" || t === "function" || t === "symbol") return null;
  if (t === "bigint") return String(value);
  if (t !== "object") return null;

  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    const out = value.map((item) => toJsonSafe(item, seen));
    seen.delete(value);
    return out;
  }

  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const innerType = typeof inner;
    if (innerType === "undefined" || innerType === "function" || innerType === "symbol") continue;
    out[key] = toJsonSafe(inner, seen);
  }

  seen.delete(value);
  return out;
}

function normalizeMapState({ state, ensureMapManager, incomingMapState, newMapEntry }) {
  if (incomingMapState && typeof incomingMapState === "object" && !Array.isArray(incomingMapState)) {
    state.map = incomingMapState;
  } else if (!state.map || typeof state.map !== "object") {
    state.map = {};
  }

  ensureMapManager();

  const mapState = state.map;
  if (!Array.isArray(mapState.maps)) mapState.maps = [];
  if (!mapState.maps.length) {
    const defaultMapEntry = {
      id: `map_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
      name: "World Map",
      bgBlobId: null,
      drawingBlobId: null
    };
    if (typeof newMapEntry === "function") {
      const mapEntry = newMapEntry();
      if (mapEntry && typeof mapEntry === "object") {
        if (!mapEntry.name) mapEntry.name = "World Map";
        mapState.maps.push(mapEntry);
      } else {
        mapState.maps.push(defaultMapEntry);
      }
    } else {
      mapState.maps.push(defaultMapEntry);
    }
  }
  if (!mapState.maps.some((m) => m?.id === mapState.activeMapId)) {
    mapState.activeMapId = mapState.maps[0]?.id ?? null;
  }

  mapState.ui ||= {};
  if (typeof mapState.ui.activeTool !== "string") mapState.ui.activeTool = "brush";
  if (!Number.isFinite(mapState.ui.brushSize)) mapState.ui.brushSize = 6;
  const viewScale = Number(mapState.ui.viewScale);
  mapState.ui.viewScale = Number.isFinite(viewScale) ? viewScale : 1;

  if (!Array.isArray(mapState.undo)) mapState.undo = [];
  if (!Array.isArray(mapState.redo)) mapState.redo = [];
  return mapState;
}

function createRuntimeState() {
  return {
    canvas: null,
    ctx: null,
    drawLayer: null,
    drawCtx: null,
    canvasWrap: null,
    bgImg: null,
    gestures: null,
    toolbarUI: null,
    listUI: null,
    initialized: false,
    destroyed: false,
    listenerController: null,
    listenerSignal: null,
    gestureSession: {
      activePointers: new Map(),
      gestureMode: null,
      panStart: null,
      pinchStart: null,
      viewScale: 1,
      initScaleRaf: 0,
      activeGestureWrap: null
    },
    pointerSession: {
      drawing: false,
      lastPt: null,
      pendingDraw: false,
      pendingPointerId: null,
      pendingStartClient: null,
      pendingStartCanvas: null
    }
  };
}

/**
 * @returns {MapController}
 */
export function createMapController({
  state,
  SaveManager,
  setStatus,
  positionMenuOnScreen,
  Popovers,
  ensureMapManager,
  getActiveMap,
  newMapEntry,
  blobIdToObjectUrl,
  putBlob,
  deleteBlob,
  uiPrompt,
  uiAlert,
  uiConfirm
} = {}) {
  if (!state) throw new Error("createMapController: state is required");
  if (!SaveManager) throw new Error("createMapController: SaveManager is required");
  if (!ensureMapManager) throw new Error("createMapController: ensureMapManager is required");
  if (!getActiveMap) throw new Error("createMapController: getActiveMap is required");
  if (!newMapEntry) throw new Error("createMapController: newMapEntry is required");
  if (!uiAlert) throw new Error("createMapController: uiAlert is required");
  if (!setStatus) throw new Error("createMapController: setStatus is required");

  const safePositionMenuOnScreen =
    typeof positionMenuOnScreen === "function" ? positionMenuOnScreen : () => { };
  const safeUiConfirm = typeof uiConfirm === "function" ? uiConfirm : () => false;
  const { updateMapField } = createStateActions({ state, SaveManager });
  const runtime = createRuntimeState();
  let mapState = normalizeMapState({ state, ensureMapManager, incomingMapState: state.map, newMapEntry });
  const mapHistory = createMapHistory({
    undo: mapState.undo,
    redo: mapState.redo,
    maxLen: MAP_HISTORY_MAX_LEN,
    getCurrentSnapshot: () => {
      if (!runtime.drawLayer) return null;
      return runtime.drawLayer.toDataURL("image/png");
    }
  });

  const syncHistoryToMapState = () => {
    const historyState = mapHistory.exportState();
    mapState.undo = historyState.undo;
    mapState.redo = historyState.redo;
  };

  syncHistoryToMapState();

  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function" || !runtime.listenerSignal) return;
    target.addEventListener(type, handler, { ...(options || {}), signal: runtime.listenerSignal });
  };

  const snapshotForUndoFn = () => {
    if (!runtime.drawLayer) return;
    mapHistory.push(runtime.drawLayer.toDataURL("image/png"));
    syncHistoryToMapState();
  };

  const commitDrawingSnapshot = () => {
    if (!runtime.drawLayer) return Promise.resolve();
    return persistDrawingSnapshot({ drawLayer: runtime.drawLayer, getActiveMap, putBlob, deleteBlob, SaveManager });
  };

  const renderArgs = () => ({
    canvas: runtime.canvas,
    ctx: runtime.ctx,
    drawLayer: runtime.drawLayer,
    bgImg: runtime.bgImg
  });

  const restoreFromDataUrlFn = (url) =>
    restoreFromDataUrl({
      url,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  const undo = () => {
    if (!runtime.drawLayer) return;
    const prev = mapHistory.undo();
    syncHistoryToMapState();
    if (typeof prev !== "string") return;
    restoreFromDataUrlFn(prev);
  };

  const redo = () => {
    if (!runtime.drawLayer) return;
    const next = mapHistory.redo();
    syncHistoryToMapState();
    if (typeof next !== "string") return;
    restoreFromDataUrlFn(next);
  };

  const clearDrawing = async () =>
    clearDrawingAction({
      uiConfirm: safeUiConfirm,
      snapshotForUndoFn,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  const render = () => {
    if (runtime.destroyed || !runtime.canvas || !runtime.ctx || !runtime.drawLayer) return;
    renderMap({
      canvas: runtime.canvas,
      ctx: runtime.ctx,
      drawLayer: runtime.drawLayer,
      bgImg: runtime.bgImg
    });
  };

  const load = (incomingMapState) => {
    if (runtime.destroyed) return;
    // Sanitize external map payloads before install so non-serializable values/prototypes never enter controller state.
    const safeIncomingMapStateRaw = toJsonSafe(incomingMapState);
    const safeIncomingMapState =
      safeIncomingMapStateRaw && typeof safeIncomingMapStateRaw === "object" && !Array.isArray(safeIncomingMapStateRaw)
        ? safeIncomingMapStateRaw
        : null;
    mapState = normalizeMapState({
      state,
      ensureMapManager,
      incomingMapState: safeIncomingMapState,
      newMapEntry
    });
    mapHistory.replace({ undo: mapState.undo, redo: mapState.redo });
    syncHistoryToMapState();
  };

  const init = () => {
    if (runtime.destroyed) return;
    if (runtime.initialized) return;
    runtime.initialized = true;

    runtime.listenerController = new AbortController();
    runtime.listenerSignal = runtime.listenerController.signal;

    const can = createMapCanvases({ canvasId: "mapCanvas" });
    runtime.canvas = can.canvas;
    runtime.ctx = can.ctx;
    runtime.drawLayer = can.drawLayer;
    runtime.drawCtx = can.drawCtx;
    runtime.canvasWrap = can.canvasWrap;

    runtime.gestures = createMapGestures({
      mapState,
      runtimeState: runtime.gestureSession,
      SaveManager,
      updateMapField,
    });
    runtime.gestures.initScale({ canvas: runtime.canvas, canvasWrap: runtime.canvasWrap });

    const pointerHandlers = createMapPointerHandlers({
      mapState,
      runtimeState: runtime.pointerSession,
      canvas: runtime.canvas,
      canvasWrap: runtime.canvasWrap,
      gestures: runtime.gestures,
      getActiveMap,
      snapshotForUndoFn,
      commitDrawingSnapshot,
      renderArgs,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer
    });

    const bgActions = createMapBackgroundActions({
      setStatus,
      uiAlert,
      SaveManager,
      getActiveMap,
      blobIdToObjectUrl,
      putBlob,
      deleteBlob,
      renderMap,
      commitDrawingSnapshot,
      canvas: runtime.canvas,
      ctx: runtime.ctx,
      drawLayer: runtime.drawLayer,
      getBgImg: () => runtime.bgImg,
      setBgImg: (v) => { runtime.bgImg = v; }
    });

    if (window.matchMedia("(max-width: 600px)").matches) {
      if (!mapState.ui.activeTool) mapState.ui.activeTool = "brush";
    }

    runtime.toolbarUI = initMapToolbarUI({
      mapState,
      SaveManager,
      Popovers,
      positionMenuOnScreen: safePositionMenuOnScreen,
      addListener,
      canvas: runtime.canvas,
      canvasWrap: runtime.canvasWrap,
      getActiveMap,
      colorFromKey,
      undo,
      redo,
      clearDrawing,
      setStatus
    });
    const { setActiveToolUI, setActiveColorUI } = runtime.toolbarUI;

    runtime.listUI = initMapListUI({
      mapState,
      SaveManager,
      Popovers,
      addListener,
      ensureMapManager,
      getActiveMap,
      newMapEntry,
      uiPrompt,
      uiConfirm,
      uiAlert,
      blobIdToObjectUrl,
      deleteBlob,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer,
      canvas: runtime.canvas,
      ctx: runtime.ctx,
      getBgImg: () => runtime.bgImg,
      setBgImg: (v) => { runtime.bgImg = v; },
      commitDrawingSnapshot,
      clearHistory: () => {
        mapHistory.clear();
        syncHistoryToMapState();
      },
      setActiveToolUI,
      setActiveColorUI,
      renderMap,
      setStatus
    });

    addListener(document.getElementById("mapImageInput"), "change", bgActions.setMapImage);
    addListener(
      document.getElementById("removeMapImageBtn"),
      "click",
      safeAsync(bgActions.removeMapImage, (err) => {
        console.error(err);
        setStatus("Remove map image failed.");
      })
    );

    addListener(runtime.canvas, "pointerdown", pointerHandlers.onPointerDown);
    addListener(runtime.canvas, "pointermove", pointerHandlers.onPointerMove);
    addListener(window, "pointerup", pointerHandlers.onPointerUp);
  };

  const destroy = () => {
    if (runtime.destroyed) return;
    runtime.destroyed = true;
    runtime.initialized = false;

    runtime.listenerController?.abort();
    runtime.listenerController = null;
    runtime.listenerSignal = null;

    runtime.gestures?.destroy?.();
    runtime.toolbarUI?.destroy?.();
    runtime.listUI?.destroy?.();

    runtime.canvas = null;
    runtime.ctx = null;
    runtime.drawLayer = null;
    runtime.drawCtx = null;
    runtime.bgImg = null;
    runtime.canvasWrap = null;
    runtime.gestures = null;
    runtime.toolbarUI = null;
    runtime.listUI = null;

    runtime.pointerSession.drawing = false;
    runtime.pointerSession.lastPt = null;
    runtime.pointerSession.pendingDraw = false;
    runtime.pointerSession.pendingPointerId = null;
    runtime.pointerSession.pendingStartClient = null;
    runtime.pointerSession.pendingStartCanvas = null;
  };

  const serialize = () => {
    mapHistory.replace({ undo: mapState.undo, redo: mapState.redo });
    syncHistoryToMapState();
    return toJsonSafe(mapState || {});
  };

  return { init, destroy, render, load, serialize };
}
