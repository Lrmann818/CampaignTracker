// @ts-check
// js/ui/pagePanelReorder.js
//
// Generic two-column panel reordering with persisted order, mobile single-column,
// and injected ↑/↓ move buttons.
//
// This is intentionally “headless”: page modules provide selectors + header wiring.

import { DEV_MODE } from "../utils/dev.js";
import { requireEl, requireMany, getNoopDestroyApi } from "../utils/domGuards.js";
import { flipSwapTwo } from "./flipSwap.js";

/** @typedef {{ markDirty?: () => void }} SaveManagerLike */
/** @typedef {{ sectionOrder?: string[] }} StoredSectionOrder */
/** @typedef {{ [key: string]: unknown }} PagePanelUiState */
/** @typedef {(message: string, opts?: { stickyMs?: number }) => void} SetStatusFn */
/** @typedef {(state: unknown) => object | null | undefined} GetUiStateFn */
/** @typedef {(panelId: string, pageEl: HTMLElement, panelEl: HTMLElement) => HTMLElement | null | undefined} GetHeaderElFn */
/** @typedef {(panelEl: HTMLElement) => HTMLElement | null | undefined} EnsureHeaderRowFn */
/** @typedef {-1 | 1} ReorderDirection */
/** @typedef {{ id: string, panelEl: HTMLElement }} ReorderableSectionMeta */
/** @typedef {{ pageEl: HTMLElement, columnsWrap: HTMLElement, col0: HTMLElement, col1: HTMLElement }} PagePanelDomRefs */
/** @typedef {{ activePanelId: string | null, targetPanelId: string | null }} PagePanelDragState */
/**
 * @typedef {{
 *   state?: unknown,
 *   SaveManager?: SaveManagerLike,
 *   pageId?: string,
 *   columnsWrapSelectors?: readonly string[],
 *   col0Selector?: string,
 *   col1Selector?: string,
 *   panelSelector?: string,
 *   getUiState?: GetUiStateFn,
 *   orderKey?: string,
 *   getHeaderEl?: GetHeaderElFn | null,
 *   ensureHeaderRow?: EnsureHeaderRowFn | null,
 *   breakpointQuery?: string,
 *   storeApplyFnKey?: string | null,
 *   setStatus?: SetStatusFn | null
 * }} PagePanelReorderOptions
 */
/** @typedef {{ applyOrder?: () => void, destroy: () => void }} PagePanelReorderApi */

/** @type {Map<string, () => void>} */
const activePagePanelReorderDestroyByPage = new Map();

/**
 * @param {Element | null | undefined} value
 * @returns {value is HTMLElement}
 */
function isHtmlElement(value) {
  return value instanceof HTMLElement;
}

/**
 * @param {unknown} value
 * @returns {string | null}
 */
function asNonEmptyString(value) {
  return typeof value === "string" && value.length > 0 ? value : null;
}

/**
 * @param {HTMLElement} el
 * @param {string} key
 * @returns {string | null}
 */
function getDatasetValue(el, key) {
  return asNonEmptyString(el.dataset[key]);
}

/**
 * @param {string} id
 * @returns {HTMLElement | null}
 */
function getHtmlElementById(id) {
  const el = document.getElementById(id);
  return isHtmlElement(el) ? el : null;
}

/**
 * @param {number | string | null | undefined} value
 * @returns {number | null}
 */
