// js/pages/map/mapPage.js

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

let _uiAlert = null;
let _activeMapPageController = null;

export function setupMapPage({
  state,
  SaveManager,
  setStatus,
  positionMenuOnScreen,
  Popovers,
  // map manager + storage helpers
  ensureMapManager,
  getActiveMap,
  newMapEntry,
  blobIdToObjectUrl,
  putBlob,
  deleteBlob,
  // dialogs
  uiPrompt,
  uiAlert,
  uiConfirm
} = {}) {
  if (!state) throw new Error("setupMapPage: state is required");
  if (!SaveManager) throw new Error("setupMapPage: SaveManager is required");
  if (!ensureMapManager) throw new Error("setupMapPage: ensureMapManager is required");
  if (!getActiveMap) throw new Error("setupMapPage: getActiveMap is required");
  if (!newMapEntry) throw new Error("setupMapPage: newMapEntry is required");
  if (!uiAlert) throw new Error("setupMapPage: uiAlert is required");
  if (!setStatus) throw new Error("setupMapPage requires setStatus");

  _uiAlert = uiAlert;

  // Make optional deps safe to call (prevents "is not a function" crashes)
  const safePositionMenuOnScreen =
    typeof positionMenuOnScreen === "function" ? positionMenuOnScreen : () => { };
  const safeUiConfirm = typeof uiConfirm === "function" ? uiConfirm : () => false;

  if (_activeMapPageController?.destroy) {
    _activeMapPageController.destroy();
  }

  /************************ Map page ***********************/
  let canvas, ctx;
  let drawLayer, drawCtx;
  let bgImg = null;
  let canvasWrap = null;
  let gestures;
  let toolbarUI = null;
  let listUI = null;
  let destroyed = false;

  const listenerController = new AbortController();
  const { signal: listenerSignal } = listenerController;

  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function") return;
    target.addEventListener(type, handler, { ...(options || {}), signal: listenerSignal });
  };

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;

    listenerController.abort();
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

    if (_activeMapPageController === controller) {
      _activeMapPageController = null;
    }
  };

  const controller = { destroy };
  _activeMapPageController = controller;

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

  function setupMap() {
    if (destroyed) return;

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
      uiAlert: _uiAlert,
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
      ensureMapManager,
      getActiveMap,
      newMapEntry,
      uiPrompt,
      uiConfirm,
      uiAlert: _uiAlert,
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
  }

  // actually wire it up
  try {
    setupMap();
  } catch (err) {
    destroy();
    throw err;
  }
  return controller;
}
