// @ts-nocheck
// js/ui/settingsPanel.js — wiring for the Settings / Data panel modal
//
// Keeps app.js as a composition root by moving DOM wiring for the settings
// button and data panel init into a focused module.

import { initDataPanel } from "./dataPanel.js";
import { requireMany } from "../utils/domGuards.js";

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
  const guard = requireMany(
    { settingsBtn: "#settingsBtn" },
    { root: document, setStatus, context: "Settings button" }
  );
  if (!guard.ok) return guard.destroy;
  const { settingsBtn } = guard.els;

  settingsBtn.addEventListener("click", () => {
    if (typeof window.openDataPanel === "function") window.openDataPanel();
  });
}
