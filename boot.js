// boot.js — runs before styles.css so the correct theme is applied immediately
(function () {
  try {
    // Expose an app version string early so UI can display it (e.g., Settings → About).
    // Set via <meta name="app-version" content="..."> in index.html.
    const metaVer = document.querySelector('meta[name="app-version"]')?.getAttribute("content");
    if (metaVer) {
      const v = String(metaVer);
      if (!window.__APP_VERSION__) window.__APP_VERSION__ = v;
      if (!window.APP_VERSION) window.APP_VERSION = v;
    }

    const raw = localStorage.getItem("localCampaignTracker_v1");
    const data = raw ? JSON.parse(raw) : null;
    const theme = data?.ui?.theme || "system";

    const prefersDark =
      window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolved = theme === "system" ? (prefersDark ? "dark" : "light") : theme;

    document.documentElement.dataset.theme = resolved;
  } catch (_) {
    // If storage is blocked or corrupted, just fall back to default CSS theme.
  }
})();