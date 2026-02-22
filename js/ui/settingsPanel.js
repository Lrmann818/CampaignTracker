// @ts-nocheck
// js/ui/settingsPanel.js — wiring for the Settings / Data panel modal
//
// Keeps app.js as a composition root by moving DOM wiring for the settings
// button and data panel init into a focused module.

import { initDataPanel } from "./dataPanel.js";
import { requireEl, assertEl } from "../utils/domGuards.js";

function requireCriticalEl(selector, prefix) {
  const el = requireEl(selector, document, { prefix });
  if (el) return el;
  try {
    assertEl(selector, document, { prefix, warn: false });
  } catch (err) {
    console.error(err);
  }
  return null;
}

function notifyMissingCritical(setStatus, message) {
  if (typeof setStatus === "function") {
    setStatus(message, { stickyMs: 5000 });
    return;
  }
  console.warn(message);
}

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
  const settingsBtn = requireCriticalEl("#settingsBtn", "setupSettingsPanel");
  if (!settingsBtn) {
    notifyMissingCritical(setStatus, "Settings button unavailable (missing #settingsBtn).");
    return;
  }

  settingsBtn.addEventListener("click", () => {
    if (typeof window.openDataPanel === "function") window.openDataPanel();
  });
}
