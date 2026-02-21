// Phase 3 (part 2): NPC Cards UI extracted from app.js
// This module renders NPC cards. It relies on a few helpers that still live in app.js;
// those are injected via initNpcCards().

import { enhanceSelectDropdown } from "../../../ui/selectDropdown.js";
import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";
import { renderSectionTabs, wireSectionCrud } from "./cardsShared.js";

let _cardsEl = null;
let _Popovers = null;
let _state = null;
let _blobIdToObjectUrl = null;
let _autoSizeInput = null;

// Injected helpers (still in app.js for now)
let _matchesSearch = null;
let _enhanceNumberSteppers = null;
let _pickNpcImage = null;
let _updateNpc = null;
let _moveNpcCard = null;
let _moveNpc = null;
let _deleteNpc = null;
let _numberOrNull = null;

function initNpcCards(deps = {}) {
  _state = deps.state || _state;
  _cardsEl = deps.cardsEl;
  _matchesSearch = deps.matchesSearch;
  _enhanceNumberSteppers = deps.enhanceNumberSteppers;
  _pickNpcImage = deps.pickNpcImage;
  _updateNpc = deps.updateNpc;
  _moveNpcCard = deps.moveNpcCard;
  _moveNpc = deps.moveNpc;
  _deleteNpc = deps.deleteNpc;
  _numberOrNull = deps.numberOrNull;
}

function renderNpcCards() {
  if (!_state) return;
  const prevScroll = _cardsEl.scrollTop; // ✅ keep scroll position

  const sectionId = _state.tracker.npcActiveSectionId;
  const q = (_state.tracker.npcSearch || "").trim();

  const list = _state.tracker.npcs
    .filter(n => (n.sectionId || "") === sectionId)
    .filter(n => _matchesSearch(n, q));

  _cardsEl.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mutedSmall";
    empty.textContent = q
      ? "No NPCs match your search in this section."
      : "No NPCs in this section yet. Click “+ Add NPC”.";
    _cardsEl.appendChild(empty);

    _cardsEl.scrollTop = prevScroll; // ✅ restore even on empty
    return;
  }

  list.forEach(npc => _cardsEl.appendChild(renderNpcCard(npc)));
  _enhanceNumberSteppers(_cardsEl);

  _cardsEl.scrollTop = prevScroll; // ✅ restore after DOM rebuild
}

