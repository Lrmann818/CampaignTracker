// @ts-nocheck
// js/ui/settingsPanel.js — wiring for the Settings / Data panel modal
//
// Keeps app.js as a composition root by moving DOM wiring for the settings
// button and data panel init into a focused module.

import { initDataPanel } from "./dataPanel.js";

export function setupSettingsPanel(deps) {
  const {
    state,
    storageKeys,
    applyTheme,
    markDirty,
    flush,
    Popovers,
    exportBackup,
    importBackup,
    resetAll,
    clearAllBlobs,
    clearAllTexts,
    setStatus,
  } = deps || {};

  if (!state) throw new Error("setupSettingsPanel: state is required");
  if (!storageKeys) throw new Error("setupSettingsPanel: storageKeys is required");
  if (typeof applyTheme !== "function") throw new Error("setupSettingsPanel: applyTheme() is required");
  if (typeof markDirty !== "function") throw new Error("setupSettingsPanel: markDirty() is required");
  if (typeof flush !== "function") throw new Error("setupSettingsPanel: flush() is required");
  if (!setStatus) throw new Error("setupSettingsPanel requires setStatus");

  initDataPanel({
    state,
    storageKeys,
    applyTheme,
    markDirty,
    flush,
    Popovers,
    exportBackup,
    importBackup,
    resetAll,
    clearAllBlobs,
    clearAllTexts,
    setStatus,
  });

  // Settings button opens the modal directly
  const settingsBtn = document.getElementById("settingsBtn");
  if (settingsBtn) {
    settingsBtn.addEventListener("click", () => {
      if (typeof window.openDataPanel === "function") window.openDataPanel();
    });
  }
}
