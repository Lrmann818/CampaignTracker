// @ts-check
// js/pages/map/mapCanvas.js

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
 *   bgImg?: HTMLImageElement | null
 * }} RenderMapArgs
 */
/**
 * @typedef {{ x: number, y: number }} CanvasPoint
 */

/**
 * @param {{ canvasId?: string }} [options]
 * @returns {MapCanvasRefs}
 */
export function createMapCanvases({ canvasId = "mapCanvas" } = {}) {
  const canvas = /** @type {HTMLCanvasElement | null} */ (document.getElementById(canvasId));
  if (!canvas) throw new Error(`Map canvas not found (#${canvasId})`);

  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error(`Map canvas context unavailable (#${canvasId})`);

  const drawLayer = document.createElement("canvas");
  drawLayer.width = canvas.width;
  drawLayer.height = canvas.height;
  const drawCtx = drawLayer.getContext("2d");
  if (!drawCtx) throw new Error("Map drawing canvas context unavailable");

  // Important for pointer gestures/drawing behavior
  canvas.style.touchAction = "none";

  const canvasWrap = /** @type {HTMLElement | null} */ (canvas.closest(".canvasWrap"));

  return { canvas, ctx, drawLayer, drawCtx, canvasWrap };
}

/**
 * @param {RenderMapArgs} args
 * @returns {void}
 */
export function renderMap({ canvas, ctx, drawLayer, bgImg }) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  if (bgImg && bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  } else {
    const mapEmpty = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-empty")
      .trim() || "#0f0f0f";
    ctx.fillStyle = mapEmpty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  if (drawLayer) ctx.drawImage(drawLayer, 0, 0);
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {{ clientX: number, clientY: number }} e
 * @returns {CanvasPoint}
 */
export function getCanvasPoint(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}
