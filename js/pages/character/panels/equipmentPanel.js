// Character Equipment panel (Inventory + Money).
// Inventory uses tabbed notes + toolbar actions (add/rename/delete/search).
//
// State shape (stored in state.character):
//   inventoryItems: [{ title, notes }]
//   activeInventoryIndex: number
//   inventorySearch: string

import { bindNumber } from "../../../ui/bindings.js";
import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";
import { safeAsync } from "../../../ui/safeAsync.js";
import { requireEl, getNoopDestroyApi } from "../../../utils/domGuards.js";
let _state = null;

let _tabsEl = null;
let _notesBox = null;
let _searchEl = null;
let _addBtn = null;
let _renameBtn = null;
let _deleteBtn = null;
let _notesHl = null;

let _SaveManager = null;
let _uiPrompt = null;
let _uiAlert = null;
let _uiConfirm = null;
let _setStatus = null;

let _wired = false;

function _escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _appendHighlightedText(parentEl, text, query) {
  const source = String(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) {
    parentEl.replaceChildren(document.createTextNode(source));
    return;
  }

  const re = new RegExp(_escapeRegExp(q), "gi");
  const fragment = document.createDocumentFragment();
  let lastIndex = 0;
  let match = re.exec(source);

  while (match) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(source.slice(lastIndex, start)));
    }

    const mark = document.createElement("mark");
    mark.className = "searchMark";
    mark.textContent = source.slice(start, end);
    fragment.appendChild(mark);

    lastIndex = end;
    match = re.exec(source);
  }

  if (lastIndex < source.length) {
    fragment.appendChild(document.createTextNode(source.slice(lastIndex)));
  }

  parentEl.replaceChildren(fragment);
}

function initInventoryUI(deps = {}) {
  _state = deps.state ?? _state;

  if (!_state) {
    console.warn("Inventory UI: missing required dependency (state).");
    return;
  }

  _tabsEl = deps.tabsEl;
  _notesBox = deps.notesBox;
  _searchEl = deps.searchEl;
  _addBtn = deps.addBtn;
  _renameBtn = deps.renameBtn;
  _deleteBtn = deps.deleteBtn;

  _SaveManager = deps.SaveManager;
  _uiPrompt = deps.uiPrompt;
  _uiAlert = deps.uiAlert;
  _uiConfirm = deps.uiConfirm;
  _setStatus = deps.setStatus;
  if (!_setStatus) throw new Error("initInventoryUI requires setStatus");

  const missingCritical =
    !_tabsEl || !_notesBox || !_searchEl || !_addBtn || !_renameBtn || !_deleteBtn;
  if (missingCritical) {
    _setStatus("Equipment inventory unavailable (missing expected UI elements).", { stickyMs: 5000 });
    return getNoopDestroyApi();
  }

  ensureInventoryDefaults();

  // True in-field highlight inside the notes box
  _notesHl = attachSearchHighlightOverlay(_notesBox, () => (_state.character.inventorySearch || ""));

  if (!_wired) {
    wireHandlers();
    _wired = true;
  }

  renderInventoryTabs();
}

function renderInventoryTabs() {
  if (!_tabsEl || !_notesBox) return;

  _tabsEl.replaceChildren();

  const query = (_state.character.inventorySearch || "").trim().toLowerCase();

  const items = Array.isArray(_state.character.inventoryItems) ? _state.character.inventoryItems : [];
  const itemsToShow = items
    .map((it, idx) => ({ it, idx }))
    .filter(({ it }) => {
      if (!query) return true;
      const title = (it.title || "").toLowerCase();
      const notes = (it.notes || "").toLowerCase();
      return title.includes(query) || notes.includes(query);
    });

  itemsToShow.forEach(({ it, idx }) => {
    const btn = document.createElement("button");
    btn.className = "sessionTab" + (idx === _state.character.activeInventoryIndex ? " active" : "");
    btn.type = "button";
    _appendHighlightedText(btn, (it.title || `Item ${idx + 1}`), _state.character.inventorySearch || "");
    btn.addEventListener("click", () => switchInventoryItem(idx));
    _tabsEl.appendChild(btn);
  });

  const current = items[_state.character.activeInventoryIndex];
  _notesBox.value = current?.notes || "";
  if (_notesHl) _notesHl.update();

  if (itemsToShow.length === 0) {
    const hint = document.createElement("div");
    hint.className = "mutedSmall";
    hint.style.marginLeft = "6px";
    hint.textContent = "No matching items.";
    _tabsEl.appendChild(hint);
  }
}

