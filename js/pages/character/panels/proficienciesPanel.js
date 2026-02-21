// js/pages/character/panels/proficienciesPanel.js
// Character page Proficiencies panel (armor/weapon/tool/language textareas)

export function initProficienciesPanel(deps = {}) {
  const { state, SaveManager, bindText } = deps;

  if (!state || !SaveManager || !bindText) return;
  if (!state.character) return;

  bindText("charArmorProf", () => state.character.armorProf, (v) => state.character.armorProf = v);
  bindText("charWeaponProf", () => state.character.weaponProf, (v) => state.character.weaponProf = v);
  bindText("charToolProf", () => state.character.toolProf, (v) => state.character.toolProf = v);
  bindText("charLanguages", () => state.character.languages, (v) => state.character.languages = v);
}
