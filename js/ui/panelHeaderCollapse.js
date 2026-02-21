// @ts-nocheck
// js/ui/panelHeaderCollapse.js
// Click a panel's header to collapse/expand its body (header stays visible).
import { createStateActions } from "../domain/stateActions.js";
import { getNoopDestroyApi } from "../utils/domGuards.js";

/** @type {(() => void) | null} */
let activePanelHeaderCollapseDestroy = null;

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

function isCollapsedState(state, key) {
  return state?.ui?.panelCollapsed?.[key] === true;
}

function applyCollapsedUi(panelEl, next) {
  panelEl.dataset.collapsed = next ? "true" : "false";
  // Nice-to-have for accessibility; harmless if header isn't a button.
  panelEl.setAttribute("aria-expanded", next ? "false" : "true");
}

function resolveSetPathHelper({ state, SaveManager, actions, setPath }) {
  if (actions && typeof actions.setPath === "function") return actions.setPath.bind(actions);
  if (typeof setPath === "function") return setPath;

  const localActions = createStateActions({ state, SaveManager });
  if (typeof localActions.setPath === "function") return localActions.setPath;

  return null;
}

function resolveTargetPanelElement({ key, headerEl, fallbackPanelEl }) {
  if (key) {
    const byId = document.getElementById(key);
    if (byId && byId.matches?.("section.panel")) return byId;

    const byDataPanel = Array
      .from(document.querySelectorAll("section.panel[data-panel]"))
      .find((el) => el.dataset?.panel === key);
    if (byDataPanel) return byDataPanel;
  }

  const byHeaderAncestor = headerEl?.closest?.("section.panel");
  if (byHeaderAncestor) return byHeaderAncestor;

  if (fallbackPanelEl && document.contains(fallbackPanelEl)) return fallbackPanelEl;
  return null;
}

function getPanelLabel({ key, headerEl, fallbackPanelEl }) {
  if (key) return key;
  const fromHeaderText = headerEl?.querySelector?.("h2")?.textContent;
  const fromPanel = fallbackPanelEl?.id || fallbackPanelEl?.dataset?.panel;
  const label = String(fromHeaderText || fromPanel || "").trim();
  return label || "<unknown panel>";
}

export function initPanelHeaderCollapse({ state, SaveManager, setStatus, actions, setPath } = {}) {
  if (!state) throw new Error("initPanelHeaderCollapse: state is required");
  const setPathAction = resolveSetPathHelper({ state, SaveManager, actions, setPath });
  if (typeof setPathAction !== "function") {
    throw new Error("initPanelHeaderCollapse: expected actions.setPath or setPath helper");
  }
  if (typeof activePanelHeaderCollapseDestroy === "function") {
    activePanelHeaderCollapseDestroy();
  }

  const ac = new AbortController();
  const { signal } = ac;
  let destroyed = false;
  /** @type {HTMLElement[]} */
  const boundHeaders = [];

  const panels = Array.from(document.querySelectorAll("section.panel"));
  if (!panels.length) {
    setStatus?.("Panel collapse controls unavailable (no .panel sections found).", { stickyMs: 5000 });
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
    boundHeaders.push(headerEl);

    headerEl.classList.add("panelHeaderClickable");

    // Apply initial state (CSS hides everything except the header)
    applyCollapsedUi(panelEl, isCollapsedState(state, key));

    headerEl.addEventListener(
      "click",
      (e) => {
        // Don't collapse when clicking header controls
        if (isInteractive(e.target)) return;

        const targetPanelEl = resolveTargetPanelElement({ key, headerEl, fallbackPanelEl: panelEl });
        if (!targetPanelEl) {
          const panelLabel = getPanelLabel({ key, headerEl, fallbackPanelEl: panelEl });
          const message = `Panel unavailable (missing DOM): ${panelLabel}`;
          setStatus?.(message);
          console.warn("initPanelHeaderCollapse: target panel missing on click", {
            panelKey: key,
            panelLabel,
            selectorsTried: [
              "document.getElementById(<panel key>) as section.panel",
              "section.panel[data-panel=<panel key>]",
              "headerEl.closest('section.panel')",
            ],
            headerEl,
          });
          return;
        }

        const next = !isCollapsedState(state, key);
        const updated = setPathAction(`ui.panelCollapsed.${key}`, next);
        if (updated === false) {
          console.warn("initPanelHeaderCollapse: failed to update collapsed state", { panelKey: key, next });
          return;
        }
        applyCollapsedUi(targetPanelEl, next);
      },
      { signal }
    );
  });

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    ac.abort();
    boundHeaders.forEach((headerEl) => {
      headerEl?.removeAttribute?.("data-panel-collapse-bound");
    });
    boundHeaders.length = 0;
    if (activePanelHeaderCollapseDestroy === destroy) {
      activePanelHeaderCollapseDestroy = null;
    }
  };
  activePanelHeaderCollapseDestroy = destroy;

  return { destroy };
}
