// @ts-check
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

/** @typedef {import("../../state.js").State} State */
/** @typedef {import("../../state.js").MapState} MapState */
/** @typedef {import("../../state.js").MapEntry} MapEntry */
/** @typedef {import("../../storage/saveManager.js").SaveManager} SaveManager */
/** @typedef {typeof import("../../state.js").ensureMapManager} EnsureMapManagerFn */
/** @typedef {typeof import("../../state.js").getActiveMap} GetActiveMapFn */
/** @typedef {typeof import("../../state.js").newMapEntry} NewMapEntryFn */
/** @typedef {typeof import("../../storage/blobs.js").blobIdToObjectUrl} BlobIdToObjectUrlFn */
/** @typedef {typeof import("../../storage/blobs.js").putBlob} PutBlobFn */
/** @typedef {typeof import("../../storage/blobs.js").deleteBlob} DeleteBlobFn */
/** @typedef {typeof import("../../ui/dialogs.js").uiPrompt} UiPromptFn */
/** @typedef {typeof import("../../ui/dialogs.js").uiAlert} UiAlertFn */
/** @typedef {typeof import("../../ui/dialogs.js").uiConfirm} UiConfirmFn */
/** @typedef {null | boolean | number | string | unknown[] | Record<string, unknown>} JsonSafeValue */
/**
 * @typedef {{
 *   canvas: HTMLCanvasElement,
 *   ctx: CanvasRenderingContext2D,
 *   drawLayer: HTMLCanvasElement,
 *   drawCtx: CanvasRenderingContext2D,
 *   canvasWrap: HTMLElement | null
 * }} MapCanvasRefs
 */
/**
 * @typedef {{
 *   canvas: HTMLCanvasElement,
 *   ctx: CanvasRenderingContext2D,
 *   drawLayer: HTMLCanvasElement,
 *   bgImg: HTMLImageElement | null
 * }} MapRenderArgs
 */
/**
 * @typedef {{
 *   initScale: (opts: { canvas: HTMLCanvasElement, canvasWrap: HTMLElement | null }) => void,
 *   onPointerDown: (opts: { e: PointerEvent, canvasWrap: HTMLElement | null }) => { startedPanZoom: boolean },
 *   onPointerMove: (opts: { e: PointerEvent, canvas: HTMLCanvasElement, canvasWrap: HTMLElement | null }) => { handled: boolean },
 *   onPointerUp: (opts: { e: PointerEvent, canvasWrap: HTMLElement | null }) => { endedPanZoom: boolean },
 *   destroy: () => void
 * }} MapGesturesApi
 */
/**
 * @typedef {{
 *   onPointerDown: (event: Event) => void,
 *   onPointerMove: (event: Event) => void,
 *   onPointerUp: (event: Event) => void
 * }} MapPointerHandlersApi
 */
/**
 * @typedef {{
 *   setMapImage: (event: Event) => void,
 *   removeMapImage: () => Promise<void>
 * }} MapBackgroundActionsApi
 */
/**
 * @typedef {{
 *   setActiveToolUI: (tool: string) => void,
 *   setActiveColorUI: (colorKey: string) => void,
 *   destroy: () => void
 * }} MapToolbarUiApi
 */
/**
 * @typedef {{
 *   refreshMapSelect: () => void,
 *   loadActiveMapIntoCanvas: () => Promise<void>,
 *   switchMap: (newId: string) => Promise<void>,
 *   destroy: () => void
 * }} MapListUiApi
 */
/**
 * @typedef {{
 *   activePointers: Map<number, { x: number, y: number }>,
 *   gestureMode: "panzoom" | null,
 *   panStart: { cx: number, cy: number, scrollLeft: number, scrollTop: number } | null,
 *   pinchStart: { dist: number, scale: number } | null,
 *   viewScale: number,
 *   initScaleRaf: number,
 *   activeGestureWrap: HTMLElement | null
 * }} MapGestureRuntimeState
 */
/**
 * @typedef {{
 *   drawing: boolean,
 *   lastPt: { x: number, y: number } | null,
 *   pendingDraw: boolean,
 *   pendingPointerId: number | null,
 *   pendingStartClient: { x: number, y: number } | null,
 *   pendingStartCanvas: { x: number, y: number } | null
 * }} MapPointerRuntimeState
 */
