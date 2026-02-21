// js/pages/character/panels/attackPanel.js
// Attacks / Weapons panel (Character page)
//
// Production notes:
// - This module should ONLY own the Attacks panel UI.
// - It should not call other Character-page wiring helpers (reorder, abilities, etc).
// - It must be safe if init is called more than once (guard + no double event listeners).
import { safeAsync } from "../../../ui/safeAsync.js";
import { requireEl, getNoopDestroyApi } from "../../../utils/domGuards.js";

let _state = null;


export function initAttacksPanel(deps = {}) {
  const {
    SaveManager,
    uiConfirm,
    autoSizeInput,
    setStatus,
  } = deps;
  _state = deps.state;

  if (!_state) throw new Error("initAttacksPanel requires state");
  if (!SaveManager) throw new Error("initAttacksPanel requires SaveManager");
  if (!setStatus) throw new Error("initAttacksPanel requires setStatus");

  if (!_state.character) _state.character = {};
  if (!Array.isArray(_state.character.attacks)) _state.character.attacks = [];

  const panelEl = requireEl("#charAttacksPanel", document, { prefix: "initAttacksPanel", warn: false });
  const listEl = requireEl("#attackList", document, { prefix: "initAttacksPanel", warn: false });
  const addBtn = requireEl("#addAttackBtn", document, { prefix: "initAttacksPanel", warn: false });

  if (!panelEl || !listEl || !addBtn) {
    setStatus("Weapons panel unavailable (missing expected UI elements).");
    return getNoopDestroyApi();
  }

  // Guard: avoid wiring twice if character page init runs again.
  if (panelEl.dataset.attacksInit === "1") {
    // Still re-render in case state changed.
    renderAttacks();
    return getNoopDestroyApi();
  }
  panelEl.dataset.attacksInit = "1";

  function newAttackId() {
    return "atk_" + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }

  function renderAttacks() {
    listEl.innerHTML = "";

    if (!_state.character.attacks.length) {
      const empty = document.createElement("div");
      empty.className = "mutedSmall";
      empty.textContent = "No weapons yet. Click “+ Weapon”.";
      listEl.appendChild(empty);
      return;
    }

    const frag = document.createDocumentFragment();
    for (const a of _state.character.attacks) frag.appendChild(renderAttackRow(a));
    listEl.appendChild(frag);
  }

  function renderAttackRow(a) {
    const row = document.createElement("div");
    row.className = "attackRow";
    row.dataset.attackId = a.id;

    const top = document.createElement("div");
    top.className = "attackTop";

    const name = document.createElement("input");
    name.className = "attackName";
    name.placeholder = "Dagger";
    name.value = a.name || "";
    autoSizeInput?.(name, { min: 50, max: 200 });
    name.addEventListener("input", () => patchAttack(a.id, { name: name.value }));
    top.appendChild(name);

    const middle = document.createElement("div");
    middle.className = "attackMiddle";

    const bonus = document.createElement("input");
    bonus.className = "attackBonus";
    bonus.placeholder = "+5";
    bonus.value = a.bonus || "";
    autoSizeInput?.(bonus, { min: 30, max: 60 });
    bonus.addEventListener("input", () => patchAttack(a.id, { bonus: bonus.value }));

    const dmg = document.createElement("input");
    dmg.className = "attackDamage";
    dmg.placeholder = "1d6+2";
    dmg.value = a.damage || "";
    autoSizeInput?.(dmg, { min: 40, max: 160 });
    dmg.addEventListener("input", () => patchAttack(a.id, { damage: dmg.value }));

    middle.appendChild(bonus);
    middle.appendChild(dmg);

    const bottom = document.createElement("div");
    bottom.className = "attackBottom";

    const range = document.createElement("input");
    range.className = "attackRange";
    range.placeholder = "80/320";
    range.value = a.range || "";
    autoSizeInput?.(range, { min: 50, max: 150 });
    range.addEventListener("input", () => patchAttack(a.id, { range: range.value }));

    const type = document.createElement("input");
    type.className = "attackType";
    type.placeholder = "Piercing";
    type.value = a.type || "";
    autoSizeInput?.(type, { min: 40, max: 150 });
    type.addEventListener("input", () => patchAttack(a.id, { type: type.value }));

    const actions = document.createElement("div");
    actions.className = "attackActions";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "X";
    del.title = "Delete weapon";
    del.addEventListener(
      "click",
      safeAsync(async (e) => {
        e.preventDefault();
        e.stopPropagation();
        await deleteAttack(a.id);
      }, (err) => {
        console.error(err);
        setStatus("Delete weapon failed.");
      })
    );

    actions.appendChild(del);

    bottom.appendChild(range);
    bottom.appendChild(type);
    bottom.appendChild(actions);

    row.appendChild(top);
    row.appendChild(middle);
    row.appendChild(bottom);

    return row;
  }

  function patchAttack(id, patch) {
    const idx = _state.character.attacks.findIndex((x) => x.id === id);
    if (idx === -1) return;
    _state.character.attacks[idx] = { ..._state.character.attacks[idx], ...patch };
    SaveManager.markDirty();
  }

  async function deleteAttack(id) {
    if (uiConfirm) {
      const ok = await uiConfirm("Delete this weapon?", { title: "Delete Weapon", okText: "Delete" });
      if (!ok) return;
    }

    _state.character.attacks = _state.character.attacks.filter((x) => x.id !== id);
    SaveManager.markDirty();
    renderAttacks();
  }

  function addAttack() {
    _state.character.attacks.unshift({
      id: newAttackId(),
      name: "",
      notes: "",
      bonus: "",
      damage: "",
      range: "",
      type: "",
    });
    SaveManager.markDirty();
    renderAttacks();
  }

  // Safe: we only wire once due to panel guard above.
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    addAttack();
  });

  renderAttacks();
}
