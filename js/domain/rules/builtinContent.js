// @ts-check
// Minimal read-only builtin content for the Step 3 rules foundation.

import draconicAncestries from "../../../game-data/srd/draconic-ancestries.json";
import races from "../../../game-data/srd/races.json";

/**
 * @typedef {"race" | "class" | "background" | "ancestry"} BuiltinContentKind
 * @typedef {{
 *   id: string,
 *   kind: BuiltinContentKind,
 *   name: string,
 *   source: "builtin" | "srd-5.1",
 *   ruleset: "srd-5.1",
 *   data: Record<string, unknown>
 * }} BuiltinContentEntry
 */

const RULESET = "srd-5.1";

/**
 * @param {unknown} value
 * @returns {value is Record<string, unknown>}
 */
function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

/**
 * @param {unknown} source
 * @returns {BuiltinContentEntry[]}
 */
function makeDragonbornEntries(source) {
  if (!Array.isArray(source)) return [];
  const dragonborn = source.find((entry) =>
    isRecord(entry) && entry.id === "dragonborn" && entry.kind === "race"
  );
  if (!isRecord(dragonborn) || typeof dragonborn.name !== "string") return [];
  return [
    Object.freeze({
      id: "dragonborn",
      kind: "race",
      name: dragonborn.name,
      source: "srd-5.1",
      ruleset: RULESET,
      data: Object.freeze({ ...dragonborn })
    })
  ];
}

/**
 * @param {unknown} source
 * @returns {BuiltinContentEntry[]}
 */
function makeDraconicAncestryEntries(source) {
  if (!Array.isArray(source)) return [];
  return source
    .filter((entry) =>
      isRecord(entry) &&
      typeof entry.id === "string" &&
      entry.kind === "ancestry" &&
      typeof entry.name === "string"
    )
    .map((entry) => Object.freeze({
      id: /** @type {string} */ (entry.id),
      kind: "ancestry",
      name: /** @type {string} */ (entry.name),
      source: "srd-5.1",
      ruleset: RULESET,
      data: Object.freeze({ ...entry })
    }));
}

/** @type {readonly BuiltinContentEntry[]} */
export const BUILTIN_CONTENT = Object.freeze([
  Object.freeze({
    id: "race_human",
    kind: "race",
    name: "Human",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ speed: 30 })
  }),
  Object.freeze({
    id: "race_dwarf",
    kind: "race",
    name: "Dwarf",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ speed: 30 })
  }),
  Object.freeze({
    id: "race_elf",
    kind: "race",
    name: "Elf",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ speed: 30 })
  }),
  Object.freeze({
    id: "class_fighter",
    kind: "class",
    name: "Fighter",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ hitDie: 10, saveProficiencies: Object.freeze(["str", "con"]) })
  }),
  Object.freeze({
    id: "class_cleric",
    kind: "class",
    name: "Cleric",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ hitDie: 8, saveProficiencies: Object.freeze(["wis", "cha"]) })
  }),
  Object.freeze({
    id: "class_wizard",
    kind: "class",
    name: "Wizard",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({ hitDie: 6, saveProficiencies: Object.freeze(["int", "wis"]) })
  }),
  Object.freeze({
    id: "background_acolyte",
    kind: "background",
    name: "Acolyte",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({})
  }),
  Object.freeze({
    id: "background_sage",
    kind: "background",
    name: "Sage",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({})
  }),
  Object.freeze({
    id: "background_soldier",
    kind: "background",
    name: "Soldier",
    source: "builtin",
    ruleset: RULESET,
    data: Object.freeze({})
  }),
  ...makeDragonbornEntries(races),
  ...makeDraconicAncestryEntries(draconicAncestries)
]);
