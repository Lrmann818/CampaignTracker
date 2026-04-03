// @ts-check

/** @typedef {"npc" | "party" | "loc"} IdPrefix */
/**
 * @typedef {{
 *   sectionId?: string,
 *   notes?: string
 * }} SectionNotesInit
 */
/**
 * @typedef {{
 *   id: string,
 *   sectionId: string,
 *   notes: string,
 *   imgBlobId: string | null,
 *   portraitHidden: boolean,
 *   collapsed: boolean
 * }} TrackerCardBase
 */
/**
 * @typedef {{
 *   status: string,
 *   className: string,
 *   hpMax: number | null,
 *   hpCurrent: number | null
 * }} TrackerVitals
 */
/**
 * @typedef {SectionNotesInit & {
 *   group?: string,
 *   name?: string
 * }} NpcInit
 */
/**
 * @typedef {TrackerCardBase & TrackerVitals & {
 *   group: string,
 *   name: string
 * }} NpcCard
 */
/**
 * @typedef {SectionNotesInit & {
 *   name?: string
 * }} PartyMemberInit
 */
/**
 * @typedef {TrackerCardBase & TrackerVitals & {
 *   name: string
 * }} PartyMemberCard
 */
/**
 * @typedef {SectionNotesInit & {
 *   title?: string,
 *   type?: string
 * }} LocationInit
 */
/**
 * @typedef {TrackerCardBase & {
 *   title: string,
 *   type: string
 * }} LocationCard
 */

/**
 * @param {IdPrefix} prefix
 * @returns {string}
 */
export function makeId(prefix) {
  // Short, readable id good enough for local use.
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * @param {NpcInit} [input]
 * @returns {NpcCard}
 */
export function makeNpc({ sectionId = "", group = "undecided", name = "", notes = "" } = {}) {
  return {
    id: makeId("npc"),
    // sectionId is the primary grouping field for current saves.
    // We keep `group` for backwards-compat / older saves.
    sectionId,
    group,
    name,
    notes,
    status: "",
    className: "",
    hpMax: null,
    hpCurrent: null,
    imgBlobId: null,
    portraitHidden: false,
    collapsed: false
  };
}

/**
 * @param {PartyMemberInit} [input]
 * @returns {PartyMemberCard}
 */
export function makePartyMember({ sectionId = "party", name = "", notes = "" } = {}) {
  return {
    id: makeId("party"),
    sectionId,
    name,
    notes,
    status: "",
    className: "",
    hpMax: null,
    hpCurrent: null,
    imgBlobId: null,
    portraitHidden: false,
    collapsed: false
  };
}

/**
 * @param {LocationInit} [input]
 * @returns {LocationCard}
 */
export function makeLocation({ sectionId = "", title = "", notes = "", type = "town" } = {}) {
  return {
    id: makeId("loc"),
    sectionId,
    title,
    notes,
    type,
    imgBlobId: null,
    portraitHidden: false,
    collapsed: false
  };
}
