// @ts-check
// js/pages/combat/combatEmbeddedPanels.js
//
// Slice 7 — Embedded Panels
//
// Panel picker, view model helpers, and renderers for the three v1 supported
// embedded panels: Vitals, Spells, and Weapons / Attacks.
//
// Architecture rules:
//  - Reads state.character directly — no copied data, no sync layers.
//  - Does NOT import Character-page panel modules (no fixed-DOM-ID coupling).
//  - Panel selection, order, and collapse persist via combat.workspace.
//  - Embedded panel content re-renders on COMBAT_ENCOUNTER_CHANGED_EVENT so
//    HP writeback from combat cards stays in sync.

import { COMBAT_ENCOUNTER_CHANGED_EVENT } from "./combatEvents.js";

/** @typedef {import("../../state.js").State} State */
/** @typedef {{ markDirty?: () => void }} SaveManagerLike */
/** @typedef {(message: string, opts?: { stickyMs?: number }) => void} CombatStatusFn */

/**
 * @typedef {{ id: string, label: string }} EmbeddedPanelDef
 */

// ─── Panel definitions ───────────────────────────────────────────────────────

/**
 * The three locked v1 embedded panel definitions.
 * Order here is also the display order in the picker.
 * @type {readonly EmbeddedPanelDef[]}
 */
export const EMBEDDED_PANEL_DEFS = Object.freeze([
  { id: "vitals",  label: "Vitals" },
  { id: "spells",  label: "Spells" },
  { id: "weapons", label: "Weapons / Attacks" },
]);

/** @returns {Set<string>} */
function validPanelIdSet() {
  return new Set(EMBEDDED_PANEL_DEFS.map((d) => d.id));
}

// ─── Selection helpers ───────────────────────────────────────────────────────

/**
 * Returns the panel defs that have NOT yet been added to workspace.embeddedPanels.
 * @param {string[]} activeIds
 * @returns {EmbeddedPanelDef[]}
 */
export function getAvailableEmbeddedPanels(activeIds) {
  const activeSet = new Set(
    Array.isArray(activeIds) ? activeIds.filter((id) => typeof id === "string") : []
  );
  return EMBEDDED_PANEL_DEFS.filter((def) => !activeSet.has(def.id));
}

/**
 * Add a panel id to the embeddedPanels array if not already present and valid.
 * Returns true if added; false if duplicate or unknown.
 * @param {string[]} embeddedPanels
 * @param {string} panelId
 * @returns {boolean}
 */
export function addEmbeddedPanel(embeddedPanels, panelId) {
  if (!validPanelIdSet().has(panelId)) return false;
  if (embeddedPanels.includes(panelId)) return false;
  embeddedPanels.push(panelId);
  return true;
}

/**
 * Remove a panel id from the embeddedPanels array.
 * Returns true if removed; false if not found.
 * @param {string[]} embeddedPanels
 * @param {string} panelId
 * @returns {boolean}
 */
export function removeEmbeddedPanel(embeddedPanels, panelId) {
  const idx = embeddedPanels.indexOf(panelId);
  if (idx === -1) return false;
  embeddedPanels.splice(idx, 1);
  return true;
}

// ─── DOM id helper ───────────────────────────────────────────────────────────

const EMBEDDED_PANEL_DOM_ID_PREFIX = "combatEmbeddedPanel_";

/**
 * Returns the DOM id for an embedded panel section element.
 * @param {string} panelId
 * @returns {string}
 */
export function embeddedPanelDomId(panelId) {
  return EMBEDDED_PANEL_DOM_ID_PREFIX + panelId;
}

// ─── View model helpers ──────────────────────────────────────────────────────

/**
 * @param {unknown} value
 * @returns {Record<string, unknown>}
 */
function objectOrEmpty(value) {
  return value && typeof value === "object" && !Array.isArray(value)
    ? /** @type {Record<string, unknown>} */ (value)
    : {};
}

