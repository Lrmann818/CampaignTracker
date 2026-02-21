// js/pages/map/mapController.js

import { createMapCanvases, renderMap } from "./mapCanvas.js";
import { colorFromKey } from "./mapUtils.js";
import { persistDrawingSnapshot } from "./mapPersistence.js";
import {
  snapshotForUndo,
  restoreFromDataUrl,
  undo as undoDrawing,
  redo as redoDrawing,
  clearDrawing as clearDrawingAction
} from "./mapDrawing.js";
import { createMapGestures } from "./mapGestures.js";
import { createMapPointerHandlers } from "./mapPointerHandlers.js";
import { createMapBackgroundActions } from "./mapBackgroundActions.js";
import { initMapListUI } from "./mapListUI.js";
import { initMapToolbarUI } from "./mapToolbarUI.js";
import { safeAsync } from "../../ui/safeAsync.js";

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

  let canvas = null;
  let ctx = null;
  let drawLayer = null;
  let drawCtx = null;
  let bgImg = null;
  let canvasWrap = null;
  let gestures = null;
  let toolbarUI = null;
  let listUI = null;

  let initialized = false;
  let destroyed = false;
  let loadedMapState = state.map || null;

  let listenerController = null;
  let listenerSignal = null;

  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function" || !listenerSignal) return;
    target.addEventListener(type, handler, { ...(options || {}), signal: listenerSignal });
  };

  const snapshotForUndoFn = () => snapshotForUndo({ state, drawLayer });

  const commitDrawingSnapshot = () =>
    persistDrawingSnapshot({ drawLayer, getActiveMap, putBlob, deleteBlob, SaveManager });

  const renderArgs = () => ({ canvas, ctx, drawLayer, bgImg });

  const restoreFromDataUrlFn = (url) =>
    restoreFromDataUrl({
      url,
      drawCtx,
      drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  const undo = () =>
    undoDrawing({ state, drawLayer, restoreFromDataUrlFn });

  const redo = () =>
    redoDrawing({ state, drawLayer, restoreFromDataUrlFn });

  const clearDrawing = async () =>
    clearDrawingAction({
      uiConfirm: safeUiConfirm,
      snapshotForUndoFn,
      drawCtx,
      drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  const render = () => {
    if (destroyed || !canvas || !ctx || !drawLayer) return;
    renderMap({ canvas, ctx, drawLayer, bgImg });
  };

  const load = (mapState) => {
    if (destroyed) return;
    if (mapState && typeof mapState === "object") {
      loadedMapState = mapState;
      state.map = mapState;
      return;
    }
    loadedMapState = state.map || null;
  };

  const init = () => {
    if (destroyed) return;
    if (initialized) return;
    initialized = true;

    listenerController = new AbortController();
    listenerSignal = listenerController.signal;

    const can = createMapCanvases({ canvasId: "mapCanvas" });
    canvas = can.canvas;
    ctx = can.ctx;
    drawLayer = can.drawLayer;
    drawCtx = can.drawCtx;
    canvasWrap = can.canvasWrap;

    gestures = createMapGestures({ state, SaveManager });
    gestures.initScale({ canvas, canvasWrap });

    const pointerHandlers = createMapPointerHandlers({
      state,
      canvas,
      canvasWrap,
      gestures,
      getActiveMap,
      snapshotForUndoFn,
      commitDrawingSnapshot,
      renderArgs,
      drawCtx,
      drawLayer
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
      canvas,
      ctx,
      drawLayer,
      getBgImg: () => bgImg,
      setBgImg: (v) => { bgImg = v; }
    });

    ensureMapManager();
    if (window.matchMedia("(max-width: 600px)").matches) {
      if (!state.map.ui.activeTool) state.map.ui.activeTool = "brush";
    }

    toolbarUI = initMapToolbarUI({
      state,
      SaveManager,
      Popovers,
      positionMenuOnScreen: safePositionMenuOnScreen,
      addListener,
      canvas,
      canvasWrap,
      getActiveMap,
      colorFromKey,
      undo,
      redo,
      clearDrawing,
      setStatus,
      listenerSignal
    });
    const { setActiveToolUI, setActiveColorUI } = toolbarUI;

    listUI = initMapListUI({
      state,
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
      drawCtx,
      drawLayer,
      canvas,
      ctx,
      getBgImg: () => bgImg,
      setBgImg: (v) => { bgImg = v; },
      commitDrawingSnapshot,
      setActiveToolUI,
      setActiveColorUI,
      renderMap,
      setStatus,
      listenerSignal
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

    addListener(canvas, "pointerdown", pointerHandlers.onPointerDown);
    addListener(canvas, "pointermove", pointerHandlers.onPointerMove);
    addListener(window, "pointerup", pointerHandlers.onPointerUp);
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    initialized = false;

    listenerController?.abort();
    listenerController = null;
    listenerSignal = null;

    gestures?.destroy?.();
    toolbarUI?.destroy?.();
    listUI?.destroy?.();

    canvas = null;
    ctx = null;
    drawLayer = null;
    drawCtx = null;
    bgImg = null;
    canvasWrap = null;
    gestures = null;
    toolbarUI = null;
    listUI = null;
  };

  const serialize = () => toJsonSafe(loadedMapState || state.map || {});

  return { init, destroy, render, load, serialize };
}
