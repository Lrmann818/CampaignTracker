// js/pages/map/mapListUI.js

import { enhanceSelectDropdown } from "../../ui/selectDropdown.js";
import {
  loadMapBackgroundImage,
  loadMapDrawingLayer
} from "./mapPersistence.js";

export function initMapListUI({
  state,
  SaveManager,
  Popovers,
  ensureMapManager,
  getActiveMap,
  newMapEntry,
  uiPrompt,
  uiConfirm,
  uiAlert,
  blobIdToObjectUrl,
  deleteBlob,
  // canvas dependencies:
  drawCtx,
  drawLayer,
  canvas,
  ctx,
  // bgImg state lives in mapPage:
  getBgImg,
  setBgImg,
  // drawing persistence:
  commitDrawingSnapshot,
  // UI helpers from toolbar module / mapPage:
  setActiveToolUI,
  setActiveColorUI,
  renderMap
}) {
  const mapSelect = document.getElementById("mapSelect");
  const addMapBtn = document.getElementById("addMapBtn");
  const renameMapBtn = document.getElementById("renameMapBtn");
  const deleteMapBtn = document.getElementById("deleteMapBtn");

  // Enhance the Map <select> so the OPEN menu matches the Map Tools dropdown.
  // Closed control keeps the same sizing/style as the original select.
  if (mapSelect && Popovers && !mapSelect.dataset.dropdownEnhanced) {
    enhanceSelectDropdown({
      select: mapSelect,
      Popovers,
      buttonClass: "mapSelectBtn",
      optionClass: "swatchOption",
      groupLabelClass: "dropdownGroupLabel",
      preferRight: false
    });
    // Ensure label is correct immediately
    try { mapSelect.dispatchEvent(new Event("selectDropdown:sync")); } catch { }
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

    setBgImg(await loadMapBackgroundImage({ mp, blobIdToObjectUrl }));

    await loadMapDrawingLayer({ mp, blobIdToObjectUrl, drawCtx, drawLayer });

    renderMap({ canvas, ctx, drawLayer, bgImg: getBgImg() });
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

  return { refreshMapSelect, loadActiveMapIntoCanvas, switchMap };
}
