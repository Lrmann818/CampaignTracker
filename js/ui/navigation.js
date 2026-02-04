// @ts-nocheck
// js/ui/navigation.js — top-level page tabs/navigation
//
// Long-term goals:
// - Single source of truth for how pages switch
// - Zero hard-coded page list in app.js (add a new page by adding a tab button + a matching #page-<name> section)
// - Accessibility (ARIA + keyboard)
// - Deep linking (#tracker/#character/#map) + state persistence

/**
 * Initialize the top page tabs.
 *
 * Expected markup:
 *   <nav class="tabs" role="tablist">
 *     <button class="tab" data-tab="tracker" role="tab">Tracker</button>
 *     ...
 *   </nav>
 * And pages:
 *   <section id="page-tracker">...</section>
 *   <section id="page-character">...</section>
 *
 * By default, tabs map to pages via: #page-${tabName}
 */
export function initTopTabsNavigation({
  state,
  markDirty,
  activeTabStorageKey = "localCampaignTracker_activeTab",
  tabsRootSelector = ".tabs",
  tabSelector = ".tab[data-tab]",
  pageIdPrefix = "page-",
  defaultTab = "tracker",
  updateHash = true
} = {}) {
  const tabsRoot = document.querySelector(tabsRootSelector);
  if (!tabsRoot) return;

  const tabButtons = Array.from(tabsRoot.querySelectorAll(tabSelector));
  if (!tabButtons.length) return;

  // Build the page registry from the DOM so adding pages is declarative.
  const pages = Object.create(null);
  tabButtons.forEach((btn) => {
    const name = btn.getAttribute("data-tab")?.trim();
    if (!name) return;
    const el = document.getElementById(`${pageIdPrefix}${name}`);
    if (el) pages[name] = el;
  });

  function normalizeTabName(tabName) {
    const t = (tabName || "").toString().replace(/^#/, "").trim();
    if (t && pages[t]) return t;
    if (pages[defaultTab]) return defaultTab;
    // Fallback to the first registered page
    const first = Object.keys(pages)[0];
    return first || defaultTab;
  }

  function setHash(tabName) {
    if (!updateHash) return;
    try {
      const hash = `#${tabName}`;
      if (location.hash !== hash) history.replaceState(null, "", hash);
    } catch (_) {
      // ignore (some environments block history)
    }
  }

  function persistActiveTab(tabName) {
    try {
      if (!activeTabStorageKey) return;
      localStorage.setItem(activeTabStorageKey, tabName);
    } catch (_) {
      // ignore
    }
  }

  function applyActiveTab(tabName, { markDirty: doMarkDirty = false } = {}) {
    const active = normalizeTabName(tabName);

    tabButtons.forEach((btn) => {
      const isActive = btn.getAttribute("data-tab") === active;
      btn.classList.toggle("active", isActive);
      btn.setAttribute("aria-selected", isActive ? "true" : "false");
      btn.setAttribute("tabindex", isActive ? "0" : "-1");
    });

    Object.entries(pages).forEach(([name, el]) => {
      if (!el) return;
      el.classList.toggle("active", name === active);
      // Keep DOM accessible; CSS uses .active, but hidden helps SR + tab order
      el.toggleAttribute("hidden", name !== active);
    });

    if (state) {
      state.ui = state.ui || {};
      state.ui.activeTab = active;
    }

    // Persist UI preference without marking campaign data as "dirty"
    persistActiveTab(active);

    setHash(active);
    if (doMarkDirty && typeof markDirty === "function") markDirty();
  }

  // Click to switch
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => applyActiveTab(btn.getAttribute("data-tab")));
  });

  // Keyboard: left/right arrows to move between tabs
  tabsRoot.addEventListener("keydown", (e) => {
    const keys = ["ArrowLeft", "ArrowRight", "Home", "End"];
    if (!keys.includes(e.key)) return;
    const idx = tabButtons.findIndex((b) => b.classList.contains("active"));
    if (idx < 0) return;

    e.preventDefault();
    let next = idx;
    if (e.key === "ArrowLeft") next = (idx - 1 + tabButtons.length) % tabButtons.length;
    if (e.key === "ArrowRight") next = (idx + 1) % tabButtons.length;
    if (e.key === "Home") next = 0;
    if (e.key === "End") next = tabButtons.length - 1;
    tabButtons[next].focus();
    applyActiveTab(tabButtons[next].getAttribute("data-tab"));
  });

  // Initial: prefer hash (#tracker/#character/#map), else localStorage, else state, else default
  // NOTE: We intentionally persist active tab in localStorage without marking the campaign "dirty".
  // That means a refresh must be able to restore the last tab even if no save was triggered.
  const hash = (location.hash || "").replace("#", "").trim();
  let stored = "";
  try {
    stored = (activeTabStorageKey && localStorage.getItem(activeTabStorageKey)) || "";
  } catch (_) {
    stored = "";
  }

  const initial =
    (hash && pages[hash] ? hash : "") ||
    (stored && pages[stored] ? stored : "") ||
    (state?.ui?.activeTab && pages[state.ui.activeTab] ? state.ui.activeTab : "") ||
    defaultTab;

  applyActiveTab(initial, { markDirty: false });

  // Optional: respond to manual hash changes (back/forward, pasted URL)
  window.addEventListener("hashchange", () => {
    const h = (location.hash || "").replace("#", "").trim();
    if (!h) return;
    if (!pages[h]) return;
    applyActiveTab(h, { markDirty: false });
  });

  // Public API
  return {
    applyActiveTab,
    getActiveTab: () => normalizeTabName(state?.ui?.activeTab || location.hash)
  };
}
