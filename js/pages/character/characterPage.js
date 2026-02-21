// js/pages/character/characterPage.js
// Phase 3: Character page + Spells v2 extracted from app.js.

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

  // Initialize spells panel
  initSpellsPanel(deps);

  // Initialize attacks panel
  initAttacksPanel(deps);

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
    initEquipmentPanel({ ...deps, bindNumber });

    // Basics
    initBasicsPanel({
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
    initVitalsPanel({ ...deps, bindNumber });

    // Proficiencies
    initProficienciesPanel({ ...deps, bindText });

    // Personality
    initPersonalityPanel({ ...deps, bindText });

    initAbilitiesPanel({ ...deps, bindNumber, bindText });
    setupCharacterSectionReorder({ state, SaveManager });
    setupCharacterCollapsibleTextareas({ state, SaveManager });
  }

  // Boot character page bindings
  initCharacterUI();
}