/**
 * Returns a non-empty trimmed string, or null.
 * @param {unknown} value
 * @returns {string | null}
 */
function strOrNull(value) {
  if (value == null) return null;
  const s = String(value).trim();
  return s === "" ? null : s;
}

/**
 * @typedef {{
 *   hp: string,
 *   hpMax: string,
 *   ac: string | null,
 *   initiative: string | null,
 *   speed: string | null,
 *   proficiency: string | null,
 *   spellAttack: string | null,
 *   spellDC: string | null,
 *   resources: Array<{ name: string, cur: string, max: string }>
 * }} VitalsEmbeddedViewModel
 */

/**
 * Build a read-only view model for the Vitals embedded panel from state.character.
 * Safe against missing or malformed state.
 * @param {unknown} state
 * @returns {VitalsEmbeddedViewModel}
 */
export function getVitalsEmbeddedViewModel(state) {
  const c = objectOrEmpty(objectOrEmpty(state).character);

  const rawResources = Array.isArray(c.resources) ? c.resources : [];
  const resources = rawResources.map((r) => {
    const res = objectOrEmpty(r);
    return {
      name: typeof res.name === "string" ? res.name : "",
      cur: res.cur == null ? "—" : String(res.cur),
      max: res.max == null ? "—" : String(res.max),
    };
  });

  return {
    hp: c.hpCur == null ? "—" : String(c.hpCur),
    hpMax: c.hpMax == null ? "—" : String(c.hpMax),
    ac: strOrNull(c.ac),
    initiative: strOrNull(c.initiative),
    speed: strOrNull(c.speed),
    proficiency: strOrNull(c.proficiency),
    spellAttack: strOrNull(c.spellAttack),
    spellDC: strOrNull(c.spellDC),
    resources,
  };
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   known: boolean,
 *   prepared: boolean,
 *   expended: boolean
 * }} SpellEmbeddedEntry
 */

/**
 * @typedef {{
 *   id: string,
 *   label: string,
 *   hasSlots: boolean,
 *   used: string,
 *   total: string,
 *   collapsed: boolean,
 *   spells: SpellEmbeddedEntry[]
 * }} SpellLevelEmbedded
 */

/**
 * @typedef {{ levels: SpellLevelEmbedded[] }} SpellsEmbeddedViewModel
 */

/**
 * Build a view model for the Spells embedded panel from state.character.spells.
 * Safe against missing or malformed state.
 * @param {unknown} state
 * @returns {SpellsEmbeddedViewModel}
 */
export function getSpellsEmbeddedViewModel(state) {
  const c = objectOrEmpty(objectOrEmpty(state).character);
  const spellsObj = objectOrEmpty(c.spells);
  const rawLevels = Array.isArray(spellsObj.levels) ? spellsObj.levels : [];

  const levels = rawLevels.map((rawLevel) => {
    const lv = objectOrEmpty(rawLevel);
    const rawSpells = Array.isArray(lv.spells) ? lv.spells : [];
    return {
      id: typeof lv.id === "string" ? lv.id : "",
      label: typeof lv.label === "string" ? lv.label : "",
      hasSlots: lv.hasSlots === true,
      used: lv.used == null ? "—" : String(lv.used),
      total: lv.total == null ? "—" : String(lv.total),
      collapsed: lv.collapsed === true,
      spells: rawSpells.map((rawSpell) => {
        const sp = objectOrEmpty(rawSpell);
        return {
          id: typeof sp.id === "string" ? sp.id : "",
          name: typeof sp.name === "string" ? sp.name : "",
          known: sp.known !== false,
          prepared: sp.prepared === true,
          expended: sp.expended === true,
        };
      }),
    };
  });

  return { levels };
}

/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   bonus: string,
 *   damage: string,
 *   range: string,
 *   type: string
 * }} WeaponEmbeddedEntry
 */

