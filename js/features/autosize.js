// Autosize helpers extracted from app.js (Phase 2)

// NOTE: many inputs are created *before* being inserted into the DOM.
// getComputedStyle() returns incomplete values for disconnected elements, so we defer measuring
// until the input is connected + styles/fonts are applied.

const __autosizeInputMeasurer = (() => {
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.whiteSpace = "pre";
  span.style.height = "0";
  span.style.overflow = "hidden";
  span.style.left = "-99999px";
  return span;
})();

export function autoSizeInput(el, { min = 0, max = 300, extra = 0 } = {}) {
  if (!el) return;

  // Ensure the measurer is in the DOM (only once)
  if (!__autosizeInputMeasurer.isConnected) document.body.appendChild(__autosizeInputMeasurer);

  const measure = () => {
    if (!el.isConnected) return; // wait until inserted into DOM
    const cs = getComputedStyle(el);

    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const borderL = parseFloat(cs.borderLeftWidth) || 0;
    const borderR = parseFloat(cs.borderRightWidth) || 0;

    __autosizeInputMeasurer.style.font = cs.font;
    __autosizeInputMeasurer.style.letterSpacing = cs.letterSpacing;
    __autosizeInputMeasurer.textContent = el.value || el.placeholder || "";

    const textW = __autosizeInputMeasurer.getBoundingClientRect().width;
    const raw = textW + padL + padR + borderL + borderR + extra;
    const next = Math.min(max, Math.max(min, Math.ceil(raw)));

    el.style.width = next + "px";
  };

  // Small scheduler so we measure after layout/styles apply.
  // (requestAnimationFrame also handles the "created then appended" case cleanly.)
  const schedule = () => requestAnimationFrame(measure);

  el.addEventListener("input", schedule);
  el.addEventListener("blur", schedule);

  // Initial sizing: run a few times to catch late font/style application.
  schedule();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule).catch(() => { });
  }
  window.addEventListener("load", schedule, { once: true });
}

export function autosizeAllNumbers(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(el => {
    el.classList.add("autosize");
    autoSizeInput(el, { min: 30, max: 80 });
  });
}

export function applyAutosize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

/**
 * Textarea sizing: autosize + persisted height
 *
 * Pass dependencies so this module stays pure-ish and doesn't rely on globals.
 */
export function setupTextareaSizing({
  state,
  markDirty,
  saveAll,
  setStatus,
  maxHeight = 900
} = {}) {
  if (!state) throw new Error("setupTextareaSizing requires { state }");
  const hasMarkDirty = (typeof markDirty === "function");
  const hasLegacySave = (typeof saveAll === "function" && typeof setStatus === "function");
  if (!hasMarkDirty && !hasLegacySave) {
    throw new Error("setupTextareaSizing requires { markDirty } or legacy { saveAll, setStatus }");
  }

  // One place to store all textarea heights (root UI so it survives imports cleanly)
  if (!state.ui || typeof state.ui !== "object") state.ui = {};
  if (!state.ui.textareaHeights || typeof state.ui.textareaHeights !== "object") state.ui.textareaHeights = {};
  const store = state.ui.textareaHeights;

  // Back-compat: if older saves stored it under tracker.ui, pull it forward once
  if (state.tracker?.ui?.textareaHeights && Object.keys(store).length === 0) {
    Object.assign(store, state.tracker.ui.textareaHeights);
  }

  const seen = new WeakSet();

  // Debounced save (so we don't spam saveAll)
  let saveTimer = null;
  function scheduleSave() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    if (typeof markDirty === "function") {
      markDirty();
    } else {
      // Legacy fallback (shouldn't be used once app.js passes markDirty)
      setStatus("Saving...");
      saveAll();
    }
  }, 150);
}

  function applySize(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    if (!el.hasAttribute("data-persist-size")) return;
    if (!el.id) return;

    const saved = store[el.id];
    const savedPx = Number.isFinite(saved) ? saved : 0;

    // If we have a saved manual height, respect it exactly
    if (savedPx > 0) {
      el.style.height = savedPx + "px";
      return;
    }

    // Otherwise autosize to content
    el.style.height = "auto";
    el.style.height = el.scrollHeight + "px";
  }

  // Expose a tiny hook so async text loads can trigger a re-measure without faking input events.
  // (Closes over `store`, so it uses the same persisted sizes.)
  window.__applyTextareaSize = (el) => {
    try { applySize(el); } catch (_) { }
  };

  function bind(el) {
    if (seen.has(el)) return;
    seen.add(el);

    // Restore/apply immediately
    applySize(el);

    // Helper: ignore layout changes that happen because a whole page/tab was hidden.
    // When we switch between top-level pages, some CSS/layout changes can briefly
    // resize textareas and would otherwise trigger a save even though the user
    // didn't edit anything.
    function isInHiddenUI() {
      // If the element (or any ancestor) is explicitly hidden, treat it as not user-driven.
      if (el.closest?.('[hidden]')) return true;
      // If detached or not in layout, bail.
      if (!document.body.contains(el)) return true;
      if (el.offsetParent === null) return true;
      return false;
    }

    // Autosize as user types (and save)
    el.addEventListener("input", () => {
      applySize(el);

      if (isInHiddenUI()) return;

      const h = Math.min(Math.round(el.getBoundingClientRect().height), maxHeight);
      if (h <= 0) return;

      store[el.id] = h;
      scheduleSave();
    });

    // Persist manual resizes (drag handle)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (isInHiddenUI()) return;

        const h = Math.min(Math.round(el.getBoundingClientRect().height), maxHeight);
        if (h <= 0) return;

        store[el.id] = h;
        scheduleSave();
      });
      ro.observe(el);
    }
  }

  function scan(root = document) {
    root.querySelectorAll("textarea[data-persist-size]").forEach(bind);
  }

  // Initial pass
  scan(document);

  // Fonts can load after DOMContentLoaded and change line-height, which affects scrollHeight.
  // Re-scan once fonts are ready so heights are correct on refresh.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => scan(document)).catch(() => { });
  }

  // Catch textareas created later (spells/npcs/party/locations renders, etc.)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.("textarea[data-persist-size]")) bind(node);
        scan(node);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}
