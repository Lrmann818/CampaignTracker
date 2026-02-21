// js/pages/map/mapGestures.js

import { clamp, distance } from "./mapUtils.js";

export function createMapGestures({
  state,
  SaveManager,
  MIN_VIEW_SCALE = 0.6,
  MAX_VIEW_SCALE = 3
}) {
  const activePointers = new Map(); // pointerId -> {x,y}
  let gestureMode = null; // null | "panzoom"
  let panStart = null;    // {cx,cy,scrollLeft,scrollTop}
  let pinchStart = null;  // {dist,scale}
  let viewScale = Number(state.map.ui?.viewScale || 1) || 1;
  let initScaleRaf = 0;
  let activeGestureWrap = null;

  function applyViewScale({ canvas, canvasWrap, scale, anchorClientX = null, anchorClientY = null }) {
    if (!canvas) return;

    viewScale = clamp(scale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
    state.map.ui ||= {};
    state.map.ui.viewScale = viewScale;

    if (canvasWrap && anchorClientX != null && anchorClientY != null) {
      const wrapRect = canvasWrap.getBoundingClientRect();
      const ax = anchorClientX - wrapRect.left;
      const ay = anchorClientY - wrapRect.top;

      const prev = Number(canvas.dataset.viewScale || 1) || 1;

      const contentX = canvasWrap.scrollLeft + ax;
      const contentY = canvasWrap.scrollTop + ay;

      const canvasX = contentX / prev;
      const canvasY = contentY / prev;

      const nextContentX = canvasX * viewScale;
      const nextContentY = canvasY * viewScale;

      canvasWrap.scrollLeft = nextContentX - ax;
      canvasWrap.scrollTop = nextContentY - ay;
    }

    canvas.dataset.viewScale = String(viewScale);
    canvas.style.transformOrigin = "top left";
    canvas.style.transform = `scale(${viewScale})`;

    SaveManager.markDirty();
  }

  function startPanZoomFromPointers({ canvasWrap }) {
    const pts = Array.from(activePointers.values());
    if (pts.length < 2) return;

    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    gestureMode = "panzoom";
    activeGestureWrap = canvasWrap || null;
    canvasWrap?.classList.add("gestureMode");

    panStart = {
      cx, cy,
      scrollLeft: canvasWrap?.scrollLeft || 0,
      scrollTop: canvasWrap?.scrollTop || 0
    };

    pinchStart = {
      dist: distance(pts[0], pts[1]),
      scale: viewScale
    };
  }

  function onPointerDown({ e, canvasWrap }) {
    if (e.pointerType !== "touch") return { startedPanZoom: false };

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (activePointers.size >= 2) {
      startPanZoomFromPointers({ canvasWrap });
      return { startedPanZoom: true };
    }

    return { startedPanZoom: false };
  }

  function onPointerMove({ e, canvas, canvasWrap }) {
    if (!activePointers.has(e.pointerId)) return { handled: false };

    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gestureMode !== "panzoom" || activePointers.size < 2) return { handled: false };

    const pts = Array.from(activePointers.values());
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    const dx = cx - panStart.cx;
    const dy = cy - panStart.cy;

    if (canvasWrap) {
      canvasWrap.scrollLeft = panStart.scrollLeft - dx;
      canvasWrap.scrollTop = panStart.scrollTop - dy;
    }

    const distNow = distance(pts[0], pts[1]);
    const distDelta = distNow - (pinchStart?.dist || 0);

    const PINCH_DEADZONE_PX = 28;
    const PAN_VS_PINCH_RATIO = 0.35;

    const panMag = Math.hypot(dx, dy);
    const pinchMag = Math.abs(distDelta);

    const pinchLooksIntentional =
      pinchMag > PINCH_DEADZONE_PX &&
      pinchMag > (panMag * PAN_VS_PINCH_RATIO) &&
      (pinchStart?.dist || 0) > 0;

    if (pinchLooksIntentional) {
      const ratio = distNow / pinchStart.dist;
      const nextScale = pinchStart.scale * ratio;

      applyViewScale({ canvas, canvasWrap, scale: nextScale, anchorClientX: cx, anchorClientY: cy });

      pinchStart.dist = distNow;
      pinchStart.scale = viewScale;
    }

    return { handled: true };
  }

  function onPointerUp({ e, canvasWrap }) {
    if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);

    if (gestureMode === "panzoom" && activePointers.size < 2) {
      gestureMode = null;
      panStart = null;
      pinchStart = null;
      canvasWrap?.classList.remove("gestureMode");
      activeGestureWrap = null;
      return { endedPanZoom: true };
    }

    return { endedPanZoom: false };
  }

  function initScale({ canvas, canvasWrap }) {
    if (initScaleRaf) cancelAnimationFrame(initScaleRaf);
    initScaleRaf = requestAnimationFrame(() => {
      initScaleRaf = 0;
      applyViewScale({ canvas, canvasWrap, scale: viewScale });
    });
  }

  function getViewScale() { return viewScale; }

  function destroy() {
    if (initScaleRaf) {
      cancelAnimationFrame(initScaleRaf);
      initScaleRaf = 0;
    }
    activePointers.clear();
    gestureMode = null;
    panStart = null;
    pinchStart = null;
    activeGestureWrap?.classList.remove("gestureMode");
    activeGestureWrap = null;
  }

  return {
    initScale,
    applyViewScale,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    getViewScale,
    destroy,
    activePointers // exposed only if you want it for debugging
  };
}
