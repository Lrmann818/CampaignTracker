// js/pages/map/mapPointerHandlers.js

import { getCanvasPoint } from "./mapCanvas.js";
import { drawDot, drawLine } from "./mapDrawing.js";

const START_DRAW_THRESHOLD_PX = 6;

export function createMapPointerHandlers({
  mapState,
  runtimeState,
  canvas,
  canvasWrap,
  gestures,
  getActiveMap,
  snapshotForUndoFn,
  commitDrawingSnapshot,
  renderArgs,
  drawCtx,
  drawLayer
}) {
  if (!mapState || typeof mapState !== "object") {
    throw new Error("createMapPointerHandlers: mapState is required");
  }

  const runtime = (runtimeState && typeof runtimeState === "object") ? runtimeState : {};
  runtime.drawing = !!runtime.drawing;
  runtime.lastPt ||= null;
  runtime.pendingDraw = !!runtime.pendingDraw;
  runtime.pendingPointerId ??= null;
  runtime.pendingStartClient ||= null;
  runtime.pendingStartCanvas ||= null;

  function resetPendingDrawState() {
    runtime.pendingDraw = false;
    runtime.pendingPointerId = null;
    runtime.pendingStartClient = null;
    runtime.pendingStartCanvas = null;
  }

  function onPointerDown(e) {
    const tool = mapState.ui?.activeTool || "brush";
    const isDrawTool = (tool === "brush" || tool === "eraser");

    if (e.pointerType === "touch") {
      const g = gestures.onPointerDown({ e, canvasWrap });
      if (g.startedPanZoom) {
        if (runtime.pendingDraw) resetPendingDrawState();
        if (runtime.drawing) {
          runtime.drawing = false;
          runtime.lastPt = null;
          commitDrawingSnapshot();
        }
        e.preventDefault();
        return;
      }
    }

    if (e.button !== undefined && e.button !== 0) return;

    if (e.pointerType === "touch" && isDrawTool) {
      runtime.pendingDraw = true;
      runtime.pendingPointerId = e.pointerId;
      runtime.pendingStartClient = { x: e.clientX, y: e.clientY };
      runtime.pendingStartCanvas = getCanvasPoint(canvas, e);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (!isDrawTool) return;
    runtime.drawing = true;
    canvas.setPointerCapture(e.pointerId);

    snapshotForUndoFn();
    const pt = getCanvasPoint(canvas, e);
    runtime.lastPt = pt;
    drawDot({
      pt,
      mapState,
      getActiveMap,
      drawCtx,
      renderArgs: renderArgs()
    });
    commitDrawingSnapshot();
  }

  function onPointerMove(e) {
    const g = gestures.onPointerMove({ e, canvas, canvasWrap });
    if (g.handled) {
      if (e.pointerType === "touch") e.preventDefault();
      return;
    }

    if (runtime.pendingDraw && e.pointerId === runtime.pendingPointerId) {
      const dx = e.clientX - runtime.pendingStartClient.x;
      const dy = e.clientY - runtime.pendingStartClient.y;

      if (Math.hypot(dx, dy) >= START_DRAW_THRESHOLD_PX) {
        runtime.pendingDraw = false;
        runtime.pendingPointerId = null;

        snapshotForUndoFn();
        runtime.drawing = true;

        runtime.lastPt = runtime.pendingStartCanvas;

        const pt = getCanvasPoint(canvas, e);
        drawLine({
          a: runtime.lastPt,
          b: pt,
          mapState,
          getActiveMap,
          drawCtx,
          renderArgs: renderArgs()
        });
        runtime.lastPt = pt;

        runtime.pendingStartClient = null;
        runtime.pendingStartCanvas = null;

        if (e.pointerType === "touch") e.preventDefault();
        return;
      }
    }

    if (!runtime.drawing) return;
    const pt = getCanvasPoint(canvas, e);
    drawLine({
      a: runtime.lastPt,
      b: pt,
      mapState,
      getActiveMap,
      drawCtx,
      renderArgs: renderArgs()
    });
    runtime.lastPt = pt;
    if (e.pointerType === "touch") e.preventDefault();
  }

  function onPointerUp(e) {
    const g = gestures.onPointerUp({ e, canvasWrap });

    if (runtime.pendingDraw && e.pointerId === runtime.pendingPointerId) {
      runtime.pendingDraw = false;
      runtime.pendingPointerId = null;

      if (runtime.pendingStartCanvas) {
        snapshotForUndoFn();
        drawDot({
          pt: runtime.pendingStartCanvas,
          mapState,
          getActiveMap,
          drawCtx,
          renderArgs: renderArgs()
        });
        commitDrawingSnapshot();
      }

      runtime.pendingStartClient = null;
      runtime.pendingStartCanvas = null;
      return;
    }

    if (g.endedPanZoom) {
      runtime.drawing = false;
      runtime.lastPt = null;
      return;
    }

    if (!runtime.drawing) return;
    runtime.drawing = false;
    runtime.lastPt = null;
    commitDrawingSnapshot();
  }

  void drawLayer;

  return { onPointerDown, onPointerMove, onPointerUp };
}
