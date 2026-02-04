// @ts-nocheck
// js/features-ui/characterSectionReorder.js
// Two-column "stacked" layout for Character page panels (like Tracker page columns).
// This allows collapsed panels to shrink and panels below scoot up in that column.
// Preserves visual order on mobile by rebuilding into a single column.

export function setupCharacterSectionReorder({ state, SaveManager }) {
  const page = document.getElementById("page-character");
  if (!page) return;

  const columnsWrap =
    page.querySelector("#charColumns") ||
    page.querySelector(".charColumns");
  if (!columnsWrap) return;

  const col0 = columnsWrap.querySelector("#charCol0");
  const col1 = columnsWrap.querySelector("#charCol1");
  if (!col0 || !col1) return;

  if (!state || !state.character) return;
  if (!state.character.ui) state.character.ui = {};

  // Collect all panels currently inside the character columns wrapper
  const panels = Array.from(columnsWrap.querySelectorAll("section.panel"));

  // Default order from current DOM (row-wise order)
  const defaultOrder = panels.map(p => p.id).filter(Boolean);

  // Ensure stored order exists and includes all current panels (and no unknown ones)
  if (!Array.isArray(state.character.ui.sectionOrder) || state.character.ui.sectionOrder.length === 0) {
    state.character.ui.sectionOrder = defaultOrder.slice();
  } else {
    const set = new Set(defaultOrder);
    const cleaned = state.character.ui.sectionOrder.filter(id => set.has(id));
    for (const id of defaultOrder) if (!cleaned.includes(id)) cleaned.push(id);
    state.character.ui.sectionOrder = cleaned;
  }

  function clearColumn(col) {
    while (col.firstChild) col.removeChild(col.firstChild);
  }

  function moveSection(id, dir) {
    const order = state.character.ui.sectionOrder;
    const i = order.indexOf(id);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    SaveManager?.markDirty?.();
    applyOrder();
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

  // Some Character panels are just <section><h2>...</h2>...</section>.
  // To host reorder controls (and work with click-to-collapse), normalize to a header row.
  function ensureHeaderRow(panelEl) {
    if (!panelEl) return null;

    const existing =
      panelEl.querySelector(":scope > .panelHeader") ||
      panelEl.querySelector(":scope > .row") ||
      panelEl.querySelector(":scope > .panelTop") ||
      panelEl.querySelector(":scope > .sessionHeader") ||
      panelEl.querySelector(":scope > .npcHeader") ||
      panelEl.querySelector(":scope > .partyHeader") ||
      panelEl.querySelector(":scope > .locHeader");

    if (existing) return existing;

    const h2 = panelEl.querySelector(":scope > h2");
    if (h2) {
      const wrap = document.createElement("div");
      wrap.className = "panelHeader";
      panelEl.insertBefore(wrap, h2);
      wrap.appendChild(h2);
      return wrap;
    }

    return null;
  }

  function attachMoves(panelId) {
    const panelEl = document.getElementById(panelId);
    if (!panelEl) return;

    const headerEl = ensureHeaderRow(panelEl);
    if (!headerEl) return;

    // Avoid duplicates if setup runs twice
    if (headerEl.querySelector(`[data-section-moves="${panelId}"]`)) return;

    const wrap = document.createElement("div");
    wrap.className = "sectionMoves";
    wrap.dataset.sectionMoves = panelId;

    wrap.appendChild(makeMoveBtn("↑", "Move section up", () => moveSection(panelId, -1)));
    wrap.appendChild(makeMoveBtn("↓", "Move section down", () => moveSection(panelId, +1)));

    headerEl.appendChild(wrap);
  }

  function applyOrder() {
    const order = state.character.ui.sectionOrder || defaultOrder;
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

  // Initial apply
  applyOrder();

  // Insert reorder buttons into panel headers
  (state.character.ui.sectionOrder || defaultOrder).forEach(attachMoves);

  // Re-apply on resize breakpoint changes
  let t = null;
  window.addEventListener("resize", () => {
    clearTimeout(t);
    t = setTimeout(applyOrder, 120);
  });

  // Optional: allow other modules to re-apply after dynamic UI changes.
  // (No global export; just store a reference if needed.)
  state.character.ui._applySectionOrder = applyOrder;
}
