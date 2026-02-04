// Phase 3 (part 2.5): Location Cards UI extracted from app.js
// This module renders Location cards. A few location helpers still live in app.js
// and are injected via initLocationCards().

import { state } from "../state.js";
import { blobIdToObjectUrl } from "../storage/blobs.js";
import { enhanceSelectDropdown } from "../ui/selectDropdown.js";
import { attachSearchHighlightOverlay } from "../ui/searchHighlightOverlay.js";

let _cardsEl = null;

// Optional: Popovers manager, used to enhance native <select> open menus.
let _Popovers = null;

// Injected helpers (still in app.js for now)
let _pickLocImage = null;
let _updateLoc = null;
let _moveLocCard = null;
let _deleteLoc = null;

/**
 * Locations toolbar wiring (search / filter / add)
 * Kept in the same module as Location cards to avoid over-splitting.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.addBtn
 * @param {HTMLInputElement} opts.searchEl
 * @param {HTMLSelectElement} opts.filterEl
 * @param {Object} [opts.state]
 * @param {Function} opts.makeLocation
 * @param {Function} opts.markDirty
 * @param {Function} opts.render
 */
export function initLocationsToolbar({ addBtn, searchEl, filterEl, state: injectedState, makeLocation, markDirty, render, renderTabs }) {
  const s = injectedState || state;
  if (!s?.tracker) return;

  // Defaults for persisted toolbar state
  if (typeof s.tracker.locSearch !== "string") s.tracker.locSearch = "";
  if (typeof s.tracker.locFilter !== "string") s.tracker.locFilter = "all";
  if (!Array.isArray(s.tracker.locationsList)) s.tracker.locationsList = [];

  // Initialize UI from state
  searchEl.value = s.tracker.locSearch;
  filterEl.value = s.tracker.locFilter;

  // Wiring
  searchEl.addEventListener("input", () => {
    s.tracker.locSearch = searchEl.value;
    markDirty();
    if (renderTabs) renderTabs();
    render();
  });

  filterEl.addEventListener("change", () => {
    s.tracker.locFilter = filterEl.value;
    markDirty();
    if (renderTabs) renderTabs();
    render();
  });

  addBtn.addEventListener("click", () => {
    const loc = makeLocation();
    // If sections are enabled, add to the active section.
    if (typeof s.tracker.locActiveSectionId === "string" && s.tracker.locActiveSectionId) {
      loc.sectionId = s.tracker.locActiveSectionId;
    }
    s.tracker.locationsList.unshift(loc);
    markDirty();
    if (renderTabs) renderTabs();
    render();
  });
}

export function initLocationCards(deps) {
  _cardsEl = deps.cardsEl;
  _pickLocImage = deps.pickLocImage;
  _updateLoc = deps.updateLoc;
  _moveLocCard = deps.moveLocCard;
  _deleteLoc = deps.deleteLoc;
}

function matchesSearch(loc, q) {
  if (!q) return true;
  const s = q.toLowerCase();
  return (
    (loc.title || "").toLowerCase().includes(s) ||
    (loc.notes || "").toLowerCase().includes(s)
  );
}

export function renderLocationCards() {
  if (!_cardsEl) return;

  const prevScroll = _cardsEl.scrollTop; // keep scroll position
  const sectionId = state.tracker.locActiveSectionId;
  const q = (state.tracker.locSearch || "").trim();
  const typeFilter = state.tracker.locFilter || "all";

  const list = state.tracker.locationsList
    .filter(l => !sectionId ? true : ((l.sectionId || "") === sectionId))
    .filter(l => typeFilter === "all" ? true : ((l.type || "town") === typeFilter))
    .filter(l => matchesSearch(l, q));

  _cardsEl.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mutedSmall";
    empty.textContent = q
      ? "No locations match your search in this section."
      : "No locations in this section yet. Click “+ Add Location”.";
    _cardsEl.appendChild(empty);
    _cardsEl.scrollTop = prevScroll;
    return;
  }

  list.forEach(loc => _cardsEl.appendChild(renderLocationCard(loc)));
  _cardsEl.scrollTop = prevScroll;
}

