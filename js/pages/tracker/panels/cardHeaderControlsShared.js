// Shared header control button builders for tracker cards.

/**
 * Create a move button (up/down) for card headers.
 *
 * @param {Object} opts
 * @param {-1 | 1} opts.direction
 * @param {(direction: -1 | 1) => void} opts.onMove
 * @param {string} [opts.className="moveBtn"]
 * @param {string} [opts.titleUp="Move card up"]
 * @param {string} [opts.titleDown="Move card down"]
 * @returns {HTMLButtonElement}
 */
export function createMoveButton({
  direction,
  onMove,
  className = "moveBtn",
  titleUp = "Move card up",
  titleDown = "Move card down",
} = {}) {
  const dir = direction === -1 ? -1 : 1;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.textContent = dir === -1 ? "\u2191" : "\u2193";
  btn.title = dir === -1 ? titleUp : titleDown;
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onMove === "function") onMove(dir);
  });
  return btn;
}

/**
 * Create a collapse/expand toggle button for card headers.
 *
 * @param {Object} opts
 * @param {boolean} opts.isCollapsed
 * @param {() => void} opts.onToggle
 * @param {string} [opts.className="cardCollapseBtn"]
 * @returns {HTMLButtonElement}
 */
export function createCollapseButton({
  isCollapsed,
  onToggle,
  className = "cardCollapseBtn",
} = {}) {
  const collapsed = !!isCollapsed;
  const btn = document.createElement("button");
  btn.type = "button";
  btn.className = className;
  btn.setAttribute("aria-label", collapsed ? "Expand card" : "Collapse card");
  btn.setAttribute("aria-expanded", (!collapsed).toString());
  btn.textContent = collapsed ? "\u25bc" : "\u25b2";
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (typeof onToggle === "function") onToggle();
  });
  return btn;
}
