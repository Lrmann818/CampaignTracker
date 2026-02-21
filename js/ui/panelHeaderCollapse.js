// @ts-nocheck
// js/ui/panelHeaderCollapse.js
// Click a panel's header to collapse/expand its body (header stays visible).
import { getNoopDestroyApi } from "../utils/domGuards.js";

function ensureObj(obj, key) {
  if (!obj[key] || typeof obj[key] !== "object") obj[key] = {};
  return obj[key];
}

function isInteractive(target) {
  return !!target?.closest?.(
    "button, input, select, textarea, a, label, summary, [role='button'], [role='link']"
  );
}

function getPanelKey(panelEl) {
  return panelEl?.id || panelEl?.dataset?.panel || null;
}

function findHeader(panelEl) {
  // Prefer explicit marker.
  const explicit = panelEl.querySelector(":scope > [data-panel-header]");
  if (explicit) return explicit;

  // Common pattern: header bar div containing an H2 and controls.
  const first = panelEl.firstElementChild;
  if (first && first.matches(".row, .panelHeader, .panelTop")) {
    if (first.querySelector("h2")) return first;
  }

  // Fallback: first H2 in the panel.
  const h2 = panelEl.querySelector(":scope > h2") || panelEl.querySelector("h2");
  if (h2) return h2;

  return null;
}

function setCollapsed(panelEl, key, collapsedMap, next, SaveManager) {
  collapsedMap[key] = !!next;
  panelEl.dataset.collapsed = next ? "true" : "false";
  // Nice-to-have for accessibility; harmless if header isn't a button.
  panelEl.setAttribute("aria-expanded", next ? "false" : "true");
  SaveManager.markDirty();
}

export function initPanelHeaderCollapse({ state, SaveManager, setStatus } = {}) {
  if (!state) throw new Error("initPanelHeaderCollapse: state is required");
  if (!SaveManager) throw new Error("initPanelHeaderCollapse: SaveManager is required");

  ensureObj(state, "ui");
  const collapsedMap = ensureObj(state.ui, "panelCollapsed");

  const panels = Array.from(document.querySelectorAll("section.panel"));
  if (!panels.length) {
    setStatus?.("Panel collapse controls unavailable (no .panel sections found).");
    return getNoopDestroyApi();
  }
  panels.forEach((panelEl) => {
    const key = getPanelKey(panelEl);
    if (!key) return;

    let headerEl = findHeader(panelEl);
    if (!headerEl) return;

    // CSS rule only preserves direct children, so promote the header to the
    // nearest direct-child wrapper when needed.
    while (headerEl && headerEl.parentElement && headerEl.parentElement !== panelEl) {
      headerEl = headerEl.parentElement;
    }
    if (!headerEl || headerEl.parentElement !== panelEl) return;

    // Ensure we have a stable selector for CSS to keep this visible.
    // (Some panels only have an <h2> as their header.)
    if (!headerEl.hasAttribute("data-panel-header")) headerEl.setAttribute("data-panel-header", "");

    // Idempotency (avoid double-binding when pages re-init)
    if (headerEl.dataset.panelCollapseBound === "1") return;
    headerEl.dataset.panelCollapseBound = "1";

    headerEl.classList.add("panelHeaderClickable");

    // Apply initial state (CSS hides everything except the header)
    const isCollapsed = collapsedMap[key] === true;
    panelEl.dataset.collapsed = isCollapsed ? "true" : "false";
    panelEl.setAttribute("aria-expanded", isCollapsed ? "false" : "true");

    headerEl.addEventListener("click", (e) => {
      // Don't collapse when clicking header controls
      if (isInteractive(e.target)) return;

      const next = !(collapsedMap[key] === true);
      setCollapsed(panelEl, key, collapsedMap, next, SaveManager);
    });
  });
}
