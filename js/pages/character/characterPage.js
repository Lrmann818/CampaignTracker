// js/pages/character/characterPage.js
// Character page composition and panel wiring.

import { initEquipmentPanel } from "../character/panels/equipmentPanel.js";
import { initAttacksPanel } from "../character/panels/attackPanel.js";
import { setupCharacterSectionReorder } from "../character/characterSectionReorder.js";
import { initSpellsPanel } from "../character/panels/spellsPanel.js";
import { initVitalsPanel } from "../character/panels/vitalsPanel.js";
import { initBasicsPanel } from "../character/panels/basicsPanel.js";
import { initProficienciesPanel } from "../character/panels/proficienciesPanel.js";
import { initAbilitiesPanel } from "../character/panels/abilitiesPanel.js";
import { initPersonalityPanel, setupCharacterCollapsibleTextareas } from "../character/panels/personalityPanel.js";
import { bindText as bindTextInput, bindNumber as bindNumberInput } from "../../ui/bindings.js";
import { requireEl, getNoopDestroyApi } from "../../utils/domGuards.js";

export function initCharacterPageUI(deps) {
  const {
    state,
    SaveManager,
    Popovers,

    // Character portrait flow
    ImagePicker,
    pickCropStorePortrait,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,

    // Common UI helpers
    autoSizeInput,
    enhanceNumberSteppers,
    uiAlert,
    uiConfirm,
    uiPrompt,
    setStatus
  } = deps || {};

  if (!state) throw new Error("initCharacterPageUI: state is required");
  if (!SaveManager) throw new Error("initCharacterPageUI: SaveManager is required");
  if (!setStatus) throw new Error("initCharacterPageUI requires setStatus");

  const runPanelInit = (panelName, initFn) => {
    try {
      return initFn();
    } catch (err) {
      console.error(`${panelName} init failed:`, err);
      setStatus(`${panelName} failed to initialize. Check console for details.`, { stickyMs: 5000 });
      return getNoopDestroyApi();
    }
  };

  /************************ Character Sheet page ***********************/
  function initCharacterUI() {
    const root = requireEl("#page-character", document, { prefix: "initCharacterPageUI", warn: false });
    if (!root) {
      setStatus("Character page unavailable (missing #page-character).", { stickyMs: 5000 });
      return;
    }

    // Ensure shape exists (older saves/backups)
    if (!state.character) state.character = {};
    if (!state.character.abilities) state.character.abilities = {};
    if (!state.character.spells) state.character.spells = {};
    if (!state.character.money) state.character.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    if (!state.character.personality) state.character.personality = {};

    const bindText = (id, getter, setter) =>
      bindTextInput({
        id,
        get: getter,
        set: setter,
        SaveManager,
      });

    const bindNumber = (id, getter, setter, autosizeOpts) =>
      bindNumberInput({
        id,
        get: getter,
        set: setter,
        SaveManager,
        autoSizeInput,
        autosizeOpts,
      });

    runPanelInit("Spells panel", () => initSpellsPanel(deps));
    runPanelInit("Attacks panel", () => initAttacksPanel(deps));

    runPanelInit("Equipment panel", () => initEquipmentPanel({ ...deps, bindNumber }));

    runPanelInit("Basics panel", () => initBasicsPanel({
      ...deps,
      ImagePicker,
      pickCropStorePortrait,
      deleteBlob,
      putBlob,
      cropImageModal,
      getPortraitAspect,
      blobIdToObjectUrl,
      bindText,
      bindNumber,
      autoSizeInput,
      setStatus,
    }));

    runPanelInit("Vitals panel", () => initVitalsPanel({ ...deps, bindNumber }));

    runPanelInit("Proficiencies panel", () => initProficienciesPanel({ ...deps, bindText }));

    runPanelInit("Personality panel", () => initPersonalityPanel({ ...deps, bindText }));

    runPanelInit("Abilities panel", () => initAbilitiesPanel({ ...deps, bindNumber, bindText }));
    runPanelInit("Character section reorder", () => setupCharacterSectionReorder({ state, SaveManager }));
    runPanelInit("Character textarea collapse", () => setupCharacterCollapsibleTextareas({ state, SaveManager }));
  }

  // Boot character page bindings
  initCharacterUI();
}
