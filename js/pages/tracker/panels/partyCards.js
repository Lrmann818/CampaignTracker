// Phase 3 (part 1): Party Cards UI extracted from app.js
// This module renders party member cards. It relies on a few helpers that still
// live in app.js; those are injected via initPartyCards().

import { state } from "../../../state.js";
import { blobIdToObjectUrl } from "../../../storage/blobs.js";
import { enhanceSelectDropdown } from "../../../ui/selectDropdown.js";
import { autoSizeInput } from "../../../features/autosize.js";
import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";

let _cardsEl = null;

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

export function initPartyCards(deps) {
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

  const prevScroll = _cardsEl.scrollTop; // keep scroll position
  const q = (state.tracker.partySearch || "").trim();
  const sectionId = state.tracker.partyActiveSectionId;

  const list = state.tracker.party
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

    blobIdToObjectUrl(m.imgBlobId).then(url => {
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

  const moveUp = document.createElement("button");
  moveUp.type = "button";
  moveUp.className = "moveBtn";
  moveUp.textContent = "↑";
  moveUp.title = "Move card up";
  moveUp.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _movePartyCard(m.id, -1);
  });

  const moveDown = document.createElement("button");
  moveDown.type = "button";
  moveDown.className = "moveBtn";
  moveDown.textContent = "↓";
  moveDown.title = "Move card down";
  moveDown.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    _movePartyCard(m.id, +1);
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
    _updateParty(m.id, { collapsed: !isCollapsed }, true);
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
  autoSizeInput(classInput, { min: 60, max: 200 });
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
  autoSizeInput(hpCur, { min: 30, max: 70 });
  hpCur.addEventListener("input", () => { autoSizeInput(hpCur, { min: 30, max: 70 }); _updateParty(m.id, { hpCurrent: numberOrNull(hpCur.value) }, false); });

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
  autoSizeInput(hpMax, { min: 30, max: 70 });
  hpMax.addEventListener("input", () => { autoSizeInput(hpMax, { min: 30, max: 70 }); _updateParty(m.id, { hpMax: numberOrNull(hpMax.value) }, false); });

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
  autoSizeInput(statusInput, { min: 60, max: 300 });
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
  (state.tracker.partySections || []).forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.id;
    opt.textContent = sec.name || "Section";
    sectionSelect.appendChild(opt);
  });
  sectionSelect.value = m.sectionId || state.tracker.partyActiveSectionId;

  sectionSelect.addEventListener("change", () => {
    _updateParty(m.id, { sectionId: sectionSelect.value }, true);
    if (_renderPartyTabs) _renderPartyTabs(); // so tab filtering (search) stays accurate
  });

  sectionWrap.appendChild(sectionLabel);
  sectionWrap.appendChild(sectionSelect);

  // Enhance the OPEN menu styling (closed look stays the same size as .cardSelect).
  // Call only after the select is appended (needs a parentElement).
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
  del.addEventListener("click", () => _deleteParty(m.id));

  footer.appendChild(sectionWrap);
  footer.appendChild(del);

  body.appendChild(headerRow);
  body.appendChild(collapsible);

  card.appendChild(portrait);
  card.appendChild(body);

  footer.hidden = isCollapsed;
  card.appendChild(footer);


  // True in-field search highlight (every occurrence)
  const _getPartyQuery = () => (state.tracker.partySearch || "");
  // Search highlight: exclude HP inputs entirely (cur/max) so numeric HP never gets marked.
  card.querySelectorAll("input:not(.npcHpInput), textarea").forEach(el => {
    attachSearchHighlightOverlay(el, _getPartyQuery);
  });

  return card;
}


