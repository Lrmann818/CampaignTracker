// @ts-check
// js/ui/theme.js
// Theme manager (system/light/dark + named themes) with a safe system listener.

/** @typedef {import("../state.js").State} State */
/**
 * @typedef {typeof ALLOWED_THEMES[number]} ThemeChoice
 */
/**
 * @typedef {{
 *   state: State,
 *   redraw?: () => void
 * }} ThemeManagerDeps
 */
/**
 * @typedef {{
 *   applyTheme: (theme: string) => void,
 *   initFromState: () => void,
 *   startSystemThemeListener: () => void,
 *   stopSystemThemeListener: () => void
 * }} ThemeManagerApi
 */
/**
 * @typedef {MediaQueryList & {
 *   addListener?: (listener: (event: MediaQueryListEvent) => void) => void,
 *   removeListener?: (listener: (event: MediaQueryListEvent) => void) => void
 * }} LegacyThemeMediaQueryList
 */

const ALLOWED_THEMES = /** @type {const} */ ([
  "system", "dark", "light",
  "purple", "teal", "green", "blue", "red", "red-gold", "rose", "beige",
  "slate", "forest", "ember", "sepia", "arcane", "arcane-gold"
]);

/** @type {Set<string>} */
const ALLOWED_THEME_SET = new Set(ALLOWED_THEMES);

/**
 * @param {ThemeManagerDeps} [deps]
 * @returns {ThemeManagerApi}
 */
export function createThemeManager(deps) {
  const { state, redraw } = deps || {};
  if (!state) throw new Error("createThemeManager: state is required");

  /** @type {LegacyThemeMediaQueryList | null} */
  let _systemThemeMql = null;
  /** @type {((event: MediaQueryListEvent) => void) | null} */
  let _systemThemeHandler = null;

  /**
   * @returns {"dark" | "light"}
   */
  function resolveSystemTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

  /**
   * @returns {void}
   */
  function stopSystemThemeListener() {
    if (_systemThemeMql && _systemThemeHandler) {
      try {
        _systemThemeMql.removeEventListener("change", _systemThemeHandler);
      } catch (err) {
        try { _systemThemeMql.removeListener(_systemThemeHandler); } catch (_) { }
      }
    }
    _systemThemeMql = null;
    _systemThemeHandler = null;
  }

  /**
   * @returns {void}
   */
  function startSystemThemeListener() {
    stopSystemThemeListener();
    if (!window.matchMedia) return;

    _systemThemeMql = /** @type {LegacyThemeMediaQueryList} */ (window.matchMedia("(prefers-color-scheme: dark)"));
    _systemThemeHandler = () => {
      if ((state?.ui?.theme || "system") !== "system") return;
      document.documentElement.dataset.theme = resolveSystemTheme();
      try { redraw?.(); } catch (_) { }
    };

    try { _systemThemeMql.addEventListener("change", _systemThemeHandler); }
    catch (err) {
      try { _systemThemeMql.addListener(_systemThemeHandler); } catch (_) { }
    }
  }

  /**
   * @param {string} theme
   * @returns {void}
   */
  function applyTheme(theme) {
    const t = /** @type {ThemeChoice} */ (ALLOWED_THEME_SET.has(theme) ? theme : "system");
    if (!state.ui) {
      state.ui = {
        theme: "system",
        textareaHeights: {},
        panelCollapsed: {}
      };
    }
    state.ui.theme = t;

    const resolved = (t === "system") ? resolveSystemTheme() : t;
    document.documentElement.dataset.theme = resolved;

    if (t === "system") startSystemThemeListener();
    else stopSystemThemeListener();

    try { redraw?.(); } catch (_) { }
  }

  /**
   * @returns {void}
   */
  function initFromState() {
    applyTheme(state?.ui?.theme || "system");
  }

  return { applyTheme, initFromState, startSystemThemeListener, stopSystemThemeListener };
}
