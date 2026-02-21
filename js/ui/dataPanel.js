// js/ui/dataPanel.js
// Modal "Data & Settings" panel.
// Keeps app.js lean by dependency-injecting actions (backup/reset/theme/etc).

import { uiConfirm, uiAlert } from "./dialogs.js";
import { enhanceSelectDropdown } from "./selectDropdown.js";
import { safeAsync } from "./safeAsync.js";

/**
 * @param {{
 *  state: any,
 *  storageKeys: { STORAGE_KEY: string, ACTIVE_TAB_KEY: string },
 *  applyTheme: (theme:string)=>void,
 *  markDirty: ()=>void,
 *  flush: ()=>Promise<any>|any,
 *  exportBackup: ()=>Promise<any>|any,
 *  importBackup: (e:Event)=>Promise<any>|any,
 *  resetAll: ()=>Promise<any>|any,
 *  clearAllBlobs: ()=>Promise<any>|any,
 *  clearAllTexts: ()=>Promise<any>|any,
 *  setStatus: (msg:string)=>void,
 *  Popovers?: any,
 * }} deps
 */
export function initDataPanel(deps) {
  const {
    state,
    storageKeys,
    applyTheme,
    markDirty,
    flush,
    exportBackup,
    importBackup,
    resetAll,
    clearAllBlobs,
    clearAllTexts,
    setStatus,
    Popovers
  } = deps;
  if (!setStatus) throw new Error("initDataPanel requires setStatus");

  const overlay = /** @type {HTMLElement|null} */ (document.getElementById("dataPanelOverlay"));
  const panel = /** @type {HTMLElement|null} */ (document.getElementById("dataPanelPanel"));
  const closeBtn = /** @type {HTMLButtonElement|null} */ (document.getElementById("dataPanelClose"));

  if (!overlay || !panel) return;

  const themeSelect = /** @type {HTMLSelectElement|null} */ (document.getElementById("dataPanelThemeSelect"));

  // Populate the Theme dropdown in the organized format you liked.
  // (We used to clone from #themeSelect in the old dropdown, but that element no longer exists.)
  if (themeSelect && !themeSelect.dataset.built) {
    buildThemeOptions(themeSelect);
    themeSelect.dataset.built = "1";
  }

  // Enhance the Theme <select> into a custom dropdown that matches the Map Tools menu.
  // This is the only reliable way to style the *open* menu consistently across browsers.
  if (themeSelect && Popovers && !themeSelect.dataset.dropdownEnhanced) {
    enhanceSelectDropdown({
      select: themeSelect,
      Popovers,
      // Keep the CLOSED control looking like the original <select> (same size),
      // while the OPEN menu uses the Map Tools menu look.
      buttonClass: "settingsSelectBtn settingsDropDownBtn",
      optionClass: "swatchOption",
      groupLabelClass: "dropdownGroupLabel",
      preferRight: true
    });
  }

  function open() {
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    // Sync theme select
    if (themeSelect) {
      const current = (state?.tracker?.ui && typeof state.tracker.ui.theme === "string")
        ? state.tracker.ui.theme
        : (state?.ui && typeof state.ui.theme === "string")
          ? state.ui.theme
          : "system";
      themeSelect.value = current;
      // Sync enhanced dropdown label without firing the real change handler.
      try { themeSelect.dispatchEvent(new Event("selectDropdown:sync")); } catch { }
    }
    // Focus close for keyboard users
    (closeBtn || panel).focus?.();
  }

  function close() {
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
  }

  // allow other modules (settings dropdown) to open it
  window.openDataPanel = open;

  // Close interactions
  if (closeBtn) closeBtn.addEventListener("click", close);
  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) close();
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !overlay.hidden) close();
  });

  // Theme change
  if (themeSelect) {
    themeSelect.addEventListener("change", () => {
      const val = themeSelect.value || "system";
      applyTheme(val);
      // store theme where your app expects it (tracker.ui), but keep backward compat if you had ui earlier
      if (state?.tracker?.ui) state.tracker.ui.theme = val;
      else {
        state.ui = state.ui || {};
        state.ui.theme = val;
      }
      markDirty();
    });
  }

  // Buttons
  const exportBtn = document.getElementById("dataExportBtn");
  const importFile = /** @type {HTMLInputElement|null} */ (document.getElementById("dataImportFile"));
  const resetAllBtn = document.getElementById("dataResetAllBtn");
  const resetUiBtn = document.getElementById("dataResetUiBtn");
  const clearImagesBtn = document.getElementById("dataClearImagesBtn");
  const clearTextsBtn = document.getElementById("dataClearTextsBtn");
  const aboutBtn = document.getElementById("dataAboutBtn");

  if (exportBtn) exportBtn.addEventListener("click", () => exportBackup());
  if (importFile) importFile.addEventListener("change", (e) => importBackup(e));

  if (resetAllBtn) resetAllBtn.addEventListener(
    "click",
    safeAsync(async () => {
      close();
      await resetAll();
    }, (err) => {
      console.error(err);
      setStatus("Reset all failed.");
    })
  );

  if (resetUiBtn) resetUiBtn.addEventListener(
    "click",
    safeAsync(async () => {
    const ok = await uiConfirm("Reset UI settings only?\n\nThis will reset theme + UI layout prefs (like last active tab). It will NOT delete your campaign data.");
    if (!ok) return;

    try {
      setStatus("Resetting UI…");
      await flush?.();

      // Clear UI-only localStorage keys
      try { localStorage.removeItem(storageKeys.ACTIVE_TAB_KEY); } catch {}
      // Reset UI subtree
      if (state?.tracker?.ui) {
        state.tracker.ui = { textareaHeights: {} };
      } else if (state?.ui) {
        state.ui = { textareaHeights: {} };
      }
      applyTheme("system");
      markDirty();
      await flush?.();

      setStatus("UI reset. Reloading…");
      location.reload();
    } catch (err) {
      console.error(err);
      await uiAlert("Could not reset UI settings. See console for details.");
      setStatus("Reset UI failed");
    }
    }, (err) => {
      console.error(err);
      setStatus("Reset UI failed.");
    })
  );

  if (clearImagesBtn) clearImagesBtn.addEventListener(
    "click",
    safeAsync(async () => {
    const ok = await uiConfirm("Clear ALL saved images?\n\nThis removes portraits and map images stored in your browser. Your campaign data stays.");
    if (!ok) return;

    try {
      setStatus("Clearing images…");
      await flush?.();

      // Remove blob references from state to avoid dangling ids
      removeAllBlobIds(state);

      markDirty();
      await flush?.();

      // Clear IndexedDB blobs
      await clearAllBlobs?.();

      setStatus("Images cleared. Reloading…");
      location.reload();
    } catch (err) {
      console.error(err);
      await uiAlert("Could not clear images. See console for details.");
      setStatus("Clear images failed");
    }
    }, (err) => {
      console.error(err);
      setStatus("Clear images failed.");
    })
  );

  if (clearTextsBtn) clearTextsBtn.addEventListener(
    "click",
    safeAsync(async () => {
    const ok = await uiConfirm("Clear ALL saved long texts (notes) stored in the browser?\n\nThis does not delete your campaign cards, but it will remove any large notes stored separately.");
    if (!ok) return;

    try {
      setStatus("Clearing texts…");
      await flush?.();
      await clearAllTexts?.();
      setStatus("Texts cleared. Reloading…");
      location.reload();
    } catch (err) {
      console.error(err);
      await uiAlert("Could not clear texts. See console for details.");
      setStatus("Clear texts failed");
    }
    }, (err) => {
      console.error(err);
      setStatus("Clear texts failed.");
    })
  );

  if (aboutBtn) aboutBtn.addEventListener(
    "click",
    safeAsync(async () => {
    const appName = (state?.tracker && typeof state.tracker.campaignTitle === "string" && state.tracker.campaignTitle.trim())
      ? state.tracker.campaignTitle.trim()
      : "My Campaign Tracker";

    const schema = Number.isFinite(state?.schemaVersion) ? state.schemaVersion : "?";
    const version = (window.__APP_VERSION__ || window.APP_VERSION || "dev").toString();
    const lastModified = (document.lastModified || "").toString();

    const lines = [
      `${appName}`,
      "",
      `Version: ${version}`,
      `Schema: v${schema}`,
      lastModified ? `Last modified: ${lastModified}` : null,
      "",
      "Local storage keys:",
      `• Data: ${storageKeys?.STORAGE_KEY || "(unknown)"}`,
      `• UI tab: ${storageKeys?.ACTIVE_TAB_KEY || "(unknown)"}`,
    ].filter(Boolean);

      await uiAlert(lines.join("\n"), { title: "About" });
    }, (err) => {
      console.error(err);
      setStatus("Open about failed.");
    })
  );
}

