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
