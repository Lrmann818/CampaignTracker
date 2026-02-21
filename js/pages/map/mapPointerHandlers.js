// js/pages/map/mapPointerHandlers.js

import { getCanvasPoint } from "./mapCanvas.js";
import { drawDot, drawLine } from "./mapDrawing.js";

const START_DRAW_THRESHOLD_PX = 6;

export function createMapPointerHandlers({
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
}) {
  let drawing = false;
  let lastPt = null;
  let pendingDraw = false;
  let pendingPointerId = null;
  let pendingStartClient = null;
  let pendingStartCanvas = null;

  function onPointerDown(e) {
    const tool = state.map.ui?.activeTool || "brush";
    const isDrawTool = (tool === "brush" || tool === "eraser");

    if (e.pointerType === "touch") {
      const g = gestures.onPointerDown({ e, canvasWrap });
      if (g.startedPanZoom) {
        if (pendingDraw) {
          pendingDraw = false;
          pendingPointerId = null;
          pendingStartClient = null;
          pendingStartCanvas = null;
        }
        if (drawing) {
          drawing = false;
          lastPt = null;
          commitDrawingSnapshot();
        }
        e.preventDefault();
        return;
      }
    }

    if (e.button !== undefined && e.button !== 0) return;

    if (e.pointerType === "touch" && isDrawTool) {
      pendingDraw = true;
      pendingPointerId = e.pointerId;
      pendingStartClient = { x: e.clientX, y: e.clientY };
      pendingStartCanvas = getCanvasPoint(canvas, e);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (!isDrawTool) return;
    drawing = true;
    canvas.setPointerCapture(e.pointerId);

    snapshotForUndoFn();
    const pt = getCanvasPoint(canvas, e);
    lastPt = pt;
    drawDot({
      pt,
      state,
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

    if (pendingDraw && e.pointerId === pendingPointerId) {
      const dx = e.clientX - pendingStartClient.x;
      const dy = e.clientY - pendingStartClient.y;

      if (Math.hypot(dx, dy) >= START_DRAW_THRESHOLD_PX) {
        pendingDraw = false;
        pendingPointerId = null;

        snapshotForUndoFn();
        drawing = true;

        lastPt = pendingStartCanvas;

        const pt = getCanvasPoint(canvas, e);
        drawLine({
          a: lastPt,
          b: pt,
          state,
          getActiveMap,
          drawCtx,
          renderArgs: renderArgs()
        });
        lastPt = pt;

        pendingStartClient = null;
        pendingStartCanvas = null;

        if (e.pointerType === "touch") e.preventDefault();
        return;
      }
    }

    if (!drawing) return;
    const pt = getCanvasPoint(canvas, e);
    drawLine({
      a: lastPt,
      b: pt,
      state,
      getActiveMap,
      drawCtx,
      renderArgs: renderArgs()
    });
    lastPt = pt;
    if (e.pointerType === "touch") e.preventDefault();
  }

  function onPointerUp(e) {
    const g = gestures.onPointerUp({ e, canvasWrap });

    if (pendingDraw && e.pointerId === pendingPointerId) {
      pendingDraw = false;
      pendingPointerId = null;

      if (pendingStartCanvas) {
        snapshotForUndoFn();
        drawDot({
          pt: pendingStartCanvas,
          state,
          getActiveMap,
          drawCtx,
          renderArgs: renderArgs()
        });
        commitDrawingSnapshot();
      }

      pendingStartClient = null;
      pendingStartCanvas = null;
      return;
    }

    if (g.endedPanZoom) {
      drawing = false;
      lastPt = null;
      return;
    }

    if (!drawing) return;
    drawing = false;
    lastPt = null;
    commitDrawingSnapshot();
  }

  void drawLayer;

  return { onPointerDown, onPointerMove, onPointerUp };
}
