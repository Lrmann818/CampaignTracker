// @ts-check
// js/pages/map/mapDrawing.js

import { colorFromKey } from "./mapUtils.js";
import { renderMap } from "./mapCanvas.js";

/** @typedef {import("../../state.js").MapState} MapState */
/** @typedef {import("../../state.js").MapEntry} MapEntry */
/**
 * @typedef {{ x: number, y: number }} MapCanvasPoint
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
 * @param {{
 *   pt: MapCanvasPoint,
 *   mapState: MapState,
 *   getActiveMap: () => MapEntry,
 *   drawCtx: CanvasRenderingContext2D,
 *   renderArgs: MapRenderArgs
 * }} options
 * @returns {void}
 */
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

/**
 * @param {{
 *   a: MapCanvasPoint,
 *   b: MapCanvasPoint,
 *   mapState: MapState,
 *   getActiveMap: () => MapEntry,
 *   drawCtx: CanvasRenderingContext2D,
 *   renderArgs: MapRenderArgs
 * }} options
 * @returns {void}
 */
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

/**
 * @param {{
 *   url: string,
 *   drawCtx: CanvasRenderingContext2D,
 *   drawLayer: HTMLCanvasElement,
 *   renderArgs: MapRenderArgs,
 *   commitDrawing: () => Promise<void> | void
 * }} options
 * @returns {void}
 */
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

/**
 * @param {{
 *   uiConfirm: (message: string, opts?: { title?: string, okText?: string }) => Promise<boolean> | boolean,
 *   snapshotForUndoFn: () => void,
 *   drawCtx: CanvasRenderingContext2D,
 *   drawLayer: HTMLCanvasElement,
 *   renderArgs: MapRenderArgs,
 *   commitDrawing: () => Promise<void> | void
 * }} options
 * @returns {Promise<void>}
 */
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
