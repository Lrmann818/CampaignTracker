// Shared search highlight attachment for tracker cards.

/**
 * Attach in-field search highlight overlays for matching card inputs.
 *
 * @param {Object} opts
 * @param {HTMLElement} opts.cardEl
 * @param {() => string} opts.getQuery
 * @param {(el: HTMLElement, getQuery: () => string) => any} opts.attachSearchHighlightOverlay
 * @param {string} [opts.selector='input:not(.npcHpInput), textarea']
 */
export function attachCardSearchHighlights({
  cardEl,
  getQuery,
  attachSearchHighlightOverlay,
  selector = "input:not(.npcHpInput), textarea",
} = {}) {
  if (!cardEl || typeof cardEl.querySelectorAll !== "function") return;
  if (typeof getQuery !== "function") return;
  if (typeof attachSearchHighlightOverlay !== "function") return;
  cardEl.querySelectorAll(selector).forEach((el) => {
    attachSearchHighlightOverlay(el, getQuery);
  });
}