/**
 * @typedef {{ attacks: WeaponEmbeddedEntry[] }} WeaponsEmbeddedViewModel
 */

/**
 * Build a view model for the Weapons / Attacks embedded panel from
 * state.character.attacks. Safe against missing or malformed state.
 * @param {unknown} state
 * @returns {WeaponsEmbeddedViewModel}
 */
export function getWeaponsEmbeddedViewModel(state) {
  const c = objectOrEmpty(objectOrEmpty(state).character);
  const rawAttacks = Array.isArray(c.attacks) ? c.attacks : [];

  const attacks = rawAttacks.map((rawAtk) => {
    const atk = objectOrEmpty(rawAtk);
    return {
      id: typeof atk.id === "string" ? atk.id : "",
      name: typeof atk.name === "string" ? atk.name : "",
      bonus: typeof atk.bonus === "string" ? atk.bonus : "",
      damage: typeof atk.damage === "string" ? atk.damage : "",
      range: typeof atk.range === "string" ? atk.range : "",
      type: typeof atk.type === "string" ? atk.type : "",
    };
  });

  return { attacks };
}

// ─── DOM renderers ───────────────────────────────────────────────────────────

/**
 * @param {string} tag
 * @param {string} [className]
 * @param {string} [textContent]
 * @returns {HTMLElement}
 */
function createEl(tag, className, textContent) {
  const el = document.createElement(tag);
  if (className) el.className = className;
  if (textContent != null) el.textContent = textContent;
  return el;
}

/**
 * Render Vitals panel content into a container.
 * @param {HTMLElement} container
 * @param {VitalsEmbeddedViewModel} vm
 * @returns {void}
 */
export function renderVitalsEmbeddedContent(container, vm) {
  container.replaceChildren();

  const hpBlock = createEl("div", "combatEmbedHpBlock");
  hpBlock.appendChild(createEl("span", "combatEmbedStatLabel", "HP"));
  hpBlock.appendChild(createEl("span", "combatEmbedHpValue", `${vm.hp} / ${vm.hpMax}`));
  container.appendChild(hpBlock);

  /** @type {Array<[string, string | null]>} */
  const statPairs = [
    ["AC", vm.ac],
    ["Initiative", vm.initiative],
    ["Speed", vm.speed],
    ["Proficiency", vm.proficiency],
    ["Spell Atk", vm.spellAttack],
    ["Spell DC", vm.spellDC],
  ];

  for (const [label, value] of statPairs) {
    if (value == null) continue;
    const row = createEl("div", "combatEmbedStatRow");
    row.appendChild(createEl("span", "combatEmbedStatLabel", label));
    row.appendChild(createEl("span", "combatEmbedStatValue", value));
    container.appendChild(row);
  }

  if (vm.resources.length > 0) {
    const resSection = createEl("div", "combatEmbedResources");
    resSection.appendChild(createEl("div", "combatEmbedSectionLabel", "Resources"));
    for (const r of vm.resources) {
      const row = createEl("div", "combatEmbedResourceRow");
      const name = (r.name || "").trim();
      if (name) row.appendChild(createEl("span", "combatEmbedResourceName", name));
      row.appendChild(createEl("span", "combatEmbedResourceValue", `${r.cur} / ${r.max}`));
      resSection.appendChild(row);
    }
    container.appendChild(resSection);
  }
}

/**
 * Render Spells panel content into a container.
 * @param {HTMLElement} container
 * @param {SpellsEmbeddedViewModel} vm
 * @returns {void}
 */
