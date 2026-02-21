// Phase 3 (part 1): Party Cards UI extracted from app.js
// This module renders party member cards. It relies on a few helpers that still
// live in app.js; those are injected via initPartyCards().

import { enhanceSelectDropdown } from "../../../ui/selectDropdown.js";
import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";
import { renderSectionTabs, wireSectionCrud } from "./cardsShared.js";
import { pickAndStorePortrait } from "./cardPortraitShared.js";
import { makeFieldSearchMatcher } from "./cardSearchShared.js";
import { attachCardSearchHighlights } from "./cardSearchHighlightShared.js";
import { createMoveButton, createCollapseButton } from "./cardHeaderControlsShared.js";
import { enhanceSelectOnce } from "./cardSelectShared.js";
import { createDeleteButton } from "./cardFooterShared.js";

let _cardsEl = null;
let _state = null;
let _blobIdToObjectUrl = null;
let _autoSizeInput = null;

// Optional: Popovers manager, used to enhance native <select> open menus.
let _Popovers = null;

// Injected helpers (still in app.js for now)
let _matchesSearch = null;
let _enhanceNumberSteppers = null;
let _pickPartyImage = null;
let _updateParty = null;
let _movePartyCard = null;
let _deleteParty = null;
let _numberOrNull = null;
let _renderPartyTabs = null;

const matchesSearch = makeFieldSearchMatcher(["name", "className", "status", "notes"]);

function initPartyCards(deps = {}) {
  _state = deps.state || _state;
  _cardsEl = deps.cardsEl;
  _matchesSearch = deps.matchesSearch;
  _enhanceNumberSteppers = deps.enhanceNumberSteppers;
  _pickPartyImage = deps.pickPartyImage;
  _updateParty = deps.updateParty;
  _movePartyCard = deps.movePartyCard;
  _deleteParty = deps.deleteParty;
  _numberOrNull = deps.numberOrNull;
  _renderPartyTabs = deps.renderPartyTabs;
}

export function renderPartyCards() {
  if (!_cardsEl) return;
  if (!_state) return;

  const prevScroll = _cardsEl.scrollTop; // keep scroll position
  const q = (_state.tracker.partySearch || "").trim();
  const sectionId = _state.tracker.partyActiveSectionId;

  const list = _state.tracker.party
    .filter(m => m.sectionId === sectionId)
    .filter(m => _matchesSearch ? _matchesSearch(m, q) : true);

  _cardsEl.innerHTML = "";

  if (list.length === 0) {
    const empty = document.createElement("div");
    empty.className = "mutedSmall";
    empty.textContent = q
      ? "No party members match your search in this section."
      : "No party members in this section yet. Click “+ Add Member”.";
    _cardsEl.appendChild(empty);
    _cardsEl.scrollTop = prevScroll;
    return;
  }

  list.forEach(m => _cardsEl.appendChild(renderPartyCard(m)));
  if (_enhanceNumberSteppers) _enhanceNumberSteppers(_cardsEl);
  _cardsEl.scrollTop = prevScroll;
}

function numberOrNull(v) {
  return _numberOrNull ? _numberOrNull(v) : (v === "" || v == null ? null : Number(v));
}