export function renderLocationCard(loc) {
  // Reuse the same card frame/classes as NPCs/Party
  const card = document.createElement("div");
  card.className = "npcCard npcCardStack";

  const isCollapsed = !!loc.collapsed;
  card.classList.toggle("collapsed", isCollapsed);

  const portrait = document.createElement("div");
  portrait.className = "npcPortraitTop";
  portrait.title = "Click to set/replace image";

  if (loc.imgBlobId) {
    const img = document.createElement("img");
    img.alt = loc.title || "Location Image";
    portrait.appendChild(img);

    // Load async
    blobIdToObjectUrl(loc.imgBlobId).then(url => {
      if (url) img.src = url;
    });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "mutedSmall";
    placeholder.textContent = "Click to add image";
    portrait.appendChild(placeholder);
  }

  portrait.addEventListener("click", () => _pickLocImage(loc.id));

  const body = document.createElement("div");
  body.className = "npcCardBodyStack";

  // Header row: Location name + collapse toggle
  const headerRow = document.createElement("div");
  headerRow.className = "npcHeaderRow";

  const titleInput = document.createElement("input");
  titleInput.className = "npcField npcNameBig";
  titleInput.placeholder = "Location name (Town, Dungeon, Region...)";
  titleInput.value = loc.title || "";
  titleInput.addEventListener("input", () => _updateLoc(loc.id, { title: titleInput.value }, false));

  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "moveBtn";
  moveUp.textContent = "↑";
  moveUp.title = "Move card up";
  moveUp.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _moveLocCard(loc.id, -1);
  });

  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "moveBtn";
  moveDown.textContent = "↓";
  moveDown.title = "Move card down";
  moveDown.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _moveLocCard(loc.id, +1);
  });

  const toggle = document.createElement("button");
  toggle.type = "button";
  toggle.className = "cardCollapseBtn";
  toggle.setAttribute("aria-label", isCollapsed ? "Expand card" : "Collapse card");
  toggle.setAttribute("aria-expanded", (!isCollapsed).toString());
  toggle.textContent = isCollapsed ? "▼" : "▲";
  toggle.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _updateLoc(loc.id, { collapsed: !isCollapsed }, true);
  });

  headerRow.appendChild(titleInput);
  headerRow.appendChild(moveUp);
  headerRow.appendChild(moveDown);
  headerRow.appendChild(toggle);

  // Collapsible content
  const collapsible = document.createElement("div");
  collapsible.className = "npcCollapsible";
  collapsible.hidden = isCollapsed;

  const typeBlock = document.createElement("div");
  typeBlock.className = "npcBlock";

  const typeLabel = document.createElement("div");
  typeLabel.className = "npcMiniLabel";
  typeLabel.textContent = "Type";

  const typeSelect = document.createElement("select");
  typeSelect.className = "cardSelect";
  typeSelect.innerHTML = `
    <option value="town">Town</option>
    <option value="dungeon">Dungeon</option>
    <option value="region">Region</option>
    <option value="other">Other</option>
  `;
  typeSelect.value = loc.type || "other";
  typeSelect.addEventListener("change", () => _updateLoc(loc.id, { type: typeSelect.value }));

  // Enhance the OPEN menu styling (closed look stays the same size as .cardSelect).
  if (_Popovers && !typeSelect.dataset.dropdownEnhanced) {
    enhanceSelectDropdown({
      select: typeSelect,
      Popovers: _Popovers,
      buttonClass: "cardSelectBtn",
      optionClass: "swatchOption",
      groupLabelClass: "dropdownGroupLabel",
      preferRight: true
    });
  }

  typeBlock.appendChild(typeLabel);
  typeBlock.appendChild(typeSelect);

  const notesBlock = document.createElement("div");
  notesBlock.className = "npcBlock";

  const notesLabel = document.createElement("div");
  notesLabel.className = "npcMiniLabel";
  notesLabel.textContent = "Notes";

  const notesArea = document.createElement("textarea");
  notesArea.className = "npcTextarea npcNotesBox";
  notesArea.placeholder = "Details, hooks, NPCs here, secrets...";
  notesArea.value = loc.notes || "";
  notesArea.addEventListener("input", () => _updateLoc(loc.id, { notes: notesArea.value }, false));

    // True in-field search highlight is attached for all inputs/textareas
    // near the end of renderLocationCard (after the query getter is defined).

  notesBlock.appendChild(notesLabel);
  notesBlock.appendChild(notesArea);

  const footer = document.createElement("div");
footer.className = "npcCardFooter";

