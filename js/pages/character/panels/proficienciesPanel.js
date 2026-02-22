// js/pages/character/panels/proficienciesPanel.js
// Character page Proficiencies panel (armor/weapon/tool/language textareas)
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

export function initProficienciesPanel(deps = {}) {
  const { state, SaveManager, bindText, setStatus } = deps;

  if (!state || !SaveManager || !bindText) return;
  if (!state.character) return;

  const prefix = "initProficienciesPanel";
  const criticalSelectors = [
    "#charProfPanel",
    "#charArmorProf",
    "#charWeaponProf",
    "#charToolProf",
    "#charLanguages"
  ];
  const missingCritical = criticalSelectors.some((selector) => !requireCriticalEl(selector, prefix));
  if (missingCritical) {
    notifyMissingCritical(setStatus, "Proficiencies panel unavailable (missing expected UI elements).");
    return getNoopDestroyApi();
  }

  bindText("charArmorProf", () => state.character.armorProf, (v) => state.character.armorProf = v);
  bindText("charWeaponProf", () => state.character.weaponProf, (v) => state.character.weaponProf = v);
  bindText("charToolProf", () => state.character.toolProf, (v) => state.character.toolProf = v);
  bindText("charLanguages", () => state.character.languages, (v) => state.character.languages = v);
}
