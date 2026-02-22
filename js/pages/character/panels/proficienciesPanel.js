// js/pages/character/panels/proficienciesPanel.js
// Character page Proficiencies panel (armor/weapon/tool/language textareas)
import { requireMany } from "../../../utils/domGuards.js";

export function initProficienciesPanel(deps = {}) {
  const { state, SaveManager, bindText, setStatus } = deps;

  if (!state || !SaveManager || !bindText) return;
  if (!state.character) return;

  const required = {
    panel: "#charProfPanel",
    armor: "#charArmorProf",
    weapons: "#charWeaponProf",
    tools: "#charToolProf",
    languages: "#charLanguages"
  };
  const guard = requireMany(required, { root: document, setStatus, context: "Proficiencies panel" });
  if (!guard.ok) return guard.destroy;

  bindText("charArmorProf", () => state.character.armorProf, (v) => state.character.armorProf = v);
  bindText("charWeaponProf", () => state.character.weaponProf, (v) => state.character.weaponProf = v);
  bindText("charToolProf", () => state.character.toolProf, (v) => state.character.toolProf = v);
  bindText("charLanguages", () => state.character.languages, (v) => state.character.languages = v);
}
