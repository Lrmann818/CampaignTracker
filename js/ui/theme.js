// js/ui/theme.js
// Phase 3: theme manager (system/light/dark + named themes) with a safe system listener.

export function createThemeManager({ state, redraw } = {}) {
  let _systemThemeMql = null;
  let _systemThemeHandler = null;

  function resolveSystemTheme() {
    const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    return prefersDark ? "dark" : "light";
  }

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

  function startSystemThemeListener() {
    stopSystemThemeListener();
    if (!window.matchMedia) return;

    _systemThemeMql = window.matchMedia("(prefers-color-scheme: dark)");
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

  function applyTheme(theme) {
    const allowed = new Set([
      "system", "dark", "light",
      "purple", "teal", "green", "blue", "red", "red-gold", "rose", "beige",
      "slate", "forest", "ember", "sepia", "arcane", "arcane-gold"
    ]);

    const t = allowed.has(theme) ? theme : "system";
    if (!state.ui) state.ui = {};
    state.ui.theme = t;

    const resolved = (t === "system") ? resolveSystemTheme() : t;
    document.documentElement.dataset.theme = resolved;

    if (t === "system") startSystemThemeListener();
    else stopSystemThemeListener();

    try { redraw?.(); } catch (_) { }
  }

  function initFromState() {
    applyTheme(state?.ui?.theme || "system");
  }

  return { applyTheme, initFromState, startSystemThemeListener, stopSystemThemeListener };
}