/**
 * @typedef {{
 *   canvas: HTMLCanvasElement | null,
 *   ctx: CanvasRenderingContext2D | null,
 *   drawLayer: HTMLCanvasElement | null,
 *   drawCtx: CanvasRenderingContext2D | null,
 *   canvasWrap: HTMLElement | null,
 *   bgImg: HTMLImageElement | null,
 *   gestures: MapGesturesApi | null,
 *   toolbarUI: MapToolbarUiApi | null,
 *   listUI: MapListUiApi | null,
 *   initialized: boolean,
 *   destroyed: boolean,
 *   listenerController: AbortController | null,
 *   listenerSignal: AbortSignal | null,
 *   gestureSession: MapGestureRuntimeState,
 *   pointerSession: MapPointerRuntimeState
 * }} MapControllerRuntimeState
 */
/**
 * @typedef {{
 *   state?: State,
 *   SaveManager?: SaveManager,
 *   setStatus?: (message: string, opts?: { stickyMs?: number }) => void,
 *   positionMenuOnScreen?: (menuEl: HTMLElement, anchorEl: HTMLElement, opts?: { preferRight?: boolean }) => void,
 *   Popovers?: {
 *     register?: (...args: unknown[]) => unknown,
 *     trackDynamic?: (...args: unknown[]) => unknown,
 *     open?: (...args: unknown[]) => void,
 *     close?: (...args: unknown[]) => void,
 *     toggle?: (...args: unknown[]) => void,
 *     reposition?: (...args: unknown[]) => void,
 *     closeAll?: () => void,
 *     closeAllExcept?: (...args: unknown[]) => void,
 *     isOpen?: (...args: unknown[]) => boolean,
 *     destroy?: () => void
 *   },
 *   ensureMapManager?: EnsureMapManagerFn,
 *   getActiveMap?: GetActiveMapFn,
 *   newMapEntry?: NewMapEntryFn,
 *   blobIdToObjectUrl?: BlobIdToObjectUrlFn,
 *   putBlob?: PutBlobFn,
 *   deleteBlob?: DeleteBlobFn,
 *   uiPrompt?: UiPromptFn,
 *   uiAlert?: UiAlertFn,
 *   uiConfirm?: UiConfirmFn
 * }} MapControllerDeps
 */
/**
 * @typedef {{
 *   state: State,
 *   ensureMapManager: EnsureMapManagerFn,
 *   incomingMapState?: JsonSafeValue | null,
 *   newMapEntry?: NewMapEntryFn
 * }} NormalizeMapStateOptions
 */

const MAP_HISTORY_MAX_LEN = 50;

/**
 * @typedef {{
 *   init: () => void,
 *   destroy: () => void,
 *   render: () => void,
 *   load: (incomingMapState?: unknown) => void,
 *   serialize: () => JsonSafeValue | null
 * }} MapController
 */

/**
 * @param {unknown} value
 * @param {WeakSet<object>} [seen]
 * @returns {JsonSafeValue | null}
 */
function toJsonSafe(value, seen = new WeakSet()) {
  if (value === null) return null;

  if (typeof value === "string" || typeof value === "boolean") return value;
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value === "undefined" || typeof value === "function" || typeof value === "symbol") return null;
  if (typeof value === "bigint") return String(value);
  if (typeof value !== "object") return null;

  if (seen.has(value)) return null;
  seen.add(value);

  if (Array.isArray(value)) {
    const out = value.map((item) => toJsonSafe(item, seen));
    seen.delete(value);
    return out;
  }

  /** @type {{ [key: string]: JsonSafeValue }} */
  const out = {};
  for (const [key, inner] of Object.entries(value)) {
    const innerType = typeof inner;
    if (innerType === "undefined" || innerType === "function" || innerType === "symbol") continue;
    out[key] = /** @type {JsonSafeValue} */ (toJsonSafe(inner, seen));
  }

  seen.delete(value);
  return out;
}

/**
 * @param {NormalizeMapStateOptions} options
 * @returns {MapState}
 */
