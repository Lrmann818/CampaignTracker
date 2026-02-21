// @ts-check
// js/state.js — app-wide state + schema migration

export const STORAGE_KEY = "localCampaignTracker_v1";
export const ACTIVE_TAB_KEY = "localCampaignTracker_activeTab";

// Save schema versioning
export const CURRENT_SCHEMA_VERSION = 2;

/**
 * Schema version history (append-only).
 * For each new schema version:
 * 1) Add a new entry here.
 * 2) Add a migration function in migrateState().
 * 3) Add it to SCHEMA_MIGRATIONS with key N mapping to migrateToV(N+1).
 */
export const SCHEMA_MIGRATION_HISTORY = Object.freeze([
  {
    version: 0,
    date: "2026-02-19",
    changes: "Legacy/unversioned saves before schemaVersion existed."
  },
  {
    version: 1,
    date: "2026-02-19",
    changes: "Normalized top-level buckets and migrated legacy spells/resources/theme/map fields."
  },
  {
    version: 2,
    date: "2026-02-19",
    changes: "Ensured character.inventoryItems exists and migrated legacy equipment text."
  }
]);

/**
 * Broad app state shape used for lightweight JS type-checking.
 *
 * @typedef {Record<string, any>} LooseObject
 */

/**
 * @typedef {{
 *   schemaVersion: number,
 *   tracker: LooseObject,
 *   character: LooseObject,
 *   map: {
 *     activeMapId: string | null,
 *     maps: LooseObject[],
 *     undo: unknown[],
 *     redo: unknown[],
 *     ui?: LooseObject,
 *     [key: string]: unknown
 *   },
 *   ui: {
 *     theme: string,
 *     textareaHeights: Record<string, number>,
 *     panelCollapsed: Record<string, boolean>,
 *     [key: string]: unknown
 *   },
 *   [key: string]: unknown
 * }} State
 */

/** @type {State} */
export const state = {
  // Used to migrate older saves/backups as the app evolves.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  tracker: {
    campaignTitle: "My Campaign",
    sessions: [{ title: "Session 1", notes: "" }],
    sessionSearch: "",
    activeSessionIndex: 0,
    npcs: [],                 // array of npc objects
    npcActiveGroup: "friendly",
    npcSearch: "",
    party: [],
    partySearch: "",
    locationsList: [],
    locSearch: "",
    locFilter: "all",
    misc: "",
    ui: { textareaHeights: {} }
  },
  character: {
    imgBlobId: null,
    name: "",
    classLevel: "",
    race: "",
    background: "",
    alignment: "",
    experience: null,
    features: "",

    hpCur: null,
    hpMax: null,
    hitDieAmt: null,
    hitDieSize: null,
    ac: null,
    initiative: null,
    speed: null,
    proficiency: null,
    spellAttack: null,
    spellDC: null,


    // New: multiple resource trackers in Vitals
    resources: [], // array of { id, name, cur, max }

    abilities: {
      str: { score: null, mod: null, save: null },
      dex: { score: null, mod: null, save: null },
      con: { score: null, mod: null, save: null },
      int: { score: null, mod: null, save: null },
      wis: { score: null, mod: null, save: null },
      cha: { score: null, mod: null, save: null }
    },
    skills: {},
    skillsNotes: "",

    armorProf: "",
    weaponProf: "",
    toolProf: "",
    languages: "",

    attacks: [], // {id,name,bonus,damage,range,type,notes}

    spells: {
      // Spells v2 (dynamic levels). Legacy spell fields are migrated in migrateState.
      levels: []
    },

    inventoryItems: [{ title: "Inventory", notes: "" }],
    activeInventoryIndex: 0,
    inventorySearch: "",
    equipment: "",
    money: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },

    personality: {
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
      notes: ""
    }
  },
  map: {
    // Multi-map support
    activeMapId: null,
    maps: [], // array of { id, name, bgBlobId, drawingBlobId, brushSize, colorKey }

    // undo/redo stacks (in-memory only; never persisted)
    undo: [],
    redo: []
  },
  ui: { theme: "system", textareaHeights: {}, panelCollapsed: {} }
};

const DICE_LAST_DEFAULTS = Object.freeze({
  count: 1,
  sides: 20,
  mod: 0,
  mode: "normal"
});

function clampDiceSides(value) {
  const n = Math.trunc(Number(value));
  if (!Number.isFinite(n)) return DICE_LAST_DEFAULTS.sides;
  return Math.max(2, Math.min(1000, n));
}

function normalizeDiceMode(mode) {
  return (mode === "adv" || mode === "dis") ? mode : DICE_LAST_DEFAULTS.mode;
}

