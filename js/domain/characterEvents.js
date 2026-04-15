// @ts-check

export const ACTIVE_CHARACTER_CHANGED_EVENT = "loreledger:active-character-changed";

/**
 * @typedef {{
 *   previousId?: string | null,
 *   activeId?: string | null
 * }} ActiveCharacterChangedDetail
 */

/**
 * @param {ActiveCharacterChangedDetail} detail
 * @returns {Event | null}
 */
function createActiveCharacterChangedEvent(detail) {
  if (typeof CustomEvent === "function") {
    return new CustomEvent(ACTIVE_CHARACTER_CHANGED_EVENT, { detail });
  }
  if (typeof Event !== "function") return null;
  const event = new Event(ACTIVE_CHARACTER_CHANGED_EVENT);
  Object.defineProperty(event, "detail", {
    configurable: true,
    enumerable: true,
    value: detail
  });
  return event;
}

/**
 * Notify app modules that state.characters.activeId changed.
 * @param {ActiveCharacterChangedDetail} [detail]
 * @returns {void}
 */
export function notifyActiveCharacterChanged(detail = {}) {
  if (typeof window === "undefined" || typeof window.dispatchEvent !== "function") return;
  const event = createActiveCharacterChangedEvent(detail);
  if (!event) return;
  window.dispatchEvent(event);
}
