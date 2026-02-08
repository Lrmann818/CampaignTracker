// js/features-ui/characterSheet.js
// Phase 3: Character page + Spells v2 extracted from app.js.

import { enhanceSelectDropdown } from "../ui/selectDropdown.js";

export function initCharacterSheetUI(deps) {
  const {
    state,
    SaveManager,
    Popovers,

    // Character portrait flow
    ImagePicker,
    pickCropStorePortrait,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    blobIdToObjectUrl,

    // Spells notes storage
    textKey_spellNotes,
    putText,
    getText,
    deleteText,

    // Common UI helpers
    autoSizeInput,
    enhanceNumberSteppers,
    uiAlert,
    uiConfirm,
    uiPrompt,
    setStatus
  } = deps || {};

  // ---------- Spells v2 UI (dynamic levels + spells) ----------
  const _spellNotesCache = new Map(); // spellId -> text
  const _spellNotesSaveTimers = new Map(); // spellId -> timeoutId

  function newTextId(prefix = "id") {
    return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
  }

  function ensureSpellsV2Shape() {
    if (!state.character.spells || typeof state.character.spells !== "object") {
      state.character.spells = { levels: [] };
    }
    if (!Array.isArray(state.character.spells.levels)) state.character.spells.levels = [];
  }

  function newSpellLevel(label, hasSlots = true) {
    return { id: newTextId('spellLevel'), label: label || 'New Level', hasSlots: !!hasSlots, used: null, total: null, collapsed: false, spells: [] };
  }

  // Spell factory (Spells v2).
  // Keep this local so the UI can always create a valid spell object,
  // even if other modules refactor/rename helpers.
  function newSpell(name = '') {
    return {
      id: newTextId('spell'),
      name: name || '',
      notesCollapsed: true,
      known: true,
      prepared: false,
      expended: false
    };
  }

  function setupSpellsV2() {
    const container = document.getElementById('spellLevels');
    const addLevelBtn = document.getElementById('addSpellLevelBtn');
    if (!container || !addLevelBtn) return;

    ensureSpellsV2Shape();
    if (!state.character.spells.levels.length) {
      state.character.spells.levels = [
        newSpellLevel('Cantrips', false),
        newSpellLevel('1st Level', true),
        newSpellLevel('2nd Level', true),
        newSpellLevel('3rd Level', true)
      ];
    }

    const scheduleSpellNotesSave = (spellId, text) => {
      _spellNotesCache.set(spellId, text);
      const prev = _spellNotesSaveTimers.get(spellId);
      if (prev) clearTimeout(prev);
      const t = setTimeout(() => {
        putText(_spellNotesCache.get(spellId) || '', textKey_spellNotes(spellId)).catch(err => console.warn("Failed to save spell notes:", err));
      }, 250);
      _spellNotesSaveTimers.set(spellId, t);
    };

    addLevelBtn.addEventListener('click', async () => {
      const suggested = (() => {
        // Find the highest numbered "<n>th Level" and suggest the next one.
        const levels = (state.character?.spells?.levels || []).map(l => String(l.label || ""));
        let max = 0;
        for (const lab of levels) {
          const m = lab.match(/\b(\d+)\s*(st|nd|rd|th)?\s*level\b/i);
          if (!m) continue;
          const n = Number(m[1]);
          if (Number.isFinite(n) && n > max) max = n;
        }
        const next = Math.max(1, max + 1);
        const ordinal = (n) => {
          const s = ["th", "st", "nd", "rd"];
          const v = n % 100;
          return n + (s[(v - 20) % 10] || s[v] || s[0]);
        };
        return `${ordinal(next)} Level`;
      })();

      const label = ((await uiPrompt('New spell level name:', { defaultValue: suggested, title: 'New Spell Level' })) || '').trim();
      if (!label) return;
      const isCantrip = label.toLowerCase().includes('cantrip');
      state.character.spells.levels.push(newSpellLevel(label, !isCantrip));
      SaveManager.markDirty();
      render();
    });

    async function ensureSpellNotesLoaded(spellId) {
      if (_spellNotesCache.has(spellId)) return;
      const txt = await getText(textKey_spellNotes(spellId));
      _spellNotesCache.set(spellId, txt || '');
    }

    function render() {
      container.innerHTML = '';
      const levels = state.character.spells.levels;
      if (!levels.length) {
        const empty = document.createElement('div');
        empty.className = 'mutedSmall';
        empty.textContent = 'No spell levels yet. Click + Level.';
        container.appendChild(empty);
        return;
      }
      levels.forEach((lvl, i) => container.appendChild(renderLevel(lvl, i)));
      enhanceNumberSteppers(container);
    }

    function renderLevel(level, levelIndex) {
      if (!Array.isArray(level.spells)) level.spells = [];

      const card = document.createElement('div');
      card.className = 'spellLevel';

      const header = document.createElement('div');
      header.className = 'spellLevelHeader';

      const left = document.createElement('div');
      left.className = 'spellLevelLeft';

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'spellCollapseBtn';
      collapseBtn.title = level.collapsed ? 'Expand level' : 'Collapse level';
      collapseBtn.textContent = level.collapsed ? '▸' : '▾';
      collapseBtn.setAttribute(
        'aria-expanded',
        level.collapsed ? 'false' : 'true'
      );
      collapseBtn.addEventListener('click', (e) => {
        e.preventDefault();
        level.collapsed = !level.collapsed;
        collapseBtn.setAttribute(
          'aria-expanded',
          level.collapsed ? 'false' : 'true'
        );
        SaveManager.markDirty();
        render();
      });

      const titleWrap = document.createElement('div');
      titleWrap.className = 'spellLevelTitle';
      const titleInput = document.createElement('input');
      titleInput.value = level.label || '';
      titleInput.placeholder = 'Level name';
      titleInput.addEventListener('input', () => {
        level.label = titleInput.value;
        SaveManager.markDirty();
      });
      titleWrap.appendChild(titleInput);

      left.appendChild(collapseBtn);
      left.appendChild(titleWrap);

      const right = document.createElement('div');
      right.className = 'spellLevelRight';

      if (level.hasSlots) {
        const slots = document.createElement('div');
        slots.className = 'spellSlots';
        const used = document.createElement('input');
        used.classList.add("num-sum");
        used.type = 'number';
        used.placeholder = 'Used';
        used.value = (level.used ?? '');
        used.addEventListener('input', () => {
          level.used = used.value === '' ? null : Number(used.value); SaveManager.markDirty();
        });
        const sep = document.createElement('span');
        sep.className = 'muted';
        sep.textContent = '/';
        const total = document.createElement('input');
        total.classList.add("num-sum");
        total.type = 'number';
        total.placeholder = 'Total';
        total.value = (level.total ?? '');
        total.addEventListener('input', () => {
          level.total = total.value === '' ? null : Number(total.value); SaveManager.markDirty();
        });
        slots.appendChild(used); slots.appendChild(sep); slots.appendChild(total);
        right.appendChild(slots);
      }

      const actions = document.createElement('div');
      actions.className = 'spellLevelActions';

      const addSpellBtn = document.createElement('button');
      addSpellBtn.type = 'button';
      addSpellBtn.textContent = '+ Spell';
      addSpellBtn.addEventListener('click', () => {
        // Defensive: ensure the spells array exists before pushing.
        if (!Array.isArray(level.spells)) level.spells = [];
        level.spells.push(newSpell(''));
        SaveManager.markDirty();
        render();
      });

      const resetExpBtn = document.createElement('button');
      resetExpBtn.type = 'button';
      resetExpBtn.textContent = 'Reset Cast';
      resetExpBtn.title = 'Clear expended/cast flags for this level';
      resetExpBtn.addEventListener('click', () => {
        level.spells.forEach(sp => sp.expended = false);
        SaveManager.markDirty();
        render();
      });

      const deleteLevelBtn = document.createElement('button');
      deleteLevelBtn.type = 'button';
      deleteLevelBtn.className = 'danger';
      deleteLevelBtn.textContent = 'X';
      deleteLevelBtn.addEventListener('click', async () => {
        if (!(await uiConfirm(`Delete level "${level.label || 'this level'}" and all its spells?`, { title: 'Delete Spell Level', okText: 'Delete' }))) return;
        // delete associated notes
        for (const sp of level.spells) {
          _spellNotesCache.delete(sp.id);
          await deleteText(textKey_spellNotes(sp.id));
        }
        state.character.spells.levels.splice(levelIndex, 1);
        SaveManager.markDirty();
        render();
      });

      actions.appendChild(addSpellBtn);
      actions.appendChild(resetExpBtn);
      actions.appendChild(deleteLevelBtn);
      right.appendChild(actions);

      header.appendChild(left);
      header.appendChild(right);
      card.appendChild(header);

      if (!level.collapsed) {
        const body = document.createElement('div');
        body.className = 'spellBody';

        if (!level.spells.length) {
          const empty = document.createElement('div');
          empty.className = 'mutedSmall';
          empty.textContent = 'No spells yet. Click + Spell.';
          body.appendChild(empty);
        } else {
          level.spells.forEach((spell, spellIndex) => body.appendChild(renderSpell(level, spell, levelIndex, spellIndex)));
        }

        card.appendChild(body);
      }

      return card;
    }

    function renderSpell(level, spell, levelIndex, spellIndex) {
      const row = document.createElement('div');
      row.className = 'spellRow';

      const top = document.createElement('div');
      top.className = 'spellRowTop';

      const collapseBtn = document.createElement('button');
      collapseBtn.type = 'button';
      collapseBtn.className = 'spellSpellCollapseBtn';
      collapseBtn.title = spell.notesCollapsed ? 'Show notes' : 'Hide notes';
      collapseBtn.textContent = spell.notesCollapsed ? '▸' : '▾';
      collapseBtn.setAttribute(
        'aria-expanded',
        spell.notesCollapsed ? 'false' : 'true'
      );
      collapseBtn.addEventListener('click', async () => {
        spell.notesCollapsed = !spell.notesCollapsed;
        if (!spell.notesCollapsed) {
          await ensureSpellNotesLoaded(spell.id);
        }
        collapseBtn.setAttribute(
          'aria-expanded',
          spell.notesCollapsed ? 'false' : 'true'
        );
        SaveManager.markDirty();
        render();
      });

      const name = document.createElement('input');
      name.className = 'spellName';
      name.placeholder = 'Spell name';
      name.value = spell.name || '';
      name.addEventListener('input', () => {
        spell.name = name.value; SaveManager.markDirty();
      });

      const toggles = document.createElement('div');
      toggles.className = 'spellToggles';

      const mkToggle = (label, key, extraClass = '') => {
        const b = document.createElement('button');
        b.type = 'button';
        b.className = `spellToggle ${extraClass}`.trim();
        b.textContent = label;

        const refresh = () => {
          const isOn = !!spell[key];
          b.classList.toggle('on', isOn);
          b.setAttribute('aria-pressed', isOn ? 'true' : 'false');
        };

        refresh();

        b.addEventListener('click', () => {
          spell[key] = !spell[key];
          refresh();
          SaveManager.markDirty();
        });

        return b;
      };

      toggles.appendChild(mkToggle('Known', 'known'));
      toggles.appendChild(mkToggle('Prepared', 'prepared'));
      toggles.appendChild(mkToggle('Cast', 'expended', 'warn'));

      const mini = document.createElement('div');
      mini.className = 'spellMiniBtns';

      const up = document.createElement('button');
      up.type = 'button';
      up.className = 'moveBtn';
      up.title = 'Move up';
      up.textContent = '↑';
      up.disabled = spellIndex === 0;
      up.addEventListener('click', () => {
        if (spellIndex === 0) return;
        const arr = level.spells;
        arr.splice(spellIndex - 1, 0, arr.splice(spellIndex, 1)[0]);
        SaveManager.markDirty();
        render();
      });

      const down = document.createElement('button');
      down.type = 'button';
      down.className = 'moveBtn';
      down.title = 'Move down';
      down.textContent = '↓';
      down.disabled = spellIndex === level.spells.length - 1;
      down.addEventListener('click', () => {
        if (spellIndex >= level.spells.length - 1) return;
        const arr = level.spells;
        arr.splice(spellIndex + 1, 0, arr.splice(spellIndex, 1)[0]);
        SaveManager.markDirty();
        render();
      });

      const del = document.createElement('button');
      del.type = 'button';
      del.className = 'danger';
      del.textContent = 'X';
      del.addEventListener('click', async () => {
        if (!(await uiConfirm(`Delete spell "${spell.name || 'this spell'}"?`, { title: 'Delete Spell', okText: 'Delete' }))) return;
        level.spells.splice(spellIndex, 1);
        _spellNotesCache.delete(spell.id);
        await deleteText(textKey_spellNotes(spell.id));
        SaveManager.markDirty();
        render();
      });

      mini.appendChild(up);
      mini.appendChild(down);
      mini.appendChild(del);

      top.appendChild(collapseBtn);
      top.appendChild(name);
      top.appendChild(toggles);
      top.appendChild(mini);
      row.appendChild(top);

      if (!spell.notesCollapsed) {
        const notesWrap = document.createElement('div');
        notesWrap.className = 'spellNotes';
        const ta = document.createElement('textarea');
        // Stable id so we can persist the resized height even when the spell collapses/expands
        ta.id = `spellNotes_${spell.id}`;
        ta.setAttribute('data-persist-size', '');
        ta.placeholder = 'Spell notes / description...';
        // Load cached value if present; otherwise empty until async load finishes
        ta.value = _spellNotesCache.get(spell.id) ?? '';
        ta.addEventListener('input', () => {
          scheduleSpellNotesSave(spell.id, ta.value);
        });
        // Ensure loaded
        if (!_spellNotesCache.has(spell.id)) {
          ta.placeholder = 'Loading...';
          ensureSpellNotesLoaded(spell.id).then(() => {
            ta.placeholder = 'Spell notes / description...';
            ta.value = _spellNotesCache.get(spell.id) ?? '';

            // Re-measure after programmatic value set (otherwise it won't autosize until focus/blur)
            requestAnimationFrame(() => window.__applyTextareaSize?.(ta));
          });
        }
        notesWrap.appendChild(ta);
        row.appendChild(notesWrap);
      }

      return row;
    }

    render();
  }


  function setupCharacterSectionReorder() {
    const charPage = document.getElementById("page-character");
    if (!charPage) return;

    const grid = charPage.querySelector(".grid2");
    if (!grid) return;

    const panels = Array.from(grid.children).filter(el => el.classList && el.classList.contains("panel"));
    const defaultOrder = panels.map(p => p.id).filter(Boolean);

    if (!state.character) state.character = {};
    if (!state.character.ui) state.character.ui = {};

    if (!Array.isArray(state.character.ui.sectionOrder) || state.character.ui.sectionOrder.length === 0) {
      state.character.ui.sectionOrder = defaultOrder.slice();
    } else {
      const set = new Set(defaultOrder);
      const cleaned = state.character.ui.sectionOrder.filter(id => set.has(id));
      for (const id of defaultOrder) if (!cleaned.includes(id)) cleaned.push(id);
      state.character.ui.sectionOrder = cleaned;
    }

    function applyOrder() {
      const order = state.character.ui.sectionOrder || defaultOrder;
      const map = new Map(panels.map(p => [p.id, p]));
      order.forEach(id => {
        const el = map.get(id);
        if (el) grid.appendChild(el);
      });
    }

    function moveSection(id, dir) {
      const order = state.character.ui.sectionOrder;
      const i = order.indexOf(id);
      if (i === -1) return;
      const j = i + dir;
      if (j < 0 || j >= order.length) return;
      [order[i], order[j]] = [order[j], order[i]];
      SaveManager.markDirty();
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

    function ensureHeaderRow(panelEl) {
      if (!panelEl) return null;

      const existing =
        panelEl.querySelector(":scope > .panelHeader") ||
        panelEl.querySelector(":scope > .row") ||
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

      if (headerEl.querySelector(`[data-section-moves="${panelId}"]`)) return;

      const wrap = document.createElement("div");
      wrap.className = "sectionMoves";
      wrap.dataset.sectionMoves = panelId;

      wrap.appendChild(makeMoveBtn("↑", "Move section up", () => moveSection(panelId, -1)));
      wrap.appendChild(makeMoveBtn("↓", "Move section down", () => moveSection(panelId, +1)));

      headerEl.appendChild(wrap);
    }

    defaultOrder.forEach(attachMoves);
    applyOrder();
  }

  /************************ Ability block reordering (STR/DEX/CON/INT/WIS/CHA) ***********************/
  function setupAbilityBlockReorder() {
    const panel = document.getElementById("charAbilitiesPanel");
    if (!panel) return;

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

  /************************ Vitals tile reordering (within Vitals section) ***********************/
  function setupVitalsTileReorder() {
    const panel = document.getElementById("charVitalsPanel");
    const grid = document.getElementById("charVitalsTiles") || panel?.querySelector(".charTiles");
    if (!panel || !grid) return;

    if (!state.character) state.character = {};
    if (!state.character.ui) state.character.ui = {};

    const tiles = Array.from(grid.querySelectorAll(".charTile")).filter(t => t.dataset.vitalKey);
    const defaultOrder = tiles.map(t => t.dataset.vitalKey).filter(Boolean);

    // init/clean persisted order
    if (!Array.isArray(state.character.ui.vitalsOrder) || state.character.ui.vitalsOrder.length === 0) {
      state.character.ui.vitalsOrder = defaultOrder.slice();
    } else {
      const set = new Set(defaultOrder);
      const cleaned = state.character.ui.vitalsOrder.filter(k => set.has(k));
      for (const k of defaultOrder) if (!cleaned.includes(k)) cleaned.push(k);
      state.character.ui.vitalsOrder = cleaned;
    }

    function applyOrder() {
      const order = state.character.ui.vitalsOrder || defaultOrder;
      const map = new Map(Array.from(grid.querySelectorAll(".charTile")).map(t => [t.dataset.vitalKey, t]));
      order.forEach(k => {
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
      // Resource tiles already have a header row
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

    // Attach moves + apply order
    Array.from(grid.querySelectorAll(".charTile")).forEach(attachMoves);
    applyOrder();
  }

  /************************ Character Sheet page ***********************/
  function initCharacterUI() {
    const root = document.getElementById("page-character");
    if (!root) return;

    function formatPossessive(name) {
      const n = (name || "").trim();
      if (!n) return "";
      // If it ends with s/S, prefer: "Silas' Campaign Tracker"
      return /[sS]$/.test(n) ? `${n}'` : `${n}'s`;
    }

    function updateTabTitle() {
      const base = "Campaign Tracker";
      const name = state.character?.name || ""; // state.character.name exists 1
      const poss = formatPossessive(name);
      document.title = poss ? `${poss} ${base}` : base;
    }

    // Ensure shape exists (older saves/backups)
    if (!state.character) state.character = {};
    if (!state.character.abilities) state.character.abilities = {};
    if (!state.character.spells) state.character.spells = {};
    if (!state.character.money) state.character.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    if (!state.character.personality) state.character.personality = {};

    const bindText = (id, getter, setter) => {
      const el = document.getElementById(id);
      if (!el) return;
      el.value = getter() ?? "";
      el.addEventListener("input", () => {
        setter(el.value);
        SaveManager.markDirty();
      });
    };

    const bindNumber = (id, getter, setter, autosizeOpts) => {
      const el = document.getElementById(id);
      if (!el) return;

      const v = getter();
      el.value = (v === null || v === undefined) ? "" : String(v);

      // ✅ autosize once right after restore (fixes refresh)
      el.classList.add("autosize");
      autoSizeInput(el, autosizeOpts ?? { min: 30, max: 80 });

      el.addEventListener("input", () => {
        setter(numberOrNull(el.value));

        // ✅ autosize as the user types
        autoSizeInput(el, autosizeOpts ?? { min: 30, max: 80 });

        SaveManager.markDirty();
      });
    };

    // Basics
    bindText("charName", () => state.character.name, v => state.character.name = v);
    bindText("charClassLevel", () => state.character.classLevel, v => state.character.classLevel = v);
    bindText("charRace", () => state.character.race, v => state.character.race = v);
    bindText("charBackground", () => state.character.background, v => state.character.background = v);
    bindText("charAlignment", () => state.character.alignment, v => state.character.alignment = v);
    bindNumber("charExperience", () => state.character.experience, v => state.character.experience = v);
    bindText("charFeatures", () => state.character.features, v => state.character.features = v);

    const nameInput = document.getElementById("charName");
    const classInput = document.getElementById("charClassLevel");
    const raceInput = document.getElementById("charRace");
    const bgInput = document.getElementById("charBackground");
    const alignInput = document.getElementById("charAlignment");
    const xpInput = document.getElementById("charExperience");

    // Set initial title based on saved character name (if any)
    updateTabTitle();
    nameInput?.addEventListener("input", updateTabTitle);

    if (nameInput) {
      nameInput.classList.add("autosize");
      autoSizeInput(nameInput, { min: 55, max: 320 });
    }
    if (classInput) {
      classInput.classList.add("autosize");
      autoSizeInput(classInput, { min: 55, max: 320 });
    }
    if (raceInput) {
      raceInput.classList.add("autosize");
      autoSizeInput(raceInput, { min: 55, max: 320 });
    }
    if (bgInput) {
      bgInput.classList.add("autosize");
      autoSizeInput(bgInput, { min: 55, max: 320 });
    }
    if (alignInput) {
      alignInput.classList.add("autosize");
      autoSizeInput(alignInput, { min: 55, max: 320 });
    }
    if (xpInput) {
      xpInput.classList.add("autosize");
      autoSizeInput(xpInput, { min: 30, max: 320 });
    }

    // Vitals
    bindNumber("charHpCur", () => state.character.hpCur, v => state.character.hpCur = v);
    bindNumber("charHpMax", () => state.character.hpMax, v => state.character.hpMax = v);
    bindNumber("hitDieAmt", () => state.character.hitDieAmount, v => state.character.hitDieAmount = v);
    bindNumber("hitDieSize", () => state.character.hitDieSize, v => state.character.hitDieSize = v);
    bindNumber("charAC", () => state.character.ac, v => state.character.ac = v);
    bindNumber("charInit", () => state.character.initiative, v => state.character.initiative = v);
    bindNumber("charSpeed", () => state.character.speed, v => state.character.speed = v);
    bindNumber("charProf", () => state.character.proficiency, v => state.character.proficiency = v);
    bindNumber("charSpellAtk", () => state.character.spellAttack, v => state.character.spellAttack = v);
    bindNumber("charSpellDC", () => state.character.spellDC, v => state.character.spellDC = v);

    // After the Vitals bindNumber(...) calls:
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

      // optional: helps you find these later in CSS if you ever want
      el.classList.add("autosize");

      // numbers in your vitals are intended to stay small (30–60ish)
      autoSizeInput(el, { min: 30, max: 60 });
    });

    /***********************
     * Vitals: Resource trackers (multiple)
     ***********************/
    (function setupResourceTrackers() {
      const wrap = document.getElementById("charVitalsTiles") || document.querySelector("#charVitalsPanel .charTiles");
      const addBtn = document.getElementById("addResourceBtn");
      if (!wrap || !addBtn) return;
      // Resources are stored as an array (single source of truth).
      // Legacy single-resource fields are migrated in js/state.js (migrateState).
      if (!Array.isArray(state.character.resources)) state.character.resources = [];

      if (state.character.resources.length === 0) {
        state.character.resources.push({
          id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
          name: "",
          cur: null,
          max: null
        });
      }

      function setAndSave() {
        SaveManager.markDirty();
      }

      function render() {
        // Remove any previously-rendered resource tiles
        Array.from(wrap.querySelectorAll('.charTile[data-vital-key^="res:"]')).forEach(el => el.remove());

        (state.character.resources || []).forEach((r, idx) => {
          const tile = document.createElement("div");
          tile.className = "charTile resourceTile";
          tile.dataset.resourceId = r.id;
          tile.dataset.vitalKey = `res:${r.id}`;

          const header = document.createElement("div");
          header.className = "resourceHeader";

          // Title label (editable) — visually matches the campaign title style,
          // but saves into r.name.
          const title = document.createElement("div");
          title.className = "resourceTitle";
          title.setAttribute("contenteditable", "true");
          title.setAttribute("spellcheck", "false");
          title.setAttribute("role", "textbox");
          title.setAttribute("aria-label", "Resource name");
          title.dataset.placeholder = "Resource";
          title.textContent = (r.name ?? "").trim();

          // Prevent Enter from creating new lines inside the tile header.
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

          // Normalize empty state so CSS :empty placeholder works reliably.
          title.addEventListener("blur", () => {
            const t = (title.textContent ?? "").trim();
            if (!t) title.textContent = "";
          });

          const del = document.createElement("button");
          del.type = "button";
          del.className = "iconBtn danger resourceDeleteBtn";
          del.title = "Remove this resource";
          del.textContent = "✕";
          del.disabled = (state.character.resources.length <= 1);
          del.addEventListener("click", async (e) => {
            e.preventDefault();
            e.stopPropagation();
            if (state.character.resources.length <= 1) return;
            const name = (r.name || "").trim();
            const label = name ? `"${name}"` : "this resource tracker";
            if (!(await uiConfirm(`Delete ${label}?`, { title: "Delete Resource", okText: "Delete" }))) return;
            state.character.resources.splice(idx, 1);
            setAndSave();
            render();
          });

          header.appendChild(title);

          // Footer row: keep the number group tight (inputs + slash) and push the delete button to the right.
          const footer = document.createElement("div");
          footer.className = "resourceFooterRow";

          const nums = document.createElement("div");
          nums.className = "resourceNums";

          const cur = document.createElement("input");
          cur.type = "number";
          cur.placeholder = "Cur";
          cur.value = (r.cur === null || r.cur === undefined) ? "" : String(r.cur);
          autoSizeInput(cur, { min: 30, max: 55 });
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
          max.value = (r.max === null || r.max === undefined) ? "" : String(r.max);
          autoSizeInput(max, { min: 30, max: 55 });
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
        // Add custom steppers to the newly-rendered resource inputs
        enhanceNumberSteppers(wrap);
        // Ensure move buttons + order includes newly-added resources
        setupVitalsTileReorder();
      }

      addBtn.addEventListener("click", () => {
        state.character.resources.push({
          id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
          name: "",
          cur: null,
          max: null
        });
        setAndSave();
        render();
      });

      // Make sure static tiles get reorder buttons first
      setupVitalsTileReorder();
      render();
    })();

    // Abilities
    const ab = (key) => {
      if (!state.character.abilities[key]) state.character.abilities[key] = { score: null, mod: null, save: null };
      return state.character.abilities[key];
    };

    const bindAbility = (id, key, field) => {
      bindNumber(id, () => ab(key)[field], v => ab(key)[field] = v);
    };

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

    bindText("charSkillsNotes", () => state.character.skillsNotes, v => state.character.skillsNotes = v);

    // Proficiencies
    bindText("charArmorProf", () => state.character.armorProf, v => state.character.armorProf = v);
    bindText("charWeaponProf", () => state.character.weaponProf, v => state.character.weaponProf = v);
    bindText("charToolProf", () => state.character.toolProf, v => state.character.toolProf = v);
    bindText("charLanguages", () => state.character.languages, v => state.character.languages = v);

    // Equipment & money
    bindText("charEquipment", () => state.character.equipment, v => state.character.equipment = v);

    const bindMoney = (id, key) => bindNumber(id, () => state.character.money?.[key], v => {
      if (!state.character.money) state.character.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
      state.character.money[key] = (v === null ? 0 : v);
    });

    bindMoney("moneyPP", "pp");
    bindMoney("moneyGP", "gp");
    bindMoney("moneyEP", "ep");
    bindMoney("moneySP", "sp");
    bindMoney("moneyCP", "cp");

    const ppInput = document.getElementById("moneyPP");
    const gpInput = document.getElementById("moneyGP");
    const epInput = document.getElementById("moneyEP");
    const spInput = document.getElementById("moneySP");
    const cpInput = document.getElementById("moneyCP");

    if (ppInput) {
      ppInput.classList.add("autosize");
      autoSizeInput(ppInput, { min: 30, max: 320 });
    }
    if (gpInput) {
      gpInput.classList.add("autosize");
      autoSizeInput(gpInput, { min: 30, max: 320 });
    }
    if (epInput) {
      epInput.classList.add("autosize");
      autoSizeInput(epInput, { min: 30, max: 320 });
    }
    if (spInput) {
      spInput.classList.add("autosize");
      autoSizeInput(spInput, { min: 30, max: 320 });
    }
    if (cpInput) {
      cpInput.classList.add("autosize");
      autoSizeInput(cpInput, { min: 30, max: 320 });
    }

    // Personality
    const p = state.character.personality;
    bindText("charTraits", () => p.traits, v => p.traits = v);
    bindText("charIdeals", () => p.ideals, v => p.ideals = v);
    bindText("charBonds", () => p.bonds, v => p.bonds = v);
    bindText("charFlaws", () => p.flaws, v => p.flaws = v);
    bindText("charCharNotes", () => p.notes, v => p.notes = v);

    // Spells (v2)
    setupSpellsV2();



    // Attacks
    if (!Array.isArray(state.character.attacks)) state.character.attacks = [];

    const listEl = document.getElementById("attackList");
    const addBtn = document.getElementById("addAttackBtn");

    /***********************
     * Character portrait
     ***********************/
    (function setupCharacterPortrait() {
      const boxEl = document.getElementById("charPortraitTop");
      if (!boxEl) return;

      let _portraitPicking = false;

      async function renderPortrait() {
        // wipe the box and rebuild contents like NPC
        boxEl.innerHTML = "";

        if (state.character.imgBlobId) {
          const img = document.createElement("img");
          img.alt = state.character.name || "Character Portrait";
          boxEl.appendChild(img);

          let url = null;
          try { url = await blobIdToObjectUrl(state.character.imgBlobId); }
          catch (err) {
            console.warn("Failed to load map background blob:", err);
          }
          if (url) img.src = url;
          return;
        }

        const placeholder = document.createElement("div");
        placeholder.className = "portraitPlaceholder";
        placeholder.textContent = "Add Image";
        boxEl.appendChild(placeholder);
      }

      // click anywhere in the portrait box
      boxEl.addEventListener("click", async () => {
        if (_portraitPicking) return;
        _portraitPicking = true;

        try {
          const blobId = await pickCropStorePortrait({
            picker: ImagePicker,
            currentBlobId: state.character.imgBlobId,
            deleteBlob,
            putBlob,
            cropImageModal,
            getPortraitAspect,
            aspectSelector: "#charPortraitTop",
            setStatus,
          });
          if (!blobId) return;
          state.character.imgBlobId = blobId;

          SaveManager.markDirty();
          await renderPortrait();
        } finally {
          _portraitPicking = false;
        }
      });

      renderPortrait();
    })();

    function renderAttacks() {
      if (!listEl) return;
      listEl.innerHTML = "";

      if (!state.character.attacks.length) {
        const empty = document.createElement("div");
        empty.className = "mutedSmall";
        empty.textContent = "No attacks yet. Click “+ New”.";
        listEl.appendChild(empty);
        return;
      }

      state.character.attacks.forEach(a => listEl.appendChild(renderAttackRow(a)));
    }

    function renderAttackRow(a) {
      const row = document.createElement("div");
      row.className = "attackRow";

      const top = document.createElement("div");
      top.className = "attackTop";

      const name = document.createElement("input");
      name.classList.add("attackName");
      name.placeholder = "Dagger";
      name.value = a.name || "";
      autoSizeInput(name, { min: 50, max: 200 });
      name.addEventListener("input", () => patchAttack(a.id, { name: name.value }));

      // const notes = document.createElement("input");
      // notes.placeholder = "Notes (optional)";
      // notes.value = a.notes || "";
      // notes.addEventListener("input", () => patchAttack(a.id, { notes: notes.value }));

      top.appendChild(name);
      // top.appendChild(notes);

      const middle = document.createElement("div");
      middle.className = "attackMiddle";

      const bonus = document.createElement("input");
      bonus.classList.add("attackBonus");
      bonus.placeholder = "+5";
      bonus.value = a.bonus || "";
      autoSizeInput(bonus, { min: 30, max: 40 });
      bonus.addEventListener("input", () => patchAttack(a.id, { bonus: bonus.value }));

      const dmg = document.createElement("input");
      dmg.classList.add("attackDamage");
      dmg.placeholder = "1d6+2";
      dmg.value = a.damage || "";
      autoSizeInput(dmg, { min: 30, max: 100 });
      dmg.addEventListener("input", () => patchAttack(a.id, { damage: dmg.value }));

      middle.appendChild(bonus);
      middle.appendChild(dmg);

      const bottom = document.createElement("div");
      bottom.className = "attackBottom";

      const range = document.createElement("input");
      range.classList.add("attackRange");
      range.placeholder = "80/320";
      range.value = a.range || "";
      autoSizeInput(range, { min: 50, max: 150 });
      range.addEventListener("input", () => patchAttack(a.id, { range: range.value }));

      const type = document.createElement("input");
      type.classList.add("attackType");
      type.placeholder = "Piercing";
      type.value = a.type || "";
      autoSizeInput(type, { min: 0, max: 150 });
      type.addEventListener("input", () => patchAttack(a.id, { type: type.value }));

      const actions = document.createElement("div");
      actions.className = "attackActions";

      const del = document.createElement("button");
      del.type = "button";
      del.className = "danger";
      del.textContent = "X";
      del.addEventListener("click", async () => { await deleteAttack(a.id); });

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
      const idx = state.character.attacks.findIndex(x => x.id === id);
      if (idx === -1) return;
      state.character.attacks[idx] = { ...state.character.attacks[idx], ...patch };
      SaveManager.markDirty();
    }

    async function deleteAttack(id) {
      if (!(await uiConfirm("Delete this attack?", { title: "Delete Attack", okText: "Delete" }))) return;
      state.character.attacks = state.character.attacks.filter(x => x.id !== id);
      SaveManager.markDirty();
      renderAttacks();
    }

    function addAttack() {
      state.character.attacks.unshift({
        id: "atk_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
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

    addBtn?.addEventListener("click", addAttack);

    renderAttacks();
    setupCollapsibleTextareas();
    setupCharacterSectionReorder();
    setupAbilityBlockReorder();
    setupAbilitiesAndSkills();
  }

  function makeLocation({ title = "", notes = "", type = "town" } = {}) {
    return {
      id: "loc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      title,
      notes,
      type,          // <--- NEW
      imgBlobId: null,
      collapsed: false
    };
  }

  function makePartyMember() {
    return {
      id: "party_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      sectionId: "", // ✅ NEW
      name: "",
      className: "",
      hpCurrent: null,
      hpMax: null,
      status: "",
      notes: "",
      imgBlobId: null,
      collapsed: false
    };
  }

  function makeNpc({ group = "friendly", name = "", className = "", notes = "" } = {}) {
    return {
      id: "npc_" + Math.random().toString(36).slice(2) + Date.now().toString(36),
      group,
      name,
      className,
      hpCurrent: null,
      hpMax: null,
      status: "",
      notes,
      imgBlobId: null,
      collapsed: false
    };
  }

  function numberOrNull(v) {
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
  }

  function setupCollapsibleTextareas() {
    if (!state.character) state.character = {};
    if (!state.character.ui) state.character.ui = {};
    if (!state.character.ui.textareaCollapse) state.character.ui.textareaCollapse = {}; // { textareaId: true/false }

    const btns = Array.from(document.querySelectorAll('button[data-collapse-target]'));

    btns.forEach(btn => {
      const id = btn.getAttribute('data-collapse-target');
      const ta = document.getElementById(id);
      if (!id || !ta) return;

      // Restore
      const collapsed = !!state.character.ui.textareaCollapse[id];
      ta.hidden = collapsed;
      btn.textContent = collapsed ? '▸' : '▾';
      btn.setAttribute('aria-expanded', (!collapsed).toString());

      // Avoid double-binding if init runs again
      if (btn.dataset.boundCollapse === "1") return;
      btn.dataset.boundCollapse = "1";

      btn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();

        const nowCollapsed = !ta.hidden; // if visible, collapse it
        ta.hidden = nowCollapsed;

        state.character.ui.textareaCollapse[id] = nowCollapsed;
        btn.textContent = nowCollapsed ? '▸' : '▾';
        btn.setAttribute('aria-expanded', (!nowCollapsed).toString());

        SaveManager.markDirty();
      });
    });
  }

  // Textarea sizing moved to js/features/autosize.js (setupTextareaSizing)

  function exportBackup() {
    return SaveManager.flush().then(() => _exportBackup({
      state,
      ensureMapManager,
      getBlob,
      blobToDataUrl,
      getAllTexts
    }));
  }
  function importBackup(e) {
    return _importBackup(e, {
      state,
      ensureMapManager,
      migrateState,
      saveAll,
      putBlob,
      dataUrlToBlob,
      clearAllBlobs,
      clearAllTexts,
      putText,
      ACTIVE_TAB_KEY,
      STORAGE_KEY,
      afterImport: async () => {
        // Force a clean re-hydration of the UI from the newly imported state.
        // This avoids having to manually refresh after importing.
        try { setStatus?.("Imported backup. Reloading..."); } catch (_) { }
        window.location.reload();
      }
    });
  }

  async function resetAll() {
    return _resetAll({
      ACTIVE_TAB_KEY,
      STORAGE_KEY,
      clearAllBlobs,
      clearAllTexts,
      flush: SaveManager?.flush,
      setStatus
    });
  }

  function setupAbilitiesAndSkills() {
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
      // what the little button shows
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

    if (profInput) {
      profInput.addEventListener("input", () => {
        document.querySelectorAll(".abilityBlock").forEach(b => {
          b.querySelector(".abilityScore")?.dispatchEvent(new Event("input"));
        });
      });
    }

    // --- Save Options dropdown wiring ---
    (function setupSaveOptionsDropdown() {
      const btn = document.getElementById("saveOptionsBtn");
      const menu = document.getElementById("saveOptionsMenu");
      if (!btn || !menu) return;

      const miscIds = ["str", "dex", "con", "int", "wis", "cha"].map(a => [`miscSave_${a}`, a]);

      // load initial values into inputs
      miscIds.forEach(([id, a]) => {
        const el = document.getElementById(id);
        if (!el) return;
        el.value = String(Number(state.character.saveOptions.misc[a] || 0));
        el.addEventListener("input", () => {
          state.character.saveOptions.misc[a] = Number(el.value || 0);
          // Recalc all blocks (cheapest way: poke one input on each block like you already do for prof)
          document.querySelectorAll(".abilityBlock .abilityScore").forEach(x => x.dispatchEvent(new Event("input")));
          SaveManager.markDirty();
        });
      });

      const sel = document.getElementById("saveModToAllSelect");
      if (sel) {
        sel.value = state.character.saveOptions.modToAll || "";

        // Make this select's open menu match the Map Tools dropdown styling.
        // (Native <select> open menus can't be reliably styled across browsers.)
        if (Popovers && !sel.dataset.dropdownEnhanced) {
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

        sel.addEventListener("change", () => {
          state.character.saveOptions.modToAll = sel.value || "";
          document.querySelectorAll(".abilityBlock .abilityScore").forEach(x => x.dispatchEvent(new Event("input")));
          SaveManager.markDirty();
        });
      }

      // Centralized open/close + outside click + Escape + resize reposition
      Popovers.register({
        button: btn,
        menu,
        preferRight: true,
        closeOnOutside: true,
        closeOnEsc: true,
        stopInsideClick: true,
        wireButton: true
      });
    })();

    document.querySelectorAll(".abilityBlock").forEach(block => {
      const ability = block.dataset.ability;
      const scoreInput = block.querySelector(".abilityScore");
      const modEl = block.querySelector('[data-stat="mod"]');
      const saveEl = block.querySelector('[data-stat="save"]');
      const saveProf = block.querySelector('[data-stat="saveProf"]');

      const abilityState = state.character.abilities[ability] ||= {
        score: 10,
        saveProf: false
      };

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

        block.querySelectorAll("[data-skill-value]").forEach(el => {
          const skill = el.dataset.skillValue;
          const st = ensureSkillState(skill);

          const profBonus = getProfBonus();
          const profAdd = profAddForLevel(st.level, profBonus);
          const misc = Number(st.misc || 0);

          const val = mod + profAdd + misc;
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
        if (!rowEl) return;

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

      scoreInput.addEventListener("input", recalc);
      saveProf.addEventListener("change", recalc);

      block.querySelectorAll("[data-skill-prof]").forEach(cb => {
        replaceSkillCheckboxWithMenu(cb);
      });

      // Collapsible (with persistence)
      const skills = block.querySelector(".abilitySkills");
      const header = block.querySelector(".abilityHeader");

      // Restore saved collapsed state (default: open)
      const wasCollapsed = !!state.character.ui.abilityCollapse[ability];
      if (skills) skills.style.display = wasCollapsed ? "none" : "";

      header?.addEventListener("click", (e) => {
        // Don't collapse when interacting with inputs/checkboxes inside the header
        if (e.target.closest("input, button, label, select, textarea")) return;
        if (!skills) return;

        const nowCollapsed = skills.style.display !== "none"; // we're about to hide it
        skills.style.display = nowCollapsed ? "none" : "";

        // Save per-ability collapse state
        state.character.ui.abilityCollapse[ability] = nowCollapsed;
        SaveManager.markDirty();
      });

      recalc();
    });
  }



  // Boot character page bindings
  initCharacterUI();
}
