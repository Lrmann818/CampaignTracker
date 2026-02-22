// js/pages/character/panels/personalityPanel.js
// Character page Personality panel (traits/ideals/bonds/flaws/notes + collapsible textareas)

import { initCollapsibleTextareas } from "../../../ui/collapsibleTextareas.js";
import { requireEl, assertEl, getNoopDestroyApi } from "../../../utils/domGuards.js";

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

function ensureStringField(obj, key) {
  if (typeof obj[key] !== "string") obj[key] = "";
}

export function initPersonalityPanel(deps = {}) {
  const { state, bindText, setStatus } = deps;
  if (!state || !bindText) return;

  const prefix = "initPersonalityPanel";
  const criticalSelectors = [
    "#charPersonalityPanel",
    "#charTraits",
    "#charIdeals",
    "#charBonds",
    "#charFlaws",
    "#charCharNotes"
  ];
  const missingCritical = criticalSelectors.some((selector) => !requireCriticalEl(selector, prefix));
  if (missingCritical) {
    notifyMissingCritical(setStatus, "Personality panel unavailable (missing expected UI elements).");
    return getNoopDestroyApi();
  }

  if (!state.character) state.character = {};
  if (!state.character.personality || typeof state.character.personality !== "object") {
    state.character.personality = {};
  }

  const p = state.character.personality;
  ensureStringField(p, "traits");
  ensureStringField(p, "ideals");
  ensureStringField(p, "bonds");
  ensureStringField(p, "flaws");
  ensureStringField(p, "notes");

  bindText("charTraits", () => p.traits, (v) => p.traits = v);
  bindText("charIdeals", () => p.ideals, (v) => p.ideals = v);
  bindText("charBonds", () => p.bonds, (v) => p.bonds = v);
  bindText("charFlaws", () => p.flaws, (v) => p.flaws = v);
  bindText("charCharNotes", () => p.notes, (v) => p.notes = v);
}

export function setupCharacterCollapsibleTextareas({ state, SaveManager, root } = {}) {
  initCollapsibleTextareas({ state, SaveManager, root });
}