// Phase 3 polish: Party init + CRUD helpers moved out of app.js
// Returns an API object useful for optional legacy/global wiring.
export function initPartyUI({
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
} = {}) {
  if (!SaveManager) throw new Error("initPartyUI: missing SaveManager");
  if (!makePartyMember) throw new Error("initPartyUI: missing makePartyMember");

  // store Popovers for dynamic card dropdown enhancements
  _Popovers = Popovers || null;

  if (!Array.isArray(state.tracker.party)) state.tracker.party = [];
  if (typeof state.tracker.partySearch !== "string") state.tracker.partySearch = "";

  // Party sections state (migrate old saves safely)
  if (!Array.isArray(state.tracker.partySections) || state.tracker.partySections.length === 0) {
    state.tracker.partySections = [{
      id: "partysec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name: "Main"
    }];
  }
  if (typeof state.tracker.partyActiveSectionId !== "string" || !state.tracker.partyActiveSectionId) {
    state.tracker.partyActiveSectionId = state.tracker.partySections[0].id;
  }
  // If active id no longer exists, reset to first
  if (!state.tracker.partySections.some(s => s.id === state.tracker.partyActiveSectionId)) {
    state.tracker.partyActiveSectionId = state.tracker.partySections[0].id;
  }
  // Migrate existing party members to default section
  const defaultSectionId = state.tracker.partySections[0].id;
  state.tracker.party.forEach(m => {
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

  function matchesSearch(m, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (m.name || "").toLowerCase().includes(s) ||
      (m.className || "").toLowerCase().includes(s) ||
      (m.status || "").toLowerCase().includes(s) ||
      (m.notes || "").toLowerCase().includes(s)
    );
  }

  async function pickPartyImage(memberId) {
    const member = state?.tracker?.party?.find(m => m.id === memberId);
    if (!member) return;

    if (!pickCropStorePortrait || !ImagePicker || !cropImageModal || !getPortraitAspect || !deleteBlob || !putBlob) {
      console.warn("Party portrait flow dependencies missing; cannot pick image.");
      return;
    }

    const blobId = await pickCropStorePortrait({
      picker: ImagePicker,
      currentBlobId: member.imgBlobId,
      deleteBlob,
      putBlob,
      cropImageModal,
      getPortraitAspect,
      aspectSelector: ".npcPortraitTop",
      setStatus,
    });
    if (!blobId) return;
    updateParty(memberId, { imgBlobId: blobId });
  }

  function updateParty(id, patch, rerender = true) {
    const idx = state.tracker.party.findIndex(m => m.id === id);
    if (idx === -1) return;
    state.tracker.party[idx] = { ...state.tracker.party[idx], ...patch };
    SaveManager.markDirty();
    if (rerender) renderPartyCards();
  }

  async function deleteParty(id) {
    const member = state.tracker.party.find(m => m.id === id);
    if (!member) return;

    if (uiConfirm) {
      const ok = await uiConfirm(`Delete party member "${member.name || "Unnamed"}"?`, { title: "Delete Party Member", okText: "Delete" });
      if (!ok) return;
    }

    if (member.imgBlobId && deleteBlob) {
      try { await deleteBlob(member.imgBlobId); }
      catch (err) { console.warn("Failed to delete party image blob:", err); }
    }

    state.tracker.party = state.tracker.party.filter(m => m.id !== id);
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  }

  function setActiveSection(sectionId) {
    state.tracker.partyActiveSectionId = sectionId;
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  }

  function renderPartyTabs() {
    tabsEl.innerHTML = "";

    const query = (state.tracker.partySearch || "").trim().toLowerCase();
    const sections = state.tracker.partySections || [];
    const activeId = state.tracker.partyActiveSectionId;

    // Sessions-style filtering: show sections if their NAME matches search
    // OR if any member inside matches the search
    let toShow = sections.filter(sec => {
      if (!query) return true;
      const nameMatch = (sec.name || "").toLowerCase().includes(query);
      if (nameMatch) return true;
      return state.tracker.party.some(m => m.sectionId === sec.id && matchesSearch(m, query));
    });

    // If search would hide the active tab, keep it visible
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

  function movePartyCard(id, dir) {
    const q = (state.tracker.partySearch || "").trim();
    const sectionId = state.tracker.partyActiveSectionId;

    const visible = state.tracker.party.filter(m =>
      m.sectionId === sectionId && matchesSearch(m, q)
    );

    const pos = visible.findIndex(m => m.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = state.tracker.party.findIndex(m => m.id === aId);
    const bIdx = state.tracker.party.findIndex(m => m.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    const tmp = state.tracker.party[aIdx];
    state.tracker.party[aIdx] = state.tracker.party[bIdx];
    state.tracker.party[bIdx] = tmp;

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
  searchEl.value = state.tracker.partySearch;
  searchEl.addEventListener("input", () => {
    state.tracker.partySearch = searchEl.value;
    SaveManager.markDirty();
    renderPartyTabs();     // tabs react to search
    renderPartyCards();    // cards react to search
  });

  // Add party member (goes into ACTIVE section)
  addBtn.addEventListener("click", () => {
    const member = makePartyMember();
    member.sectionId = state.tracker.partyActiveSectionId;
    state.tracker.party.unshift(member);
    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  });

  // Section buttons
  addSectionBtn.addEventListener("click", async () => {
    if (!uiPrompt) {
      await uiAlert?.("This action needs the in-app prompt dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }
    const nextNum = (state.tracker.partySections?.length || 0) + 1;
    const proposed = await uiPrompt("New section name:", { defaultValue: `Section ${nextNum}`, title: "New Party Section" });
    if (proposed === null) return;

    const name = proposed.trim() || `Section ${nextNum}`;
    const sec = {
      id: "partysec_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      name
    };
    state.tracker.partySections.push(sec);
    state.tracker.partyActiveSectionId = sec.id;

    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  });

  renameSectionBtn.addEventListener("click", async () => {
    const sec = state.tracker.partySections.find(s => s.id === state.tracker.partyActiveSectionId);
    if (!sec) return;

    if (!uiPrompt) {
      await uiAlert?.("This action needs the in-app prompt dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }

    const proposed = await uiPrompt("Rename section to:", { defaultValue: sec.name || "", title: "Rename Party Section" });
    if (proposed === null) return;

    sec.name = proposed.trim() || sec.name || "Section";
    SaveManager.markDirty();
    renderPartyTabs();
  });

  deleteSectionBtn.addEventListener("click", async () => {
    if ((state.tracker.partySections?.length || 0) <= 1) {
      await uiAlert?.("You need at least one section.", { title: "Notice" });
      return;
    }

    const sec = state.tracker.partySections.find(s => s.id === state.tracker.partyActiveSectionId);
    if (!sec) return;

    if (!uiConfirm) {
      await uiAlert?.("This action needs the in-app confirm dialog, but it isn't available.", { title: "Missing Dialog" });
      return;
    }

    const ok = await uiConfirm(`Delete section "${sec.name}"? Party members in it will be moved to the first section.`, { title: "Delete Party Section", okText: "Delete" });
    if (!ok) return;

    const deleteId = sec.id;
    state.tracker.partySections = state.tracker.partySections.filter(s => s.id !== deleteId);

    const fallbackId = state.tracker.partySections[0].id;
    state.tracker.party.forEach(m => {
      if (m.sectionId === deleteId) m.sectionId = fallbackId;
    });

    state.tracker.partyActiveSectionId = fallbackId;

    SaveManager.markDirty();
    renderPartyTabs();
    renderPartyCards();
  });

  // Initial render
  renderPartyTabs();
  renderPartyCards();

  // Steppers
  if (enhanceNumberSteppers) enhanceNumberSteppers(document);

  return { updateParty, pickPartyImage, deleteParty, renderPartyTabs };
}