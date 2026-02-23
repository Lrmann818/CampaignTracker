// js/features/imageCropper.js
// Shared portrait-cropping modal + aspect helper.

import { safeAsync } from "../ui/safeAsync.js";

/**
 * Returns the aspect ratio (width/height) of the first element matching selector.
 * Falls back to 1 if the element is missing or has zero size.
 */
export function getPortraitAspect(selector = ".npcPortraitTop") {
  const el = document.querySelector(selector);
  if (!el) return 1;

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return 1;

  return rect.width / rect.height;
}

/**
 * Opens a modal that lets the user zoom + pan an uploaded image, then returns a cropped Blob.
 * Returns null if cancelled.
 */
export async function cropImageModal(
  file,
  {
    aspect = 1, // 1 = square
    outSize = 512, // output width/height in px
    mime = "image/webp",
    quality = 0.9,
    setStatus
  } = {}
) {
  if (!setStatus) throw new Error("cropImageModal requires setStatus");

  // Basic feature detection for webp
  const test = document.createElement("canvas");
  const canWebp = test.toDataURL("image/webp").startsWith("data:image/webp");
  if (mime === "image/webp" && !canWebp) mime = "image/jpeg";

  // Load image
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => {
      URL.revokeObjectURL(url);
      resolve(i);
    };
    i.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    i.src = url;
  });

  return new Promise((resolve) => {
    // ---------- Modal UI ----------
    const overlay = document.createElement("div");
    overlay.className = "modalOverlay";

    const panel = document.createElement("div");
    panel.className = "modalPanel";

    const title = document.createElement("div");
    title.textContent = "Crop portrait";
    title.className = "modalTitle";

    const cropWrap = document.createElement("div");
    cropWrap.className = "cropWrap";
    cropWrap.style.aspectRatio = `${aspect} / 1`; // dynamic

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = Math.round(800 / aspect);
    canvas.className = "cropCanvas";
    cropWrap.appendChild(canvas);

    // A subtle "crop frame" overlay
    const frame = document.createElement("div");
    frame.className = "cropFrame";
    cropWrap.appendChild(frame);

    const controls = document.createElement("div");
    controls.className = "modalControls";

    const zoomLabel = document.createElement("div");
    zoomLabel.textContent = "Zoom";
    zoomLabel.className = "modalLabel";

    const zoom = document.createElement("input");
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "3.5";
    zoom.step = "0.01";
    zoom.value = "1.2";
    zoom.className = "modalRange uiRange";

    const btnRow = document.createElement("div");
    btnRow.className = "modalBtnRow";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "modalBtn";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className = "modalBtn modalBtnPrimary";

    controls.appendChild(zoomLabel);
    controls.appendChild(zoom);

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    panel.appendChild(title);
    panel.appendChild(cropWrap);
    panel.appendChild(controls);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ---------- Crop math ----------
    const ctx = canvas.getContext("2d");

    // center of image in canvas coords
    let scale = parseFloat(zoom.value);
    let offsetX = 0; // pan in canvas pixels
    let offsetY = 0;

    // Fit image to canvas initially
    const baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
    scale = baseScale * scale;

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // fill background (helps if image has transparency)
      const mapEmpty =
        getComputedStyle(document.documentElement).getPropertyValue("--map-empty").trim() || "#111";

      ctx.fillStyle = mapEmpty;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawW = img.width * scale;
      const drawH = img.height * scale;

      const x = (canvas.width - drawW) / 2 + offsetX;
      const y = (canvas.height - drawH) / 2 + offsetY;

      ctx.drawImage(img, x, y, drawW, drawH);
    }

    function clampPan() {
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      // Ensure the image always covers the crop area (no empty gaps)
      const minX = (canvas.width - drawW) / 2;
      const maxX = (drawW - canvas.width) / 2;
      const minY = (canvas.height - drawH) / 2;
      const maxY = (drawH - canvas.height) / 2;

      offsetX = Math.min(Math.max(offsetX, -maxX), -minX);
      offsetY = Math.min(Math.max(offsetY, -maxY), -minY);
    }

    // ---------- Pan handling (mouse + touch) ----------
    let dragging = false;
    let lastX = 0;
    let lastY = 0;

    function onDown(clientX, clientY) {
      dragging = true;
      lastX = clientX;
      lastY = clientY;
    }

    function onMove(clientX, clientY) {
      if (!dragging) return;
      const dx = clientX - lastX;
      const dy = clientY - lastY;
      lastX = clientX;
      lastY = clientY;
      offsetX += dx;
      offsetY += dy;
      clampPan();
      redraw();
    }

    function onUp() {
      dragging = false;
    }

    canvas.addEventListener("mousedown", (e) => onDown(e.clientX, e.clientY));
    window.addEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
    window.addEventListener("mouseup", onUp);

    canvas.addEventListener(
      "touchstart",
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        onDown(t.clientX, t.clientY);
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchmove",
      (e) => {
        const t = e.touches[0];
        if (!t) return;
        onMove(t.clientX, t.clientY);
      },
      { passive: true }
    );

    canvas.addEventListener(
      "touchend",
      () => {
        onUp();
      },
      { passive: true }
    );

    // ---------- Zoom handling ----------
    zoom.addEventListener("input", () => {
      const z = parseFloat(zoom.value);
      // Keep base fit, multiply by slider
      scale = baseScale * z;
      clampPan();
      redraw();
    });

    // ---------- Cancel / Save ----------
    function cleanup() {
      window.removeEventListener("mousemove", (e) => onMove(e.clientX, e.clientY));
      window.removeEventListener("mouseup", onUp);
      overlay.remove();
    }

    cancelBtn.addEventListener("click", () => {
      cleanup();
      resolve(null);
    });

    saveBtn.addEventListener(
      "click",
      safeAsync(async () => {
        // Render final crop to output canvas
        const out = document.createElement("canvas");
        out.width = outSize;
        out.height = Math.round(outSize / aspect);
        const octx = out.getContext("2d");

        // Map from canvas draw back to image coordinates
        const drawW = img.width * scale;
        const drawH = img.height * scale;
        const x = (canvas.width - drawW) / 2 + offsetX;
        const y = (canvas.height - drawH) / 2 + offsetY;

        // We want the visible canvas region; compute which part of the image is visible
        const sx = (0 - x) / scale;
        const sy = (0 - y) / scale;
        const sw = canvas.width / scale;
        const sh = canvas.height / scale;

        octx.drawImage(img, sx, sy, sw, sh, 0, 0, out.width, out.height);

        const blob = await new Promise((res) => out.toBlob(res, mime, quality));
        cleanup();
        resolve(blob);
      }, (err) => {
        console.error(err);
        setStatus("Save image failed.");
      })
    );

    // Initial draw
    clampPan();
    redraw();
  });
}