function renderPartyCard(m) {
  // Reuse the NPC card styling classes so it looks identical
  const card = document.createElement("div");
  card.className = "npcCard npcCardStack";

  const isCollapsed = !!m.collapsed;
  card.classList.toggle("collapsed", isCollapsed);

  const portrait = document.createElement("div");
  portrait.className = "npcPortraitTop";
  portrait.title = "Click to set/replace image";

  if (m.imgBlobId) {
    const img = document.createElement("img");
    img.alt = m.name || "Party Member Portrait";
    portrait.appendChild(img);

    _blobIdToObjectUrl(m.imgBlobId).then(url => {
      if (url) img.src = url;
    });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "mutedSmall";
    placeholder.textContent = "Click to add image";
    portrait.appendChild(placeholder);
  }

  portrait.addEventListener("click", () => _pickPartyImage(m.id));

  const body = document.createElement("div");
  body.className = "npcCardBodyStack";

  const headerRow = document.createElement("div");
  headerRow.className = "npcHeaderRow";

  const nameInput = document.createElement("input");
  nameInput.className = "npcField npcNameBig";
  nameInput.placeholder = "Name";
  nameInput.value = m.name || "";
  nameInput.addEventListener("input", () => _updateParty(m.id, { name: nameInput.value }, false));

  const moveUp = createMoveButton({
    direction: -1,
    onMove: () => {
      _movePartyCard(m.id, -1);
    },
  });

  const moveDown = createMoveButton({
    direction: +1,
    onMove: () => {
      _movePartyCard(m.id, +1);
    },
  });

  const toggle = createCollapseButton({
    isCollapsed,
    onToggle: () => {
      _updateParty(m.id, { collapsed: !isCollapsed }, true);
    },
  });

  headerRow.appendChild(nameInput);
  headerRow.appendChild(moveUp);
  headerRow.appendChild(moveDown);
  headerRow.appendChild(toggle);

  const collapsible = document.createElement("div");
  collapsible.className = "npcCollapsible";
  collapsible.hidden = isCollapsed;

  //   const classRow = … through notesBlock …

  const classRow = document.createElement("div");
  classRow.className = "npcRowBlock";

  const classLabel = document.createElement("div");
  classLabel.className = "npcMiniLabel";
  classLabel.textContent = "Class";

  const classInput = document.createElement("input");
  classInput.className = "npcField npcClass";
  classInput.placeholder = "Class / Role";
  classInput.value = m.className || "";
  classInput.classList.add("autosize");
  _autoSizeInput(classInput, { min: 60, max: 200 });
  classInput.addEventListener("input", () => _updateParty(m.id, { className: classInput.value }, false));

  classRow.appendChild(classLabel);
  classRow.appendChild(classInput);

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
  hpCur.value = m.hpCurrent ?? "";
  _autoSizeInput(hpCur, { min: 30, max: 70 });
  hpCur.addEventListener("input", () => { _autoSizeInput(hpCur, { min: 30, max: 70 }); _updateParty(m.id, { hpCurrent: numberOrNull(hpCur.value) }, false); });

  const slash = document.createElement("span");
  slash.className = "muted";
  slash.textContent = "/";

  const hpMax = document.createElement("input");
  hpMax.className = "npcField npcHpInput";
  hpMax.classList.add("num-lg");
  hpMax.classList.add("autosize");
  hpMax.type = "number";
  hpMax.placeholder = "Max";
  hpMax.value = m.hpMax ?? "";
  _autoSizeInput(hpMax, { min: 30, max: 70 });
  hpMax.addEventListener("input", () => { _autoSizeInput(hpMax, { min: 30, max: 70 }); _updateParty(m.id, { hpMax: numberOrNull(hpMax.value) }, false); });

  hpWrap.appendChild(hpCur);
  hpWrap.appendChild(slash);
  hpWrap.appendChild(hpMax);

  hpRow.appendChild(hpLabel);
  hpRow.appendChild(hpWrap);

  const statusRow = document.createElement("div");
  statusRow.className = "npcRowBlock";

  const statusLabel = document.createElement("div");
  statusLabel.className = "npcMiniLabel";
  statusLabel.textContent = "Status Effects";

  const statusInput = document.createElement("input");
  statusInput.className = "npcField";
  statusInput.classList.add("statusInput");
  statusInput.placeholder = "Poisoned, Charmed…";
  statusInput.value = m.status || "";
  _autoSizeInput(statusInput, { min: 60, max: 300 });
  statusInput.addEventListener("input", () => _updateParty(m.id, { status: statusInput.value }, false));

  statusRow.appendChild(statusLabel);
  statusRow.appendChild(statusInput);

  const notesBlock = document.createElement("div");
  notesBlock.className = "npcBlock";

  const notesLabel = document.createElement("div");
  notesLabel.className = "npcMiniLabel";
  notesLabel.textContent = "Notes";

  const notesArea = document.createElement("textarea");
  notesArea.className = "npcTextarea npcNotesBox";
  notesArea.placeholder = "Anything important...";
  notesArea.value = m.notes || "";
  notesArea.addEventListener("input", () => _updateParty(m.id, { notes: notesArea.value }, false));

  // True in-field search highlight is attached for all inputs/textareas
  // near the end of renderPartyCard (after the query getter is defined).

  notesBlock.appendChild(notesLabel);
  notesBlock.appendChild(notesArea);

  collapsible.appendChild(classRow);
  collapsible.appendChild(hpRow);
  collapsible.appendChild(statusRow);
  collapsible.appendChild(notesBlock);

  const footer = document.createElement("div");
  footer.className = "npcCardFooter";

  // ✅ NPC-style “move between sections”, but scalable:
  // a dropdown that switches which section the member belongs to
  const sectionWrap = document.createElement("div");
  sectionWrap.className = "row";
  sectionWrap.style.gap = "4px";

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "mutedSmall";
  sectionLabel.textContent = "Section";

  const sectionSelect = document.createElement("select");
  sectionSelect.className = "cardSelect"; // shared select styling (plus existing mapSelect look)
  sectionSelect.title = "Move to section";
  (_state.tracker.partySections || []).forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.id;
    opt.textContent = sec.name || "Section";
    sectionSelect.appendChild(opt);
  });
  sectionSelect.value = m.sectionId || _state.tracker.partyActiveSectionId;

  sectionSelect.addEventListener("change", () => {
    _updateParty(m.id, { sectionId: sectionSelect.value }, true);
    if (_renderPartyTabs) _renderPartyTabs(); // so tab filtering (search) stays accurate
  });

  sectionWrap.appendChild(sectionLabel);
  sectionWrap.appendChild(sectionSelect);

  // Enhance the OPEN menu styling (closed look stays the same size as .cardSelect).
  // Call only after the select is appended (needs a parentElement).
  enhanceSelectOnce({
    select: sectionSelect,
    Popovers: _Popovers,
    enhanceSelectDropdown,
    buttonClass: "cardSelectBtn",
    optionClass: "swatchOption",
    groupLabelClass: "dropdownGroupLabel",
    preferRight: true
  });


  const del = createDeleteButton({
    className: "npcSmallBtn danger",
    text: "Delete",
    onDelete: () => _deleteParty(m.id),
  });

  footer.appendChild(sectionWrap);
  footer.appendChild(del);

  body.appendChild(headerRow);
  body.appendChild(collapsible);

  card.appendChild(portrait);
  card.appendChild(body);

  footer.hidden = isCollapsed;
  card.appendChild(footer);


  // True in-field search highlight (every occurrence)
  const _getPartyQuery = () => (_state.tracker.partySearch || "");
  // Search highlight: exclude HP inputs entirely (cur/max) so numeric HP never gets marked.
  attachCardSearchHighlights({
    cardEl: card,
    getQuery: _getPartyQuery,
    attachSearchHighlightOverlay,
  });

  return card;
}


