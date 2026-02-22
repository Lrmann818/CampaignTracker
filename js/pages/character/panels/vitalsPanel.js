// js/pages/character/panels/vitalsPanel.js
// Character page Vitals panel (Vitals numbers + resource trackers)

import { numberOrNull } from "../../../utils/number.js";
import { safeAsync } from "../../../ui/safeAsync.js";
import { requireEl, assertEl, getNoopDestroyApi } from "../../../utils/domGuards.js";

function requireCriticalEl(selector, root, prefix) {
  const el = requireEl(selector, root, { prefix });
  if (el) return el;
  try {
    assertEl(selector, root, { prefix, warn: false });
  } catch (err) {
    console.error(err);
  }
  return null;
}

function notifyMissingCritical(setStatus, message) {
  if (typeof setStatus === "function") {
    setStatus(message, { stickyMs: 5000 });
    return;
  }
  console.warn(message);
}

function notifyStatus(setStatus, message) {
  if (typeof setStatus === "function") {
    setStatus(message);
    return;
  }
  console.warn(message);
}

function setupVitalsTileReorder({ state, SaveManager, panelEl, gridEl }) {
  const panel = panelEl || document.getElementById("charVitalsPanel");
  const grid = gridEl || document.getElementById("charVitalsTiles") || panel?.querySelector(".charTiles");
  if (!panel || !grid) return;

  if (!state.character) state.character = {};
  if (!state.character.ui) state.character.ui = {};

  const tiles = Array.from(grid.querySelectorAll(".charTile")).filter((t) => t.dataset.vitalKey);
  const defaultOrder = tiles.map((t) => t.dataset.vitalKey).filter(Boolean);

  if (!Array.isArray(state.character.ui.vitalsOrder) || state.character.ui.vitalsOrder.length === 0) {
    state.character.ui.vitalsOrder = defaultOrder.slice();
  } else {
    const set = new Set(defaultOrder);
    const cleaned = state.character.ui.vitalsOrder.filter((k) => set.has(k));
    for (const k of defaultOrder) if (!cleaned.includes(k)) cleaned.push(k);
    state.character.ui.vitalsOrder = cleaned;
  }

  function applyOrder() {
    const order = state.character.ui.vitalsOrder || defaultOrder;
    const map = new Map(Array.from(grid.querySelectorAll(".charTile")).map((t) => [t.dataset.vitalKey, t]));
    order.forEach((k) => {
      const el = map.get(k);
      if (el) grid.appendChild(el);
    });
  }

  function moveVital(key, dir) {
    const order = state.character.ui.vitalsOrder;
    const i = order.indexOf(key);
    if (i === -1) return;
    const j = i + dir;
    if (j < 0 || j >= order.length) return;
    [order[i], order[j]] = [order[j], order[i]];
    SaveManager.markDirty();
    applyOrder();
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

  function ensureVitalHeader(tileEl) {
    const resHeader = tileEl.querySelector(":scope > .resourceHeader");
    if (resHeader) return resHeader;

    const existing = tileEl.querySelector(":scope > .vitalHeader");
    if (existing) return existing;

    const label = tileEl.querySelector(":scope > .charTileLabel");
    if (!label) return null;

    const header = document.createElement("div");
    header.className = "vitalHeader";
    tileEl.insertBefore(header, label);
    header.appendChild(label);
    return header;
  }

  function attachMoves(tileEl) {
    const key = tileEl.dataset.vitalKey;
    if (!key) return;

    const header = ensureVitalHeader(tileEl);
    if (!header) return;

    if (header.querySelector(`[data-vital-moves="${key}"]`)) return;

    const wrap = document.createElement("div");
    wrap.className = "vitalMoves";
    wrap.dataset.vitalMoves = key;

    wrap.appendChild(makeMoveBtn("↑", "Move up", () => moveVital(key, -1)));
    wrap.appendChild(makeMoveBtn("↓", "Move down", () => moveVital(key, +1)));

    header.appendChild(wrap);
  }

  Array.from(grid.querySelectorAll(".charTile")).forEach(attachMoves);
  applyOrder();
}

export function initVitalsPanel(deps = {}) {
  const {
    state,
    SaveManager,
    bindNumber,
    autoSizeInput,
    enhanceNumberSteppers,
    uiConfirm,
    setStatus,
  } = deps;

  if (!state || !SaveManager || !bindNumber) return;

  if (!state.character) state.character = {};

  const prefix = "initVitalsPanel";
  const criticalSelectors = [
    "#charVitalsPanel",
    "#charVitalsTiles",
    "#addResourceBtn",
    "#charHpCur",
    "#charHpMax",
    "#hitDieAmt",
    "#hitDieSize",
    "#charAC",
    "#charInit",
    "#charSpeed",
    "#charProf",
    "#charSpellAtk",
    "#charSpellDC"
  ];
  const missingCritical = criticalSelectors.some((selector) => !requireCriticalEl(selector, document, prefix));
  const panelEl = requireCriticalEl("#charVitalsPanel", document, prefix);
  const wrap = requireCriticalEl("#charVitalsTiles", document, prefix)
    || panelEl?.querySelector(".charTiles");
  const addBtn = requireCriticalEl("#addResourceBtn", document, prefix);
  if (missingCritical || !panelEl || !wrap || !addBtn) {
    notifyMissingCritical(setStatus, "Vitals panel unavailable (missing expected UI elements).");
    return getNoopDestroyApi();
  }

  function bindVitalsNumbers() {
    bindNumber("charHpCur", () => state.character.hpCur, (v) => state.character.hpCur = v);
    bindNumber("charHpMax", () => state.character.hpMax, (v) => state.character.hpMax = v);
    bindNumber("hitDieAmt", () => state.character.hitDieAmount, (v) => state.character.hitDieAmount = v);
    bindNumber("hitDieSize", () => state.character.hitDieSize, (v) => state.character.hitDieSize = v);
    bindNumber("charAC", () => state.character.ac, (v) => state.character.ac = v);
    bindNumber("charInit", () => state.character.initiative, (v) => state.character.initiative = v);
    bindNumber("charSpeed", () => state.character.speed, (v) => state.character.speed = v);
    bindNumber("charProf", () => state.character.proficiency, (v) => state.character.proficiency = v);
    bindNumber("charSpellAtk", () => state.character.spellAttack, (v) => state.character.spellAttack = v);
    bindNumber("charSpellDC", () => state.character.spellDC, (v) => state.character.spellDC = v);
  }

  function refreshVitalsNumbers() {
    const fields = [
      ["charHpCur", state.character.hpCur],
      ["charHpMax", state.character.hpMax],
      ["hitDieAmt", state.character.hitDieAmount],
      ["hitDieSize", state.character.hitDieSize],
      ["charAC", state.character.ac],
      ["charInit", state.character.initiative],
      ["charSpeed", state.character.speed],
      ["charProf", state.character.proficiency],
      ["charSpellAtk", state.character.spellAttack],
      ["charSpellDC", state.character.spellDC],
    ];

    fields.forEach(([id, value]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = (value === null || value === undefined) ? "" : String(value);
    });
  }

  function autoSizeVitals() {
    [
      "charHpCur",
      "charHpMax",
      "hitDieAmt",
      "hitDieSize",
      "charAC",
      "charInit",
      "charSpeed",
      "charProf",
      "charSpellAtk",
      "charSpellDC",
    ].forEach((id) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.classList.add("autosize");
      autoSizeInput(el, { min: 30, max: 60 });
    });
  }

  function ensureResourceArray() {
    if (!Array.isArray(state.character.resources)) state.character.resources = [];

    if (state.character.resources.length === 0) {
      state.character.resources.push({
        id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
        name: "",
        cur: null,
        max: null
      });
    }
  }

  function setAndSave() {
    SaveManager.markDirty();
  }

  function renderResources() {
    ensureResourceArray();

    Array.from(wrap.querySelectorAll('.charTile[data-vital-key^="res:"]')).forEach((el) => el.remove());

    (state.character.resources || []).forEach((r, idx) => {
      const tile = document.createElement("div");
      tile.className = "charTile resourceTile";
      tile.dataset.resourceId = r.id;
      tile.dataset.vitalKey = `res:${r.id}`;

      const header = document.createElement("div");
      header.className = "resourceHeader";

      const title = document.createElement("div");
      title.className = "resourceTitle";
      title.setAttribute("contenteditable", "true");
      title.setAttribute("spellcheck", "false");
      title.setAttribute("role", "textbox");
      title.setAttribute("aria-label", "Resource name");
      title.dataset.placeholder = "Resource";
      title.textContent = (r.name ?? "").trim();

      title.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          title.blur();
        }
      });

      title.addEventListener("input", () => {
        r.name = title.textContent ?? "";
        setAndSave();
      });

      title.addEventListener("blur", () => {
        const t = (title.textContent ?? "").trim();
        if (!t) title.textContent = "";
      });

      const del = document.createElement("button");
      del.type = "button";
      del.className = "iconBtn danger resourceDeleteBtn";
      del.title = "Remove this resource";
      del.textContent = "✖";
      del.disabled = (state.character.resources.length <= 1);
      del.addEventListener(
        "click",
        safeAsync(async (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (state.character.resources.length <= 1) return;
          const name = (r.name || "").trim();
          const label = name ? `"${name}"` : "this resource tracker";
          if (!(await uiConfirm(`Delete ${label}?`, { title: "Delete Resource", okText: "Delete" }))) return;
          state.character.resources.splice(idx, 1);
          setAndSave();
          renderResources();
        }, (err) => {
          console.error(err);
          notifyStatus(setStatus, "Delete resource failed.");
        })
      );

      header.appendChild(title);

      const footer = document.createElement("div");
      footer.className = "resourceFooterRow";

      const nums = document.createElement("div");
      nums.className = "resourceNums";

      const cur = document.createElement("input");
      cur.type = "number";
      cur.placeholder = "Cur";
      cur.classList.add("autosize");
      cur.value = (r.cur === null || r.cur === undefined) ? "" : String(r.cur);
      autoSizeInput(cur, { min: 30, max: 60 });
      cur.addEventListener("input", () => {
        r.cur = numberOrNull(cur.value);
        setAndSave();
      });

      const slash = document.createElement("span");
      slash.className = "hpSlash";
      slash.textContent = "/";

      const max = document.createElement("input");
      max.type = "number";
      max.placeholder = "Max";
      max.classList.add("autosize");
      max.value = (r.max === null || r.max === undefined) ? "" : String(r.max);
      autoSizeInput(max, { min: 30, max: 60 });
      max.addEventListener("input", () => {
        r.max = numberOrNull(max.value);
        setAndSave();
      });

      nums.appendChild(cur);
      nums.appendChild(slash);
      nums.appendChild(max);

      footer.appendChild(nums);
      footer.appendChild(del);

      tile.appendChild(header);
      tile.appendChild(footer);

      wrap.appendChild(tile);
    });

    enhanceNumberSteppers(wrap);
    setupVitalsTileReorder({ state, SaveManager, panelEl, gridEl: wrap });
  }

  if (panelEl.dataset.vitalsInit === "1") {
    refreshVitalsNumbers();
    autoSizeVitals();
    renderResources();
    return getNoopDestroyApi();
  }
  panelEl.dataset.vitalsInit = "1";

  bindVitalsNumbers();
  autoSizeVitals();

  addBtn.addEventListener("click", () => {
    ensureResourceArray();
    state.character.resources.push({
      id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
      name: "",
      cur: null,
      max: null
    });
    setAndSave();
    renderResources();
  });

  setupVitalsTileReorder({ state, SaveManager, panelEl, gridEl: wrap });
  renderResources();
}
