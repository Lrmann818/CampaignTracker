// js/pages/character/panels/personalityPanel.js
// Character page Personality panel (traits/ideals/bonds/flaws/notes + collapsible textareas)

import { initCollapsibleTextareas } from "../../../ui/collapsibleTextareas.js";
import { requireMany } from "../../../utils/domGuards.js";

function ensureStringField(obj, key) {
  if (typeof obj[key] !== "string") obj[key] = "";
}

export function initPersonalityPanel(deps = {}) {
  const { state, bindText, setStatus } = deps;
  if (!state || !bindText) return;

  const required = {
    panel: "#charPersonalityPanel",
    traits: "#charTraits",
    ideals: "#charIdeals",
    bonds: "#charBonds",
    flaws: "#charFlaws",
    notes: "#charCharNotes"
  };
  const guard = requireMany(required, { root: document, setStatus, context: "Personality panel" });
  if (!guard.ok) return guard.destroy;

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