/**
 * Apply runtime-only UI defaults after load/import migration.
 * Dice count/mod are always reset on full load.
 * @param {State | LooseObject | null | undefined} data
 * @returns {State | LooseObject | null | undefined}
 */
export function normalizeState(data) {
  if (!data || typeof data !== "object") return data;
  if (!data.ui || typeof data.ui !== "object") data.ui = {};
  if (!data.ui.dice || typeof data.ui.dice !== "object") data.ui.dice = {};
  data.ui.dice.history = [];

  const prevLast = (data.ui.dice.last && typeof data.ui.dice.last === "object") ? data.ui.dice.last : {};
  data.ui.dice.last = {
    ...prevLast,
    count: DICE_LAST_DEFAULTS.count,
    mod: DICE_LAST_DEFAULTS.mod,
    sides: clampDiceSides(prevLast.sides),
    mode: normalizeDiceMode(prevLast.mode)
  };
  if (!data.ui.calc || typeof data.ui.calc !== "object") data.ui.calc = {};
  data.ui.calc.history = [];

  return data;
}

/**
 * Remove ephemeral UI from persistence/export payloads.
 * @param {State | LooseObject | null | undefined} source
 * @param {{ currentSchemaVersion?: number }} [opts]
 */
export function sanitizeForSave(source, opts = {}) {
  const { currentSchemaVersion = CURRENT_SCHEMA_VERSION } = opts;
  const input = (source && typeof source === "object") ? source : {};

  const serializableMap = { ...(input.map || {}) };
  delete serializableMap.undo;
  delete serializableMap.redo;

  const serializableUi = { ...(input.ui || {}) };
  delete serializableUi.dice;
  if (serializableUi.calc && typeof serializableUi.calc === "object") {
    const serializableCalc = { ...serializableUi.calc };
    delete serializableCalc.history;
    if (Object.keys(serializableCalc).length === 0) {
      delete serializableUi.calc;
    } else {
      serializableUi.calc = serializableCalc;
    }
  }

  return {
    schemaVersion: input.schemaVersion ?? currentSchemaVersion,
    tracker: input.tracker,
    character: input.character,
    map: serializableMap,
    ui: serializableUi
  };
}


// ---------- Map manager (multiple maps) ----------
/**
 * @typedef {{
 *   id: string,
 *   name: string,
 *   bgBlobId: string | null,
 *   drawingBlobId: string | null,
 *   brushSize: number,
 *   colorKey: string
 * }} MapEntry
 */

/**
 * @param {string} [name]
 * @returns {MapEntry}
 */
