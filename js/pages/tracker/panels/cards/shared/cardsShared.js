export function makeSectionId(prefix) {
  return `${prefix}_` + Math.random().toString(36).slice(2) + Date.now().toString(36);
}

/**
 * @param {Object} config
 * @param {HTMLElement} config.tabsEl
 * @param {Array<{id:string,name:string}>} config.sections
 * @param {string} config.activeId
 * @param {string} config.query
 * @param {string} config.tabClass
 * @param {(sec:{id:string,name:string}, query:string) => boolean} config.sectionMatches
 * @param {(sectionId:string) => void} config.onSelect
 */
export function renderSectionTabs({
  tabsEl,
  sections,
  activeId,
  query,
  tabClass,
  sectionMatches,
  onSelect,
}) {
  tabsEl.innerHTML = "";

  let toShow = (sections || []).filter(sec => {
    if (!query) return true;
    const nameMatch = (sec.name || "").toLowerCase().includes(query);
    if (nameMatch) return true;
    return sectionMatches ? sectionMatches(sec, query) : false;
  });

  if (!toShow.some(s => s.id === activeId)) {
    const active = (sections || []).find(s => s.id === activeId);
    if (active) toShow = [active, ...toShow];
  }

  toShow.forEach(sec => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = `${tabClass}${sec.id === activeId ? " active" : ""}`;
    btn.setAttribute("role", "tab");
    btn.setAttribute("aria-selected", sec.id === activeId ? "true" : "false");
    btn.textContent = sec.name || "Section";
    btn.addEventListener("click", () => onSelect(sec.id));
    tabsEl.appendChild(btn);
  });

  if (toShow.length === 0) {
    const hint = document.createElement("div");
    hint.className = "mutedSmall";
    hint.style.marginLeft = "6px";
    hint.textContent = "No matching sections.";
    tabsEl.appendChild(hint);
  }
}

/**
 * @param {Object} config
 */
export function wireSectionCrud({
  state,
  SaveManager,
  uiPrompt,
  uiAlert,
  uiConfirm,

  addSectionBtn,
  renameSectionBtn,
  deleteSectionBtn,

  sectionsKey,
  activeKey,
  idPrefix,

  newTitle,
  renameTitle,
  deleteTitle,
  deleteConfirmText,

  renderTabs,
  renderCards,
  onDeleteMoveItems,

  newPromptLabel = "New section name:",
  renamePromptLabel = "Rename section to:",
  minSectionsMessage = "You need at least one section.",
  minSectionsTitle = "Notice",
  missingPromptMessage = "This action needs the in-app prompt dialog, but it isn't available.",
  missingPromptTitle = "Missing Dialog",
  missingConfirmMessage = "This action needs the in-app confirm dialog, but it isn't available.",
  missingConfirmTitle = "Missing Dialog",
}) {
  addSectionBtn.addEventListener("click", async () => {
    if (!uiPrompt) {
      await uiAlert?.(missingPromptMessage, { title: missingPromptTitle });
      return;
    }

    const nextNum = (state.tracker[sectionsKey]?.length || 0) + 1;
    const proposed = await uiPrompt(newPromptLabel, {
      defaultValue: `Section ${nextNum}`,
      title: newTitle,
    });
    if (proposed === null) return;

    const name = proposed.trim() || `Section ${nextNum}`;
    const sec = { id: makeSectionId(idPrefix), name };
    state.tracker[sectionsKey].push(sec);
    state.tracker[activeKey] = sec.id;

    SaveManager.markDirty();
    renderTabs();
    renderCards();
  });

  renameSectionBtn.addEventListener("click", async () => {
    const sec = state.tracker[sectionsKey].find(s => s.id === state.tracker[activeKey]);
    if (!sec) return;

    if (!uiPrompt) {
      await uiAlert?.(missingPromptMessage, { title: missingPromptTitle });
      return;
    }

    const proposed = await uiPrompt(renamePromptLabel, {
      defaultValue: sec.name || "",
      title: renameTitle,
    });
    if (proposed === null) return;

    sec.name = proposed.trim() || sec.name || "Section";
    SaveManager.markDirty();
    renderTabs();
  });

  deleteSectionBtn.addEventListener("click", async () => {
    if ((state.tracker[sectionsKey]?.length || 0) <= 1) {
      await uiAlert?.(minSectionsMessage, { title: minSectionsTitle });
      return;
    }

    const sec = state.tracker[sectionsKey].find(s => s.id === state.tracker[activeKey]);
    if (!sec) return;

    if (!uiConfirm) {
      await uiAlert?.(missingConfirmMessage, { title: missingConfirmTitle });
      return;
    }

    const ok = await uiConfirm(deleteConfirmText(sec.name), { title: deleteTitle, okText: "Delete" });
    if (!ok) return;

    const deleteId = sec.id;
    state.tracker[sectionsKey] = state.tracker[sectionsKey].filter(s => s.id !== deleteId);
    const fallbackId = state.tracker[sectionsKey][0].id;

    onDeleteMoveItems(deleteId, fallbackId);
    state.tracker[activeKey] = fallbackId;

    SaveManager.markDirty();
    renderTabs();
    renderCards();
  });
}
