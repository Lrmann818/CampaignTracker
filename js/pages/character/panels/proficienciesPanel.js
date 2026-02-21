// js/pages/character/panels/proficienciesPanel.js
// Character page Proficiencies panel (armor/weapon/tool/language textareas)
import { requireEl, getNoopDestroyApi } from "../../../utils/domGuards.js";

export function initProficienciesPanel(deps = {}) {
  const { state, SaveManager, bindText, setStatus } = deps;

  if (!state || !SaveManager || !bindText) return;
  if (!setStatus) throw new Error("initProficienciesPanel requires setStatus");
  if (!state.character) return;

  const criticalSelectors = [
    "#charProfPanel",
    "#charArmorProf",
    "#charWeaponProf",
    "#charToolProf",
    "#charLanguages"
  ];
  const missingCritical = criticalSelectors.some(
    (selector) => !requireEl(selector, document, { prefix: "initProficienciesPanel", warn: false })
  );
  if (missingCritical) {
    setStatus("Proficiencies panel unavailable (missing expected UI elements).");
    return getNoopDestroyApi();
  }

  bindText("charArmorProf", () => state.character.armorProf, (v) => state.character.armorProf = v);
  bindText("charWeaponProf", () => state.character.weaponProf, (v) => state.character.weaponProf = v);
  bindText("charToolProf", () => state.character.toolProf, (v) => state.character.toolProf = v);
  bindText("charLanguages", () => state.character.languages, (v) => state.character.languages = v);
}
