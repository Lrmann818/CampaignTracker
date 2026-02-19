// js/pages/character/panels/basicsPanel.js
// Character page Basics panel (identity fields + portrait)

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
    portraitBindEl.addEventListener("click", async () => {
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
        state.character.imgBlobId = result || null;

        SaveManager.markDirty();
        await renderPortrait();
      } finally {
        _portraitPicking = false;
      }
    });
  }

  renderPortrait();
}

export function initBasicsPanelUI(deps = {}) {
  const {
    state,
    SaveManager,
    bindText,
    bindNumber,
    autoSizeInput,
  } = deps;

  if (!state || !SaveManager || !bindText || !bindNumber) return;
  if (!state.character) state.character = {};

  bindText("charName", () => state.character.name, (v) => state.character.name = v);
  bindText("charClassLevel", () => state.character.classLevel, (v) => state.character.classLevel = v);
  bindText("charRace", () => state.character.race, (v) => state.character.race = v);
  bindText("charBackground", () => state.character.background, (v) => state.character.background = v);
  bindText("charAlignment", () => state.character.alignment, (v) => state.character.alignment = v);
  bindNumber("charExperience", () => state.character.experience, (v) => state.character.experience = v);
  bindText("charFeatures", () => state.character.features, (v) => state.character.features = v);

  setupTitleSync(state);
  setupAutosizeInputs(autoSizeInput);
  setupCharacterPortrait(deps);
}