export function newMapEntry(name = "World Map") {
  return {
    id: `map_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    name: name || "World Map",
    bgBlobId: null,
    drawingBlobId: null,
    brushSize: 6,
    colorKey: "grey"
  };
}

// Exported because app.js (and backup import/export) need to call it.
export function ensureMapManager() {
  if (!state.map || typeof state.map !== "object") state.map = {};
  if (!Array.isArray(state.map.maps)) state.map.maps = [];

  // UI / preferences (tool + shared brush size)
  if (!state.map.ui || typeof state.map.ui !== "object") state.map.ui = {};
  if (typeof state.map.ui.activeTool !== "string") state.map.ui.activeTool = "brush"; // brush | eraser
  if (typeof state.map.ui.brushSize !== "number") state.map.ui.brushSize = 6;

  if (!state.map.maps.length) {
    const m = newMapEntry("World Map");
    state.map.maps.push(m);
    state.map.activeMapId = m.id;
  }
  if (!state.map.activeMapId || !state.map.maps.some(m => m.id === state.map.activeMapId)) {
    state.map.activeMapId = state.map.maps[0].id;
  }

  // Ensure each entry has the expected fields
  state.map.maps.forEach(m => {
    if (!m.id) m.id = newMapEntry().id;
    if (!m.name) m.name = "Map";
    if (m.bgBlobId === undefined) m.bgBlobId = null;
    if (m.drawingBlobId === undefined) m.drawingBlobId = null;
    if (typeof m.brushSize !== "number") m.brushSize = 6;
    if (typeof m.colorKey !== "string") m.colorKey = "grey";
  });

  // Migration / sync: if UI size looks unset but maps have sizes, prefer active map's size
  const active = state.map.maps.find(m => m.id === state.map.activeMapId) || state.map.maps[0];
  if (!Number.isFinite(state.map.ui.brushSize)) state.map.ui.brushSize = (active?.brushSize ?? 6);
}

/**
 * @returns {MapEntry}
 */
export function getActiveMap() {
  ensureMapManager();
  return /** @type {MapEntry} */ (
    state.map.maps.find(m => m.id === state.map.activeMapId) || state.map.maps[0]
  );
}

/************************ Save / Load ***********************/

/**
 * @param {unknown} raw
 * @returns {State}
 */
export function migrateState(raw) {
  // Accept either a full state object or a partial/legacy blob.
  const data = (raw && typeof raw === "object") ? raw : {};

  // Older saves won't have schemaVersion.
  const parsedVersion = Number(data.schemaVersion);
  let v = Number.isFinite(parsedVersion) ? Math.trunc(parsedVersion) : 0;
  if (v < 0) v = 0;

  function ensureObj(parent, key) {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    return parent[key];
  }
  function ensureArr(parent, key) {
    if (!Array.isArray(parent[key])) parent[key] = [];
    return parent[key];
  }

  function migrateToV1() {
    // --- Legacy: character sheet accidentally stored inside map.character ---
    if (!data.character && data.map && data.map.character) {
      data.character = data.map.character;
      delete data.map.character;
    }

    // Ensure top-level buckets exist
    ensureObj(data, "tracker");
    ensureObj(data, "character");
    ensureObj(data, "map");

    // Tracker UI defaults + typo fix
    const t = data.tracker;
    ensureObj(t, "ui");
    if (t.ui?.textareaHeigts && !t.ui.textareaHeights) {
      t.ui.textareaHeights = t.ui.textareaHeigts;
    }
    ensureObj(t.ui, "textareaHeights");
    if (!Array.isArray(t.sessions)) t.sessions = [{ title: "Session 1", notes: "" }];
    if (!Array.isArray(t.npcs)) t.npcs = [];
    if (!Array.isArray(t.party)) t.party = [];
    if (!Array.isArray(t.locationsList)) t.locationsList = [];
    if (typeof t.campaignTitle !== "string") t.campaignTitle = "My Campaign";
    if (typeof t.activeSessionIndex !== "number") t.activeSessionIndex = 0;

    // Character defaults (only fill missing, never overwrite)
    const c = data.character;
    if (!("imgBlobId" in c)) c.imgBlobId = null;
    if (!c.money || typeof c.money !== "object") c.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    if (!c.personality || typeof c.personality !== "object") {
      c.personality = { traits: "", ideals: "", bonds: "", flaws: "", notes: "" };
    }
    if (!Array.isArray(c.resources)) c.resources = [];
    ensureObj(c, "abilities");
    ensureObj(c, "skills");
    ensureObj(c, "ui");
    ensureObj(c.ui, "textareaHeights");
    if (!Array.isArray(c.inventoryItems)) {
      const legacy = typeof c.equipment === "string" ? c.equipment : "";
      c.inventoryItems = [{ title: "Inventory", notes: legacy || "" }];
    }
    if (c.inventoryItems.length === 0) c.inventoryItems.push({ title: "Inventory", notes: "" });

    if (typeof c.activeInventoryIndex !== "number") c.activeInventoryIndex = 0;
    if (c.activeInventoryIndex < 0) c.activeInventoryIndex = 0;
    if (c.activeInventoryIndex >= c.inventoryItems.length) c.activeInventoryIndex = c.inventoryItems.length - 1;

    if (typeof c.inventorySearch !== "string") c.inventorySearch = "";

    // Spells v2 shape + legacy migration
    if (!c.spells || typeof c.spells !== "object") c.spells = { levels: [] };
    // If spells was stored in legacy shape (cantrips/lvl1/lvl2/lvl3), migrate once.
    const looksLegacySpells =
      ("cantrips" in c.spells) || ("lvl1" in c.spells) || ("lvl2" in c.spells) || ("lvl3" in c.spells);

    if (looksLegacySpells && (!Array.isArray(c.spells.levels) || c.spells.levels.length === 0)) {
      const parseLines = (txt) => String(txt || "").split(/\r?\n/).map(s => s.trim()).filter(Boolean);

      const newTextId = (prefix = "id") => `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
      const newSpell = (name = "") => ({ id: newTextId("spell"), name: name || "", notesCollapsed: true, known: true, prepared: false, expended: false });
      const newSpellLevel = (label, hasSlots = true) => ({ id: newTextId("spellLevel"), label: label || "New Level", hasSlots: !!hasSlots, used: null, total: null, collapsed: false, spells: [] });

      const levels = [];
      const can = newSpellLevel("Cantrips", false);
      for (const n of parseLines(c.spells.cantrips)) can.spells.push(newSpell(n));
      levels.push(can);

      const legacyLvls = [c.spells.lvl1, c.spells.lvl2, c.spells.lvl3];
      for (let i = 0; i < legacyLvls.length; i++) {
        const n = i + 1;
        const l = legacyLvls[i] || { used: null, total: null, list: "" };
        const label = n === 1 ? "1st Level" : n === 2 ? "2nd Level" : "3rd Level";
        const level = newSpellLevel(label, true);
        level.used = (typeof l.used === "number") ? l.used : (l.used === "" ? null : (l.used == null ? null : Number(l.used)));
        level.total = (typeof l.total === "number") ? l.total : (l.total === "" ? null : (l.total == null ? null : Number(l.total)));
        for (const name of parseLines(l.list)) level.spells.push(newSpell(name));
        levels.push(level);
      }

      c.spells = { levels };
    } else {
      if (!Array.isArray(c.spells.levels)) c.spells.levels = [];
    }

    // Vitals resources: migrate legacy single-resource fields into the first resource tile, then remove legacy fields.
    if (!Array.isArray(c.resources)) c.resources = [];
    const hasLegacyResource = ("resourceName" in c) || ("resourceCur" in c) || ("resourceMax" in c);
    if (c.resources.length === 0 && hasLegacyResource) {
      const hasAny = !!(c.resourceName || c.resourceCur != null || c.resourceMax != null);
      if (hasAny) {
        c.resources.push({
          id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
          name: c.resourceName || "",
          cur: (c.resourceCur ?? null),
          max: (c.resourceMax ?? null)
        });
      }
    }
    // Always remove legacy fields so the app has a single source of truth.
    delete c.resourceName;
    delete c.resourceCur;
    delete c.resourceMax;

    if (!("hitDieAmt" in c)) c.hitDieAmt = null;
    if (!("hitDieSize" in c)) c.hitDieSize = null;

    // Map defaults (multi-map manager expects these)
    const m = data.map;
    ensureArr(m, "maps");
    ensureObj(m, "ui");
    if (typeof m.ui.activeTool !== "string") m.ui.activeTool = "brush";
    if (typeof m.ui.brushSize !== "number") m.ui.brushSize = 6;
    if (!m.activeMapId) m.activeMapId = null;

    // Root UI bucket used by textarea persistence helpers
    ensureObj(data, "ui");
    ensureObj(data.ui, "textareaHeights");
    ensureObj(data.ui, "panelCollapsed");
    // Default theme should match fresh installs ("system")
    if (typeof data.ui.theme !== "string") data.ui.theme = "system";

    // ---- THEME MIGRATION (important) ----
    if (!data.ui) data.ui = {};

    // Prefer root ui.theme
    if (typeof data.ui.theme !== "string") {
      // Fallback to legacy tracker.ui.theme if present
      if (typeof data.tracker?.ui?.theme === "string") {
        data.ui.theme = data.tracker.ui.theme;
      } else {
        data.ui.theme = "system";
      }
    }
  }

  function migrateToV2() {
    // Ensure inventoryItems exists even for v1 saves (schemaVersion already 1)
    const c = data.character || (data.character = {});
    if (!Array.isArray(c.inventoryItems) || c.inventoryItems.length === 0) {
      const legacy = typeof c.equipment === "string" ? c.equipment : "";
      c.inventoryItems = [{ title: "Inventory", notes: legacy || "" }];
      return;
    }
    // If inventory exists but is empty AND legacy equipment has content, migrate it once.
    const legacy = typeof c.equipment === "string" ? c.equipment : "";
    const first = c.inventoryItems[0];
    const hasAnyNotes = c.inventoryItems.some(it => (it && typeof it.notes === "string" && it.notes.trim()));
    if (!hasAnyNotes && legacy && String(legacy).trim()) {
      if (!first.notes || !String(first.notes).trim()) first.notes = legacy;
      if (!first.title) first.title = "Inventory";
    }
  }

  const SCHEMA_MIGRATIONS = Object.freeze({
    0: migrateToV1,
    1: migrateToV2
  });

  function applyMigrationStep(version) {
    const migrate = SCHEMA_MIGRATIONS[version];
    if (typeof migrate !== "function") return false;
    migrate();
    return true;
  }

  // Unknown future versions are accepted as-is to avoid downgrade/clobbering.
  if (v > CURRENT_SCHEMA_VERSION) {
    return normalizeState(data);
  }

  while (v < CURRENT_SCHEMA_VERSION) {
    if (!applyMigrationStep(v)) break;
    v += 1;
  }

  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return normalizeState(data);
}