function ensureInventoryDefaults() {
  const c = _state.character;

  // Migrate legacy single textarea into first tab, once.
  if (!Array.isArray(c.inventoryItems)) {
    const legacy = typeof c.equipment === "string" ? c.equipment : "";
    c.inventoryItems = [{ title: "Inventory", notes: legacy || "" }];
  }
  // If we already have inventoryItems (due to defaults/merge) but they're empty
  // and legacy equipment has text, migrate it once.
  else {
    const legacy = typeof c.equipment === "string" ? c.equipment : "";
    const hasAnyNotes = c.inventoryItems.some(it => (it && typeof it.notes === "string" && it.notes.trim()));
    if (!hasAnyNotes && legacy && String(legacy).trim()) {
      if (!c.inventoryItems[0]) c.inventoryItems[0] = { title: "Inventory", notes: "" };
      if (!c.inventoryItems[0].notes || !String(c.inventoryItems[0].notes).trim()) {
        c.inventoryItems[0].notes = legacy;
      }
      if (!c.inventoryItems[0].title) c.inventoryItems[0].title = "Inventory";
    }
  }

  if (c.inventoryItems.length === 0) {
    c.inventoryItems.push({ title: "Inventory", notes: "" });
  }
  if (typeof c.activeInventoryIndex !== "number") c.activeInventoryIndex = 0;
  if (c.activeInventoryIndex < 0) c.activeInventoryIndex = 0;
  if (c.activeInventoryIndex >= c.inventoryItems.length) c.activeInventoryIndex = c.inventoryItems.length - 1;
  if (typeof c.inventorySearch !== "string") c.inventorySearch = "";
}

function markDirty() {
  try { _SaveManager?.markDirty?.(); } catch { /* ignore */ }
}

function wireHandlers() {
  // Search
  if (_searchEl) {
    _searchEl.value = _state.character.inventorySearch || "";
    _searchEl.addEventListener("input", () => {
      _state.character.inventorySearch = _searchEl.value;
      markDirty();
      renderInventoryTabs();
    });
  }

  // Notes typing saves into active item
  _notesBox.addEventListener("input", () => {
    const cur = _state.character.inventoryItems?.[_state.character.activeInventoryIndex];
    if (!cur) return;
    cur.notes = _notesBox.value;
    markDirty();
  });

  // Add item (prompt first, cancel aborts)
  _addBtn?.addEventListener(
    "click",
    safeAsync(async () => {
    // Save current notes into active item before anything else
    const cur = _state.character.inventoryItems?.[_state.character.activeInventoryIndex];
    if (cur) cur.notes = _notesBox.value;

    const nextNum = (_state.character.inventoryItems?.length || 0) + 1;
    const defaultTitle = `Item ${nextNum}`;

    // Ask for name BEFORE creating item
    const proposed = await _uiPrompt?.("Name this item:", {
      defaultValue: defaultTitle,
      title: "New Inventory Item"
    });

    // If user cancels → abort entirely
    if (proposed === null || proposed === undefined) {
      return;
    }

    const name = String(proposed).trim();
    const finalTitle = name || defaultTitle;

    // Now create the item
    _state.character.inventoryItems.push({
      title: finalTitle,
      notes: ""
    });

    _state.character.activeInventoryIndex =
      _state.character.inventoryItems.length - 1;

    markDirty();
    renderInventoryTabs();
      _notesBox.focus();
    }, (err) => {
      console.error(err);
      _setStatus("Add inventory item failed.");
    })
  );


  // Rename item
  _renameBtn?.addEventListener(
    "click",
    safeAsync(async () => {
    const cur = _state.character.inventoryItems?.[_state.character.activeInventoryIndex];
    if (!cur) return;

    const proposed = await _uiPrompt?.("Rename item tab to:", {
      defaultValue: cur.title || "",
      title: "Rename Item"
    });
    if (proposed === null || proposed === undefined) return;

    cur.title = String(proposed).trim() || cur.title || `Item ${_state.character.activeInventoryIndex + 1}`;
    markDirty();
      renderInventoryTabs();
    }, (err) => {
      console.error(err);
      _setStatus("Rename inventory item failed.");
    })
  );

  // Delete item
  _deleteBtn?.addEventListener(
    "click",
    safeAsync(async (e) => {
    if ((_state.character.inventoryItems?.length || 0) <= 1) {
      await _uiAlert?.("You need at least one inventory item.", { title: "Notice" });
      if (e?.target && "value" in e.target) e.target.value = "";
      return;
    }

    const ok = await _uiConfirm?.("Delete this inventory item? This cannot be undone.", {
      title: "Delete Item",
      okText: "Delete"
    });
    if (!ok) return;

    const idx = _state.character.activeInventoryIndex;
    _state.character.inventoryItems.splice(idx, 1);
    _state.character.activeInventoryIndex = Math.max(0, idx - 1);

    markDirty();
      renderInventoryTabs();
    }, (err) => {
      console.error(err);
      _setStatus("Delete inventory item failed.");
    })
  );
}

