// js/pages/character/panels/abilitiesPanel.js
// Character page Abilities panel (abilities + skills + save options)

import { enhanceSelectDropdown } from "../../../ui/selectDropdown.js";

export function initAbilitiesPanelUI(deps = {}) {
  const { state, SaveManager, Popovers, bindNumber, bindText } = deps;
  if (!state || !SaveManager || !Popovers) return;

  const panel = document.getElementById("charAbilitiesPanel");
  if (!panel) return;

  if (!state.character) state.character = {};
  if (!state.character.abilities) state.character.abilities = {};
  if (!state.character.skills) state.character.skills = {};

  // Persist open/collapsed state of each ability block's skills list
  // (so refresh keeps them the way the user left them).
  if (!state.character.ui) state.character.ui = {};
  if (!state.character.ui.abilityCollapse) state.character.ui.abilityCollapse = {}; // { str:true, dex:false, ... }

  // Saving throw extras
  if (!state.character.saveOptions) {
    state.character.saveOptions = {
      misc: { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 },
      modToAll: "" // "", or "str"/"dex"/...
    };
  } else {
    // shape safety for older saves
    state.character.saveOptions.misc ||= { str: 0, dex: 0, con: 0, int: 0, wis: 0, cha: 0 };
    if (typeof state.character.saveOptions.modToAll !== "string") state.character.saveOptions.modToAll = "";
  }

  const profInput = document.getElementById("charProf");

  function getProfBonus() {
    return Number(profInput?.value || 0);
  }

  function ensureAbilityShape(key) {
    const raw = state.character.abilities[key];
    if (!raw || typeof raw !== "object") {
      const created = { score: 10, saveProf: false };
      state.character.abilities[key] = created;
      return created;
    }

    if (!Object.prototype.hasOwnProperty.call(raw, "score")) {
      raw.score = 10;
    }
    if (!Object.prototype.hasOwnProperty.call(raw, "saveProf")) {
      raw.saveProf = false;
    }
    raw.saveProf = !!raw.saveProf;
    return raw;
  }

  function computeSaveForAbility(key) {
    const abilityState = ensureAbilityShape(key);
    const score = Number(abilityState.score || 10);
    const mod = Math.floor((score - 10) / 2);
    const prof = getProfBonus();
    const misc = Number(state.character.saveOptions?.misc?.[key] || 0);

    let addMod = 0;
    const pick = state.character.saveOptions?.modToAll;
    if (pick) {
      const pickedScore = Number(state.character.abilities?.[pick]?.score ?? 10);
      addMod = Math.floor((pickedScore - 10) / 2);
    }

    return mod + (abilityState.saveProf ? prof : 0) + misc + addMod;
  }

  function bindAbility(id, key, field) {
    if (typeof bindNumber !== "function") return null;
    const el = document.getElementById(id);
    if (!el) return null;
    if (el.dataset.boundAbilitiesLegacy === "1") return el;
    el.dataset.boundAbilitiesLegacy = "1";

    if (field === "score") {
      return bindNumber(id, () => ensureAbilityShape(key).score, (v) => {
        ensureAbilityShape(key).score = v;
      });
    }

    if (field === "mod") {
      return bindNumber(id, () => {
        const score = Number(ensureAbilityShape(key).score || 10);
        return Math.floor((score - 10) / 2);
      }, () => {
        // Derived from score in the current abilities model.
      });
    }

    if (field === "save") {
      return bindNumber(id, () => computeSaveForAbility(key), () => {
        // Derived from score/save proficiency/save options in the current abilities model.
      });
    }

    return null;
  }

  const abilitySuffixByKey = {
    str: "Str",
    dex: "Dex",
    con: "Con",
    int: "Int",
    wis: "Wis",
    cha: "Cha"
  };

  function syncLegacyAbilityFields(key, score, mod, save) {
    const suffix = abilitySuffixByKey[key];
    if (!suffix) return;

    const scoreEl = document.getElementById(`ab${suffix}`);
    if (scoreEl) {
      scoreEl.value = score === null || score === undefined ? "" : String(score);
    }

    const modInput = document.getElementById(`ab${suffix}Mod`);
    if (modInput) modInput.value = String(mod);

    const saveInput = document.getElementById(`ab${suffix}Save`);
    if (saveInput) saveInput.value = String(save);
  }

  // Legacy ability field bindings (guarded; no-op when ids do not exist).
  bindAbility("abStr", "str", "score");
  bindAbility("abStrMod", "str", "mod");
  bindAbility("abStrSave", "str", "save");

  bindAbility("abDex", "dex", "score");
  bindAbility("abDexMod", "dex", "mod");
  bindAbility("abDexSave", "dex", "save");

  bindAbility("abCon", "con", "score");
  bindAbility("abConMod", "con", "mod");
  bindAbility("abConSave", "con", "save");

  bindAbility("abInt", "int", "score");
  bindAbility("abIntMod", "int", "mod");
  bindAbility("abIntSave", "int", "save");

  bindAbility("abWis", "wis", "score");
  bindAbility("abWisMod", "wis", "mod");
  bindAbility("abWisSave", "wis", "save");

  bindAbility("abCha", "cha", "score");
  bindAbility("abChaMod", "cha", "mod");
  bindAbility("abChaSave", "cha", "save");

  const skillsNotesEl = document.getElementById("charSkillsNotes");
  if (
    skillsNotesEl &&
    typeof bindText === "function" &&
    skillsNotesEl.dataset.boundAbilitiesSkillsNotes !== "1"
  ) {
    skillsNotesEl.dataset.boundAbilitiesSkillsNotes = "1";
    bindText(
      "charSkillsNotes",
      () => state.character.skillsNotes,
      (v) => state.character.skillsNotes = v
    );
  }

  function ensureSkillState(skillKey) {
    const raw = state.character.skills[skillKey];

    // New shape:
    // { level: "none"|"half"|"prof"|"expert", misc: number, value: number }
    if (raw && typeof raw === "object" && "level" in raw) {
      raw.misc = Number(raw.misc || 0);
      return raw;
    }

    // Legacy shape from current build: { prof: boolean, value: number }
    const level = raw?.prof ? "prof" : "none";
    const misc = Number(raw?.misc || 0);

    const migrated = { level, misc, value: Number(raw?.value || 0) };
    state.character.skills[skillKey] = migrated;
    return migrated;
  }

  function profAddForLevel(level, profBonus) {
    if (level === "half") return Math.floor(profBonus / 2);  // D&D 5e rounds down
    if (level === "prof") return profBonus;
    if (level === "expert") return profBonus * 2;
    return 0;
  }

  function labelForLevel(level) {
    if (level === "half") return "½";
    if (level === "prof") return "✓";
    if (level === "expert") return "★";
    return "—";
  }


  // === Skill menu open/close ===
  // These menus are dynamically created; we use the centralized Popovers manager
  // for outside-click, Escape close, and resize reposition.
  let openSkillReg = null;
  const closeOpenSkillMenu = () => {
    if (openSkillReg) Popovers.close(openSkillReg, { focusButton: false });
    openSkillReg = null;
  };

  if (profInput && profInput.dataset.boundAbilitiesProf !== "1") {
    profInput.dataset.boundAbilitiesProf = "1";
    profInput.addEventListener("input", () => {
      document.querySelectorAll(".abilityBlock").forEach(b => {
        b.querySelector(".abilityScore")?.dispatchEvent(new Event("input"));
      });
    });
  }

  // --- Save Options dropdown wiring ---
  (function setupSaveOptionsDropdown() {
    const dropdown = document.getElementById("saveOptionsDropdown");
    const btn = document.getElementById("saveOptionsBtn");
    const menu = document.getElementById("saveOptionsMenu");
    if (!btn || !menu) return;

    const miscIds = ["str", "dex", "con", "int", "wis", "cha"].map(a => [`miscSave_${a}`, a]);

    // load initial values into inputs
    miscIds.forEach(([id, a]) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = String(Number(state.character.saveOptions.misc[a] || 0));
      if (el.dataset.boundAbilitiesSaveMisc !== "1") {
        el.dataset.boundAbilitiesSaveMisc = "1";
        el.addEventListener("input", () => {
          state.character.saveOptions.misc[a] = Number(el.value || 0);
          // Recalc all blocks (cheapest way: poke one input on each block like you already do for prof)
          document.querySelectorAll(".abilityBlock .abilityScore").forEach(x => x.dispatchEvent(new Event("input")));
          SaveManager.markDirty();
        });
      }
    });

    const sel = document.getElementById("saveModToAllSelect");
    if (sel) {
      sel.value = state.character.saveOptions.modToAll || "";

      // Make this select's open menu match the Map Tools dropdown styling.
      // (Native <select> open menus can't be reliably styled across browsers.)
      if (!sel.dataset.dropdownEnhanced) {
        // Use a button that mimics the CLOSED <select> styling (same size),
        // while the OPEN menu uses the Map Tools menu look.
        enhanceSelectDropdown({
          select: sel,
          Popovers,
          buttonClass: "settingsSelectBtn",
          optionClass: "swatchOption",
          groupLabelClass: "dropdownGroupLabel",
          preferRight: true,
          exclusive: false
        });
      }

      // Sync enhanced label without firing the change handler.
      try { sel.dispatchEvent(new Event("selectDropdown:sync")); } catch { }

      if (sel.dataset.boundAbilitiesSaveModToAll !== "1") {
        sel.dataset.boundAbilitiesSaveModToAll = "1";
        sel.addEventListener("change", () => {
          state.character.saveOptions.modToAll = sel.value || "";
          document.querySelectorAll(".abilityBlock .abilityScore").forEach(x => x.dispatchEvent(new Event("input")));
          SaveManager.markDirty();
        });
      }
    }

    // Centralized open/close + outside click + Escape + resize reposition
    if (btn.dataset.boundAbilitiesSaveOptionsPopover !== "1") {
      btn.dataset.boundAbilitiesSaveOptionsPopover = "1";
      if (dropdown) dropdown.dataset.boundAbilitiesSaveOptionsPopover = "1";
      Popovers.register({
        button: btn,
        menu,
        preferRight: true,
        closeOnOutside: true,
        closeOnEsc: true,
        stopInsideClick: true,
        wireButton: true
      });
    }
  })();

  /************************ Ability block reordering (STR/DEX/CON/INT/WIS/CHA) ***********************/
  function setupAbilityBlockReorder() {
    const grid = panel.querySelector(".abilityGrid");
    if (!grid) return;

    const blocks = Array.from(grid.querySelectorAll(".abilityBlock"));
    const defaultOrder = blocks.map(b => b.dataset.ability).filter(Boolean);

    if (!state.character) state.character = {};
    if (!state.character.ui) state.character.ui = {};

    if (!Array.isArray(state.character.ui.abilityOrder) || state.character.ui.abilityOrder.length === 0) {
      state.character.ui.abilityOrder = defaultOrder.slice();
    } else {
      const set = new Set(defaultOrder);
      const cleaned = state.character.ui.abilityOrder.filter(k => set.has(k));
      for (const k of defaultOrder) if (!cleaned.includes(k)) cleaned.push(k);
      state.character.ui.abilityOrder = cleaned;
    }

    function applyOrder() {
      const order = state.character.ui.abilityOrder || defaultOrder;
      const map = new Map(blocks.map(b => [b.dataset.ability, b]));
      order.forEach(k => {
        const el = map.get(k);
        if (el) grid.appendChild(el);
      });
    }

    function moveAbility(key, dir) {
      const order = state.character.ui.abilityOrder;
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

    function attachMoves(blockEl) {
      const key = blockEl.dataset.ability;
      if (!key) return;

      const header = blockEl.querySelector(".abilityHeader");
      if (!header) return;

      if (header.querySelector(`[data-ability-moves="${key}"]`)) return;

      const wrap = document.createElement("div");
      wrap.className = "abilityMoves";
      wrap.dataset.abilityMoves = key;

      wrap.appendChild(makeMoveBtn("↑", "Move ability up", () => moveAbility(key, -1)));
      wrap.appendChild(makeMoveBtn("↓", "Move ability down", () => moveAbility(key, +1)));

      header.appendChild(wrap);
    }

    blocks.forEach(attachMoves);
    applyOrder();
  }

  document.querySelectorAll(".abilityBlock").forEach(block => {
    const ability = block.dataset.ability;
    const scoreInput = block.querySelector(".abilityScore");
    const modEl = block.querySelector('[data-stat="mod"]');
    const saveEl = block.querySelector('[data-stat="save"]');
    const saveProf = block.querySelector('[data-stat="saveProf"]');

    if (!ability || !scoreInput || !modEl || !saveEl || !saveProf) return;

    const abilityState = ensureAbilityShape(ability);

    scoreInput.value = abilityState.score;
    saveProf.checked = abilityState.saveProf;

    function recalc() {
      const score = Number(scoreInput.value || 10);
      const mod = Math.floor((score - 10) / 2);
      const prof = getProfBonus();
      const misc = Number(state.character.saveOptions?.misc?.[ability] || 0);

      let addMod = 0;
      const pick = state.character.saveOptions?.modToAll;
      if (pick) {
        const pickedScore = Number(state.character.abilities?.[pick]?.score ?? 10);
        addMod = Math.floor((pickedScore - 10) / 2);
      }

      const save = mod + (saveProf.checked ? prof : 0) + misc + addMod;

      modEl.textContent = (mod >= 0 ? "+" : "") + mod;
      saveEl.textContent = (save >= 0 ? "+" : "") + save;
      syncLegacyAbilityFields(ability, score, mod, save);

      block.querySelectorAll("[data-skill-value]").forEach(el => {
        const skill = el.dataset.skillValue;
        const st = ensureSkillState(skill);

        const profBonus = getProfBonus();
        const profAdd = profAddForLevel(st.level, profBonus);
        const skillMisc = Number(st.misc || 0);

        const val = mod + profAdd + skillMisc;
        el.textContent = (val >= 0 ? "+" : "") + val;

        st.value = val;
      });

      abilityState.score = score;
      abilityState.saveProf = saveProf.checked;

      SaveManager.markDirty();
    }

    function makeSkillMenu(skillKey, btn) {
      const menu = document.createElement("div");
      menu.className = "dropdownMenu skillProfMenu";
      menu.hidden = true;
      menu.addEventListener("click", (e) => e.stopPropagation());

      const s = ensureSkillState(skillKey);

      const row = (labelText, checked) => {
        const wrap = document.createElement("label");
        wrap.className = "skillMenuRow";

        const cb = document.createElement("input");
        cb.type = "checkbox";
        cb.checked = !!checked;

        const text = document.createElement("span");
        text.textContent = labelText;

        wrap.appendChild(cb);
        wrap.appendChild(text);

        return { wrap, cb };
      };

      const half = row("Half proficient", s.level === "half");
      const prof = row("Proficient", s.level === "prof");
      const expert = row("Expert (double)", s.level === "expert");

      // Mutual exclusivity helper
      function setLevel(next) {
        const st = ensureSkillState(skillKey);
        st.level = next;

        half.cb.checked = next === "half";
        prof.cb.checked = next === "prof";
        expert.cb.checked = next === "expert";

        btn.textContent = labelForLevel(next);
        btn.title = `Skill options (${next})`;

        recalc();      // updates values and saves
      }

      half.cb.addEventListener("change", () => setLevel(half.cb.checked ? "half" : "none"));
      prof.cb.addEventListener("change", () => setLevel(prof.cb.checked ? "prof" : "none"));
      expert.cb.addEventListener("change", () => setLevel(expert.cb.checked ? "expert" : "none"));

      // Misc bonus
      const miscWrap = document.createElement("div");
      miscWrap.className = "skillMenuMisc";

      const miscLabel = document.createElement("div");
      miscLabel.className = "skillMenuLabel";
      miscLabel.textContent = "Misc bonus";

      const miscInput = document.createElement("input");
      miscInput.type = "number";
      miscInput.value = String(Number(s.misc || 0));
      miscInput.className = "skillMiscInput";

      miscInput.addEventListener("input", () => {
        const st = ensureSkillState(skillKey);
        st.misc = Number(miscInput.value || 0);
        recalc();
      });

      miscWrap.appendChild(miscLabel);
      miscWrap.appendChild(miscInput);

      menu.appendChild(half.wrap);
      menu.appendChild(prof.wrap);
      menu.appendChild(expert.wrap);
      menu.appendChild(document.createElement("hr"));
      menu.appendChild(miscWrap);

      document.body.appendChild(menu);
      return menu;
    }

    function replaceSkillCheckboxWithMenu(cb) {
      const skillKey = cb.dataset.skillProf;
      const rowEl = cb.closest(".skillRow");
      if (!rowEl || !skillKey) return;

      // Create the small button
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "skillProfBtn";
      btn.setAttribute("aria-expanded", "false");

      const st = ensureSkillState(skillKey);
      btn.textContent = labelForLevel(st.level);
      btn.title = "Skill options";

      // Build the menu
      const menu = makeSkillMenu(skillKey, btn);

      // Open/close behavior (managed)
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        const reg = Popovers.trackDynamic({
          button: btn,
          menu,
          preferRight: true,
          closeOnOutside: true,
          closeOnEsc: true,
          stopInsideClick: true
        });
        if (!reg) return;

        // Clicking the same open one -> close
        if (openSkillReg === reg && !menu.hidden) {
          closeOpenSkillMenu();
          return;
        }

        closeOpenSkillMenu();
        Popovers.open(reg, { exclusive: false });
        openSkillReg = reg;
      });

      // Swap in the button, remove the old checkbox
      rowEl.insertBefore(btn, cb);
      cb.remove();
    }

    if (scoreInput.dataset.boundAbilitiesRecalcInput !== "1") {
      scoreInput.dataset.boundAbilitiesRecalcInput = "1";
      scoreInput.addEventListener("input", recalc);
    }

    if (saveProf.dataset.boundAbilitiesRecalcChange !== "1") {
      saveProf.dataset.boundAbilitiesRecalcChange = "1";
      saveProf.addEventListener("change", recalc);
    }

    block.querySelectorAll("[data-skill-prof]").forEach(cb => {
      replaceSkillCheckboxWithMenu(cb);
    });

    // Collapsible (with persistence)
    const skills = block.querySelector(".abilitySkills");
    const header = block.querySelector(".abilityHeader");

    // Restore saved collapsed state (default: open)
    const wasCollapsed = !!state.character.ui.abilityCollapse[ability];
    if (skills) skills.style.display = wasCollapsed ? "none" : "";

    if (header && header.dataset.boundAbilitiesCollapse !== "1") {
      header.dataset.boundAbilitiesCollapse = "1";
      header.addEventListener("click", (e) => {
        // Don't collapse when interacting with inputs/checkboxes inside the header
        if (e.target.closest("input, button, label, select, textarea")) return;
        if (!skills) return;

        const nowCollapsed = skills.style.display !== "none"; // we're about to hide it
        skills.style.display = nowCollapsed ? "none" : "";

        // Save per-ability collapse state
        state.character.ui.abilityCollapse[ability] = nowCollapsed;
        SaveManager.markDirty();
      });
    }

    recalc();
  });

  setupAbilityBlockReorder();
}
