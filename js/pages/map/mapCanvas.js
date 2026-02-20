// js/pages/map/mapCanvas.js

export function createMapCanvases({ canvasId = "mapCanvas" } = {}) {
  const canvas = document.getElementById(canvasId);
  if (!canvas) throw new Error(`Map canvas not found (#${canvasId})`);

  const ctx = canvas.getContext("2d");

  const drawLayer = document.createElement("canvas");
  drawLayer.width = canvas.width;
  drawLayer.height = canvas.height;
  const drawCtx = drawLayer.getContext("2d");

  // Important for pointer gestures/drawing behavior
  canvas.style.touchAction = "none";

  const canvasWrap = canvas.closest(".canvasWrap");

  return { canvas, ctx, drawLayer, drawCtx, canvasWrap };
}

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

export function getCanvasPoint(canvas, e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}