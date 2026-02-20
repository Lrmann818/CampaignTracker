// Phase 3: Sessions UI extracted from app.js
// Renders the Sessions tab strip + notes box and wires the toolbar buttons.

import { state } from "../../../state.js";
import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";

let _tabsEl = null;
let _notesBox = null;
let _searchEl = null;
let _addBtn = null;
let _renameBtn = null;
let _deleteBtn = null;
let _notesHl = null;

// Injected services (still live in app.js)
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


/**
 * Initialize Sessions UI.
 *
 * deps = {
 *   tabsEl, notesBox, searchEl, addBtn, renameBtn, deleteBtn,
 *   SaveManager, uiPrompt, uiAlert, uiConfirm
 * }
 */
export function initSessionsUI(deps) {
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
    console.warn("Sessions UI: missing required elements (tabsEl/notesBox).");
    return;
  }

  ensureSessionDefaults();

  // True in-field highlight inside the session notes box
  _notesHl = attachSearchHighlightOverlay(_notesBox, () => (state.tracker.sessionSearch || ""));

  // Wire handlers only once (setupTracker can run more than once in some refactors)
  if (!_wired) {
    wireHandlers();
    _wired = true;
  }

  renderSessionTabs();
}

function renderSessionTabs() {
  if (!_tabsEl || !_notesBox) return;

  _tabsEl.innerHTML = "";

  const query = (state.tracker.sessionSearch || "").trim().toLowerCase();

  // Decide which sessions to show in the tab strip
  const sessionsToShow = (state.tracker.sessions || [])
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => {
      if (!query) return true;
      const title = (s.title || "").toLowerCase();
      const notes = (s.notes || "").toLowerCase();
      return title.includes(query) || notes.includes(query);
    });

  sessionsToShow.forEach(({ s, idx }) => {
    const btn = document.createElement("button");
    btn.className = "sessionTab" + (idx === state.tracker.activeSessionIndex ? " active" : "");
    btn.type = "button";
    btn.innerHTML = _highlightInline((s.title || `Session ${idx + 1}`), state.tracker.sessionSearch || "");
    btn.addEventListener("click", () => switchSession(idx));
    _tabsEl.appendChild(btn);
  });

  // Load current notes into box
  const current = state.tracker.sessions?.[state.tracker.activeSessionIndex];
  _notesBox.value = current?.notes || "";
  if (_notesHl) _notesHl.update();

  // Optional: if there are no matches, show a tiny hint
  if (sessionsToShow.length === 0) {
    const hint = document.createElement("div");
    hint.className = "mutedSmall";
    hint.style.marginLeft = "6px";
    hint.textContent = "No matching sessions.";
    _tabsEl.appendChild(hint);
  }
}

function ensureSessionDefaults() {
  if (!Array.isArray(state.tracker.sessions) || state.tracker.sessions.length === 0) {
    state.tracker.sessions = [{ title: "Session 1", notes: "" }];
  }
  if (typeof state.tracker.activeSessionIndex !== "number") {
    state.tracker.activeSessionIndex = 0;
  }
  if (state.tracker.activeSessionIndex < 0) state.tracker.activeSessionIndex = 0;
  if (state.tracker.activeSessionIndex >= state.tracker.sessions.length) {
    state.tracker.activeSessionIndex = state.tracker.sessions.length - 1;
  }
}

function markDirty() {
  try {
    _SaveManager?.markDirty?.();
  } catch {
    // ignore
  }
}

function wireHandlers() {
  // Search
  if (_searchEl) {
    _searchEl.value = state.tracker.sessionSearch || "";
    _searchEl.addEventListener("input", () => {
      state.tracker.sessionSearch = _searchEl.value;
      markDirty();
      renderSessionTabs();
    });
  }

  // Notes typing saves into active session
  _notesBox.addEventListener("input", () => {
    const cur = state.tracker.sessions?.[state.tracker.activeSessionIndex];
    if (!cur) return;
    cur.notes = _notesBox.value;
    markDirty();
  });

  // Add session
  _addBtn?.addEventListener("click", () => {
    // Save current first
    const cur = state.tracker.sessions?.[state.tracker.activeSessionIndex];
    if (cur) cur.notes = _notesBox.value;

    const nextNum = (state.tracker.sessions?.length || 0) + 1;
    state.tracker.sessions.push({ title: `Session ${nextNum}`, notes: "" });
    state.tracker.activeSessionIndex = state.tracker.sessions.length - 1;

    markDirty();
    renderSessionTabs();
    _notesBox.focus();
  });

  // Rename session
  _renameBtn?.addEventListener("click", async () => {
    const cur = state.tracker.sessions?.[state.tracker.activeSessionIndex];
    if (!cur) return;

    const proposed = await _uiPrompt?.("Rename session tab to:", {
      defaultValue: cur.title || "",
      title: "Rename Session"
    });
    if (proposed === null || proposed === undefined) return; // cancelled

    cur.title = String(proposed).trim() || cur.title || `Session ${state.tracker.activeSessionIndex + 1}`;
    markDirty();
    renderSessionTabs();
  });

  // Delete session
  _deleteBtn?.addEventListener("click", async (e) => {
    if ((state.tracker.sessions?.length || 0) <= 1) {
      await _uiAlert?.("You need at least one session.", { title: "Notice" });
      // (legacy) some handlers tried to clear inputs; keep harmless
      if (e?.target && "value" in e.target) e.target.value = "";
      return;
    }

    const ok = await _uiConfirm?.("Delete this session? This cannot be undone.", {
      title: "Delete Session",
      okText: "Delete"
    });
    if (!ok) return;

    const idx = state.tracker.activeSessionIndex;
    state.tracker.sessions.splice(idx, 1);
    state.tracker.activeSessionIndex = Math.max(0, idx - 1);

    markDirty();
    renderSessionTabs();
  });
}

function switchSession(newIndex) {
  // Save current notes before switching
  const cur = state.tracker.sessions?.[state.tracker.activeSessionIndex];
  if (cur) cur.notes = _notesBox.value;

  state.tracker.activeSessionIndex = newIndex;
  markDirty();
  renderSessionTabs();
}