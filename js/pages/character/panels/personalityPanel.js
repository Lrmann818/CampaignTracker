// js/pages/character/panels/personalityPanel.js
// Character page Personality panel (traits/ideals/bonds/flaws/notes + collapsible textareas)

import { initCollapsibleTextareas } from "../../../ui/collapsibleTextareas.js";

function ensureStringField(obj, key) {
  if (typeof obj[key] !== "string") obj[key] = "";
}

export function initPersonalityPanelUI({ state, SaveManager, bindText, root } = {}) {
  if (!state || !bindText) return;
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

export function initCharacterCollapsibleTextareas({ state, SaveManager, root } = {}) {
  initCollapsibleTextareas({ state, SaveManager, root });
}