function buildThemeOptions(select) {
  // value => label (label is what the user sees)
  const light = [
    ["light", "Light"],
    ["beige", "Parchment"],
    ["rose", "Blush"],
    ["teal", "Teal"],
    ["blue", "Pondera Blue"],
  ];

  const dark = [
    ["dark", "Dark"],
    ["purple", "Purple"],
    ["red", "Crimson"],
    ["red-gold", "Royal Red"],
    ["arcane", "Arcane"],
    ["arcane-gold", "Arcane Gold"],
    ["green", "Toxic Core"],
    ["slate", "Stone"],
    ["forest", "Forest"],
    ["ember", "Dark Copper"],
    ["sepia", "Sepia"],
  ];

  // Clear existing options
  select.innerHTML = "";

  // Default (System)
  select.appendChild(new Option("Default", "system"));

  // Light group
  const gLight = document.createElement("optgroup");
  gLight.label = "✶ Light Themes";
  for (const [value, label] of light) gLight.appendChild(new Option(label, value));
  select.appendChild(gLight);

  // Dark group
  const gDark = document.createElement("optgroup");
  gDark.label = "☾ Dark Themes";
  for (const [value, label] of dark) gDark.appendChild(new Option(label, value));
  select.appendChild(gDark);
}

/** Remove any *BlobId references inside an object graph (best effort). */
function removeAllBlobIds(root) {
  const seen = new Set();
  const stack = [root];

  while (stack.length) {
    const cur = stack.pop();
    if (!cur || typeof cur !== "object") continue;
    if (seen.has(cur)) continue;
    seen.add(cur);

    if (Array.isArray(cur)) {
      for (const v of cur) stack.push(v);
      continue;
    }

    for (const k of Object.keys(cur)) {
      const v = cur[k];
      if (k === "imgBlobId" || k === "bgBlobId" || k === "drawingBlobId" || k.endsWith("BlobId")) {
        cur[k] = null;
        continue;
      }
      if (v && typeof v === "object") stack.push(v);
    }
  }
}
