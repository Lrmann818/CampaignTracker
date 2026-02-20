// js/pages/map/mapDrawing.js

import { colorFromKey } from "./mapUtils.js";
import { renderMap } from "./mapCanvas.js";

export function snapshotForUndo({ state, drawLayer }) {
  const url = drawLayer.toDataURL("image/png");
  state.map.undo.push(url);
  if (state.map.undo.length > 50) state.map.undo.shift();
  state.map.redo.length = 0;
}

export function drawDot({
  pt,
  state,
  getActiveMap,
  drawCtx,
  renderArgs
}) {
  const mp = getActiveMap();
  const tool = state.map.ui?.activeTool || "brush";
  const size = state.map.ui?.brushSize ?? mp.brushSize;

  drawCtx.save();
  if (tool === "eraser") {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.fillStyle = "rgba(0,0,0,1)";
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.fillStyle = colorFromKey(mp.colorKey);
  }

  drawCtx.beginPath();
  drawCtx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();

  renderMap(renderArgs);
}

export function drawLine({
  a,
  b,
  state,
  getActiveMap,
  drawCtx,
  renderArgs
}) {
  const mp = getActiveMap();
  const tool = state.map.ui?.activeTool || "brush";
  const size = state.map.ui?.brushSize ?? mp.brushSize;

  drawCtx.save();
  if (tool === "eraser") {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.strokeStyle = "rgba(0,0,0,1)";
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = colorFromKey(mp.colorKey);
  }

  drawCtx.lineWidth = size;
  drawCtx.lineCap = "round";
  drawCtx.beginPath();
  drawCtx.moveTo(a.x, a.y);
  drawCtx.lineTo(b.x, b.y);
  drawCtx.stroke();
  drawCtx.restore();

  renderMap(renderArgs);
}

export function restoreFromDataUrl({
  url,
  drawCtx,
  drawLayer,
  renderArgs,
  commitDrawing
}) {
  const img = new Image();
  img.onload = () => {
    drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
    drawCtx.drawImage(img, 0, 0);
    renderMap(renderArgs);
    commitDrawing();
  };
  img.src = url;
}

export function undo({
  state,
  drawLayer,
  restoreFromDataUrlFn
}) {
  if (!state.map.undo.length) return;

  const current = drawLayer.toDataURL("image/png");
  state.map.redo.push(current);

  const prev = state.map.undo.pop();
  restoreFromDataUrlFn(prev);
}

export function redo({
  state,
  drawLayer,
  restoreFromDataUrlFn
}) {
  if (!state.map.redo.length) return;

  const current = drawLayer.toDataURL("image/png");
  state.map.undo.push(current);

  const next = state.map.redo.pop();
  restoreFromDataUrlFn(next);
}

export async function clearDrawing({
  uiConfirm,
  snapshotForUndoFn,
  drawCtx,
  drawLayer,
  renderArgs,
  commitDrawing
}) {
  const ok = await uiConfirm("Clear the map drawings?", { title: "Clear Map", okText: "Clear" });
  if (!ok) return;

  snapshotForUndoFn();
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  renderMap(renderArgs);
  commitDrawing();
}
