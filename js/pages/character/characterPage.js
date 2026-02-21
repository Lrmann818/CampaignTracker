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
import { numberOrNull } from "../../utils/number.js";
import { requireEl, getNoopDestroyApi } from "../../utils/domGuards.js";

let _activeCharacterPageController = null;
const _singletonCharacterPanelInits = {
  spells: false,
  equipment: false
};

export function initCharacterPageUI(deps) {
  _activeCharacterPageController?.destroy?.();
  _activeCharacterPageController = null;

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

  const destroyFns = [];
  const addDestroy = (destroyFn) => {
    if (typeof destroyFn === "function") destroyFns.push(destroyFn);
  };
  const listenerController = new AbortController();
  const listenerSignal = listenerController.signal;
  addDestroy(() => listenerController.abort());

  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function") return;
    const listenerOptions =
      typeof options === "boolean"
        ? { capture: options }
        : (options || {});
    target.addEventListener(type, handler, { ...listenerOptions, signal: listenerSignal });
  };

  const bindText = (id, getter, setter) => {
    const target = document.getElementById(id);
    if (!target) return null;

    target.value = getter?.() ?? "";
    addListener(target, "input", () => {
      setter?.(target.value);
      SaveManager.markDirty();
    });

    return target;
  };

  const bindNumber = (id, getter, setter, autosizeOpts) => {
    const target = document.getElementById(id);
    if (!target) return null;

    const sizeOpts = autosizeOpts || { min: 30, max: 80 };
    const initial = getter?.();
    target.value = (initial === null || initial === undefined) ? "" : String(initial);

    if (typeof autoSizeInput === "function") {
      target.classList.add("autosize");
      autoSizeInput(target, sizeOpts);
    }

    addListener(target, "input", () => {
      setter?.(numberOrNull(target.value));

      if (typeof autoSizeInput === "function") {
        autoSizeInput(target, sizeOpts);
      }

      SaveManager.markDirty();
    });

    return target;
  };

  const runPanelInit = (panelName, initFn, { singletonKey } = {}) => {
    if (singletonKey && _singletonCharacterPanelInits[singletonKey]) {
      return getNoopDestroyApi();
    }

    try {
      const panelApi = initFn();
      if (panelApi?.destroy) addDestroy(() => panelApi.destroy());
      else if (singletonKey) _singletonCharacterPanelInits[singletonKey] = true;
      return panelApi || getNoopDestroyApi();
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

    runPanelInit("Spells panel", () => initSpellsPanel(deps), { singletonKey: "spells" });
    runPanelInit("Attacks panel", () => initAttacksPanel(deps));

    runPanelInit(
      "Equipment panel",
      () => initEquipmentPanel({ ...deps, bindNumber }),
      { singletonKey: "equipment" }
    );

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

  const api = {
    destroy() {
      for (let i = destroyFns.length - 1; i >= 0; i--) {
        destroyFns[i]?.();
      }
      if (_activeCharacterPageController === api) {
        _activeCharacterPageController = null;
      }
    }
  };

  _activeCharacterPageController = api;
  return api;
}