// Phase 3 polish: Party init + CRUD helpers moved out of app.js
// Returns an API object useful for optional legacy/global wiring.
export function initPartyUI(deps = {}) {
  const {
    SaveManager,
    Popovers,
    uiPrompt,
    uiAlert,
    uiConfirm,
    makePartyMember,
    enhanceNumberSteppers,
    numberOrNull,
    // portrait flow deps
    pickCropStorePortrait,
    ImagePicker,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    setStatus,
    blobIdToObjectUrl,
    autoSizeInput,
  } = deps;
  _state = deps.state;
  _blobIdToObjectUrl = blobIdToObjectUrl || _blobIdToObjectUrl;
  _autoSizeInput = autoSizeInput || _autoSizeInput;
  if (!_state) throw new Error("initPartyUI requires state");
  if (!_blobIdToObjectUrl) throw new Error("initPartyUI requires blobIdToObjectUrl");
  if (!_autoSizeInput) throw new Error("initPartyUI requires autoSizeInput");
  if (!SaveManager) throw new Error("initPartyUI: missing SaveManager");
  if (!makePartyMember) throw new Error("initPartyUI: missing makePartyMember");

  // store Popovers for dynamic card dropdown enhancements
  _Popovers = Popovers || null;

  if (!Array.isArray(_state.tracker.party)) _state.tracker.party = [];
  if (typeof _state.tracker.partySearch !== "string") _state.tracker.partySearch = "";

  // Party sections state (migrate old saves safely)
  if (!Array.isArray(_state.tracker.partySections) || _state.tracker.partySections.length === 0) {
    _state.tracker.partySections = [{
      id: "partysec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: "Main"
    }];
  }
  if (typeof _state.tracker.partyActiveSectionId !== "string" || !_state.tracker.partyActiveSectionId) {
    _state.tracker.partyActiveSectionId = _state.tracker.partySections[0].id;
  }
  // If active id no longer exists, reset to first
  if (!_state.tracker.partySections.some(s => s.id === _state.tracker.partyActiveSectionId)) {
    _state.tracker.partyActiveSectionId = _state.tracker.partySections[0].id;
  }
  // Migrate existing party members to default section
  const defaultSectionId = _state.tracker.partySections[0].id;
  _state.tracker.party.forEach(m => {
    if (!m.sectionId) m.sectionId = defaultSectionId;
  });

  const cardsEl = document.getElementById("partyCards");
  const addBtn = document.getElementById("addPartyBtn");
  const searchEl = document.getElementById("partySearch");

  const tabsEl = document.getElementById("partyTabs");
  const addSectionBtn = document.getElementById("addPartySectionBtn");
  const renameSectionBtn = document.getElementById("renamePartySectionBtn");
  const deleteSectionBtn = document.getElementById("deletePartySectionBtn");

  if (!cardsEl || !addBtn || !searchEl || !tabsEl || !addSectionBtn || !renameSectionBtn || !deleteSectionBtn) return null;

  async function pickPartyImage(memberId) {
    let pickedBlobId = null;
    const ok = await pickAndStorePortrait({
      itemId: memberId,
      getItemById: (id) => _state?.tracker?.party?.find(m => m.id === id) || null,
      getBlobId: (member) => member.imgBlobId,
      setBlobId: (member, blobId) => {
        member.imgBlobId = blobId;
        pickedBlobId = blobId;
      },
      deps: {
        pickCropStorePortrait,
        ImagePicker,
        deleteBlob,
        putBlob,
        cropImageModal,
        getPortraitAspect,
      },
      setStatus,
    });
    if (!ok) return;
    updateParty(memberId, { imgBlobId: pickedBlobId });
  }

  function updateParty(id, patch, rerender = true) {
    const idx = _state.tracker.party.findIndex(m => m.id === id);
    if (idx === -1) return;
    _state.tracker.party[idx] = { ..._state.tracker.party[idx], ...patch };
    SaveManager.markDirty();
    if (rerender) renderPartyCards();
  }

  async function deleteParty(id) {
    const member = _state.tracker.party.find(m => m.id === id);
    if (!member) return;

    if (uiConfirm) {
      const ok = await uiConfirm(`Delete party member "${member.name || "Unnamed"}"?`, { title: "Delete Party Member", okText: "Delete" });
      if (!ok) return;
    }

    if (member.imgBlobId && deleteBlob) {
      try { await deleteBlob(member.imgBlobId); }
      catch (err) { console.warn("Failed to delete party image blob:", err); }
    }

    _state.tracker.party = _state.tracker.party.filter(m => m.id !== id);
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  }

  function setActiveSection(sectionId) {
    _state.tracker.partyActiveSectionId = sectionId;
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  }

  function renderPartyTabs() {
    renderSectionTabs({
      tabsEl,
      sections: _state.tracker.partySections || [],
      activeId: _state.tracker.partyActiveSectionId,
      query: (_state.tracker.partySearch || "").trim().toLowerCase(),
      tabClass: "npcTab",
      sectionMatches: (sec, query) =>
        _state.tracker.party.some(m => m.sectionId === sec.id && matchesSearch(m, query)),
      onSelect: (id) => setActiveSection(id),
    });
  }

  function movePartyCard(id, dir) {
    const q = (_state.tracker.partySearch || "").trim();
    const sectionId = _state.tracker.partyActiveSectionId;

    const visible = _state.tracker.party.filter(m =>
      m.sectionId === sectionId && matchesSearch(m, q)
    );

    const pos = visible.findIndex(m => m.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = _state.tracker.party.findIndex(m => m.id === aId);
    const bIdx = _state.tracker.party.findIndex(m => m.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    const tmp = _state.tracker.party[aIdx];
    _state.tracker.party[aIdx] = _state.tracker.party[bIdx];
    _state.tracker.party[bIdx] = tmp;

    SaveManager.markDirty();
    renderPartyCards();
  }

  // Wire extracted renderer module
  initPartyCards({
    cardsEl,
    matchesSearch,
    enhanceNumberSteppers,
    pickPartyImage,
    updateParty,
    movePartyCard,
    deleteParty,
    numberOrNull,
    renderPartyTabs
  });

  // Bind search
  searchEl.value = _state.tracker.partySearch;
  searchEl.addEventListener("input", () => {
    _state.tracker.partySearch = searchEl.value;
    SaveManager.markDirty();
    renderPartyTabs();     // tabs react to search
    renderPartyCards();    // cards react to search
  });

  // Add party member (goes into ACTIVE section)
  addBtn.addEventListener("click", () => {
    const member = makePartyMember();
    member.sectionId = _state.tracker.partyActiveSectionId;
    _state.tracker.party.unshift(member);
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
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
    sectionsKey: "partySections",
    activeKey: "partyActiveSectionId",
    idPrefix: "partysec",
    newTitle: "New Party Section",
    renameTitle: "Rename Party Section",
    deleteTitle: "Delete Party Section",
    deleteConfirmText: (secName) => `Delete section "${secName}"? Party members in it will be moved to the first section.`,
    renderTabs: renderPartyTabs,
    renderCards: renderPartyCards,
    onDeleteMoveItems: (deleteId, fallbackId) => {
      _state.tracker.party.forEach(m => {
        if (m.sectionId === deleteId) m.sectionId = fallbackId;
      });
    },
  });

  // Initial render
  renderPartyTabs();
  renderPartyCards();

  // Steppers
  if (enhanceNumberSteppers) enhanceNumberSteppers(document);

  return { updateParty, pickPartyImage, deleteParty, renderPartyTabs };
}
