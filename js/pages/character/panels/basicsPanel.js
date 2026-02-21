// js/pages/character/panels/basicsPanel.js
// Character page Basics panel (identity fields + portrait)

import { safeAsync } from "../../../ui/safeAsync.js";
import { createStateActions } from "../../../domain/stateActions.js";

function formatPossessive(name) {
  const n = (name || "").trim();
  if (!n) return "";
  // If it ends with s/S, prefer: "Silas' Campaign Tracker"
  return /[sS]$/.test(n) ? `${n}'` : `${n}'s`;
}

function updateTabTitle(state) {
  const base = "Campaign Tracker";
  const name = state.character?.name || "";
  const poss = formatPossessive(name);
  document.title = poss ? `${poss} ${base}` : base;
}

function setupAutosizeInputs(autoSizeInput) {
  if (!autoSizeInput) return;

  const nameInput = document.getElementById("charName");
  const classInput = document.getElementById("charClassLevel");
  const raceInput = document.getElementById("charRace");
  const bgInput = document.getElementById("charBackground");
  const alignInput = document.getElementById("charAlignment");
  const xpInput = document.getElementById("charExperience");

  if (nameInput) {
    nameInput.classList.add("autosize");
    autoSizeInput(nameInput, { min: 55, max: 320 });
  }
  if (classInput) {
    classInput.classList.add("autosize");
    autoSizeInput(classInput, { min: 55, max: 320 });
  }
  if (raceInput) {
    raceInput.classList.add("autosize");
    autoSizeInput(raceInput, { min: 55, max: 320 });
  }
  if (bgInput) {
    bgInput.classList.add("autosize");
    autoSizeInput(bgInput, { min: 55, max: 320 });
  }
  if (alignInput) {
    alignInput.classList.add("autosize");
    autoSizeInput(alignInput, { min: 55, max: 320 });
  }
  if (xpInput) {
    xpInput.classList.add("autosize");
    autoSizeInput(xpInput, { min: 30, max: 320 });
  }
}

function setupTitleSync(state) {
  const nameInput = document.getElementById("charName");

  // Set initial title based on saved character name (if any)
  updateTabTitle(state);

  if (!nameInput) return;
  if (nameInput.dataset.boundBasicsTitle === "1") return;

  nameInput.dataset.boundBasicsTitle = "1";
  nameInput.addEventListener("input", () => updateTabTitle(state));
}

function setupCharacterPortrait(deps) {
  const {
    state,
    SaveManager,
    ImagePicker,
    pickCropStorePortrait,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,
    setStatus,
  } = deps;
  if (!setStatus) throw new Error("setupCharacterPortrait requires setStatus");
  const { updateCharacterField } = createStateActions({ state, SaveManager });

  const cardEl = document.getElementById("charPortraitCard");
  const boxEl = document.getElementById("charPortraitTop");
  if (!boxEl) return;
  const portraitBindEl = cardEl || boxEl;

  let _portraitPicking = false;

  async function renderPortrait() {
    // wipe the box and rebuild contents like NPC
    boxEl.innerHTML = "";

    if (state.character.imgBlobId && typeof blobIdToObjectUrl === "function") {
      const img = document.createElement("img");
      img.alt = state.character.name || "Character Portrait";
      boxEl.appendChild(img);

      let url = null;
      try { url = await blobIdToObjectUrl(state.character.imgBlobId); }
      catch (err) {
        console.warn("Failed to load character portrait blob:", err);
      }
      if (url) img.src = url;
      return;
    }

    const placeholder = document.createElement("div");
    placeholder.className = "portraitPlaceholder";
    placeholder.textContent = "Add Image";
    boxEl.appendChild(placeholder);
  }

  // click anywhere in the portrait box
  if (portraitBindEl.dataset.boundBasicsPortrait !== "1") {
    portraitBindEl.dataset.boundBasicsPortrait = "1";
    portraitBindEl.addEventListener(
      "click",
      safeAsync(async () => {
        if (_portraitPicking) return;
        _portraitPicking = true;

        try {
          const result = await pickCropStorePortrait({
            picker: ImagePicker,
            currentBlobId: state.character.imgBlobId,
            deleteBlob,
            putBlob,
            cropImageModal,
            getPortraitAspect,
            aspectSelector: "#charPortraitTop",
            setStatus,
          });

          // cancel
          if (typeof result === "undefined") return;

          // delete returns null/""; set to null
          updateCharacterField("imgBlobId", result || null);
          await renderPortrait();
        } finally {
          _portraitPicking = false;
        }
      }, (err) => {
        console.error(err);
        setStatus("Update portrait failed.");
      })
    );
  }

  renderPortrait();
}

export function initBasicsPanel(deps = {}) {
  const {
    state,
    SaveManager,
    bindText,
    bindNumber,
    autoSizeInput,
    setStatus,
  } = deps;

  if (!state || !SaveManager || !bindText || !bindNumber) return;
  if (!setStatus) throw new Error("initBasicsPanel requires setStatus");
  if (!state.character) state.character = {};
  const { updateCharacterField } = createStateActions({ state, SaveManager });

  // bindText/bindNumber already queue saves via SaveManager; actions only mutate here.
  bindText("charName", () => state.character.name, (v) => updateCharacterField("name", v, { queueSave: false }));
  bindText("charClassLevel", () => state.character.classLevel, (v) => updateCharacterField("classLevel", v, { queueSave: false }));
  bindText("charRace", () => state.character.race, (v) => updateCharacterField("race", v, { queueSave: false }));
  bindText("charBackground", () => state.character.background, (v) => updateCharacterField("background", v, { queueSave: false }));
  bindText("charAlignment", () => state.character.alignment, (v) => updateCharacterField("alignment", v, { queueSave: false }));
  bindNumber("charExperience", () => state.character.experience, (v) => updateCharacterField("experience", v, { queueSave: false }));
  bindText("charFeatures", () => state.character.features, (v) => updateCharacterField("features", v, { queueSave: false }));

  setupTitleSync(state);
  setupAutosizeInputs(autoSizeInput);
  setupCharacterPortrait(deps);
}