function renderNpcCard(npc) {
  const card = document.createElement("div");
  card.className = "npcCard npcCardStack";
  card.dataset.npcId = npc.id;

  const isCollapsed = !!npc.collapsed;
  card.classList.toggle("collapsed", isCollapsed);

  // --- Portrait (full-width top) ---
  const portrait = document.createElement("div");
  portrait.className = "npcPortraitTop";
  portrait.title = "Click to set/replace image";

  if (npc.imgBlobId) {
    const img = document.createElement("img");
    img.alt = npc.name || "NPC Portrait";
    portrait.appendChild(img);

    // Load async
    _blobIdToObjectUrl(npc.imgBlobId).then(url => {
      if (url) img.src = url;
    });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "mutedSmall";
    placeholder.textContent = "Click to add image";
    portrait.appendChild(placeholder);
  }

  // click portrait to set image
  portrait.addEventListener("click", () => _pickNpcImage(npc.id));

  // --- Main stacked fields ---
  const body = document.createElement("div");
  body.className = "npcCardBodyStack";

  // Header row: Name + collapse toggle
  const headerRow = document.createElement("div");
  headerRow.className = "npcHeaderRow";

  const nameInput = document.createElement("input");
  nameInput.className = "npcField npcNameBig";
  nameInput.placeholder = "Name";
  nameInput.value = npc.name || "";
  nameInput.addEventListener("input", () => _updateNpc(npc.id, { name: nameInput.value }, false));

  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "moveBtn";
  moveUp.textContent = "↑";
  moveUp.title = "Move card up";
  moveUp.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _moveNpcCard(npc.id, -1);
  });

  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "moveBtn";
  moveDown.textContent = "↓";
  moveDown.title = "Move card down";
  moveDown.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _moveNpcCard(npc.id, +1);
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

    // Preserve page scroll position. NPC re-render rebuilds the card DOM,
    // which can cause the browser to jump to the top when the focused button disappears.
    const x = window.scrollX;
    const y = window.scrollY;

    _updateNpc(npc.id, { collapsed: !isCollapsed }, true);

    requestAnimationFrame(() => {
      window.scrollTo(x, y);
      // Re-focus the new toggle button without scrolling.
      const btn = _cardsEl?.querySelector(`.npcCard[data-npc-id="${npc.id}"] .cardCollapseBtn`);
      try { btn?.focus({ preventScroll: true }); } catch { btn?.focus?.(); }
    });
  });

  headerRow.appendChild(nameInput);
  headerRow.appendChild(moveUp);
  headerRow.appendChild(moveDown);
  headerRow.appendChild(toggle);

  // Collapsible content: everything below name

  // Class (label + input)
  const collapsible = document.createElement("div");
  collapsible.className = "npcCollapsible";
  collapsible.hidden = isCollapsed;

  const classLabel = document.createElement("div");
  classLabel.className = "npcMiniLabel";
  classLabel.textContent = "Class";

  const classInput = document.createElement("input");
  classInput.className = "npcField npcClass";
  classInput.placeholder = "Class / Role";
  classInput.value = npc.className || "";
  classInput.classList.add("autosize");
  _autoSizeInput(classInput, { min: 60, max: 200 });
  classInput.addEventListener("input", () => _updateNpc(npc.id, { className: classInput.value }, false));

  const classBlock = document.createElement("div");
  classBlock.className = "npcRowBlock";
  classBlock.appendChild(classLabel);
  classBlock.appendChild(classInput);

  // HP row
  const hpRow = document.createElement("div");
  hpRow.className = "npcRowBlock npcHpRow";

  const hpLabel = document.createElement("div");
  hpLabel.className = "npcMiniLabel";
  hpLabel.textContent = "HP";

  const hpWrap = document.createElement("div");
  hpWrap.className = "npcHpWrap";

  const hpCur = document.createElement("input");
  hpCur.className = "npcField npcHpInput";
  hpCur.classList.add("num-lg");
  hpCur.classList.add("autosize");
  hpCur.type = "number";
  hpCur.placeholder = "Cur";
  hpCur.value = npc.hpCurrent ?? "";
  _autoSizeInput(hpCur, { min: 30, max: 70 });
  hpCur.addEventListener("input", () =>{ _autoSizeInput(hpCur, { min: 30, max: 70 }); _updateNpc(npc.id, { hpCurrent: _numberOrNull(hpCur.value) }, false); });

  const slash = document.createElement("span");
  slash.className = "muted";
  slash.textContent = "/";

  const hpMax = document.createElement("input");
  hpMax.className = "npcField npcHpInput";
  hpMax.classList.add("num-lg");
  hpMax.classList.add("autosize");
  hpMax.type = "number";
  hpMax.placeholder = "Max";
  hpMax.value = npc.hpMax ?? "";
  _autoSizeInput(hpMax, { min: 30, max: 70 });
  hpMax.addEventListener("input", () => { _autoSizeInput(hpMax, { min: 30, max: 70 }); _updateNpc(npc.id, { hpMax: _numberOrNull(hpMax.value) }, false); });

  hpWrap.appendChild(hpCur);
  hpWrap.appendChild(slash);
  hpWrap.appendChild(hpMax);

  hpRow.appendChild(hpLabel);
  hpRow.appendChild(hpWrap);

  // Status
  const statusBlock = document.createElement("div");
  statusBlock.className = "npcRowBlock";

  const statusLabel = document.createElement("div");
  statusLabel.className = "npcMiniLabel";
  statusLabel.textContent = "Status Effects";

  const statusInput = document.createElement("input");
  statusInput.className = "npcField";
  statusInput.classList.add("statusInput");
  statusInput.placeholder = "Poisoned, Charmed…";
  statusInput.value = npc.status || "";
  _autoSizeInput(statusInput, { min: 60, max: 300 });
  statusInput.addEventListener("input", () => _updateNpc(npc.id, { status: statusInput.value }, false));

  statusBlock.appendChild(statusLabel);
  statusBlock.appendChild(statusInput);

  // Notes (fixed-height + scroll)
  const notesBlock = document.createElement("div");
  notesBlock.className = "npcBlock";

  const notesLabel = document.createElement("div");
  notesLabel.className = "npcMiniLabel";
  notesLabel.textContent = "Notes";

  const notesArea = document.createElement("textarea");
  notesArea.className = "npcTextarea npcNotesBox";
  notesArea.placeholder = "Anything important...";
  notesArea.value = npc.notes || "";
  notesArea.addEventListener("input", () => _updateNpc(npc.id, { notes: notesArea.value }, false));

  // True in-field search highlight is attached for all inputs/textareas
  // near the end of renderNpcCard (after the query getter is defined).

  notesBlock.appendChild(notesLabel);
  notesBlock.appendChild(notesArea);

  // --- Footer actions ---
  const footer = document.createElement("div");
  footer.className = "npcCardFooter";

  // ✅ Scalable “move between sections” via dropdown (same pattern as Party)
  const sectionWrap = document.createElement("div");
  sectionWrap.className = "row";
  sectionWrap.style.gap = "4px";

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "mutedSmall";
  sectionLabel.textContent = "Section";

  const sectionSelect = document.createElement("select");
  sectionSelect.className = "cardSelect";
  sectionSelect.title = "Move to section";
  (_state.tracker.npcSections || []).forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.id;
    opt.textContent = sec.name || "Section";
    sectionSelect.appendChild(opt);
  });
  sectionSelect.value = npc.sectionId || _state.tracker.npcActiveSectionId;
  sectionSelect.addEventListener("change", () => {
    _updateNpc(npc.id, { sectionId: sectionSelect.value }, true);
    // If tabs are search-filtered like Party, ensure they stay accurate.
    if (typeof window.renderNpcTabs === "function") window.renderNpcTabs();
  });

  sectionWrap.appendChild(sectionLabel);
  sectionWrap.appendChild(sectionSelect);

  // Enhance OPEN menu styling (closed select sizing stays the same).
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
  del.addEventListener("click", () => _deleteNpc(npc.id));

  footer.appendChild(sectionWrap);
  footer.appendChild(del);

  // Build card
  collapsible.appendChild(classBlock);
  collapsible.appendChild(hpRow);
  collapsible.appendChild(statusBlock);
  collapsible.appendChild(notesBlock);

  body.appendChild(headerRow);
  body.appendChild(collapsible);

  card.appendChild(portrait);
  card.appendChild(body);
  // Footer should also collapse
  footer.hidden = isCollapsed;
  card.appendChild(footer);


  // True in-field search highlight (every occurrence)
  const _getNpcQuery = () => (_state.tracker.npcSearch || "");
  // Search highlight: exclude HP inputs entirely (cur/max) so numeric HP never gets marked.
  card.querySelectorAll("input:not(.npcHpInput), textarea").forEach(el => {
    attachSearchHighlightOverlay(el, _getNpcQuery);
  });

  return card;
}