export function renderSpellsEmbeddedContent(container, vm) {
  container.replaceChildren();

  if (!vm.levels.length) {
    container.appendChild(createEl("p", "mutedSmall m0", "No spells yet."));
    return;
  }

  for (const level of vm.levels) {
    const levelEl = createEl("div", "combatEmbedSpellLevel");
    levelEl.dataset.spellLevelId = level.id;

    const headerEl = createEl("div", "combatEmbedSpellLevelHeader");
    headerEl.appendChild(createEl("span", "combatEmbedSpellLevelLabel", level.label || "Level"));
    if (level.hasSlots) {
      headerEl.appendChild(
        createEl("span", "combatEmbedSpellSlots", `${level.used}/${level.total}`)
      );
    }
    levelEl.appendChild(headerEl);

    if (!level.collapsed) {
      const bodyEl = createEl("div", "combatEmbedSpellLevelBody");
      if (!level.spells.length) {
        bodyEl.appendChild(createEl("p", "mutedSmall m0", "No spells."));
      } else {
        for (const spell of level.spells) {
          const row = createEl("div", "combatEmbedSpellRow");
          row.classList.toggle("isExpended", spell.expended);
          row.appendChild(createEl("span", "combatEmbedSpellName", spell.name || "(unnamed)"));
          const flags = [];
          if (spell.prepared) flags.push("Prep");
          if (spell.expended) flags.push("Cast");
          if (flags.length) {
            row.appendChild(createEl("span", "combatEmbedSpellFlags", flags.join(" · ")));
          }
          bodyEl.appendChild(row);
        }
      }
      levelEl.appendChild(bodyEl);
    }

    container.appendChild(levelEl);
  }
}

/**
 * Render Weapons / Attacks panel content into a container.
 * @param {HTMLElement} container
 * @param {WeaponsEmbeddedViewModel} vm
 * @returns {void}
 */
export function renderWeaponsEmbeddedContent(container, vm) {
  container.replaceChildren();

  if (!vm.attacks.length) {
    container.appendChild(createEl("p", "mutedSmall m0", "No weapons yet."));
    return;
  }

  for (const atk of vm.attacks) {
    const row = createEl("div", "combatEmbedWeaponRow");
    row.appendChild(createEl("span", "combatEmbedWeaponName", atk.name || "(unnamed)"));
    const stats = [atk.bonus, atk.damage, atk.type, atk.range].filter(Boolean);
    if (stats.length) {
      row.appendChild(createEl("span", "combatEmbedWeaponStats", stats.join(" · ")));
    }
    container.appendChild(row);
  }
}

// ─── Panel section DOM builder ───────────────────────────────────────────────

/**
 * Build a collapsible embedded panel section element.
 * @param {EmbeddedPanelDef} def
 * @param {boolean} collapsed
 * @returns {HTMLElement}
 */
function buildEmbeddedPanelSection(def, collapsed) {
  const section = document.createElement("section");
  section.className = "combatPanel combatEmbeddedPanel";
  section.id = embeddedPanelDomId(def.id);
  section.dataset.embeddedPanelId = def.id;
  section.setAttribute("aria-labelledby", `combatEmbeddedTitle_${def.id}`);
  section.dataset.collapsed = collapsed ? "true" : "false";
  section.setAttribute("aria-expanded", collapsed ? "false" : "true");

  const header = createEl("div", "panelHeader panelHeaderClickable");
  header.setAttribute("data-panel-header", "");

  const titleGroup = createEl("div", "combatEmbeddedTitleGroup");
  const title = createEl("h3", "m0");
  title.id = `combatEmbeddedTitle_${def.id}`;
  title.textContent = def.label;
  titleGroup.appendChild(title);
  header.appendChild(titleGroup);

  const removeBtn = document.createElement("button");
  removeBtn.type = "button";
  removeBtn.className = "panelBtn panelBtnSm danger combatEmbeddedRemoveBtn";
  removeBtn.dataset.removeEmbeddedPanel = def.id;
  removeBtn.textContent = "Remove";
  removeBtn.setAttribute("aria-label", `Remove ${def.label} panel`);
  header.appendChild(removeBtn);

  section.appendChild(header);

  const body = createEl("div", "combatEmbeddedPanelBody");
  body.dataset.embeddedPanelBody = def.id;
  section.appendChild(body);

  return section;
}

