// @ts-check
// Content registry helpers for Step 3 rules foundation.

import { BUILTIN_CONTENT } from "./builtinContent.js";

/** @typedef {import("./builtinContent.js").BuiltinContentEntry} BuiltinContentEntry */
/** @typedef {import("./builtinContent.js").BuiltinContentKind} BuiltinContentKind */

/**
 * @typedef {{
 *   entries: BuiltinContentEntry[],
 *   byId: Map<string, BuiltinContentEntry>
 * }} ContentRegistry
 */

/**
 * @param {unknown} value
 * @returns {value is BuiltinContentEntry}
 */
function isContentEntry(value) {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const entry = /** @type {Record<string, unknown>} */ (value);
  return !!value &&
    typeof entry.id === "string" &&
    typeof entry.kind === "string" &&
    typeof entry.name === "string";
}

/**
 * @param {readonly unknown[]} [entries]
 * @returns {ContentRegistry}
 */
export function createContentRegistry(entries = BUILTIN_CONTENT) {
  const normalizedEntries = entries.filter(isContentEntry);
  return {
    entries: normalizedEntries.slice(),
    byId: new Map(normalizedEntries.map((entry) => [entry.id, entry]))
  };
}

/**
 * @param {ContentRegistry | null | undefined} registry
 * @param {unknown} id
 * @returns {BuiltinContentEntry | null}
 */
export function getContentById(registry, id) {
  if (!registry || typeof id !== "string") return null;
  const normalizedId = id.trim();
  if (!normalizedId) return null;
  return registry.byId?.get(normalizedId) || null;
}

/**
 * @param {ContentRegistry | null | undefined} registry
 * @param {BuiltinContentKind | string} kind
 * @returns {BuiltinContentEntry[]}
 */
export function listContentByKind(registry, kind) {
  if (!registry || typeof kind !== "string") return [];
  return (Array.isArray(registry.entries) ? registry.entries : [])
    .filter((entry) => entry.kind === kind);
}

export const BUILTIN_CONTENT_REGISTRY = createContentRegistry(BUILTIN_CONTENT);