function parseIndex(value) {
  const parsed = typeof value === "number"
    ? value
    : typeof value === "string"
      ? Number.parseInt(value, 10)
      : NaN;
  return Number.isInteger(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * @param {MouseEvent} event
 * @returns {HTMLButtonElement | null}
 */
function getButtonFromEvent(event) {
  const currentTarget = event.currentTarget;
  if (currentTarget instanceof HTMLButtonElement) return currentTarget;
  const target = event.target;
  return target instanceof HTMLButtonElement ? target : null;
}

/**
 * @returns {PagePanelDragState}
 */
function createIdleDragState() {
  return { activePanelId: null, targetPanelId: null };
}

/**
 * @param {HTMLElement} headerEl
 * @param {string} panelId
 * @returns {boolean}
 */
function hasSectionMoveWrap(headerEl, panelId) {
  return Array.from(headerEl.children).some((child) => isHtmlElement(child) && getDatasetValue(child, "sectionMoves") === panelId);
}

/**
 * @param {HTMLElement} panelEl
 * @returns {ReorderableSectionMeta | null}
 */
function toReorderableSection(panelEl) {
  const id = asNonEmptyString(panelEl.id);
  return id ? { id, panelEl } : null;
}

/**
 * @param {ReorderableSectionMeta | null} section
 * @returns {section is ReorderableSectionMeta}
 */
function isReorderableSection(section) {
  return section !== null;
}

/**
 * @param {PagePanelUiState & StoredSectionOrder} ui
 * @param {string} orderKey
 * @returns {string[] | null}
 */
function getStoredOrderValue(ui, orderKey) {
  const value = ui[orderKey];
  if (!Array.isArray(value)) return null;
  return value.every((id) => typeof id === "string" && id.length > 0)
    ? /** @type {string[]} */ (value)
    : null;
}

/**
 * @param {PagePanelUiState & StoredSectionOrder} ui
 * @param {string} orderKey
 * @param {string[]} order
 * @returns {string[]}
 */
function setStoredOrderValue(ui, orderKey, order) {
  ui[orderKey] = order;
  return order;
}

/**
 * @param {PagePanelUiState} ui
 * @param {string | null} storeApplyFnKey
 * @param {() => void} applyOrder
 * @returns {void}
 */
function storeApplyFn(ui, storeApplyFnKey, applyOrder) {
  if (!storeApplyFnKey) return;
  ui[storeApplyFnKey] = applyOrder;
}

/**
 * @param {PagePanelUiState} ui
 * @param {string | null} storeApplyFnKey
 * @param {() => void} applyOrder
 * @returns {void}
 */
function clearStoredApplyFn(ui, storeApplyFnKey, applyOrder) {
  if (!storeApplyFnKey) return;
  if (ui[storeApplyFnKey] === applyOrder) {
    delete ui[storeApplyFnKey];
  }
}

/**
 * @param {PagePanelReorderOptions} [options]
 * @returns {PagePanelReorderApi}
 */
export function setupPagePanelReorder({
  state,
  SaveManager,

  // DOM wiring
  pageId,
  columnsWrapSelectors, // array of selectors to try, in order
  col0Selector,
  col1Selector,
  panelSelector,

  // State wiring
  getUiState,           // (state) => object (must be stable, creates .ui if needed)
  orderKey = "sectionOrder",

  // Header wiring
  // If provided: (panelId, pageEl, panelEl) => headerEl to append buttons into.
  getHeaderEl = null,

  // Optional: if header not found, a factory to create/normalize one
  // (panelEl) => headerEl | null
  ensureHeaderRow = null,

  // Behavior
  breakpointQuery = "(max-width: 600px)",
  storeApplyFnKey = null, // e.g. "_applySectionOrder" if you want to expose applyOrder
  setStatus = null,
} = {}) {
  const destroyKey = pageId ? String(pageId) : "";
  if (destroyKey) {
    const prevDestroy = activePagePanelReorderDestroyByPage.get(destroyKey);
    if (typeof prevDestroy === "function") prevDestroy();
  }

  const prefix = `setupPagePanelReorder(${pageId || "unknown"})`;
  const pageGuard = requireMany(
    { pageEl: `#${pageId}` },
    { root: document, setStatus, context: `Panel reorder (${pageId || "unknown"})` }
  );
  if (!pageGuard.ok) return /** @type {PagePanelReorderApi} */ (pageGuard.destroy || getNoopDestroyApi());
  const { pageEl } = /** @type {{ pageEl?: Element }} */ (pageGuard.els);
  if (!isHtmlElement(pageEl)) return /** @type {PagePanelReorderApi} */ (getNoopDestroyApi());

  /** @type {HTMLElement | null} */
  let columnsWrap = null;
  for (const sel of (columnsWrapSelectors || [])) {
    const candidate = requireEl(sel, pageEl, { prefix, warn: false });
    if (!isHtmlElement(candidate)) continue;
    columnsWrap = candidate;
    break;
  }
  if (!columnsWrap) {
    const message = `Panel reorder unavailable (missing columns wrapper; tried selectors: ${(columnsWrapSelectors || []).join(", ")}).`;
    if (DEV_MODE) throw new Error(message);
    if (typeof setStatus === "function") setStatus(message, { stickyMs: 5000 });
    else console.warn(message);
    return getNoopDestroyApi();
  }

  const columnsGuard = requireMany(
    { col0: col0Selector, col1: col1Selector },
    { root: columnsWrap, setStatus, context: `Panel reorder (${pageId || "unknown"})` }
  );
  if (!columnsGuard.ok) return /** @type {PagePanelReorderApi} */ (columnsGuard.destroy || getNoopDestroyApi());
  const { col0, col1 } = /** @type {{ col0?: Element, col1?: Element }} */ (columnsGuard.els);
  if (!isHtmlElement(col0) || !isHtmlElement(col1)) {
    return /** @type {PagePanelReorderApi} */ (getNoopDestroyApi());
  }

  /** @type {PagePanelDomRefs} */
  const dom = { pageEl, columnsWrap, col0, col1 };

  const ui = getUiState?.(state);
  if (!ui || typeof ui !== "object") return /** @type {PagePanelReorderApi} */ (getNoopDestroyApi());
  const reorderUi = /** @type {PagePanelUiState & StoredSectionOrder} */ (ui);

  const ac = new AbortController();
  const { signal } = ac;
  let destroyed = false;
  /** @type {HTMLElement[]} */
  const createdMoveWraps = [];
  const dragState = createIdleDragState();

  // Collect panels (wherever they currently live inside wrapper)
  const sections = Array.from(dom.columnsWrap.querySelectorAll(panelSelector || "section.panel"))
    .filter(isHtmlElement)
    .map(toReorderableSection)
    .filter(isReorderableSection);
  const defaultOrder = sections.map((section) => section.id);

  // Normalize stored order
  const storedOrder = getStoredOrderValue(reorderUi, orderKey);
  if (!storedOrder || storedOrder.length === 0) {
    setStoredOrderValue(reorderUi, orderKey, defaultOrder.slice());
  } else {
    const set = new Set(defaultOrder);
    const cleaned = storedOrder.filter((id) => set.has(id));
    for (const id of defaultOrder) {
      if (!cleaned.includes(id)) cleaned.push(id);
    }
    setStoredOrderValue(reorderUi, orderKey, cleaned);
  }

  /**
   * @returns {string[]}
   */
  function getOrder() {
    const current = getStoredOrderValue(reorderUi, orderKey);
    if (current) return current;
    return setStoredOrderValue(reorderUi, orderKey, defaultOrder.slice());
  }

  /**
   * @param {HTMLElement} col
   * @returns {Node[]}
   */
  function liftNonPanelChildren(col) {
    const selector = panelSelector || "section.panel";
    const preserved = [];
    for (const child of Array.from(col.childNodes)) {
      if (child instanceof HTMLElement && child.matches(selector)) continue;
      preserved.push(child);
      col.removeChild(child);
    }
    return preserved;
  }

  /**
   * @param {HTMLElement} col
   * @returns {void}
   */
  function clearPanelChildren(col) {
    const selector = panelSelector || "section.panel";
    Array.from(col.children).forEach((child) => {
      if (child instanceof HTMLElement && child.matches(selector)) child.remove();
    });
  }

  /** @returns {boolean} */
  function isSingleColumn() {
    return !!(window.matchMedia && window.matchMedia(breakpointQuery).matches);
  }

  /** @returns {void} */
  function applyOrder() {
    const order = getOrder();
    const map = new Map(sections.map((section) => [section.id, section.panelEl]));
    const preservedCol0 = liftNonPanelChildren(dom.col0);
    const preservedCol1 = liftNonPanelChildren(dom.col1);

    clearPanelChildren(dom.col0);
    clearPanelChildren(dom.col1);

    const single = isSingleColumn();

    order.forEach((id, idx) => {
      const el = map.get(id);
      if (!el) return;
      if (single) dom.col0.appendChild(el);
      else (idx % 2 === 0 ? dom.col0 : dom.col1).appendChild(el);
    });

    preservedCol0.forEach((child) => dom.col0.appendChild(child));
    preservedCol1.forEach((child) => dom.col1.appendChild(child));
  }

  /**
   * @param {string} id
   * @param {ReorderDirection} dir
   * @returns {void}
   */
  function moveSection(id, dir) {
    const order = getOrder();
    const i = parseIndex(order.indexOf(id));
    if (i === null) return;
    const j = parseIndex(i + dir);
    if (j === null || j >= order.length) return;

    const adjacentId = order[j];
    const panelEl = getHtmlElementById(id);
    const adjacentEl = getHtmlElementById(adjacentId);

    dragState.activePanelId = id;
    dragState.targetPanelId = adjacentId;

    try {
      [order[i], order[j]] = [order[j], order[i]];

      SaveManager?.markDirty?.();
      if (!panelEl || !adjacentEl || !dom.columnsWrap.contains(panelEl) || !dom.columnsWrap.contains(adjacentEl)) {
        applyOrder();
        return;
      }

      /** @returns {void} */
      const swapInDom = () => {
        const parentA = panelEl.parentNode;
        const parentB = adjacentEl.parentNode;
        if (!parentA || !parentB) return;
        const markerA = document.createComment("swap-panel-a");
        const markerB = document.createComment("swap-panel-b");
        parentA.replaceChild(markerA, panelEl);
        parentB.replaceChild(markerB, adjacentEl);
        parentA.replaceChild(adjacentEl, markerA);
        parentB.replaceChild(panelEl, markerB);
      };

      const didSwap = flipSwapTwo(panelEl, adjacentEl, {
        durationMs: 260,
        easing: "cubic-bezier(.22,1,.36,1)",
        swap: swapInDom,
      });

      if (!didSwap) applyOrder();
    } finally {
      dragState.activePanelId = null;
      dragState.targetPanelId = null;
    }
  }

  /**
   * @param {string} label
   * @param {string} title
   * @param {(button: HTMLButtonElement) => void} onClick
   * @returns {HTMLButtonElement}
   */
  function makeMoveBtn(label, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "moveBtn";
    b.textContent = label;
    b.title = title;
    b.addEventListener(
      "click",
      (e) => {
        e.preventDefault();
        e.stopPropagation();
        onClick(getButtonFromEvent(e) || b);
      },
      { signal }
    );
    return b;
  }

  /**
   * @param {string} panelId
   * @returns {void}
   */
  function attachMoves(panelId) {
    if (!panelId) return;

    const panelEl = getHtmlElementById(panelId);
    if (!panelEl) return;

    /** @type {HTMLElement | null | undefined} */
    let headerEl = null;

    if (typeof getHeaderEl === "function") headerEl = getHeaderEl(panelId, dom.pageEl, panelEl);
    if (!headerEl && typeof ensureHeaderRow === "function") headerEl = ensureHeaderRow(panelEl);

    if (!isHtmlElement(headerEl)) return;

    // Avoid duplicates if setup runs twice
    if (hasSectionMoveWrap(headerEl, panelId)) return;

    const wrap = document.createElement("div");
    wrap.className = "sectionMoves";
    wrap.dataset.sectionMoves = panelId;

    wrap.appendChild(makeMoveBtn("↑", "Move section up", (btn) => {
      moveSection(panelId, -1);
      requestAnimationFrame(() => {
        try { btn?.focus({ preventScroll: true }); } catch { btn?.focus?.(); }
      });
    }));
    wrap.appendChild(makeMoveBtn("↓", "Move section down", (btn) => {
      moveSection(panelId, +1);
      requestAnimationFrame(() => {
        try { btn?.focus({ preventScroll: true }); } catch { btn?.focus?.(); }
      });
    }));

    headerEl.appendChild(wrap);
    createdMoveWraps.push(wrap);
  }

  // Initial apply
  applyOrder();

  // Inject buttons for panels in the current order (stable + predictable)
  getOrder().forEach(attachMoves);

  // Re-apply on resize breakpoint changes
  /** @type {ReturnType<typeof setTimeout> | null} */
  let t = null;
  window.addEventListener(
    "resize",
    () => {
      clearTimeout(t);
      t = setTimeout(applyOrder, 120);
    },
    { signal }
  );

  storeApplyFn(reorderUi, storeApplyFnKey, applyOrder);

  const destroy = () => {
    if (destroyed) return;
    destroyed = true;
    clearTimeout(t);
    t = null;
    ac.abort();
    createdMoveWraps.forEach((wrap) => {
      wrap?.remove?.();
    });
    createdMoveWraps.length = 0;
    clearStoredApplyFn(reorderUi, storeApplyFnKey, applyOrder);
    if (destroyKey && activePagePanelReorderDestroyByPage.get(destroyKey) === destroy) {
      activePagePanelReorderDestroyByPage.delete(destroyKey);
    }
  };

  if (destroyKey) activePagePanelReorderDestroyByPage.set(destroyKey, destroy);

  return { applyOrder, destroy };
}
