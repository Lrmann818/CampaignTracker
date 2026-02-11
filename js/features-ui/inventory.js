// Phase 3: Inventory UI (Character -> Equipment panel)
// Makes Inventory behave like Sessions: tabs + notes + toolbar (add/rename/delete/search).
//
// State shape (stored in state.character):
//   inventoryItems: [{ title, notes }]
//   activeInventoryIndex: number
//   inventorySearch: string

import { state } from "../state.js";
import { attachSearchHighlightOverlay } from "../ui/searchHighlightOverlay.js";

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

let _wired = false;

function _escapeHtml(str) {
  return String(str ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}
function _escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function _highlightInline(text, query) {
  const safe = _escapeHtml(text ?? "");
  const q = String(query ?? "").trim();
  if (!q) return safe;
  const re = new RegExp(_escapeRegExp(q), "gi");
  return safe.replace(re, (m) => `<mark class="searchMark">${m}</mark>`);
}

export function initInventoryUI(deps) {
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

  if (!_tabsEl || !_notesBox) {
    console.warn("Inventory UI: missing required elements (tabsEl/notesBox).");
    return;
  }

  ensureInventoryDefaults();

  // True in-field highlight inside the notes box
  _notesHl = attachSearchHighlightOverlay(_notesBox, () => (state.character.inventorySearch || ""));

  if (!_wired) {
    wireHandlers();
    _wired = true;
  }

  renderInventoryTabs();
}

export function renderInventoryTabs() {
  if (!_tabsEl || !_notesBox) return;

  _tabsEl.innerHTML = "";

  const query = (state.character.inventorySearch || "").trim().toLowerCase();

  const items = Array.isArray(state.character.inventoryItems) ? state.character.inventoryItems : [];
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
    btn.className = "sessionTab" + (idx === state.character.activeInventoryIndex ? " active" : "");
    btn.type = "button";
    btn.innerHTML = _highlightInline((it.title || `Item ${idx + 1}`), state.character.inventorySearch || "");
    btn.addEventListener("click", () => switchInventoryItem(idx));
    _tabsEl.appendChild(btn);
  });

  const current = items[state.character.activeInventoryIndex];
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
  const c = state.character;

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
    _searchEl.value = state.character.inventorySearch || "";
    _searchEl.addEventListener("input", () => {
      state.character.inventorySearch = _searchEl.value;
      markDirty();
      renderInventoryTabs();
    });
  }

  // Notes typing saves into active item
  _notesBox.addEventListener("input", () => {
    const cur = state.character.inventoryItems?.[state.character.activeInventoryIndex];
    if (!cur) return;
    cur.notes = _notesBox.value;
    markDirty();
  });

  // Add item
  // Add item (prompt first, cancel aborts)
  _addBtn?.addEventListener("click", async () => {
    // Save current notes into active item before anything else
    const cur = state.character.inventoryItems?.[state.character.activeInventoryIndex];
    if (cur) cur.notes = _notesBox.value;

    const nextNum = (state.character.inventoryItems?.length || 0) + 1;
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
    state.character.inventoryItems.push({
      title: finalTitle,
      notes: ""
    });

    state.character.activeInventoryIndex =
      state.character.inventoryItems.length - 1;

    markDirty();
    renderInventoryTabs();
    _notesBox.focus();
  });


  // Rename item
  _renameBtn?.addEventListener("click", async () => {
    const cur = state.character.inventoryItems?.[state.character.activeInventoryIndex];
    if (!cur) return;

    const proposed = await _uiPrompt?.("Rename item tab to:", {
      defaultValue: cur.title || "",
      title: "Rename Item"
    });
    if (proposed === null || proposed === undefined) return;

    cur.title = String(proposed).trim() || cur.title || `Item ${state.character.activeInventoryIndex + 1}`;
    markDirty();
    renderInventoryTabs();
  });

  // Delete item
  _deleteBtn?.addEventListener("click", async (e) => {
    if ((state.character.inventoryItems?.length || 0) <= 1) {
      await _uiAlert?.("You need at least one inventory item.", { title: "Notice" });
      if (e?.target && "value" in e.target) e.target.value = "";
      return;
    }

    const ok = await _uiConfirm?.("Delete this inventory item? This cannot be undone.", {
      title: "Delete Item",
      okText: "Delete"
    });
    if (!ok) return;

    const idx = state.character.activeInventoryIndex;
    state.character.inventoryItems.splice(idx, 1);
    state.character.activeInventoryIndex = Math.max(0, idx - 1);

    markDirty();
    renderInventoryTabs();
  });
}

function switchInventoryItem(idx) {
  const items = state.character.inventoryItems || [];
  const current = items[state.character.activeInventoryIndex];
  if (current) current.notes = _notesBox.value;

  state.character.activeInventoryIndex = idx;

  markDirty();
  renderInventoryTabs();
  _notesBox.focus();
}