function normalizeMapState({ state, ensureMapManager, incomingMapState, newMapEntry }) {
  if (incomingMapState && typeof incomingMapState === "object" && !Array.isArray(incomingMapState)) {
    state.map = /** @type {MapState} */ (incomingMapState);
  } else if (!state.map || typeof state.map !== "object") {
    state.map = /** @type {MapState} */ ({});
  }

  ensureMapManager();

  const mapState = /** @type {MapState} */ (state.map);
  if (!Array.isArray(mapState.maps)) mapState.maps = [];
  if (!mapState.maps.length) {
    const defaultMapEntry = /** @type {MapEntry} */ ({
      id: `map_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
      name: "World Map",
      bgBlobId: null,
      drawingBlobId: null,
      brushSize: 6,
      colorKey: "grey"
    });
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

  if (!mapState.ui || typeof mapState.ui !== "object") {
    mapState.ui = { activeTool: "brush", brushSize: 6, viewScale: 1 };
  }
  if (typeof mapState.ui.activeTool !== "string") mapState.ui.activeTool = "brush";
  if (!Number.isFinite(mapState.ui.brushSize)) mapState.ui.brushSize = 6;
  const viewScale = Number(mapState.ui.viewScale);
  mapState.ui.viewScale = Number.isFinite(viewScale) ? viewScale : 1;

  if (!Array.isArray(mapState.undo)) mapState.undo = [];
  if (!Array.isArray(mapState.redo)) mapState.redo = [];
  return mapState;
}

/**
 * @returns {MapControllerRuntimeState}
 */
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
 * @param {MapControllerDeps} [deps]
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
  const safeUiConfirm = typeof uiConfirm === "function" ? uiConfirm : async () => false;
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
    updateMapField("undo", historyState.undo, { queueSave: false });
    updateMapField("redo", historyState.redo, { queueSave: false });
  };

  syncHistoryToMapState();

  /**
   * @param {{ addEventListener?: EventTarget["addEventListener"] } | null | undefined} target
   * @param {string} type
   * @param {(event: Event) => void} handler
   * @param {AddEventListenerOptions | boolean} [options]
   * @returns {void}
   */
  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function" || !runtime.listenerSignal) return;
    const listenerOptions =
      typeof options === "boolean"
        ? { capture: options }
        : (options || {});
    target.addEventListener(type, handler, { ...listenerOptions, signal: runtime.listenerSignal });
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

  /**
   * @returns {MapRenderArgs | null}
   */
  const renderArgs = () => {
    if (!runtime.canvas || !runtime.ctx || !runtime.drawLayer) return null;
    return {
      canvas: runtime.canvas,
      ctx: runtime.ctx,
      drawLayer: runtime.drawLayer,
      bgImg: runtime.bgImg
    };
  };

  /**
   * @param {string} url
   * @returns {void}
   */
  const restoreFromDataUrlFn = (url) => {
    const args = renderArgs();
    if (!args || !runtime.drawCtx || !runtime.drawLayer) return;
    restoreFromDataUrl({
      url,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer,
      renderArgs: args,
      commitDrawing: commitDrawingSnapshot
    });
  };

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

  const clearDrawing = async () => {
    const args = renderArgs();
    if (!args || !runtime.drawCtx || !runtime.drawLayer) return;
    return clearDrawingAction({
      uiConfirm: safeUiConfirm,
      snapshotForUndoFn,
      drawCtx: runtime.drawCtx,
      drawLayer: runtime.drawLayer,
      renderArgs: args,
      commitDrawing: commitDrawingSnapshot
    });
  };

  const render = () => {
    if (runtime.destroyed || !runtime.canvas || !runtime.ctx || !runtime.drawLayer) return;
    renderMap({
      canvas: runtime.canvas,
      ctx: runtime.ctx,
      drawLayer: runtime.drawLayer,
      bgImg: runtime.bgImg
    });
  };

  /**
   * @param {unknown} incomingMapState
   * @returns {void}
   */
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

    const can = /** @type {MapCanvasRefs} */ (createMapCanvases({ canvasId: "mapCanvas" }));
    runtime.canvas = can.canvas;
    runtime.ctx = can.ctx;
    runtime.drawLayer = can.drawLayer;
    runtime.drawCtx = can.drawCtx;
    runtime.canvasWrap = can.canvasWrap;

    runtime.gestures = /** @type {MapGesturesApi} */ (createMapGestures({
      mapState,
      runtimeState: runtime.gestureSession,
      SaveManager,
      updateMapField,
    }));
    runtime.gestures.initScale({ canvas: runtime.canvas, canvasWrap: runtime.canvasWrap });

    const pointerHandlers = /** @type {MapPointerHandlersApi} */ (createMapPointerHandlers({
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
    }));

    const bgActions = /** @type {MapBackgroundActionsApi} */ (createMapBackgroundActions({
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
    }));

    if (window.matchMedia("(max-width: 600px)").matches) {
      if (!mapState.ui.activeTool) mapState.ui.activeTool = "brush";
    }

    runtime.toolbarUI = /** @type {MapToolbarUiApi} */ (initMapToolbarUI({
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
    }));
    const { setActiveToolUI, setActiveColorUI } = runtime.toolbarUI;

    runtime.listUI = /** @type {MapListUiApi} */ (initMapListUI({
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
    }));

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
