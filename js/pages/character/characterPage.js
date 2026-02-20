// js/features-ui/characterPage.js
// Phase 3: Character page + Spells v2 extracted from app.js.

import { initEquipmentPanelUI } from "../character/panels/equipmentPanel.js";
import { initAttacksPanelUI } from "../character/panels/attackPanel.js";
import { setupCharacterSectionReorder } from "../character/characterSectionReorder.js";
import { initSpellsPanelUI } from "../character/panels/spellsPanel.js";
import { initVitalsPanelUI } from "../character/panels/vitalsPanel.js";
import { initBasicsPanelUI } from "../character/panels/basicsPanel.js";
import { initProficienciesPanelUI } from "../character/panels/proficienciesPanel.js";
import { initAbilitiesPanelUI } from "../character/panels/abilitiesPanel.js";
import { initPersonalityPanelUI, initCharacterCollapsibleTextareas } from "../character/panels/personalityPanel.js";
import { bindText as bindTextInput, bindNumber as bindNumberInput } from "../../ui/bindings.js";

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

  // Initialize spells panel
  initSpellsPanelUI(deps);

  // Initialize attacks panel
  initAttacksPanelUI(deps);

  /************************ Character Sheet page ***********************/
  function initCharacterUI() {
    const root = document.getElementById("page-character");
    if (!root) return;

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

    // Equipment panel (Inventory + Money)
    initEquipmentPanelUI({ ...deps, bindNumber });

    // Basics
    initBasicsPanelUI({
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
    });

    // Vitals panel (numbers + resource trackers + internal tile reorder)
    initVitalsPanelUI({ ...deps, bindNumber });

    // Proficiencies
    initProficienciesPanelUI({ ...deps, bindText });

    // Personality
    initPersonalityPanelUI({ ...deps, bindText });

    initAbilitiesPanelUI({ ...deps, bindNumber, bindText });
    setupCharacterSectionReorder({ state, SaveManager });
    initCharacterCollapsibleTextareas({ state, SaveManager });
  }

  // Boot character page bindings
  initCharacterUI();
}
