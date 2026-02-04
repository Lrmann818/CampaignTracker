// js/features-ui/mapPage.js

import { uiAlert } from "../ui/dialogs.js";
import { enhanceSelectDropdown } from "../ui/selectDropdown.js";
export function setupMapPage({
  state,
  SaveManager,
  setStatus,
  positionMenuOnScreen,
  popovers,
  // map manager + storage helpers
  ensureMapManager,
  getActiveMap,
  newMapEntry,
  blobIdToObjectUrl,
  putBlob,
  deleteBlob,
  // dialogs
  uiPrompt,
  uiConfirm
}) {
  /************************ Map page ***********************/
  let canvas, ctx;
  let drawLayer, drawCtx;
  let drawing = false;
  let lastPt = null;
  // Touch: delay starting a stroke until we know it's not a 2-finger pan/zoom
  let pendingDraw = false;
  let pendingPointerId = null;
  let pendingStartClient = null; // {x,y}
  let pendingStartCanvas = null; // {x,y}
  let bgImg = null;
  // --- Mobile pan/zoom (two fingers) ---
  let canvasWrap = null;
  let viewScale = 1;
  const MIN_VIEW_SCALE = 0.6;
  const MAX_VIEW_SCALE = 3;
  const activePointers = new Map(); // pointerId -> {x,y}
  let gestureMode = null; // null | "panzoom"
  let panStart = null;    // {cx,cy,scrollLeft,scrollTop}
  let pinchStart = null;  // {dist,scale}

  function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

  function applyViewScale(scale, anchorClientX = null, anchorClientY = null) {
    if (!canvas) return;
    viewScale = clamp(scale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
    state.map.ui ||= {};
    state.map.ui.viewScale = viewScale;

    // Keep zoom anchored under the user's fingers (or center if no anchor provided)
    if (canvasWrap && anchorClientX != null && anchorClientY != null) {
      const wrapRect = canvasWrap.getBoundingClientRect();
      const ax = anchorClientX - wrapRect.left;
      const ay = anchorClientY - wrapRect.top;

      const prev = Number(canvas.dataset.viewScale || 1) || 1;

      // Content coords under the anchor, in CSS px
      const contentX = canvasWrap.scrollLeft + ax;
      const contentY = canvasWrap.scrollTop + ay;

      // Convert to "unscaled canvas CSS px" (pre-zoom)
      const canvasX = contentX / prev;
      const canvasY = contentY / prev;

      // After zoom, where should that same canvas point land?
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

  function distance(a, b) {
    const dx = a.x - b.x, dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }

  function startPanZoomFromPointers() {
    const pts = Array.from(activePointers.values());
    if (pts.length < 2) return;

    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    gestureMode = "panzoom";
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

  function colorFromKey(key) {
    switch (key) {
      case "teal": return "rgba(53, 208, 214, 0.85)";
      case "red": return "rgba(224, 75, 75, 0.85)";
      case "blue": return "rgba(58, 166, 255, 0.85)";
      case "green": return "rgba(52, 201, 123, 0.85)";
      case "yellow": return "rgba(242, 201, 76, 0.85)";
      case "purple": return "rgba(155, 123, 255, 0.85)";
      case "black": return "rgba(17, 17, 17, 0.85)";
      case "white": return "rgba(240, 240, 240, 0.85)";
      default: return "rgba(140, 140, 140, 0.85)";
    }
  }

  function renderMap() {
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

  function snapshotForUndo() {
    const url = drawLayer.toDataURL("image/png");
    state.map.undo.push(url);
    if (state.map.undo.length > 50) state.map.undo.shift();
    state.map.redo.length = 0;
  }

  function commitDrawing() {
    persistDrawingSnapshot();
  }

  function persistDrawingSnapshot() {
    return new Promise((resolve) => {
      const mp = getActiveMap();
      drawLayer.toBlob(async (blob) => {
        if (!blob) { resolve(); return; }

        if (mp.drawingBlobId) {
          try { await deleteBlob(mp.drawingBlobId); }
          catch (err) { console.warn("Failed to delete map drawing blob:", err); }
        }
        mp.drawingBlobId = await putBlob(blob);
        SaveManager.markDirty(); resolve();
      }, "image/png");
    });
  }

  function getCanvasPoint(e) {
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX - rect.left) * (canvas.width / rect.width);
    const y = (e.clientY - rect.top) * (canvas.height / rect.height);
    return { x, y };
  }

  function drawDot(pt) {
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
    renderMap();
  }

  function drawLine(a, b) {
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
    renderMap();
  }

  function restoreFromDataUrl(url) {
    const img = new Image();
    img.onload = () => {
      drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
      drawCtx.drawImage(img, 0, 0);
      renderMap();
      commitDrawing();
    };
    img.src = url;
  }

  function undo() {
    if (!state.map.undo.length) return;
    const current = drawLayer.toDataURL("image/png");
    state.map.redo.push(current);

    const prev = state.map.undo.pop();
    restoreFromDataUrl(prev);
  }

  function redo() {
    if (!state.map.redo.length) return;
    const current = drawLayer.toDataURL("image/png");
    state.map.undo.push(current);

    const next = state.map.redo.pop();
    restoreFromDataUrl(next);
  }

  async function clearDrawing() {
    if (!(await uiConfirm("Clear the map drawings?", { title: "Clear Map", okText: "Clear" }))) return;
    snapshotForUndo();
    drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
    renderMap();
    commitDrawing();
  }

  function onPointerDown(e) {
    const tool = state.map.ui?.activeTool || "brush";
    const isDrawTool = (tool === "brush" || tool === "eraser");

    if (e.pointerType === "touch") {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

      if (activePointers.size >= 2) {
        if (pendingDraw) {
          pendingDraw = false;
          pendingPointerId = null;
          pendingStartClient = null;
          pendingStartCanvas = null;
        }
        if (drawing) {
          drawing = false;
          lastPt = null;
          commitDrawing();
        }
        startPanZoomFromPointers();
        e.preventDefault();
        return;
      }
    }

    if (e.button !== undefined && e.button !== 0) return;
    if (e.pointerType === "touch" && activePointers.size >= 2) return;

    if (e.pointerType === "touch" && isDrawTool) {
      pendingDraw = true;
      pendingPointerId = e.pointerId;
      pendingStartClient = { x: e.clientX, y: e.clientY };
      pendingStartCanvas = getCanvasPoint(e);
      canvas.setPointerCapture(e.pointerId);
      e.preventDefault();
      return;
    }

    if (!isDrawTool) return;
    drawing = true;
    canvas.setPointerCapture(e.pointerId);

    snapshotForUndo();
    lastPt = getCanvasPoint(e);
    drawDot(lastPt);
    commitDrawing();
  }

  function onPointerMove(e) {
    if (activePointers.has(e.pointerId)) {
      activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }

    if (gestureMode === "panzoom" && activePointers.size >= 2) {
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
        applyViewScale(nextScale, cx, cy);

        pinchStart.dist = distNow;
        pinchStart.scale = viewScale;
      }

      e.preventDefault();
      return;
    }

    if (pendingDraw && e.pointerId === pendingPointerId) {
      const dx = e.clientX - pendingStartClient.x;
      const dy = e.clientY - pendingStartClient.y;

      const START_DRAW_THRESHOLD_PX = 6;
      if (Math.hypot(dx, dy) >= START_DRAW_THRESHOLD_PX) {
        pendingDraw = false;
        pendingPointerId = null;

        snapshotForUndo();
        drawing = true;

        lastPt = pendingStartCanvas;

        const pt = getCanvasPoint(e);
        drawLine(lastPt, pt);
        lastPt = pt;

        pendingStartClient = null;
        pendingStartCanvas = null;

        if (e.pointerType === "touch") e.preventDefault();
        return;
      }
    }

    if (!drawing) return;
    const pt = getCanvasPoint(e);
    drawLine(lastPt, pt);
    lastPt = pt;
    if (e.pointerType === "touch") e.preventDefault();
  }

  function onPointerUp(e) {
    if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);

    if (pendingDraw && e.pointerId === pendingPointerId) {
      pendingDraw = false;
      pendingPointerId = null;

      if (pendingStartCanvas) {
        snapshotForUndo();
        drawDot(pendingStartCanvas);
        commitDrawing();
      }

      pendingStartClient = null;
      pendingStartCanvas = null;
      return;
    }

    if (gestureMode === "panzoom" && activePointers.size < 2) {
      gestureMode = null;
      panStart = null;
      pinchStart = null;
      canvasWrap?.classList.remove("gestureMode");
      drawing = false;
      lastPt = null;
      return;
    }

    if (!drawing) return;
    drawing = false;
    lastPt = null;
    commitDrawing();
  }

  function setMapImage(e) {
    const file = e.target.files?.[0];
    if (!file) return;

    (async () => {
      setStatus("Saving map image...");

      const mp = getActiveMap();
      if (mp.bgBlobId) {
        try { await deleteBlob(mp.bgBlobId); }
        catch (err) { console.warn("Failed to delete map image blob:", err); }
      }
      try {
        mp.bgBlobId = await putBlob(file);
      } catch (err) {
        console.error("Failed to save map image blob:", err);
        setStatus("Could not save map image. Consider exporting a backup.");
        await uiAlert("Could not save that map image (storage may be full).", { title: "Save Failed" });
        return;
      }

      let url = null;
      try { url = await blobIdToObjectUrl(mp.bgBlobId); }
      catch (err) { console.warn("Failed to load map background blob:", err); }
      bgImg = new Image();
      bgImg.onload = () => { renderMap(); persistDrawingSnapshot(); };
      bgImg.src = url;

      SaveManager.markDirty();
    })();
  }

  async function removeMapImage() {
    const mp = getActiveMap();
    if (mp.bgBlobId) {
      try { await deleteBlob(mp.bgBlobId); }
      catch (err) { console.warn("Failed to delete map image blob:", err); }
    }
    mp.bgBlobId = null;
    bgImg = null;
    renderMap();
    await persistDrawingSnapshot();
    SaveManager.markDirty();
  }

  function setupMap() {
    canvas = document.getElementById("mapCanvas");
    ctx = canvas.getContext("2d");

    drawLayer = document.createElement("canvas");
    drawLayer.width = canvas.width;
    drawLayer.height = canvas.height;
    drawCtx = drawLayer.getContext("2d");

    canvas.style.touchAction = "none";

    ensureMapManager();
    if (window.matchMedia("(max-width: 600px)").matches) {
      if (!state.map.ui.activeTool) state.map.ui.activeTool = "brush";
    }

    const mapSelect = document.getElementById("mapSelect");
    const addMapBtn = document.getElementById("addMapBtn");
    const renameMapBtn = document.getElementById("renameMapBtn");
    const deleteMapBtn = document.getElementById("deleteMapBtn");

    // Enhance the Map <select> so the OPEN menu matches the Map Tools dropdown.
    // Closed control keeps the same sizing/style as the original select.
    if (mapSelect && popovers && !mapSelect.dataset.dropdownEnhanced) {
      enhanceSelectDropdown({
        select: mapSelect,
        Popovers: popovers,
        buttonClass: "mapSelectBtn",
        optionClass: "swatchOption",
        groupLabelClass: "dropdownGroupLabel",
        preferRight: false
      });
      // Ensure label is correct immediately
      try { mapSelect.dispatchEvent(new Event("selectDropdown:sync")); } catch { }
    }

    const toolDropdown = document.getElementById("toolDropdown");
    const toolBtn = document.getElementById("toolDropdownBtn");
    const toolMenu = document.getElementById("toolDropdownMenu");
    const toolOptions = Array.from(toolMenu?.querySelectorAll("[data-tool]") || []);
    const toolLabel = toolBtn?.querySelector("[data-tool-label]");

    const colorDropdown = document.getElementById("colorDropdown");
    const colorBtn = document.getElementById("colorBtn");
    const colorMenu = document.getElementById("colorDropdownMenu");
    const colorOptions = Array.from(colorMenu?.querySelectorAll(".colorSwatch") || []);
    const preview = document.getElementById("activeColorPreview");

    // (mapSelect enhancement handled above)
    // Centralized popover registrations (outside click + Escape + resize reposition)
    const toolPopover = (popovers && toolBtn && toolMenu)
      ? popovers.register({
        button: toolBtn,
        menu: toolMenu,
        preferRight: false,
        closeOnOutside: true,
        closeOnEsc: true,
        stopInsideClick: true,
        wireButton: true,
        onOpen: () => {
          const first = toolMenu.querySelector("button:not([disabled])");
          try { first?.focus?.({ preventScroll: true }); } catch { first?.focus?.(); }
        }
      })
      : null;

    const colorPopover = (popovers && colorBtn && colorMenu)
      ? popovers.register({
        button: colorBtn,
        menu: colorMenu,
        preferRight: false,
        closeOnOutside: true,
        closeOnEsc: true,
        stopInsideClick: true,
        wireButton: false, // we add a conditional click handler below
        onOpen: () => {
          const first = colorMenu.querySelector("button:not([disabled])");
          try { first?.focus?.({ preventScroll: true }); } catch { first?.focus?.(); }
        }
      })
      : null;

    // Keyboard: make tool + color dropdowns feel closer to native <select>.
    const wireNativeLikeKeys = (btn, openFn, menu) => {
      if (!btn || !openFn || !menu) return;
      btn.addEventListener("keydown", (e) => {
        const k = e.key;
        if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter" && k !== " ") return;
        e.preventDefault();
        openFn();
        const opts = Array.from(menu.querySelectorAll("button:not([disabled])"));
        if (!opts.length) return;
        const target = (k === "ArrowUp") ? opts[opts.length - 1] : opts[0];
        try { target.focus({ preventScroll: true }); } catch { target.focus(); }
      });
    };

    wireNativeLikeKeys(toolBtn, () => toolPopover?.open?.(), toolMenu);
    wireNativeLikeKeys(colorBtn, () => colorPopover?.open?.(), colorMenu);

    canvasWrap = canvas.closest(".canvasWrap");

    viewScale = Number(state.map.ui?.viewScale || 1) || 1;
    requestAnimationFrame(() => applyViewScale(viewScale));

    function applyMapInteractionMode() {
      const tool = state.map.ui?.activeTool || "brush";
      const drawing = (tool === "brush" || tool === "eraser");
      canvasWrap?.classList.toggle("drawingMode", drawing);
      canvas.style.touchAction = drawing ? "none" : "pan-x pan-y";
    }

    function closeToolMenu() {
      if (toolPopover) return toolPopover.close();
      if (!toolMenu || !toolBtn) return;
      toolMenu.hidden = true;
      toolBtn.setAttribute("aria-expanded", "false");
    }

    function closeColorMenu() {
      if (colorPopover) return colorPopover.close();
      if (!colorMenu || !colorBtn) return;
      colorMenu.hidden = true;
      colorMenu.setAttribute("hidden", "");
      colorBtn.setAttribute("aria-expanded", "false");
    }

    function setActiveToolUI(tool) {
      const nice = (tool || "brush").slice(0, 1).toUpperCase() + (tool || "brush").slice(1);
      if (toolLabel) toolLabel.textContent = `${nice}`;
      toolOptions.forEach(opt => opt.classList.toggle("active", opt.getAttribute("data-tool") === tool));
      if (colorDropdown) colorDropdown.classList.toggle("disabled", tool === "eraser");
      if (tool === "eraser") closeColorMenu();
      if (tool === "eraser") closeToolMenu();
    }

    function setActiveColorUI(colorKey) {
      if (preview) preview.style.setProperty("--swatch-color", colorFromKey(colorKey));
      colorOptions.forEach(opt => opt.classList.toggle("active", opt.getAttribute("data-color") === colorKey));
    }

    function refreshMapSelect() {
      ensureMapManager();
      mapSelect.innerHTML = "";
      for (const mp of state.map.maps) {
        const opt = document.createElement("option");
        opt.value = mp.id;
        opt.textContent = mp.name || "Map";
        if (mp.id === state.map.activeMapId) opt.selected = true;
        mapSelect.appendChild(opt);
      }
      try { mapSelect.dispatchEvent(new Event("selectDropdown:rebuild")); } catch {}
    }

    async function loadActiveMapIntoCanvas() {
      const mp = getActiveMap();

      state.map.undo = [];
      state.map.redo = [];

      const brush = document.getElementById("brushSize");
      brush.value = state.map.ui.brushSize;
      mp.brushSize = state.map.ui.brushSize;
      setActiveToolUI(state.map.ui.activeTool);
      setActiveColorUI(mp.colorKey);

      bgImg = null;
      if (mp.bgBlobId) {
        let url = null;
        try { url = await blobIdToObjectUrl(mp.bgBlobId); }
        catch (err) { console.warn("Failed to load map background blob:", err); }
        if (url) {
          bgImg = new Image();
          await new Promise((res) => {
            bgImg.onload = () => res();
            bgImg.onerror = () => res();
            bgImg.src = url;
          });
        }
      }

      drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
      if (mp.drawingBlobId) {
        let durl = null;
        try { durl = await blobIdToObjectUrl(mp.drawingBlobId); }
        catch (err) { console.warn("Failed to load map drawing blob:", err); }
        if (durl) {
          const img = new Image();
          await new Promise((res) => {
            img.onload = () => { drawCtx.drawImage(img, 0, 0); res(); };
            img.onerror = () => res();
            img.src = durl;
          });
        }
      }

      renderMap();
    }

    async function switchMap(newId) {
      await persistDrawingSnapshot();
      state.map.activeMapId = newId;
      SaveManager.markDirty(); refreshMapSelect();
      await loadActiveMapIntoCanvas();
    }

    addMapBtn?.addEventListener("click", async () => {
      const name = await uiPrompt("Name for the new map?", { defaultValue: "New Map", title: "New Map" });
      if (name == null) return;
      const mp = newMapEntry(name.trim() || "New Map");
      state.map.maps.push(mp);
      await switchMap(mp.id);
    });

    renameMapBtn?.addEventListener("click", async () => {
      const mp = getActiveMap();
      const name = await uiPrompt("Rename map", { defaultValue: mp.name || "Map", title: "Rename Map" });
      if (name == null) return;
      mp.name = name.trim() || mp.name;
      SaveManager.markDirty(); refreshMapSelect();
    });

    deleteMapBtn?.addEventListener("click", async () => {
      if (state.map.maps.length <= 1) {
        await uiAlert("You must keep at least one map.", { title: "Notice" });
        return;
      }
      const mp = getActiveMap();
      const ok = await uiConfirm(`Delete map "${mp.name || "Map"}"? This cannot be undone.`, { title: "Delete Map", okText: "Delete" });
      if (!ok) return;

      if (mp.bgBlobId) {
        try { await deleteBlob(mp.bgBlobId); }
        catch (err) { console.warn("Failed to delete map image blob:", err); }
      }
      if (mp.drawingBlobId) {
        try { await deleteBlob(mp.drawingBlobId); }
        catch (err) { console.warn("Failed to delete map image blob:", err); }
      }

      state.map.maps = state.map.maps.filter(m => m.id !== mp.id);
      if (!state.map.maps.length) state.map.maps = [newMapEntry("World Map")];
      state.map.activeMapId = state.map.maps[0].id;
      SaveManager.markDirty(); refreshMapSelect();
      await loadActiveMapIntoCanvas();
    });

    mapSelect?.addEventListener("change", async () => {
      await switchMap(mapSelect.value);
    });

    refreshMapSelect();
    loadActiveMapIntoCanvas();

    const brush = document.getElementById("brushSize");
    brush.addEventListener("input", () => {
      const mp = getActiveMap();
      state.map.ui.brushSize = Number(brush.value);
      mp.brushSize = state.map.ui.brushSize;
      SaveManager.markDirty();
    });

    // Tool button is auto-wired by popovers manager (if present).

    toolOptions.forEach(opt => {
      opt.addEventListener("click", () => {
        const tool = opt.getAttribute("data-tool") || "brush";
        state.map.ui.activeTool = tool;
        setActiveToolUI(tool);
        if (tool === "brush") setActiveColorUI(getActiveMap().colorKey);
        applyMapInteractionMode();
        SaveManager.markDirty(); closeToolMenu();
      });
    });

    colorBtn?.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (state.map.ui.activeTool === "eraser") return;
      if (colorPopover) colorPopover.toggle();
      else {
        // fallback: old behavior
        if (!colorMenu || !colorBtn) return;
        if (colorMenu.hidden) {
          colorMenu.hidden = false;
          colorMenu.removeAttribute("hidden");
          colorBtn.setAttribute("aria-expanded", "true");
          positionMenuOnScreen(colorMenu, colorBtn, { preferRight: false });
        } else {
          closeColorMenu();
        }
      }
    });

    colorMenu?.addEventListener("click", (e) => { e.stopPropagation(); });

    // Outside click close is handled by popovers manager (if present).

    colorOptions.forEach(btn => {
      btn.addEventListener("click", () => {
        if (state.map.ui.activeTool === "eraser") return;
        const colorKey = btn.dataset.color || "grey";
        const mp = getActiveMap();
        mp.colorKey = colorKey;
        setActiveColorUI(colorKey);
        closeColorMenu();
        SaveManager.markDirty();
      });
    });

    applyMapInteractionMode();

    document.getElementById("undoBtn").addEventListener("click", undo);
    document.getElementById("redoBtn").addEventListener("click", redo);
    document.getElementById("clearMapBtn").addEventListener("click", async () => { await clearDrawing(); });

    document.getElementById("mapImageInput").addEventListener("change", setMapImage);
    document.getElementById("removeMapImageBtn").addEventListener("click", removeMapImage);

    canvas.addEventListener("pointerdown", onPointerDown);
    canvas.addEventListener("pointermove", onPointerMove);
    window.addEventListener("pointerup", onPointerUp);
  }

  // actually wire it up
  setupMap();
}