// ─── Panel picker DOM builder ────────────────────────────────────────────────

/**
 * Build the panel picker row showing buttons for all currently-available panels.
 * @param {EmbeddedPanelDef[]} available
 * @returns {HTMLElement}
 */
function buildPanelPickerRow(available) {
  const row = createEl("div", "combatPanelPicker");
  row.id = "combatPanelPickerRow";

  if (!available.length) {
    row.appendChild(createEl("span", "mutedSmall", "All panels added."));
    return row;
  }

  row.appendChild(createEl("span", "combatPanelPickerLabel", "Add panel:"));

  for (const def of available) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "panelBtn panelBtnSm";
    btn.dataset.addEmbeddedPanel = def.id;
    btn.textContent = `+ ${def.label}`;
    btn.setAttribute("aria-label", `Add ${def.label} panel`);
    row.appendChild(btn);
  }

  return row;
}

// ─── Main initializer ────────────────────────────────────────────────────────

/**
 * Initialize the embedded panels area for the Combat Workspace.
 *
 * Renders a panel picker and one collapsible section per active panel.
 * Panel additions, removals, and collapse state are persisted via
 * combat.workspace.embeddedPanels and combat.workspace.panelCollapsed.
 *
 * @param {{
 *   state: State,
 *   SaveManager: SaveManagerLike,
 *   setStatus?: CombatStatusFn,
 *   root: HTMLElement
 * }} deps
 * @returns {{ destroy: () => void }}
 */