// “Move between sections” dropdown (matches Party/NPC cards)
const sectionWrap = document.createElement("div");
sectionWrap.className = "row";
sectionWrap.style.gap = "4px";

const sectionLabel = document.createElement("div");
sectionLabel.className = "mutedSmall";
sectionLabel.textContent = "Section";

const sectionSelect = document.createElement("select");
sectionSelect.className = "cardSelect";
sectionSelect.title = "Move to section";
(state.tracker.locSections || []).forEach(sec => {
  const opt = document.createElement("option");
  opt.value = sec.id;
  opt.textContent = sec.name || "Section";
  sectionSelect.appendChild(opt);
});
sectionSelect.value = loc.sectionId || state.tracker.locActiveSectionId;
sectionSelect.addEventListener("change", () => {
  _updateLoc(loc.id, { sectionId: sectionSelect.value }, true);
  if (typeof window.renderLocationTabs === "function") window.renderLocationTabs();
});

sectionWrap.appendChild(sectionLabel);
sectionWrap.appendChild(sectionSelect);

// Enhance OPEN menu styling (closed sizing stays the same).
if (_Popovers && !sectionSelect.dataset.dropdownEnhanced) {
  enhanceSelectDropdown({
    select: sectionSelect,
    Popovers: _Popovers,
    buttonClass: "cardSelectBtn",
    optionClass: "swatchOption",
    groupLabelClass: "dropdownGroupLabel",
    preferRight: true
  });
}

const del = document.createElement("button");
  del.type = "button";
  del.className = "npcSmallBtn danger";
  del.textContent = "Delete";
  del.addEventListener("click", () => _deleteLoc(loc.id));

  footer.appendChild(sectionWrap);
  footer.appendChild(del);

  // Build collapsible
  collapsible.appendChild(typeBlock);
  collapsible.appendChild(notesBlock);

  body.appendChild(headerRow);
  body.appendChild(collapsible);

  card.appendChild(portrait);
  card.appendChild(body);

  // Footer should also collapse
  footer.hidden = isCollapsed;
  card.appendChild(footer);

  
    // True in-field search highlight (every occurrence)
    const _getLocQuery = () => (state.tracker.locSearch || "");
    card.querySelectorAll("input, textarea").forEach(el => {
      attachSearchHighlightOverlay(el, _getLocQuery);
    });

return card;
}


