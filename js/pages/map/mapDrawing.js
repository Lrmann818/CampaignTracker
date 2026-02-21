// js/pages/map/mapDrawing.js

import { colorFromKey } from "./mapUtils.js";
import { renderMap } from "./mapCanvas.js";

export function snapshotForUndo({ mapState, drawLayer }) {
  const url = drawLayer.toDataURL("image/png");
  mapState.undo ||= [];
  mapState.redo ||= [];
  mapState.undo.push(url);
  if (mapState.undo.length > 50) mapState.undo.shift();
  mapState.redo.length = 0;
}

export function drawDot({
  pt,
  mapState,
  getActiveMap,
  drawCtx,
  renderArgs
}) {
  const mp = getActiveMap();
  const tool = mapState.ui?.activeTool || "brush";
  const size = mapState.ui?.brushSize ?? mp.brushSize;

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
  mapState,
  getActiveMap,
  drawCtx,
  renderArgs
}) {
  const mp = getActiveMap();
  const tool = mapState.ui?.activeTool || "brush";
  const size = mapState.ui?.brushSize ?? mp.brushSize;

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
  mapState,
  drawLayer,
  restoreFromDataUrlFn
}) {
  if (!Array.isArray(mapState.undo) || !mapState.undo.length) return;
  mapState.redo ||= [];

  const current = drawLayer.toDataURL("image/png");
  mapState.redo.push(current);

  const prev = mapState.undo.pop();
  if (typeof prev !== "string") return;
  restoreFromDataUrlFn(prev);
}

export function redo({
  mapState,
  drawLayer,
  restoreFromDataUrlFn
}) {
  if (!Array.isArray(mapState.redo) || !mapState.redo.length) return;
  mapState.undo ||= [];

  const current = drawLayer.toDataURL("image/png");
  mapState.undo.push(current);

  const next = mapState.redo.pop();
  if (typeof next !== "string") return;
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
