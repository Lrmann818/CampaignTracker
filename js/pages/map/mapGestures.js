// js/pages/map/mapGestures.js

import { clamp, distance } from "./mapUtils.js";

export function createMapGestures({
  mapState,
  runtimeState,
  SaveManager,
  updateMapField,
  MIN_VIEW_SCALE = 0.6,
  MAX_VIEW_SCALE = 3
}) {
  if (!mapState || typeof mapState !== "object") {
    throw new Error("createMapGestures: mapState is required");
  }

  mapState.ui ||= {};
  const runtime = (runtimeState && typeof runtimeState === "object") ? runtimeState : {};
  if (!(runtime.activePointers instanceof Map)) runtime.activePointers = new Map(); // pointerId -> {x,y}
  runtime.gestureMode = runtime.gestureMode === "panzoom" ? runtime.gestureMode : null; // null | "panzoom"
  runtime.panStart = runtime.panStart || null; // {cx,cy,scrollLeft,scrollTop}
  runtime.pinchStart = runtime.pinchStart || null; // {dist,scale}
  runtime.activeGestureWrap ||= null;
  runtime.initScaleRaf = Number.isFinite(runtime.initScaleRaf) ? runtime.initScaleRaf : 0;
  const persistedScale = Number(mapState.ui.viewScale || 1);
  runtime.viewScale = Number.isFinite(persistedScale)
    ? persistedScale
    : (Number.isFinite(runtime.viewScale) ? runtime.viewScale : 1);

  function applyViewScale({ canvas, canvasWrap, scale, anchorClientX = null, anchorClientY = null }) {
    if (!canvas) return;

    runtime.viewScale = clamp(scale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
    const updatedByAction =
      typeof updateMapField === "function"
        ? updateMapField("ui.viewScale", runtime.viewScale)
        : false;
    if (!updatedByAction) {
      mapState.ui.viewScale = runtime.viewScale;
      SaveManager?.markDirty?.();
    }

    if (canvasWrap && anchorClientX != null && anchorClientY != null) {
      const wrapRect = canvasWrap.getBoundingClientRect();
      const ax = anchorClientX - wrapRect.left;
      const ay = anchorClientY - wrapRect.top;

      const prev = Number(canvas.dataset.viewScale || 1) || 1;

      const contentX = canvasWrap.scrollLeft + ax;
      const contentY = canvasWrap.scrollTop + ay;

      const canvasX = contentX / prev;
      const canvasY = contentY / prev;

      const nextContentX = canvasX * runtime.viewScale;
      const nextContentY = canvasY * runtime.viewScale;

      canvasWrap.scrollLeft = nextContentX - ax;
      canvasWrap.scrollTop = nextContentY - ay;
    }

    canvas.dataset.viewScale = String(runtime.viewScale);
    canvas.style.transformOrigin = "top left";
    canvas.style.transform = `scale(${runtime.viewScale})`;
  }

  function startPanZoomFromPointers({ canvasWrap }) {
    const pts = Array.from(runtime.activePointers.values());
    if (pts.length < 2) return;

    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    runtime.gestureMode = "panzoom";
    runtime.activeGestureWrap = canvasWrap || null;
    canvasWrap?.classList.add("gestureMode");

    runtime.panStart = {
      cx, cy,
      scrollLeft: canvasWrap?.scrollLeft || 0,
      scrollTop: canvasWrap?.scrollTop || 0
    };

    runtime.pinchStart = {
      dist: distance(pts[0], pts[1]),
      scale: runtime.viewScale
    };
  }

  function onPointerDown({ e, canvasWrap }) {
    if (e.pointerType !== "touch") return { startedPanZoom: false };

    runtime.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (runtime.activePointers.size >= 2) {
      startPanZoomFromPointers({ canvasWrap });
      return { startedPanZoom: true };
    }

    return { startedPanZoom: false };
  }

  function onPointerMove({ e, canvas, canvasWrap }) {
    if (!runtime.activePointers.has(e.pointerId)) return { handled: false };

    runtime.activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (runtime.gestureMode !== "panzoom" || runtime.activePointers.size < 2) return { handled: false };

    const pts = Array.from(runtime.activePointers.values());
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    const dx = cx - runtime.panStart.cx;
    const dy = cy - runtime.panStart.cy;

    if (canvasWrap) {
      canvasWrap.scrollLeft = runtime.panStart.scrollLeft - dx;
      canvasWrap.scrollTop = runtime.panStart.scrollTop - dy;
    }

    const distNow = distance(pts[0], pts[1]);
    const distDelta = distNow - (runtime.pinchStart?.dist || 0);

    const PINCH_DEADZONE_PX = 28;
    const PAN_VS_PINCH_RATIO = 0.35;

    const panMag = Math.hypot(dx, dy);
    const pinchMag = Math.abs(distDelta);

    const pinchLooksIntentional =
      pinchMag > PINCH_DEADZONE_PX &&
      pinchMag > (panMag * PAN_VS_PINCH_RATIO) &&
      (runtime.pinchStart?.dist || 0) > 0;

    if (pinchLooksIntentional) {
      const ratio = distNow / runtime.pinchStart.dist;
      const nextScale = runtime.pinchStart.scale * ratio;

      applyViewScale({ canvas, canvasWrap, scale: nextScale, anchorClientX: cx, anchorClientY: cy });

      runtime.pinchStart.dist = distNow;
      runtime.pinchStart.scale = runtime.viewScale;
    }

    return { handled: true };
  }

  function onPointerUp({ e, canvasWrap }) {
    if (runtime.activePointers.has(e.pointerId)) runtime.activePointers.delete(e.pointerId);

    if (runtime.gestureMode === "panzoom" && runtime.activePointers.size < 2) {
      runtime.gestureMode = null;
      runtime.panStart = null;
      runtime.pinchStart = null;
      canvasWrap?.classList.remove("gestureMode");
      runtime.activeGestureWrap = null;
      return { endedPanZoom: true };
    }

    return { endedPanZoom: false };
  }

  function initScale({ canvas, canvasWrap }) {
    if (runtime.initScaleRaf) cancelAnimationFrame(runtime.initScaleRaf);
    runtime.initScaleRaf = requestAnimationFrame(() => {
      runtime.initScaleRaf = 0;
      applyViewScale({ canvas, canvasWrap, scale: runtime.viewScale });
    });
  }

  function getViewScale() { return runtime.viewScale; }

  function destroy() {
    if (runtime.initScaleRaf) {
      cancelAnimationFrame(runtime.initScaleRaf);
      runtime.initScaleRaf = 0;
    }
    runtime.activePointers.clear();
    runtime.gestureMode = null;
    runtime.panStart = null;
    runtime.pinchStart = null;
    runtime.activeGestureWrap?.classList.remove("gestureMode");
    runtime.activeGestureWrap = null;
  }

  return {
    initScale,
    applyViewScale,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    getViewScale,
    destroy,
    activePointers: runtime.activePointers // exposed only if you want it for debugging
  };
}
