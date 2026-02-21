// Phase 3: Sessions UI extracted from app.js
// Renders the Sessions tab strip + notes box and wires the toolbar buttons.

import { attachSearchHighlightOverlay } from "../../../ui/searchHighlightOverlay.js";
import { safeAsync } from "../../../ui/safeAsync.js";

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
let _state = null;
let _setStatus = null;

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
export function initSessionsPanel(deps = {}) {
  _state = deps.state;
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

  if (!_state) {
    console.warn("Sessions UI: missing required dependency (state).");
    return;
  }
  if (!_setStatus) throw new Error("initSessionsPanel requires setStatus");

  if (!_tabsEl || !_notesBox) {
    console.warn("Sessions UI: missing required elements (tabsEl/notesBox).");
    return;
  }

  ensureSessionDefaults();

  // True in-field highlight inside the session notes box
  _notesHl = attachSearchHighlightOverlay(_notesBox, () => (_state.tracker.sessionSearch || ""));

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

  const query = (_state.tracker.sessionSearch || "").trim().toLowerCase();

  // Decide which sessions to show in the tab strip
  const sessionsToShow = (_state.tracker.sessions || [])
    .map((s, idx) => ({ s, idx }))
    .filter(({ s }) => {
      if (!query) return true;
      const title = (s.title || "").toLowerCase();
      const notes = (s.notes || "").toLowerCase();
      return title.includes(query) || notes.includes(query);
    });

  sessionsToShow.forEach(({ s, idx }) => {
    const btn = document.createElement("button");
    btn.className = "sessionTab" + (idx === _state.tracker.activeSessionIndex ? " active" : "");
    btn.type = "button";
    btn.innerHTML = _highlightInline((s.title || `Session ${idx + 1}`), _state.tracker.sessionSearch || "");
    btn.addEventListener("click", () => switchSession(idx));
    _tabsEl.appendChild(btn);
  });

  // Load current notes into box
  const current = _state.tracker.sessions?.[_state.tracker.activeSessionIndex];
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
  if (!Array.isArray(_state.tracker.sessions) || _state.tracker.sessions.length === 0) {
    _state.tracker.sessions = [{ title: "Session 1", notes: "" }];
  }
  if (typeof _state.tracker.activeSessionIndex !== "number") {
    _state.tracker.activeSessionIndex = 0;
  }
  if (_state.tracker.activeSessionIndex < 0) _state.tracker.activeSessionIndex = 0;
  if (_state.tracker.activeSessionIndex >= _state.tracker.sessions.length) {
    _state.tracker.activeSessionIndex = _state.tracker.sessions.length - 1;
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
    _searchEl.value = _state.tracker.sessionSearch || "";
    _searchEl.addEventListener("input", () => {
      _state.tracker.sessionSearch = _searchEl.value;
      markDirty();
      renderSessionTabs();
    });
  }

  // Notes typing saves into active session
  _notesBox.addEventListener("input", () => {
    const cur = _state.tracker.sessions?.[_state.tracker.activeSessionIndex];
    if (!cur) return;
    cur.notes = _notesBox.value;
    markDirty();
  });

  // Add session
  _addBtn?.addEventListener("click", () => {
    // Save current first
    const cur = _state.tracker.sessions?.[_state.tracker.activeSessionIndex];
    if (cur) cur.notes = _notesBox.value;

    const nextNum = (_state.tracker.sessions?.length || 0) + 1;
    _state.tracker.sessions.push({ title: `Session ${nextNum}`, notes: "" });
    _state.tracker.activeSessionIndex = _state.tracker.sessions.length - 1;

    markDirty();
    renderSessionTabs();
    _notesBox.focus();
  });

  // Rename session
  _renameBtn?.addEventListener(
    "click",
    safeAsync(async () => {
      const cur = _state.tracker.sessions?.[_state.tracker.activeSessionIndex];
      if (!cur) return;

      const proposed = await _uiPrompt?.("Rename session tab to:", {
        defaultValue: cur.title || "",
        title: "Rename Session"
      });
      if (proposed === null || proposed === undefined) return; // cancelled

      cur.title = String(proposed).trim() || cur.title || `Session ${_state.tracker.activeSessionIndex + 1}`;
      markDirty();
      renderSessionTabs();
    }, (err) => {
      console.error(err);
      _setStatus("Rename session failed.");
    })
  );

  // Delete session
  _deleteBtn?.addEventListener(
    "click",
    safeAsync(async (e) => {
      if ((_state.tracker.sessions?.length || 0) <= 1) {
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

      const idx = _state.tracker.activeSessionIndex;
      _state.tracker.sessions.splice(idx, 1);
      _state.tracker.activeSessionIndex = Math.max(0, idx - 1);

      markDirty();
      renderSessionTabs();
    }, (err) => {
      console.error(err);
      _setStatus("Delete session failed.");
    })
  );
}

function switchSession(newIndex) {
  // Save current notes before switching
  const cur = _state.tracker.sessions?.[_state.tracker.activeSessionIndex];
  if (cur) cur.notes = _notesBox.value;

  _state.tracker.activeSessionIndex = newIndex;
  markDirty();
  renderSessionTabs();
}