// Phase 3 polish: Locations init + CRUD helpers moved out of app.js
export function initLocationsUI({
  SaveManager,
  Popovers,
  uiPrompt,
  uiAlert,
  uiConfirm,
  makeLocation,
  // portrait flow deps
  pickCropStorePortrait,
  ImagePicker,
  deleteBlob,
  putBlob,
  cropImageModal,
  getPortraitAspect,
  setStatus,
} = {}) {
  if (!SaveManager) throw new Error("initLocationsUI: missing SaveManager");
  if (!makeLocation) throw new Error("initLocationsUI: missing makeLocation");

  // store Popovers for dynamic card dropdown enhancements
  _Popovers = Popovers || null;

  // migrate old textarea into a location card (only once)
  if (!Array.isArray(state.tracker.locationsList)) state.tracker.locationsList = [];
  if (typeof state.tracker.locSearch !== "string") state.tracker.locSearch = "";
  if (typeof state.tracker.locFilter !== "string") state.tracker.locFilter = "all";

  // Location sections (like Party)
  if (!Array.isArray(state.tracker.locSections) || state.tracker.locSections.length === 0) {
    state.tracker.locSections = [{
      id: "locsec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: "Main"
    }];
  }
  if (typeof state.tracker.locActiveSectionId !== "string" || !state.tracker.locActiveSectionId) {
    state.tracker.locActiveSectionId = state.tracker.locSections[0].id;
  }
  if (!state.tracker.locSections.some(s => s.id === state.tracker.locActiveSectionId)) {
    state.tracker.locActiveSectionId = state.tracker.locSections[0].id;
  }
  // Ensure all locations belong to a section
  const defaultSectionId = state.tracker.locSections[0].id;
  state.tracker.locationsList.forEach(l => {
    if (!l.sectionId) l.sectionId = defaultSectionId;
  });

  if (typeof state.tracker.locations === "string") {
    const old = state.tracker.locations.trim();
    if (old && state.tracker.locationsList.length === 0) {
      state.tracker.locationsList.push(makeLocation({ title: "Imported Locations", notes: old }));
    }
  }

  const cardsEl = document.getElementById("locCards");
  const addBtn = document.getElementById("addLocBtn");
  const searchEl = document.getElementById("locSearch");
  const filterEl = document.getElementById("locFilter");

  const tabsEl = document.getElementById("locTabs");
  const addSectionBtn = document.getElementById("addLocSectionBtn");
  const renameSectionBtn = document.getElementById("renameLocSectionBtn");
  const deleteSectionBtn = document.getElementById("deleteLocSectionBtn");

  if (!cardsEl || !addBtn || !searchEl || !filterEl || !tabsEl || !addSectionBtn || !renameSectionBtn || !deleteSectionBtn) return null;

  // Enhance the type filter so its OPEN menu matches the Map Tools dropdown.
  // Closed control keeps the same size as the panel header select.
  if (filterEl && Popovers && !filterEl.dataset.dropdownEnhanced) {
    enhanceSelectDropdown({
      select: filterEl,
      Popovers,
      buttonClass: "panelSelectBtn",
      optionClass: "swatchOption",
      groupLabelClass: "dropdownGroupLabel",
      preferRight: false
    });
  }

  // (filterEl enhancement handled above)

  function matchesSearch(loc, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (loc.title || "").toLowerCase().includes(s) ||
      (loc.notes || "").toLowerCase().includes(s)
    );
  }

  function updateLoc(id, patch, rerender = true) {
    const idx = state.tracker.locationsList.findIndex(l => l.id === id);
    if (idx === -1) return;
    state.tracker.locationsList[idx] = { ...state.tracker.locationsList[idx], ...patch };
    SaveManager.markDirty();
    if (rerender) renderLocationCards();
  }

  function moveLocCard(id, dir) {
    const sectionId = state.tracker.locActiveSectionId;
    const q = (state.tracker.locSearch || "").trim();
    const typeFilter = state.tracker.locFilter || "all";

    const visible = state.tracker.locationsList
      .filter(l => (l.sectionId || "") === sectionId)
      .filter(l => typeFilter === "all" ? true : ((l.type || "town") === typeFilter))
      .filter(l => matchesSearch(l, q));

    const pos = visible.findIndex(l => l.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = state.tracker.locationsList.findIndex(l => l.id === aId);
    const bIdx = state.tracker.locationsList.findIndex(l => l.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    const tmp = state.tracker.locationsList[aIdx];
    state.tracker.locationsList[aIdx] = state.tracker.locationsList[bIdx];
    state.tracker.locationsList[bIdx] = tmp;

    SaveManager.markDirty();
    renderLocationCards();
  }

  async function pickLocImage(id) {
    const loc = state?.tracker?.locationsList?.find(l => l.id === id);
    if (!loc) return;

    if (!pickCropStorePortrait || !ImagePicker || !cropImageModal || !getPortraitAspect || !deleteBlob || !putBlob) {
      console.warn("Location portrait flow dependencies missing; cannot pick image.");
      return;
    }

    const blobId = await pickCropStorePortrait({
      picker: ImagePicker,
      currentBlobId: loc.imgBlobId,
      deleteBlob,
      putBlob,
      cropImageModal,
      getPortraitAspect,
      aspectSelector: ".npcPortraitTop",
      setStatus,
    });
    if (!blobId) return;
    updateLoc(id, { imgBlobId: blobId });
  }

  async function deleteLoc(id) {
    const loc = state.tracker.locationsList.find(l => l.id === id);
    if (!loc) return;

    if (uiConfirm) {
      const ok = await uiConfirm(`Delete location "${loc.title || "Unnamed"}"?`, { title: "Delete Location", okText: "Delete" });
      if (!ok) return;
    }

    if (loc.imgBlobId && deleteBlob) {
      try { await deleteBlob(loc.imgBlobId); }
      catch (err) { console.warn("Failed to delete location image blob:", err); }
    }

    state.tracker.locationsList = state.tracker.locationsList.filter(l => l.id !== id);
    SaveManager.markDirty();
    renderLocationCards();
  }

  initLocationCards({
    cardsEl,
    pickLocImage,
    updateLoc,
    moveLocCard,
    deleteLoc
  });

  function setActiveSection(sectionId) {
    state.tracker.locActiveSectionId = sectionId;
    SaveManager.markDirty();
    renderLocTabs();
    renderLocationCards();
  }

  function renderLocTabs() {
    tabsEl.innerHTML = "";

    const query = (state.tracker.locSearch || "").trim().toLowerCase();
    const typeFilter = state.tracker.locFilter || "all";
    const sections = state.tracker.locSections || [];
    const activeId = state.tracker.locActiveSectionId;

    let toShow = sections.filter(sec => {
      if (!query) return true;
      const nameMatch = (sec.name || "").toLowerCase().includes(query);
      if (nameMatch) return true;
      return state.tracker.locationsList.some(l => {
        if (l.sectionId !== sec.id) return false;
        if (typeFilter !== "all" && (l.type || "town") !== typeFilter) return false;
        return matchesSearch(l, query);
      });
    });

    if (!toShow.some(s => s.id === activeId)) {
      const active = sections.find(s => s.id === activeId);
      if (active) toShow = [active, ...toShow];
    }

    toShow.forEach(sec => {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "npcTab" + (sec.id === activeId ? " active" : "");
      btn.setAttribute("role", "tab");
      btn.setAttribute("aria-selected", sec.id === activeId ? "true" : "false");
      btn.textContent = sec.name || "Section";
      btn.addEventListener("click", () => setActiveSection(sec.id));
      tabsEl.appendChild(btn);
    });

    if (toShow.length === 0) {
      const hint = document.createElement("div");
      hint.className = "mutedSmall";
      hint.style.marginLeft = "6px";
      hint.textContent = "No matching sections.";
      tabsEl.appendChild(hint);
    }
  }

  // Allow cards/actions to refresh tabs if needed.
  window.renderLocTabs = renderLocTabs;

  // Section buttons
  addSectionBtn.addEventListener("click", async () => {
    if (!uiPrompt) {
      await uiAlert?.("This action needs the in-app prompt dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }
    const nextNum = (state.tracker.locSections?.length || 0) + 1;
    const proposed = await uiPrompt("New section name:", { defaultValue: `Section ${nextNum}`, title: "New Location Section" });
    if (proposed === null) return;

    const name = proposed.trim() || `Section ${nextNum}`;
    const sec = {
      id: "locsec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name
    };
    state.tracker.locSections.push(sec);
    state.tracker.locActiveSectionId = sec.id;
    SaveManager.markDirty();
    renderLocTabs();
    renderLocationCards();
  });

  renameSectionBtn.addEventListener("click", async () => {
    const sec = state.tracker.locSections.find(s => s.id === state.tracker.locActiveSectionId);
    if (!sec) return;

    if (!uiPrompt) {
      await uiAlert?.("This action needs the in-app prompt dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }

    const proposed = await uiPrompt("Rename section to:", { defaultValue: sec.name || "", title: "Rename Location Section" });
    if (proposed === null) return;

    sec.name = proposed.trim() || sec.name || "Section";
    SaveManager.markDirty();
    renderLocTabs();
  });

  deleteSectionBtn.addEventListener("click", async () => {
    if ((state.tracker.locSections?.length || 0) <= 1) {
      await uiAlert?.("You need at least one section.", { title: "Notice" });
      return;
    }

    const sec = state.tracker.locSections.find(s => s.id === state.tracker.locActiveSectionId);
    if (!sec) return;

    if (!uiConfirm) {
      await uiAlert?.("This action needs the in-app confirm dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }

    const ok = await uiConfirm(`Delete section "${sec.name}"? Locations in it will be moved to the first section.`, { title: "Delete Location Section", okText: "Delete" });
    if (!ok) return;

    const deleteId = sec.id;
    state.tracker.locSections = state.tracker.locSections.filter(s => s.id !== deleteId);

    const fallbackId = state.tracker.locSections[0].id;
    state.tracker.locationsList.forEach(l => {
      if (l.sectionId === deleteId) l.sectionId = fallbackId;
    });
    state.tracker.locActiveSectionId = fallbackId;

    SaveManager.markDirty();
    renderLocTabs();
    renderLocationCards();
  });

  // Toolbar (search / filter / add)
  initLocationsToolbar({
    addBtn,
    searchEl,
    filterEl,
    state,
    makeLocation,
    markDirty: () => SaveManager.markDirty(),
    renderTabs: () => renderLocTabs(),
    render: () => renderLocationCards()
  });

  // Initial render
  renderLocTabs();
  renderLocationCards();
  return { updateLoc, pickLocImage, deleteLoc };
}