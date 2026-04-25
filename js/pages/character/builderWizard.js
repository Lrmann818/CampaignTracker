// @ts-check
// Minimal in-memory builder creation wizard for Phase 2A.

import { CHARACTER_ABILITY_KEYS, makeDefaultCharacterBuild } from "../../domain/characterHelpers.js";
import { deriveCharacter } from "../../domain/rules/deriveCharacter.js";
import {
  BUILTIN_CONTENT_REGISTRY,
  getContentById,
  listContentByKind
} from "../../domain/rules/registry.js";
import { enhanceSelectDropdown } from "../../ui/selectDropdown.js";
import { getNoopDestroyApi, requireMany } from "../../utils/domGuards.js";

const MIN_LEVEL = 1;
const MAX_LEVEL = 20;
const MIN_ABILITY_SCORE = 1;
const MAX_ABILITY_SCORE = 20;
const DEFAULT_NAME = "New Builder Character";
const NOT_SELECTED_LABEL = "Not selected";
const ABILITY_METHODS = Object.freeze([
  { id: "manual", label: "Manual", enabled: true },
  { id: "standard-array", label: "Standard Array", enabled: false },
  { id: "point-buy", label: "Point Buy", enabled: false },
  { id: "roll", label: "Roll", enabled: false }
]);

const ABILITY_META = Object.freeze({
  str: { suffix: "Str", label: "STR" },
  dex: { suffix: "Dex", label: "DEX" },
  con: { suffix: "Con", label: "CON" },
  int: { suffix: "Int", label: "INT" },
  wis: { suffix: "Wis", label: "WIS" },
  cha: { suffix: "Cha", label: "CHA" }
});

/**
 * @typedef {{
 *   name: string,
 *   build: import("../../state.js").CharacterBuildState
 * }} BuilderWizardResult
 */

/**
 * @param {unknown} value
 * @returns {string}
 */
function cleanString(value) {
  return typeof value === "string" ? value.trim() : "";
}

/**
 * @param {unknown} value
 * @param {number} min
 * @param {number} max
 * @param {number} fallback
 * @returns {number}
 */
function clampInteger(value, min, max, fallback) {
  const n = Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, Math.trunc(n)));
}

/**
 * @param {unknown} value
 * @param {import("../../domain/rules/builtinContent.js").BuiltinContentKind} kind
 * @returns {string | null}
 */
function normalizeContentId(value, kind) {
  const id = cleanString(value);
  if (!id) return null;
  return getContentById(BUILTIN_CONTENT_REGISTRY, id)?.kind === kind ? id : null;
}

/**
 * @param {HTMLSelectElement} select
 * @param {import("../../domain/rules/builtinContent.js").BuiltinContentKind} kind
 * @param {unknown} selectedId
 * @returns {void}
 */
function populateContentSelect(select, kind, selectedId) {
  const selected = cleanString(selectedId);
  const entries = listContentByKind(BUILTIN_CONTENT_REGISTRY, kind);
  select.innerHTML = "";

  const emptyOption = document.createElement("option");
  emptyOption.value = "";
  emptyOption.textContent = NOT_SELECTED_LABEL;
  select.appendChild(emptyOption);

  for (const entry of entries) {
    const option = document.createElement("option");
    option.value = entry.id;
    option.textContent = entry.name;
    select.appendChild(option);
  }

  select.value = selected && entries.some((entry) => entry.id === selected) ? selected : "";
}

/**
 * @param {number} value
 * @returns {string}
 */
function signedNumber(value) {
  return value >= 0 ? `+${value}` : String(value);
}

/**
 * @param {HTMLElement} parent
 * @param {string} className
 * @param {string} text
 * @returns {HTMLElement}
 */
function appendDiv(parent, className, text) {
  const el = document.createElement("div");
  el.className = className;
  el.textContent = text;
  parent.appendChild(el);
  return el;
}

/**
 * @param {HTMLElement} panel
 * @returns {HTMLElement[]}
 */
function getFocusable(panel) {
  const selectors = [
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "a[href]",
    "[tabindex]:not([tabindex='-1'])"
  ];
  return /** @type {HTMLElement[]} */ (Array.from(panel.querySelectorAll(selectors.join(",")))
    .filter((el) => !!el &&
      typeof /** @type {HTMLElement} */ (el).focus === "function" &&
      !/** @type {HTMLElement} */ (el).hidden &&
      !/** @type {HTMLElement} */ (el).closest("[hidden]") &&
      !/** @type {HTMLElement} */ (el).classList.contains("nativeSelectHidden")));
}

/**
 * @param {unknown} value
 * @param {string} tagName
 * @returns {boolean}
 */
function hasTagName(value, tagName) {
  return !!value &&
    typeof value === "object" &&
    String(/** @type {{ tagName?: unknown }} */ (value).tagName || "").toUpperCase() === tagName.toUpperCase();
}