// (Move buttons removed in favor of section dropdown)


// Phase 3 polish: NPC init + CRUD helpers moved out of app.js
export function initNpcsUI(deps = {}) {
  const {
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    setStatus,
    makeNpc,
    enhanceNumberSteppers,
    numberOrNull,
    // portrait flow deps
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,
    autoSizeInput,
  } = deps;
  _state = deps.state;
  _blobIdToObjectUrl = blobIdToObjectUrl || _blobIdToObjectUrl;
  _autoSizeInput = autoSizeInput || _autoSizeInput;
  if (!_state) throw new Error("initNpcsUI requires state");
  if (!_blobIdToObjectUrl) throw new Error("initNpcsUI requires blobIdToObjectUrl");
  if (!_autoSizeInput) throw new Error("initNpcsUI requires autoSizeInput");
  if (!SaveManager) throw new Error("initNpcsUI: missing SaveManager");
  if (!makeNpc) throw new Error("initNpcsUI: missing makeNpc");

  _Popovers = Popovers || null;

  // Migrate old npc textarea string into first NPC note (if any old data exists)
  // Only runs if npcs is not an array.
  if (!Array.isArray(_state.tracker.npcs)) {
    const old = String(_state.tracker.npcs || "").trim();
    _state.tracker.npcs = [];
    if (old) {
      _state.tracker.npcs.push(makeNpc({ group: "undecided", name: "Imported NPC Notes", notes: old }));
    }
  }

  if (typeof _state.tracker.npcSearch !== "string") _state.tracker.npcSearch = "";

  // --- NPC Sections (migrate older group-based saves safely) ---
  // Older versions used fixed groups: friendly/undecided/foe.
  // Newer versions use dynamic sections with add/rename/delete.
  if (!Array.isArray(_state.tracker.npcSections) || _state.tracker.npcSections.length === 0) {
    const mk = (name) => ({
      id: "npcsec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name
    });
    const friendly = mk("Friendly");
    const undecided = mk("Undecided");
    const foe = mk("Foe");
    _state.tracker.npcSections = [friendly, undecided, foe];

    const groupToSecId = {
      friendly: friendly.id,
      undecided: undecided.id,
      foe: foe.id,
    };
    // Migrate existing NPCs into the matching section
    (_state.tracker.npcs || []).forEach(n => {
      if (!n.sectionId) n.sectionId = groupToSecId[n.group] || friendly.id;
    });

    // If older saves had npcActiveGroup, map it over
    if (typeof _state.tracker.npcActiveGroup === "string") {
      _state.tracker.npcActiveSectionId = groupToSecId[_state.tracker.npcActiveGroup] || friendly.id;
    }
  }

  // Ensure active section exists
  if (typeof _state.tracker.npcActiveSectionId !== "string" || !_state.tracker.npcActiveSectionId) {
    _state.tracker.npcActiveSectionId = _state.tracker.npcSections[0].id;
  }
  if (!_state.tracker.npcSections.some(s => s.id === _state.tracker.npcActiveSectionId)) {
    _state.tracker.npcActiveSectionId = _state.tracker.npcSections[0].id;
  }

  // If any NPC lacks a sectionId, put it in the first section
  const defaultSectionId = _state.tracker.npcSections[0].id;
  (_state.tracker.npcs || []).forEach(n => {
    if (!n.sectionId) n.sectionId = defaultSectionId;
  });

  const cardsEl = document.getElementById("npcCards");
  const addBtn = document.getElementById("addNpcBtn");
  const searchEl = document.getElementById("npcSearch");

  const tabsEl = document.getElementById("npcTabs");
  const addSectionBtn = document.getElementById("addNpcSectionBtn");
  const renameSectionBtn = document.getElementById("renameNpcSectionBtn");
  const deleteSectionBtn = document.getElementById("deleteNpcSectionBtn");

  if (!cardsEl || !addBtn || !searchEl || !tabsEl || !addSectionBtn || !renameSectionBtn || !deleteSectionBtn) return;

  // Local helpers
  function matchesSearch(npc, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (npc.name || "").toLowerCase().includes(s) ||
      (npc.className || "").toLowerCase().includes(s) ||
      (npc.status || "").toLowerCase().includes(s) ||
      (npc.notes || "").toLowerCase().includes(s)
    );
  }

  function updateNpc(id, patch, rerender = true) {
    const idx = _state.tracker.npcs.findIndex(n => n.id === id);
    if (idx === -1) return;
    _state.tracker.npcs[idx] = { ..._state.tracker.npcs[idx], ...patch };
    SaveManager.markDirty();
    if (rerender) renderNpcCards();
  }

  function moveNpcCard(id, dir) {
    const sectionId = _state.tracker.npcActiveSectionId;
    const q = (_state.tracker.npcSearch || "").trim();

    // Build the same visible list logic as renderNpcCards()
    const visible = _state.tracker.npcs
      .filter(n => (n.sectionId || "") === sectionId)
      .filter(n => matchesSearch(n, q));

    const pos = visible.findIndex(n => n.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = _state.tracker.npcs.findIndex(n => n.id === aId);
    const bIdx = _state.tracker.npcs.findIndex(n => n.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    // Swap in the master array
    const tmp = _state.tracker.npcs[aIdx];
    _state.tracker.npcs[aIdx] = _state.tracker.npcs[bIdx];
    _state.tracker.npcs[bIdx] = tmp;

    SaveManager.markDirty();
    renderNpcCards();
  }

  async function pickNpcImage(npcId) {
    const npc = _state?.tracker?.npcs?.find(n => n.id === npcId);
    if (!npc) return;

    if (!pickCropStorePortrait || !ImagePicker || !cropImageModal || !getPortraitAspect || !deleteBlob || !putBlob) {
      console.warn("NPC portrait flow dependencies missing; cannot pick image.");
      return;
    }

    const blobId = await pickCropStorePortrait({
      picker: ImagePicker,
      currentBlobId: npc.imgBlobId,
      deleteBlob,
      putBlob,
      cropImageModal,
      getPortraitAspect,
      aspectSelector: ".npcPortraitTop",
      setStatus,
    });
    if (!blobId) return;
    updateNpc(npcId, { imgBlobId: blobId });
  }

  async function deleteNpc(id) {
    const npc = _state.tracker.npcs.find(n => n.id === id);
    if (!npc) return;

    if (uiConfirm) {
      const ok = await uiConfirm(`Delete NPC "${npc.name || "Unnamed"}"?`, { title: "Delete NPC", okText: "Delete" });
      if (!ok) return;
    }

    if (npc.imgBlobId && deleteBlob) {
      try { await deleteBlob(npc.imgBlobId); }
      catch (err) { console.warn("Failed to delete npc image blob:", err); }
    }

    _state.tracker.npcs = _state.tracker.npcs.filter(n => n.id !== id);
    SaveManager.markDirty();
    renderNpcCards();
  }

  // Wire extracted renderer module
  initNpcCards({
    cardsEl,
    Popovers,
    matchesSearch,
    enhanceNumberSteppers,
    pickNpcImage,
    updateNpc,
    moveNpcCard,
    deleteNpc,
    numberOrNull,
  });

  function setActiveSection(sectionId) {
    _state.tracker.npcActiveSectionId = sectionId;
    SaveManager.markDirty();
    renderNpcTabs();
    renderNpcCards();
  }

  function renderNpcTabs() {
    renderSectionTabs({
      tabsEl,
      sections: _state.tracker.npcSections || [],
      activeId: _state.tracker.npcActiveSectionId,
      query: (_state.tracker.npcSearch || "").trim().toLowerCase(),
      tabClass: "npcTab",
      sectionMatches: (sec, query) =>
        _state.tracker.npcs.some(n => n.sectionId === sec.id && matchesSearch(n, query)),
      onSelect: (id) => setActiveSection(id),
    });
  }

  // Allow cards' section dropdown to refresh tabs after a move.
  // (Kept as a small escape hatch similar to Party's renderer injection.)
  window.renderNpcTabs = renderNpcTabs;

  // Bind search
  searchEl.value = _state.tracker.npcSearch;
  searchEl.addEventListener("input", () => {
    _state.tracker.npcSearch = searchEl.value;
    SaveManager.markDirty();
    renderNpcTabs();
    renderNpcCards();
  });

  // Section buttons
  wireSectionCrud({
    state: _state,
    SaveManager,
    uiPrompt,
    uiAlert,
    uiConfirm,
    addSectionBtn,
    renameSectionBtn,
    deleteSectionBtn,
    sectionsKey: "npcSections",
    activeKey: "npcActiveSectionId",
    idPrefix: "npcsec",
    newTitle: "New NPC Section",
    renameTitle: "Rename NPC Section",
    deleteTitle: "Delete NPC Section",
    deleteConfirmText: (secName) => `Delete section "${secName}"? NPCs in it will be moved to the first section.`,
    renderTabs: renderNpcTabs,
    renderCards: renderNpcCards,
    onDeleteMoveItems: (deleteId, fallbackId) => {
      _state.tracker.npcs.forEach(n => {
        if (n.sectionId === deleteId) n.sectionId = fallbackId;
      });
    },
  });

  // Initial render
  renderNpcTabs();
  renderNpcCards();

  // Add NPC
  addBtn.addEventListener("click", () => {
    const npc = makeNpc({ sectionId: _state.tracker.npcActiveSectionId });
    _state.tracker.npcs.unshift(npc);
    SaveManager.markDirty();
    renderNpcTabs();
    renderNpcCards();
  });

  // Steppers (covers initial render + any fixed inputs)
  if (enhanceNumberSteppers) enhanceNumberSteppers(document);
}