function switchInventoryItem(idx) {
  const items = _state.character.inventoryItems || [];
  const current = items[_state.character.activeInventoryIndex];
  if (current) current.notes = _notesBox.value;

  _state.character.activeInventoryIndex = idx;

  markDirty();
  renderInventoryTabs();
  _notesBox.focus();
}

export function initEquipmentPanel(deps = {}) {
  const { 
    state,
    SaveManager, 
    uiPrompt, 
    uiAlert, 
    uiConfirm, 
    autoSizeInput,
    setStatus
  } = deps;
  _state = state;

  if (!_state) {
    console.warn("initEquipmentPanel: missing state");
    return;
  }
  if (!setStatus) throw new Error("initEquipmentPanel requires setStatus");

  const panelEl = requireEl("#charEquipmentPanel", document, { prefix: "initEquipmentPanel", warn: false });
  const criticalSelectors = [
    "#inventoryTabs",
    "#inventoryNotesBox",
    "#inventorySearch",
    "#addInventoryBtn",
    "#renameInventoryBtn",
    "#deleteInventoryBtn",
    "#moneyPP",
    "#moneyGP",
    "#moneyEP",
    "#moneySP",
    "#moneyCP"
  ];
  const missingCriticalField = criticalSelectors.some(
    (selector) => !requireEl(selector, document, { prefix: "initEquipmentPanel", warn: false })
  );
  if (!panelEl || missingCriticalField) {
    setStatus("Equipment panel unavailable (missing expected UI elements).", { stickyMs: 5000 });
    return getNoopDestroyApi();
  }

  // ---- Inventory tabs UI ----
  initInventoryUI({
    tabsEl: document.getElementById("inventoryTabs"),
    notesBox: document.getElementById("inventoryNotesBox"),
    searchEl: document.getElementById("inventorySearch"),
    addBtn: document.getElementById("addInventoryBtn"),
    renameBtn: document.getElementById("renameInventoryBtn"),
    deleteBtn: document.getElementById("deleteInventoryBtn"),
    SaveManager,
    uiPrompt,
    uiAlert,
    uiConfirm,
    setStatus,
  });

  // ---- Money tiles ----
  const ensureMoney = () => {
    if (!_state?.character) return;
    if (!_state.character.money) _state.character.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
  };

  ensureMoney();

  const bindMoney = (id, key) =>
    bindNumber({
      id,
      get: () => _state.character.money?.[key],
      set: (v) => {
        ensureMoney();
        _state.character.money[key] = (v ?? 0);
      },
      SaveManager,
      autoSizeInput,
      autosizeOpts: { min: 30, max: 320 }, // money wants to grow wider
    });

  bindMoney("moneyPP", "pp");
  bindMoney("moneyGP", "gp");
  bindMoney("moneyEP", "ep");
  bindMoney("moneySP", "sp");
  bindMoney("moneyCP", "cp");
}
