// js/pages/map/mapPage.js

import { uiAlert } from "../../ui/dialogs.js";
import { enhanceSelectDropdown } from "../../ui/selectDropdown.js";
import { createMapCanvases, renderMap, getCanvasPoint } from "./mapCanvas.js";

import { colorFromKey } from "./mapUtils.js";
import {
  persistDrawingSnapshot,
  loadMapBackgroundImage,
  loadMapDrawingLayer
} from "./mapPersistence.js";
import {
  snapshotForUndo,
  drawDot,
  drawLine,
  restoreFromDataUrl,
  undo as undoDrawing,
  redo as redoDrawing,
  clearDrawing as clearDrawingAction
} from "./mapDrawing.js";
import { createMapGestures } from "./mapGestures.js";

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
  let canvasWrap = null;
  let gestures;

  const snapshotForUndoFn = () => snapshotForUndo({ state, drawLayer });

  const commitDrawingSnapshot = () =>
    persistDrawingSnapshot({ drawLayer, getActiveMap, putBlob, deleteBlob, SaveManager });

  const renderArgs = () => ({ canvas, ctx, drawLayer, bgImg });

  const restoreFromDataUrlFn = (url) =>
    restoreFromDataUrl({
      url,
      drawCtx,
      drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  const undo = () =>
    undoDrawing({ state, drawLayer, restoreFromDataUrlFn });

  const redo = () =>
    redoDrawing({ state, drawLayer, restoreFromDataUrlFn });

  const clearDrawing = async () =>
    clearDrawingAction({
      uiConfirm,
      snapshotForUndoFn,
      drawCtx,
      drawLayer,
      renderArgs: renderArgs(),
      commitDrawing: commitDrawingSnapshot
    });

  function onPointerDown(e) {
    const tool = state.map.ui?.activeTool || "brush";
    const isDrawTool = (tool === "brush" || tool === "eraser");

    if (e.pointerType === "touch") {
      const g = gestures.onPointerDown({ e, canvasWrap });
      if (g.startedPanZoom) {
        // cancel any pending draw / stop drawing like you already do
        if (pendingDraw) { pendingDraw = false; pendingPointerId = null; pendingStartClient = null; pendingStartCanvas = null; }
        if (drawing) { drawing = false; lastPt = null; commitDrawingSnapshot(); }
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
    // Let the gestures module handle 2-finger pan/zoom.
    const g = gestures.onPointerMove({ e, canvas, canvasWrap });
    if (g.handled) {
      // If gestures handled it, we should not draw.
      if (e.pointerType === "touch") e.preventDefault();
      return;
    }

    if (pendingDraw && e.pointerId === pendingPointerId) {
      const dx = e.clientX - pendingStartClient.x;
      const dy = e.clientY - pendingStartClient.y;

      const START_DRAW_THRESHOLD_PX = 6;
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
      bgImg.onload = () => { renderMap({ canvas, ctx, drawLayer, bgImg }); commitDrawingSnapshot(); };
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
    renderMap({ canvas, ctx, drawLayer, bgImg });
    await commitDrawingSnapshot();
    SaveManager.markDirty();
  }

  function setupMap() {
    const can = createMapCanvases({ canvasId: "mapCanvas" });
    canvas = can.canvas;
    ctx = can.ctx;
    drawLayer = can.drawLayer;
    drawCtx = can.drawCtx;
    canvasWrap = can.canvasWrap;

    gestures = createMapGestures({ state, SaveManager });
    gestures.initScale({ canvas, canvasWrap });

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
      try { mapSelect.dispatchEvent(new Event("selectDropdown:rebuild")); } catch { }
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

      bgImg = await loadMapBackgroundImage({ mp, blobIdToObjectUrl });

      await loadMapDrawingLayer({ mp, blobIdToObjectUrl, drawCtx, drawLayer });

      renderMap({ canvas, ctx, drawLayer, bgImg });
    }

    async function switchMap(newId) {
      await commitDrawingSnapshot();
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
