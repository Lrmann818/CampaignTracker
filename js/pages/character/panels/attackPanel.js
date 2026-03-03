// js/pages/character/panels/attackPanel.js
// Attacks / Weapons panel (Character page)
//
// Production notes:
// - This module should ONLY own the Attacks panel UI.
// - It should not call other Character-page wiring helpers (reorder, abilities, etc).
// - It must be safe if init is called more than once (guard + no double event listeners).
import { safeAsync } from "../../../ui/safeAsync.js";
import { createStateActions } from "../../../domain/stateActions.js";
import { createMoveButton } from "../../tracker/panels/cards/shared/cardHeaderControlsShared.js";
import { flipSwapTwo } from "../../../ui/flipSwap.js";
import { requireMany } from "../../../utils/domGuards.js";

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

  if (!_state.character) _state.character = {};
  if (!Array.isArray(_state.character.attacks)) _state.character.attacks = [];
  const { mutateCharacter } = createStateActions({ state: _state, SaveManager });

  const required = {
    panelEl: "#charAttacksPanel",
    listEl: "#attackList",
    addBtn: "#addAttackBtn"
  };
  const guard = requireMany(required, { root: document, setStatus, context: "Weapons panel" });
  if (!guard.ok) return guard.destroy;
  const { panelEl, listEl, addBtn } = guard.els;

  // Guard: avoid wiring twice if character page init runs again.
  if (panelEl.dataset.attacksInit === "1") {
    // Still re-render in case state changed.
    renderAttacks();
    return guard.destroy;
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
    const attacks = _state.character.attacks;
    for (let i = 0; i < attacks.length; i++) frag.appendChild(renderAttackRow(attacks[i], i, attacks.length));
    listEl.appendChild(frag);
  }

  function syncMoveButtonsState() {
    const rows = Array.from(listEl.querySelectorAll(".attackRow"));
    const last = rows.length - 1;
    rows.forEach((row, idx) => {
      const up = row.querySelector('.attackHeaderActions .moveBtn[aria-label="Move weapon up"]');
      const down = row.querySelector('.attackHeaderActions .moveBtn[aria-label="Move weapon down"]');
      if (up) up.disabled = idx === 0;
      if (down) down.disabled = idx === last;
    });
  }

  function focusMoveButtonForAttack(id, dir) {
    const row = listEl.querySelector(`.attackRow[data-attack-id="${id}"]`);
    if (!row) return;
    const selector = dir < 0
      ? '.attackHeaderActions .moveBtn[aria-label="Move weapon up"]'
      : '.attackHeaderActions .moveBtn[aria-label="Move weapon down"]';
    const target = row.querySelector(selector);
    requestAnimationFrame(() => {
      try { target?.focus?.({ preventScroll: true }); } catch { target?.focus?.(); }
    });
  }

  function renderAttackRow(a, index, total) {
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

    const headerActions = document.createElement("div");
    headerActions.className = "attackHeaderActions";

    const moveUp = createMoveButton({
      direction: -1,
      titleUp: "Move weapon up",
      titleDown: "Move weapon down",
      onMove: () => moveAttack(a.id, -1, moveUp),
    });
    moveUp.setAttribute("aria-label", "Move weapon up");
    moveUp.disabled = index === 0;

    const moveDown = createMoveButton({
      direction: +1,
      titleUp: "Move weapon up",
      titleDown: "Move weapon down",
      onMove: () => moveAttack(a.id, +1, moveDown),
    });
    moveDown.setAttribute("aria-label", "Move weapon down");
    moveDown.disabled = index >= total - 1;

    headerActions.appendChild(moveUp);
    headerActions.appendChild(moveDown);
    top.appendChild(headerActions);

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
        if (typeof setStatus === "function") setStatus("Delete weapon failed.");
        else console.warn("Delete weapon failed.");
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
    mutateCharacter((character) => {
      if (!Array.isArray(character.attacks)) return false;
      const idx = character.attacks.findIndex((x) => x.id === id);
      if (idx === -1) return false;
      character.attacks[idx] = { ...character.attacks[idx], ...patch };
      return true;
    });
  }

  async function deleteAttack(id) {
    if (uiConfirm) {
      const ok = await uiConfirm("Delete this weapon?", { title: "Delete Weapon", okText: "Delete" });
      if (!ok) return;
    }

    mutateCharacter((character) => {
      if (!Array.isArray(character.attacks)) character.attacks = [];
      character.attacks = character.attacks.filter((x) => x.id !== id);
      return true;
    });
    renderAttacks();
  }

  function addAttack() {
    mutateCharacter((character) => {
      if (!Array.isArray(character.attacks)) character.attacks = [];
      character.attacks.unshift({
        id: newAttackId(),
        name: "",
        notes: "",
        bonus: "",
        damage: "",
        range: "",
        type: "",
      });
      return true;
    });
    renderAttacks();
  }

  function moveAttack(id, dir, btn) {
    const list = _state.character.attacks;
    if (!Array.isArray(list)) return;
    const i = list.findIndex((x) => x?.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= list.length) return;

    const attackEl = listEl.querySelector(`.attackRow[data-attack-id="${id}"]`);
    const adjacentId = list[j]?.id;
    const adjacentEl = adjacentId
      ? listEl.querySelector(`.attackRow[data-attack-id="${adjacentId}"]`)
      : null;

    const didMove = mutateCharacter((character) => {
      if (!Array.isArray(character.attacks)) return false;
      const i = character.attacks.findIndex((x) => x?.id === id);
      const j = i + dir;
      if (i < 0 || j < 0 || j >= character.attacks.length) return false;
      [character.attacks[i], character.attacks[j]] = [character.attacks[j], character.attacks[i]];
      return true;
    }, { queueSave: false });
    if (!didMove) return;
    SaveManager.markDirty();

    const prevListScroll = listEl.scrollTop;
    const prevPanelScroll = panelEl.scrollTop;
    const didSwap = flipSwapTwo(attackEl, adjacentEl, {
      durationMs: 260,
      easing: "cubic-bezier(.22,1,.36,1)",
      swap: () => {
        if (dir < 0) listEl.insertBefore(attackEl, adjacentEl);
        else listEl.insertBefore(adjacentEl, attackEl);
        listEl.scrollTop = prevListScroll;
        panelEl.scrollTop = prevPanelScroll;
      },
    });
    if (didSwap) {
      syncMoveButtonsState();
      requestAnimationFrame(() => {
        try { btn?.focus?.({ preventScroll: true }); } catch { btn?.focus?.(); }
      });
      return;
    }

    renderAttacks();
    focusMoveButtonForAttack(id, dir);
  }

  // Safe: we only wire once due to panel guard above.
  addBtn.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    addAttack();
  });

  renderAttacks();
}
