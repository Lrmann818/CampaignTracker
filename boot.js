// boot.js — runs before styles.css so the correct theme is applied immediately
(function () {
  try {
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