/**
 * @param {{
 *   root?: ParentNode,
 *   Popovers?: import("../../ui/popovers.js").PopoversApi | null,
 *   onFinish?: (result: BuilderWizardResult) => void,
 *   setStatus?: (message: string, options?: Record<string, unknown>) => void
 * }} [deps]
 * @returns {{ open: () => void, close: () => void, destroy: () => void }}
 */
export function initBuilderWizard(deps = {}) {
  const {
    root = document,
    Popovers = null,
    onFinish,
    setStatus
  } = deps;

  const guard = requireMany(
    {
      overlay: "#builderWizardOverlay",
      panel: "#builderWizardPanel",
      title: "#builderWizardTitle",
      closeBtn: "#builderWizardClose",
      name: "#builderWizardName",
      race: "#builderWizardRace",
      class: "#builderWizardClass",
      background: "#builderWizardBackground",
      level: "#builderWizardLevel",
      methodManual: "#builderWizardAbilityMethodManual",
      stepIdentity: "#builderWizardStepIdentity",
      stepAbilities: "#builderWizardStepAbilities",
      stepSummary: "#builderWizardStepSummary",
      summary: "#builderWizardSummary",
      backBtn: "#builderWizardBack",
      nextBtn: "#builderWizardNext",
      finishBtn: "#builderWizardFinish",
      cancelBtn: "#builderWizardCancel"
    },
    {
      root,
      setStatus,
      context: "Builder wizard",
      devAssert: false,
      warn: false
    }
  );
  if (!guard.ok) {
    const noop = getNoopDestroyApi();
    return {
      open() {},
      close() {},
      destroy: noop.destroy
    };
  }

  const overlay = /** @type {HTMLElement} */ (guard.els.overlay);
  const panel = /** @type {HTMLElement} */ (guard.els.panel);
  const closeBtn = /** @type {HTMLButtonElement} */ (guard.els.closeBtn);
  const nameInput = /** @type {HTMLInputElement} */ (guard.els.name);
  const raceSelect = /** @type {HTMLSelectElement} */ (guard.els.race);
  const classSelect = /** @type {HTMLSelectElement} */ (guard.els.class);
  const backgroundSelect = /** @type {HTMLSelectElement} */ (guard.els.background);
  const levelInput = /** @type {HTMLInputElement} */ (guard.els.level);
  const methodManualInput = /** @type {HTMLInputElement} */ (guard.els.methodManual);
  const stepIdentity = /** @type {HTMLElement} */ (guard.els.stepIdentity);
  const stepAbilities = /** @type {HTMLElement} */ (guard.els.stepAbilities);
  const stepSummary = /** @type {HTMLElement} */ (guard.els.stepSummary);
  const summaryEl = /** @type {HTMLElement} */ (guard.els.summary);
  const backBtn = /** @type {HTMLButtonElement} */ (guard.els.backBtn);
  const nextBtn = /** @type {HTMLButtonElement} */ (guard.els.nextBtn);
  const finishBtn = /** @type {HTMLButtonElement} */ (guard.els.finishBtn);
  const cancelBtn = /** @type {HTMLButtonElement} */ (guard.els.cancelBtn);

  /** @type {Record<string, HTMLInputElement>} */
  const abilityInputs = {};
  for (const key of CHARACTER_ABILITY_KEYS) {
    const suffix = ABILITY_META[key]?.suffix || key;
    const input = root.querySelector?.(`#builderWizardAbility${suffix}`);
    if (hasTagName(input, "input")) abilityInputs[key] = /** @type {HTMLInputElement} */ (input);
  }

  const listenerController = new AbortController();
  const signal = listenerController.signal;
  /** @type {Element | null} */
  let previousFocus = null;
  let stepIndex = 0;
  let abilityMethod = "manual";
  /** @type {Array<{ rebuild?: () => void, close?: () => void, destroy?: () => void }>} */
  const enhancedSelects = [];
  /** @type {BuilderWizardResult} */
  let draft = {
    name: DEFAULT_NAME,
    build: makeDefaultCharacterBuild()
  };

  function syncDraftFromControls() {
    const summaryNameInput = /** @type {HTMLInputElement | null} */ (root.querySelector?.("#builderWizardSummaryName"));
    const summaryName = stepIndex === 2 && !stepSummary.hidden ? cleanString(summaryNameInput?.value) : "";
    draft.name = summaryName || cleanString(nameInput.value) || DEFAULT_NAME;
    nameInput.value = draft.name;
    draft.build.raceId = normalizeContentId(raceSelect.value, "race");
    draft.build.classId = normalizeContentId(classSelect.value, "class");
    draft.build.backgroundId = normalizeContentId(backgroundSelect.value, "background");
    draft.build.level = clampInteger(levelInput.value, MIN_LEVEL, MAX_LEVEL, draft.build.level || MIN_LEVEL);
    draft.build.abilityMethod = "manual";
    if (!draft.build.abilities || typeof draft.build.abilities !== "object") {
      draft.build.abilities = { base: {} };
    }
    if (!draft.build.abilities.base || typeof draft.build.abilities.base !== "object") {
      draft.build.abilities.base = {};
    }
    abilityMethod = "manual";
    for (const key of CHARACTER_ABILITY_KEYS) {
      draft.build.abilities.base[key] = clampInteger(
        abilityInputs[key]?.value,
        MIN_ABILITY_SCORE,
        MAX_ABILITY_SCORE,
        Number(draft.build.abilities.base[key]) || 10
      );
    }
  }

  function syncControlsFromDraft() {
    nameInput.value = draft.name;
    populateContentSelect(raceSelect, "race", draft.build.raceId);
    populateContentSelect(classSelect, "class", draft.build.classId);
    populateContentSelect(backgroundSelect, "background", draft.build.backgroundId);
    syncEnhancedSelects();
    levelInput.value = String(clampInteger(draft.build.level, MIN_LEVEL, MAX_LEVEL, MIN_LEVEL));
    levelInput.min = String(MIN_LEVEL);
    levelInput.max = String(MAX_LEVEL);
    levelInput.step = "1";
    for (const key of CHARACTER_ABILITY_KEYS) {
      const input = abilityInputs[key];
      if (!input) continue;
      input.value = String(clampInteger(draft.build.abilities.base[key], MIN_ABILITY_SCORE, MAX_ABILITY_SCORE, 10));
      input.min = String(MIN_ABILITY_SCORE);
      input.max = String(MAX_ABILITY_SCORE);
      input.step = "1";
    }
    methodManualInput.checked = true;
  }

  function syncEnhancedSelects() {
    for (const enhanced of enhancedSelects) {
      try { enhanced.rebuild?.(); } catch { /* noop */ }
    }
  }

  function renderAbilityMethods() {
    for (const method of ABILITY_METHODS) {
      const input = /** @type {HTMLInputElement | null} */ (
        root.querySelector?.(`input[name="builderWizardAbilityMethod"][value="${method.id}"]`)
      );
      if (!input) continue;
      input.checked = method.id === abilityMethod;
      input.disabled = !method.enabled;
    }
  }

  function renderSummary() {
    syncDraftFromControls();
    levelInput.value = String(draft.build.level);
    for (const key of CHARACTER_ABILITY_KEYS) {
      if (abilityInputs[key]) abilityInputs[key].value = String(draft.build.abilities.base[key]);
    }

    const derived = deriveCharacter({
      id: "builder_wizard_preview",
      name: draft.name,
      build: draft.build,
      overrides: {
        abilities: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        saves: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
        skills: {},
        initiative: 0
      },
      abilities: {},
      skills: {}
    });

    summaryEl.innerHTML = "";
    const nameReview = document.createElement("label");
    nameReview.className = "builderSummaryNameField";
    nameReview.setAttribute("for", "builderWizardSummaryName");

    const nameLabel = document.createElement("span");
    nameLabel.textContent = "Character Name";
    nameReview.appendChild(nameLabel);

    const summaryNameInput = document.createElement("input");
    summaryNameInput.id = "builderWizardSummaryName";
    summaryNameInput.className = "settingsInput";
    summaryNameInput.value = draft.name;
    summaryNameInput.addEventListener("input", () => {
      draft.name = cleanString(summaryNameInput.value) || DEFAULT_NAME;
      nameInput.value = draft.name;
    }, { signal });
    nameReview.appendChild(summaryNameInput);
    summaryEl.appendChild(nameReview);

    const rows = appendDiv(summaryEl, "builderWizardSummaryRows", "");
    const labels = /** @type {{ classLevel?: unknown, race?: unknown, background?: unknown }} */ (derived.labels || {});
    [
      ["Name", draft.name],
      ["Class / Level", cleanString(labels.classLevel) || NOT_SELECTED_LABEL],
      ["Race", cleanString(labels.race) || NOT_SELECTED_LABEL],
      ["Background", cleanString(labels.background) || NOT_SELECTED_LABEL],
      ["Proficiency Bonus", derived.proficiencyBonus == null ? "" : signedNumber(derived.proficiencyBonus)]
    ].forEach(([label, value]) => {
      const row = appendDiv(rows, "builderSummaryRow", "");
      appendDiv(row, "builderSummaryLabel", label);
      appendDiv(row, "builderSummaryValue", value || NOT_SELECTED_LABEL);
    });

    const abilities = appendDiv(summaryEl, "builderSummaryAbilities", "");
    appendDiv(abilities, "builderSummarySubhead", "Ability Totals");
    const abilityGrid = appendDiv(abilities, "builderAbilityGrid", "");
    for (const key of CHARACTER_ABILITY_KEYS) {
      const ability = derived.abilities[key];
      const row = appendDiv(abilityGrid, "builderAbilityRow", "");
      row.dataset.ability = key;
      appendDiv(row, "builderAbilityLabel", ABILITY_META[key]?.label || key.toUpperCase());
      const total = typeof ability?.total === "number" ? ability.total : null;
      const mod = typeof ability?.modifier === "number" ? ability.modifier : null;
      appendDiv(row, "builderAbilityValue", total == null || mod == null ? NOT_SELECTED_LABEL : `${total} (${signedNumber(mod)})`);
    }
  }

  function syncStep() {
    renderAbilityMethods();
    stepIdentity.hidden = stepIndex !== 0;
    stepAbilities.hidden = stepIndex !== 1;
    stepSummary.hidden = stepIndex !== 2;
    backBtn.hidden = stepIndex === 0;
    nextBtn.hidden = stepIndex === 2;
    finishBtn.hidden = stepIndex !== 2;
    if (stepIndex === 2) renderSummary();
  }

  function close() {
    for (const enhanced of enhancedSelects) {
      try { enhanced.close?.(); } catch { /* noop */ }
    }
    overlay.hidden = true;
    overlay.setAttribute("aria-hidden", "true");
    const target = previousFocus && typeof /** @type {HTMLElement} */ (previousFocus).focus === "function"
      ? /** @type {HTMLElement} */ (previousFocus)
      : null;
    previousFocus = null;
    queueMicrotask(() => {
      try {
        target?.focus?.({ preventScroll: true });
      } catch {
        target?.focus?.();
      }
    });
  }

  function open() {
    draft = {
      name: DEFAULT_NAME,
      build: makeDefaultCharacterBuild()
    };
    stepIndex = 0;
    previousFocus = document.activeElement;
    summaryEl.innerHTML = "";
    syncControlsFromDraft();
    syncStep();
    overlay.hidden = false;
    overlay.setAttribute("aria-hidden", "false");
    queueMicrotask(() => {
      try {
        nameInput.focus({ preventScroll: true });
      } catch {
        nameInput.focus();
      }
    });
  }

  function finish() {
    syncDraftFromControls();
    onFinish?.({
      name: draft.name,
      build: structuredClone(draft.build)
    });
    close();
  }

  function handleKeydown(event) {
    const e = /** @type {KeyboardEvent} */ (event);
    if (overlay.hidden) return;
    if (e.key === "Escape") {
      const target = /** @type {{ closest?: (selector: string) => Element | null } | null} */ (
        e.target && typeof e.target === "object" ? e.target : null
      );
      if (target?.closest?.(".selectDropdown, .dropdownMenu")) return;
      e.preventDefault();
      close();
      return;
    }
    if (e.key !== "Tab") return;
    const focusables = getFocusable(panel);
    if (!focusables.length) return;
    const first = focusables[0];
    const last = focusables[focusables.length - 1];
    const active = document.activeElement;
    if (e.shiftKey && (active === first || active === panel)) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && active === last) {
      e.preventDefault();
      first.focus();
    }
  }

  nextBtn.addEventListener("click", () => {
    syncDraftFromControls();
    stepIndex = Math.min(2, stepIndex + 1);
    syncStep();
  }, { signal });
  backBtn.addEventListener("click", () => {
    syncDraftFromControls();
    stepIndex = Math.max(0, stepIndex - 1);
    syncStep();
  }, { signal });
  finishBtn.addEventListener("click", finish, { signal });
  cancelBtn.addEventListener("click", close, { signal });
  closeBtn.addEventListener("click", close, { signal });
  methodManualInput.addEventListener("change", () => {
    abilityMethod = "manual";
    draft.build.abilityMethod = "manual";
    renderAbilityMethods();
  }, { signal });
  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) close();
  }, { signal });
  document.addEventListener("keydown", handleKeydown, { signal });

  if (Popovers) {
    for (const select of [raceSelect, classSelect, backgroundSelect]) {
      const enhanced = enhanceSelectDropdown({
        select,
        Popovers,
        buttonClass: "settingsSelectBtn builderWizardSelectBtn",
        optionClass: "swatchOption",
        groupLabelClass: "dropdownGroupLabel",
        preferRight: false
      });
      if (enhanced) enhancedSelects.push(enhanced);
    }
  }

  return {
    open,
    close,
    destroy() {
      for (const enhanced of enhancedSelects) {
        try { enhanced.destroy?.(); } catch { /* noop */ }
      }
      enhancedSelects.length = 0;
      listenerController.abort();
      close();
    }
  };
}
