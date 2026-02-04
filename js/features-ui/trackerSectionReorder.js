// @ts-nocheck

export function setupTrackerSectionReorder({ state, SaveManager }) {
  const trackerPage = document.getElementById("page-tracker");
  if (!trackerPage) return;

  const columnsWrap =
    trackerPage.querySelector("#trackerColumns") ||
    trackerPage.querySelector(".trackerColumns");
  if (!columnsWrap) return;

  const col0 = columnsWrap.querySelector("#trackerCol0");
  const col1 = columnsWrap.querySelector("#trackerCol1");
  if (!col0 || !col1) return;

  if (!state || !state.tracker) return;

  // Collect panels wherever they currently live (col0/col1 or legacy layout)
  const panels = Array.from(columnsWrap.querySelectorAll(".panel"));

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

  function clearColumn(col) {
    while (col.firstChild) col.removeChild(col.firstChild);
  }

  function applyOrder() {
    const order = state.tracker.ui.sectionOrder || defaultOrder;

    // Map id -> element (pull from DOM if needed)
    const map = new Map(panels.map(p => [p.id, p]));

    clearColumn(col0);
    clearColumn(col1);

    const single = window.matchMedia && window.matchMedia("(max-width: 600px)").matches;

    order.forEach((id, idx) => {
      const el = map.get(id);
      if (!el) return;
      if (single) {
        col0.appendChild(el);
      } else {
        (idx % 2 === 0 ? col0 : col1).appendChild(el);
      }
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

  // Re-apply when responsive breakpoint flips (so order stays correct on resize)
  let t = null;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(applyOrder, 120);
  });
}