export function initCombatEmbeddedPanels({ state, SaveManager, root }) {
  const containerEl = root.querySelector("#combatEmbeddedPanels");
  if (!(containerEl instanceof HTMLElement)) {
    // Container not present in DOM — degrade gracefully.
    return { destroy() {} };
  }

  let destroyed = false;
  const ac = new AbortController();
  const { signal } = ac;

  /**
   * Get or repair the workspace sub-object from state.
   * @returns {{ embeddedPanels: string[], panelCollapsed: Record<string, boolean> }}
   */
  function getWorkspace() {
    const combat = /** @type {Record<string, unknown>} */ (state.combat || {});
    let workspace = /** @type {Record<string, unknown>} */ (combat.workspace || {});
    if (!workspace || typeof workspace !== "object" || Array.isArray(workspace)) {
      workspace = {};
      combat.workspace = workspace;
    }
    if (!Array.isArray(workspace.embeddedPanels)) workspace.embeddedPanels = [];
    if (!workspace.panelCollapsed || typeof workspace.panelCollapsed !== "object" || Array.isArray(workspace.panelCollapsed)) {
      workspace.panelCollapsed = {};
    }
    return /** @type {any} */ (workspace);
  }

  /**
   * Re-render the content body of a single embedded panel.
   * Reads fresh data from state.character each time.
   * @param {string} panelId
   * @returns {void}
   */
  function renderPanelContent(panelId) {
    const bodyEl = containerEl.querySelector(`[data-embedded-panel-body="${panelId}"]`);
    if (!(bodyEl instanceof HTMLElement)) return;

    if (panelId === "vitals") {
      renderVitalsEmbeddedContent(bodyEl, getVitalsEmbeddedViewModel(state));
    } else if (panelId === "spells") {
      renderSpellsEmbeddedContent(bodyEl, getSpellsEmbeddedViewModel(state));
    } else if (panelId === "weapons") {
      renderWeaponsEmbeddedContent(bodyEl, getWeaponsEmbeddedViewModel(state));
    }
  }

  /**
   * Full re-render: rebuild the picker and all active embedded panel sections.
   * @returns {void}
   */
  function render() {
    if (destroyed) return;

    const workspace = getWorkspace();
    const activePanelIds = /** @type {string[]} */ (workspace.embeddedPanels);
    const panelCollapsed = /** @type {Record<string, boolean>} */ (workspace.panelCollapsed);
    const available = getAvailableEmbeddedPanels(activePanelIds);

    containerEl.replaceChildren();

    // Panel picker
    containerEl.appendChild(buildPanelPickerRow(available));

    // One collapsible section per active panel
    for (const panelId of activePanelIds) {
      const def = EMBEDDED_PANEL_DEFS.find((d) => d.id === panelId);
      if (!def) continue; // unknown id — skip defensively

      const domId = embeddedPanelDomId(def.id);
      const collapsed = panelCollapsed[domId] === true;
      const section = buildEmbeddedPanelSection(def, collapsed);
      containerEl.appendChild(section);

      if (!collapsed) {
        renderPanelContent(panelId);
      }
    }
  }

  // ─── Event handling ─────────────────────────────────────────────────────

  containerEl.addEventListener("click", (event) => {
    if (destroyed) return;
    const target = event.target;
    if (!(target instanceof HTMLElement)) return;

    // Add panel button
    const addBtn = target.closest("[data-add-embedded-panel]");
    if (addBtn instanceof HTMLElement && addBtn.dataset.addEmbeddedPanel) {
      const workspace = getWorkspace();
      const added = addEmbeddedPanel(
        /** @type {string[]} */ (workspace.embeddedPanels),
        addBtn.dataset.addEmbeddedPanel
      );
      if (added) {
        SaveManager.markDirty?.();
        render();
      }
      return;
    }

    // Remove panel button
    const removeBtn = target.closest("[data-remove-embedded-panel]");
    if (removeBtn instanceof HTMLElement && removeBtn.dataset.removeEmbeddedPanel) {
      const workspace = getWorkspace();
      const removed = removeEmbeddedPanel(
        /** @type {string[]} */ (workspace.embeddedPanels),
        removeBtn.dataset.removeEmbeddedPanel
      );
      if (removed) {
        SaveManager.markDirty?.();
        render();
      }
      return;
    }

    // Collapse toggle: header click (skip interactive controls inside the header)
    if (target.closest("button, input, select, textarea, a, label")) return;

    const headerEl = target.closest("[data-panel-header]");
    if (!(headerEl instanceof HTMLElement)) return;

    const sectionEl = headerEl.closest("[data-embedded-panel-id]");
    if (!(sectionEl instanceof HTMLElement)) return;
    const panelId = sectionEl.dataset.embeddedPanelId;
    if (!panelId) return;

    const domId = embeddedPanelDomId(panelId);
    const workspace = getWorkspace();
    const panelCollapsed = /** @type {Record<string, boolean>} */ (workspace.panelCollapsed);
    const next = panelCollapsed[domId] !== true;
    workspace.panelCollapsed = { ...panelCollapsed, [domId]: next };

    sectionEl.dataset.collapsed = next ? "true" : "false";
    sectionEl.setAttribute("aria-expanded", next ? "false" : "true");

    if (!next) {
      // Expanding — render fresh content now
      renderPanelContent(panelId);
    }

    SaveManager.markDirty?.();
  }, { signal });

  // Re-render visible embedded panel content when HP/status writeback occurs
  // so the Vitals panel stays in sync with combat card HP changes.
  window.addEventListener(COMBAT_ENCOUNTER_CHANGED_EVENT, () => {
    if (destroyed) return;
    const workspace = getWorkspace();
    const activePanelIds = /** @type {string[]} */ (workspace.embeddedPanels);
    const panelCollapsed = /** @type {Record<string, boolean>} */ (workspace.panelCollapsed);
    for (const panelId of activePanelIds) {
      if (panelCollapsed[embeddedPanelDomId(panelId)] !== true) {
        renderPanelContent(panelId);
      }
    }
  }, { signal });

  render();

  return {
    destroy() {
      if (destroyed) return;
      destroyed = true;
      ac.abort();
      containerEl.replaceChildren();
    }
  };
}
