// @ts-nocheck

export function setupTrackerSectionReorder({ state, SaveManager }) {
  const trackerPage = document.getElementById("page-tracker");
  if (!trackerPage) return;

  const grid = trackerPage.querySelector(".grid2");
  if (!grid) return;

  if (!state || !state.tracker) return;

  const panels = Array.from(grid.children).filter(el => el.classList && el.classList.contains("panel"));

  // Build default order from current DOM
  const defaultOrder = panels
    .map(p => p.id)
    .filter(Boolean);

  if (!state.tracker.ui) state.tracker.ui = {};

  // If missing/invalid, reset to default
  if (!Array.isArray(state.tracker.ui.sectionOrder) || state.tracker.ui.sectionOrder.length === 0) {
    state.tracker.ui.sectionOrder = defaultOrder.slice();
  } else {
    // Ensure it contains all current panels (and no unknown ones)
    const set = new Set(defaultOrder);
    const cleaned = state.tracker.ui.sectionOrder.filter(id => set.has(id));
    for (const id of defaultOrder) if (!cleaned.includes(id)) cleaned.push(id);
    state.tracker.ui.sectionOrder = cleaned;
  }

  function applyOrder() {
    const order = state.tracker.ui.sectionOrder || defaultOrder;
    const map = new Map(panels.map(p => [p.id, p]));
    order.forEach(id => {
      const el = map.get(id);
      if (el) grid.appendChild(el);
    });
  }

  function moveSection(id, dir) {
    const order = state.tracker.ui.sectionOrder;
    const i = order.indexOf(id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    SaveManager.markDirty();
    applyOrder();
    // Keep focus on the moved panel header if possible
    document.getElementById(id)?.scrollIntoView({ block: "nearest" });
  }

  function makeMoveBtn(label, title, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "moveBtn";
    b.textContent = label;
    b.title = title;
    b.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      onClick();
    });
    return b;
  }

  function attachMoves(panelId, headerEl) {
    if (!panelId || !headerEl) return;

    // Avoid duplicates if setup runs twice
    if (headerEl.querySelector(`[data-section-moves="${panelId}"]`)) return;

    const wrap = document.createElement("div");
    wrap.className = "sectionMoves";
    wrap.dataset.sectionMoves = panelId;

    wrap.appendChild(makeMoveBtn("↑", "Move section up", () => moveSection(panelId, -1)));
    wrap.appendChild(makeMoveBtn("↓", "Move section down", () => moveSection(panelId, +1)));

    headerEl.appendChild(wrap);
  }

  // Insert buttons into the existing headers
  attachMoves("sessionPanel", trackerPage.querySelector("#sessionPanel .sessionControls"));
  attachMoves("npcPanel", trackerPage.querySelector("#npcPanel .npcControls"));
  attachMoves("partyPanel", trackerPage.querySelector("#partyPanel .partyControls"));
  attachMoves("locationsPanel", trackerPage.querySelector("#locationsPanel .locControls"));

  // Loose Notes uses a dedicated header row in HTML (panelHeader)
  attachMoves("miscPanel", trackerPage.querySelector("#miscPanel .panelHeader"));

  // Apply initial ordering
  applyOrder();
}
