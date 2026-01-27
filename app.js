// @ts-nocheck

/************************ Local storage keys ***********************/
const STORAGE_KEY = "localCampaignTracker_v1";
const ACTIVE_TAB_KEY = "localCampaignTracker_activeTab";

/************************ Save schema versioning************************
 * - state.schemaVersion tells us what shape the saved data is in.
 * - migrateState(...) upgrades older saves/backups to the current shape.*/
const CURRENT_SCHEMA_VERSION = 1;

/************************ IndexedDB (blob storage)***********************/
const DB_NAME = "localCampaignTracker_db";
const DB_VERSION = 2;
const BLOB_STORE = "blobs";
const TEXT_STORE = "texts";

let _dbPromise = null;
let _blobUrlCache = new Map(); // blobId -> objectURL

function openDb() {
  if (_dbPromise) return _dbPromise;

  _dbPromise = new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);

    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(BLOB_STORE)) {
        db.createObjectStore(BLOB_STORE, { keyPath: "id" });
      }
      if (!db.objectStoreNames.contains(TEXT_STORE)) {
        db.createObjectStore(TEXT_STORE, { keyPath: "id" });
      }
    };

    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });

  return _dbPromise;
}

function newBlobId(prefix = "blob") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

async function putBlob(blob, id = null) {
  const db = await openDb();
  const blobId = id || newBlobId();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).put({
      id: blobId,
      blob,
      type: blob.type || "application/octet-stream",
      updatedAt: Date.now()
    });
    tx.oncomplete = () => resolve(blobId);
    tx.onerror = () => reject(tx.error);
  });
}

async function getBlob(blobId) {
  if (!blobId) return null;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const req = tx.objectStore(BLOB_STORE).get(blobId);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

async function deleteBlob(blobId) {
  if (!blobId) return;
  const db = await openDb();

  // Revoke any cached objectURL
  const oldUrl = _blobUrlCache.get(blobId);
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl);
    _blobUrlCache.delete(blobId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).delete(blobId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function blobIdToObjectUrl(blobId) {
  if (!blobId) return null;
  if (_blobUrlCache.has(blobId)) return _blobUrlCache.get(blobId);

  try {
    const blob = await getBlob(blobId);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    _blobUrlCache.set(blobId, url);
    return url;
  } catch (err) {
    console.warn("blobIdToObjectUrl failed:", blobId, err);
    return null;
  }
}

function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

async function clearAllBlobs() {
  const db = await openDb();
  // Revoke cached URLs
  for (const url of _blobUrlCache.values()) URL.revokeObjectURL(url);
  _blobUrlCache.clear();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

/************************ IndexedDB (text storage) ***********************/
function textKey_spellNotes(spellId) {
  return `spell_notes_${spellId}`;
}

async function putText(text, id) {
  const db = await openDb();
  const textId = id;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).put({ id: textId, text: String(text ?? ""), updatedAt: Date.now() });
    tx.oncomplete = () => resolve(textId);
    tx.onerror = () => reject(tx.error);
  });
}

async function getText(id) {
  if (!id) return "";
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readonly");
    const req = tx.objectStore(TEXT_STORE).get(id);
    req.onsuccess = () => resolve(req.result?.text ?? "");
    req.onerror = () => reject(req.error);
  });
}

async function deleteText(id) {
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function clearAllTexts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getAllTexts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, 'readonly');
    const req = tx.objectStore(TEXT_STORE).getAll();
    req.onsuccess = () => {
      const out = {};
      for (const row of (req.result || [])) out[row.id] = row.text ?? '';
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}

// ---------- Helpers ----------
// AutoSize Input Fields - Adjust min / max as needed
// NOTE: many inputs are created *before* being inserted into the DOM (attacks/resources/etc).
// getComputedStyle() returns incomplete values for disconnected elements, so we defer measuring
// until the input is connected + styles/fonts are applied.
const __autosizeInputMeasurer = (() => {
  const span = document.createElement("span");
  span.style.position = "absolute";
  span.style.visibility = "hidden";
  span.style.whiteSpace = "pre";
  span.style.height = "0";
  span.style.overflow = "hidden";
  span.style.left = "-99999px";
  return span;
})();

function autoSizeInput(el, { min = 0, max = 300, extra = 0 } = {}) {
  if (!el) return;

  // Ensure the measurer is in the DOM (only once)
  if (!__autosizeInputMeasurer.isConnected) document.body.appendChild(__autosizeInputMeasurer);

  const measure = () => {
    if (!el.isConnected) return; // wait until inserted into DOM
    const cs = getComputedStyle(el);

    const padL = parseFloat(cs.paddingLeft) || 0;
    const padR = parseFloat(cs.paddingRight) || 0;
    const borderL = parseFloat(cs.borderLeftWidth) || 0;
    const borderR = parseFloat(cs.borderRightWidth) || 0;

    __autosizeInputMeasurer.style.font = cs.font;
    __autosizeInputMeasurer.style.letterSpacing = cs.letterSpacing;
    __autosizeInputMeasurer.textContent = el.value || el.placeholder || "";

    const textW = __autosizeInputMeasurer.getBoundingClientRect().width;
    const raw = textW + padL + padR + borderL + borderR + extra;
    const next = Math.min(max, Math.max(min, Math.ceil(raw)));

    el.style.width = next + "px";
  };

  // Small scheduler so we measure after layout/styles apply.
  // (requestAnimationFrame also handles the "created then appended" case cleanly.)
  const schedule = () => requestAnimationFrame(measure);

  el.addEventListener("input", schedule);
  el.addEventListener("blur", schedule);

  // Initial sizing: run a few times to catch late font/style application.
  schedule();
  if (document.fonts && document.fonts.ready) {
    document.fonts.ready.then(schedule).catch(() => { });
  }
  window.addEventListener("load", schedule, { once: true });
}

function autosizeAllNumbers(root = document) {
  root.querySelectorAll('input[type="number"]').forEach(el => {
    el.classList.add("autosize");
    autoSizeInput(el, { min: 30, max: 80 });
  });
}

function applyAutosize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}

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

function newSpell(name = '') {
  return { id: newTextId('spell'), name: name || '', notesCollapsed: true, known: true, prepared: false, expended: false };
}

function migrateSpellsLegacy() {
  ensureSpellsV2Shape();
  if (state.character.spells.levels && state.character.spells.levels.length) return;

  const legacy = state.character.spells;
  const hasLegacy = ('cantrips' in legacy) || ('lvl1' in legacy) || ('lvl2' in legacy) || ('lvl3' in legacy);

  const parseLines = (txt) => String(txt || '').split(/\r?\n/).map(s => s.trim()).filter(Boolean);

  if (!hasLegacy) {
    state.character.spells = {
      levels: [
        newSpellLevel('Cantrips', false),
        newSpellLevel('1st Level', true),
        newSpellLevel('2nd Level', true),
        newSpellLevel('3rd Level', true)
      ]
    };
    return;
  }

  const levels = [];
  const can = newSpellLevel('Cantrips', false);
  for (const n of parseLines(legacy.cantrips)) can.spells.push(newSpell(n));
  levels.push(can);

  const legacyLvls = [legacy.lvl1, legacy.lvl2, legacy.lvl3];
  for (let i = 0; i < legacyLvls.length; i++) {
    const n = i + 1;
    const l = legacyLvls[i] || { used: null, total: null, list: '' };
    const label = n === 1 ? '1st Level' : n === 2 ? '2nd Level' : '3rd Level';
    const level = newSpellLevel(label, true);
    level.used = (typeof l.used === 'number') ? l.used : (l.used === '' ? null : (l.used == null ? null : Number(l.used)));
    level.total = (typeof l.total === 'number') ? l.total : (l.total === '' ? null : (l.total == null ? null : Number(l.total)));
    for (const name of parseLines(l.list)) level.spells.push(newSpell(name));
    levels.push(level);
  }

  state.character.spells = { levels };
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

  addLevelBtn.addEventListener('click', () => {
    const label = (prompt('New spell level name:', '4th Level') || '').trim();
    if (!label) return;
    const isCantrip = label.toLowerCase().includes('cantrip');
    state.character.spells.levels.push(newSpellLevel(label, !isCantrip));
    setStatus('Saving...');
    saveAll();
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
    collapseBtn.addEventListener('click', (e) => {
      e.preventDefault();
      level.collapsed = !level.collapsed;
      setStatus('Saving...');
      saveAll();
      render();
    });

    const titleWrap = document.createElement('div');
    titleWrap.className = 'spellLevelTitle';
    const titleInput = document.createElement('input');
    titleInput.value = level.label || '';
    titleInput.placeholder = 'Level name';
    titleInput.addEventListener('input', () => {
      level.label = titleInput.value;
      setStatus('Saving...');
      saveAll();
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
      used.addEventListener('input', () => { level.used = used.value === '' ? null : Number(used.value); setStatus('Saving...'); saveAll(); });
      const sep = document.createElement('span');
      sep.className = 'muted';
      sep.textContent = '/';
      const total = document.createElement('input');
      total.classList.add("num-sum");
      total.type = 'number';
      total.placeholder = 'Total';
      total.value = (level.total ?? '');
      total.addEventListener('input', () => { level.total = total.value === '' ? null : Number(total.value); setStatus('Saving...'); saveAll(); });
      slots.appendChild(used); slots.appendChild(sep); slots.appendChild(total);
      right.appendChild(slots);
    }

    const actions = document.createElement('div');
    actions.className = 'spellLevelActions';

    const addSpellBtn = document.createElement('button');
    addSpellBtn.type = 'button';
    addSpellBtn.textContent = '+ Spell';
    addSpellBtn.addEventListener('click', () => {
      level.spells.push(newSpell(''));
      setStatus('Saving...');
      saveAll();
      render();
    });

    const resetExpBtn = document.createElement('button');
    resetExpBtn.type = 'button';
    resetExpBtn.textContent = 'Reset Cast';
    resetExpBtn.title = 'Clear expended/cast flags for this level';
    resetExpBtn.addEventListener('click', () => {
      level.spells.forEach(sp => sp.expended = false);
      setStatus('Saving...');
      saveAll();
      render();
    });

    const deleteLevelBtn = document.createElement('button');
    deleteLevelBtn.type = 'button';
    deleteLevelBtn.className = 'danger';
    deleteLevelBtn.textContent = 'X';
    deleteLevelBtn.addEventListener('click', async () => {
      if (!confirm(`Delete level "${level.label || 'this level'}" and all its spells?`)) return;
      // delete associated notes
      for (const sp of level.spells) {
        _spellNotesCache.delete(sp.id);
        await deleteText(textKey_spellNotes(sp.id));
      }
      state.character.spells.levels.splice(levelIndex, 1);
      setStatus('Saving...');
      saveAll();
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
    collapseBtn.addEventListener('click', async () => {
      spell.notesCollapsed = !spell.notesCollapsed;
      if (!spell.notesCollapsed) {
        await ensureSpellNotesLoaded(spell.id);
      }
      setStatus('Saving...');
      saveAll();
      render();
    });

    const name = document.createElement('input');
    name.className = 'spellName';
    name.placeholder = 'Spell name';
    name.value = spell.name || '';
    name.addEventListener('input', () => { spell.name = name.value; setStatus('Saving...'); saveAll(); });

    const toggles = document.createElement('div');
    toggles.className = 'spellToggles';

    const mkToggle = (label, key, extraClass = '') => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = `spellToggle ${extraClass}`.trim();
      const refresh = () => { b.classList.toggle('on', !!spell[key]); };
      b.textContent = label;
      refresh();
      b.addEventListener('click', () => {
        spell[key] = !spell[key];
        refresh();
        setStatus('Saving...');
        saveAll();
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
      setStatus('Saving...');
      saveAll();
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
      setStatus('Saving...');
      saveAll();
      render();
    });

    const del = document.createElement('button');
    del.type = 'button';
    del.className = 'danger';
    del.textContent = 'X';
    del.addEventListener('click', async () => {
      if (!confirm(`Delete spell "${spell.name || 'this spell'}"?`)) return;
      level.spells.splice(spellIndex, 1);
      _spellNotesCache.delete(spell.id);
      await deleteText(textKey_spellNotes(spell.id));
      setStatus('Saving...');
      saveAll();
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

/************************ Basic app state ***********************/
const state = {
  // Used to migrate older saves/backups as the app evolves.
  schemaVersion: CURRENT_SCHEMA_VERSION,
  tracker: {
    campaignTitle: "My Campaign",
    sessions: [{ title: "Session 1", notes: "" }],
    sessionSearch: "",
    activeSessionIndex: 0,
    npcs: [],                 // array of npc objects
    npcActiveGroup: "friendly",
    npcSearch: "",
    party: [],
    partySearch: "",
    locationsList: [],
    locSearch: "",
    locFilter: "all",
    misc: "",
    ui: { textareaHeights: {} }
  },
  character: {
    imgBlobId: null,
    name: "",
    classLevel: "",
    race: "",
    background: "",
    alignment: "",
    experience: null,
    features: "",

    hpCur: null,
    hpMax: null,
    ac: null,
    initiative: null,
    speed: null,
    proficiency: null,
    spellAttack: null,
    spellDC: null,
    // Legacy single-resource fields (kept for backward compatibility)
    resourceName: "",
    resourceCur: null,
    resourceMax: null,

    // New: multiple resource trackers in Vitals
    resources: [], // array of { id, name, cur, max }

    abilities: {
      str: { score: null, mod: null, save: null },
      dex: { score: null, mod: null, save: null },
      con: { score: null, mod: null, save: null },
      int: { score: null, mod: null, save: null },
      wis: { score: null, mod: null, save: null },
      cha: { score: null, mod: null, save: null }
    },
    skills: {},
    skillsNotes: "",

    armorProf: "",
    weaponProf: "",
    toolProf: "",
    languages: "",

    attacks: [], // {id,name,bonus,damage,range,type,notes}

    spells: {
      cantrips: "",
      lvl1: { used: null, total: null, list: "" },
      lvl2: { used: null, total: null, list: "" },
      lvl3: { used: null, total: null, list: "" }
    },

    equipment: "",
    money: { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 },

    personality: {
      traits: "",
      ideals: "",
      bonds: "",
      flaws: "",
      notes: ""
    }
  },
  map: {
    // Multi-map support
    activeMapId: null,
    maps: [], // array of { id, name, bgBlobId, drawingBlobId, brushSize, colorKey }

    // undo/redo stacks (in-memory only; never persisted)
    undo: [],
    redo: []
  },
  ui: { theme: "system", textareaHeights: {} }
};
const statusText = document.getElementById("statusText");

// ---------- Map manager (multiple maps) ----------
function newMapEntry(name = "World Map") {
  return {
    id: `map_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
    name: name || "World Map",
    bgBlobId: null,
    drawingBlobId: null,
    brushSize: 6,
    colorKey: "grey"
  };
}

function ensureMapManager() {
  if (!state.map || typeof state.map !== "object") state.map = {};
  if (!Array.isArray(state.map.maps)) state.map.maps = [];

  // UI / preferences (tool + shared brush size)
  if (!state.map.ui || typeof state.map.ui !== "object") state.map.ui = {};
  if (typeof state.map.ui.activeTool !== "string") state.map.ui.activeTool = "brush"; // brush | eraser
  if (typeof state.map.ui.brushSize !== "number") state.map.ui.brushSize = 6;

  if (!state.map.maps.length) {
    const m = newMapEntry("World Map");
    state.map.maps.push(m);
    state.map.activeMapId = m.id;
  }
  if (!state.map.activeMapId || !state.map.maps.some(m => m.id === state.map.activeMapId)) {
    state.map.activeMapId = state.map.maps[0].id;
  }

  // Ensure each entry has the expected fields
  state.map.maps.forEach(m => {
    if (!m.id) m.id = newMapEntry().id;
    if (!m.name) m.name = "Map";
    if (m.bgBlobId === undefined) m.bgBlobId = null;
    if (m.drawingBlobId === undefined) m.drawingBlobId = null;
    if (typeof m.brushSize !== "number") m.brushSize = 6;
    if (typeof m.colorKey !== "string") m.colorKey = "grey";
  });

  // Migration / sync: if UI size looks unset but maps have sizes, prefer active map's size
  const active = state.map.maps.find(m => m.id === state.map.activeMapId) || state.map.maps[0];
  if (!Number.isFinite(state.map.ui.brushSize)) state.map.ui.brushSize = (active?.brushSize ?? 6);
}

function getActiveMap() {
  ensureMapManager();
  return state.map.maps.find(m => m.id === state.map.activeMapId) || state.map.maps[0];
}

/************************ Save / Load ***********************/
function migrateState(raw) {
  // Accept either a full state object or a partial/legacy blob.
  const data = (raw && typeof raw === "object") ? raw : {};

  // Older saves won't have schemaVersion.
  let v = Number.isFinite(data.schemaVersion) ? data.schemaVersion : 0;

  function ensureObj(parent, key) {
    if (!parent[key] || typeof parent[key] !== "object") parent[key] = {};
    return parent[key];
  }
  function ensureArr(parent, key) {
    if (!Array.isArray(parent[key])) parent[key] = [];
    return parent[key];
  }

  function migrateToV1() {
    // --- Legacy: character sheet accidentally stored inside map.character ---
    if (!data.character && data.map && data.map.character) {
      data.character = data.map.character;
      delete data.map.character;
    }

    // Ensure top-level buckets exist
    ensureObj(data, "tracker");
    ensureObj(data, "character");
    ensureObj(data, "map");

    // Tracker UI defaults + typo fix
    const t = data.tracker;
    ensureObj(t, "ui");
    if (t.ui?.textareaHeigts && !t.ui.textareaHeights) {
      t.ui.textareaHeights = t.ui.textareaHeigts;
    }
    ensureObj(t.ui, "textareaHeights");
    if (!Array.isArray(t.sessions)) t.sessions = [{ title: "Session 1", notes: "" }];
    if (!Array.isArray(t.npcs)) t.npcs = [];
    if (!Array.isArray(t.party)) t.party = [];
    if (!Array.isArray(t.locationsList)) t.locationsList = [];
    if (typeof t.campaignTitle !== "string") t.campaignTitle = "My Campaign";
    if (typeof t.activeSessionIndex !== "number") t.activeSessionIndex = 0;

    // Character defaults (only fill missing, never overwrite)
    const c = data.character;
    if (!("imgBlobId" in c)) c.imgBlobId = null;
    if (!c.money || typeof c.money !== "object") c.money = { pp: 0, gp: 0, ep: 0, sp: 0, cp: 0 };
    if (!c.personality || typeof c.personality !== "object") {
      c.personality = { traits: "", ideals: "", bonds: "", flaws: "", notes: "" };
    }
    if (!Array.isArray(c.resources)) c.resources = [];
    ensureObj(c, "abilities");
    ensureObj(c, "skills");
    ensureObj(c, "ui");
    ensureObj(c.ui, "textareaHeights");
    // Spells v2 shape safety (no-op if already correct)
    if (!c.spells || typeof c.spells !== "object") c.spells = { levels: [] };
    if (c.spells.levels && !Array.isArray(c.spells.levels)) c.spells.levels = [];

    // Map defaults (multi-map manager expects these)
    const m = data.map;
    ensureArr(m, "maps");
    ensureObj(m, "ui");
    if (typeof m.ui.activeTool !== "string") m.ui.activeTool = "brush";
    if (typeof m.ui.brushSize !== "number") m.ui.brushSize = 6;
    if (!m.activeMapId) m.activeMapId = null;

    // Root UI bucket used by textarea persistence helpers
    ensureObj(data, "ui");
    ensureObj(data.ui, "textareaHeights");
    if (typeof data.ui.theme !== "string") data.ui.theme = "dark";

    // ---- THEME MIGRATION (important) ----
    if (!data.ui) data.ui = {};

    // Prefer root ui.theme
    if (typeof data.ui.theme !== "string") {
      // Fallback to legacy tracker.ui.theme if present
      if (typeof data.tracker?.ui?.theme === "string") {
        data.ui.theme = data.tracker.ui.theme;
      } else {
        data.ui.theme = "system";
      }
    }
  }

  while (v < CURRENT_SCHEMA_VERSION) {
    if (v === 0) {
      migrateToV1();
      v = 1;
      continue;
    }
    // Safety: if we ever get an unknown version, stop trying to be clever.
    break;
  }

  data.schemaVersion = CURRENT_SCHEMA_VERSION;
  return data;
}

function safeSetItem(key, value) {
  try {
    localStorage.setItem(key, value);
    return true;
  } catch (err) {
    console.error("Failed to save:", err);
    setStatus("Could not save (storage full?). Consider exporting a backup.");
    return false;
  }
}

function saveAll() {
  const toSave = {
    ...state,
    schemaVersion: CURRENT_SCHEMA_VERSION,
    map: { ...state.map, undo: [], redo: [] }
  };

  const ok = safeSetItem(STORAGE_KEY, JSON.stringify(toSave));
  if (ok) setStatus("Saved locally.");
}

async function loadAll() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return;

  try {
    const parsed = JSON.parse(raw);
    const migrated = migrateState(parsed);

    state.schemaVersion = migrated.schemaVersion;
    Object.assign(state.tracker, migrated.tracker || {});
    Object.assign(state.character, migrated.character || {});
    Object.assign(state.map, migrated.map || {});

    // restore root UI (theme, textarea heights)
    if (!state.ui || typeof state.ui !== "object") state.ui = {};
    Object.assign(state.ui, migrated.ui || {});

    // Ensure undo/redo start empty (in-memory only)
    state.map.undo = [];
    state.map.redo = [];

    // ---- MIGRATION: imgDataUrl -> IndexedDB blobId ----
    // NPCs
    for (const npc of (state.tracker.npcs || [])) {
      if (npc.imgDataUrl && !npc.imgBlobId) {
        const blob = dataUrlToBlob(npc.imgDataUrl);

        try {
          npc.imgBlobId = await putBlob(blob);
          delete npc.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store NPC image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Party
    for (const m of (state.tracker.party || [])) {
      if (m.imgDataUrl && !m.imgBlobId) {
        const blob = dataUrlToBlob(m.imgDataUrl);
        try {
          m.imgBlobId = await putBlob(blob);
          delete m.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store party image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Locations
    for (const loc of (state.tracker.locationsList || [])) {
      if (loc.imgDataUrl && !loc.imgBlobId) {
        const blob = dataUrlToBlob(loc.imgDataUrl);
        try {
          loc.imgBlobId = await putBlob(blob);
          delete loc.imgDataUrl;
        } catch (err) {
          console.warn("Migration: failed to store location image blob:", err);
          setStatus("Storage is full. Some images couldn't be migrated. Export a backup.");
        }
      }
    }

    // Map (legacy -> multi-map)
    ensureMapManager();

    // If an older save had single-map fields, fold them into the default map entry.
    const defaultMap = state.map.maps.find(m => m.id === state.map.activeMapId) || state.map.maps[0];

    // Legacy: data URLs
    // Legacy: data URLs
    if (state.map.bgDataUrl && !defaultMap.bgBlobId) {
      try {
        const blob = dataUrlToBlob(state.map.bgDataUrl);
        defaultMap.bgBlobId = await putBlob(blob);
        delete state.map.bgDataUrl;
      } catch (err) {
        console.warn("Migration: failed to store map background blob:", err);
        setStatus("Storage is full or map image is corrupted. Some images couldn't be migrated. Export a backup.");
      }
    }

    if (state.map.drawingDataUrl && !defaultMap.drawingBlobId) {
      try {
        const blob = dataUrlToBlob(state.map.drawingDataUrl);
        defaultMap.drawingBlobId = await putBlob(blob);
        delete state.map.drawingDataUrl;
      } catch (err) {
        console.warn("Migration: failed to store map drawing blob:", err);
        setStatus("Storage is full or map image is corrupted. Some images couldn't be migrated. Export a backup.");
      }
    }

    // Legacy: blob ids stored at top-level
    if (state.map.bgBlobId && !defaultMap.bgBlobId) {
      defaultMap.bgBlobId = state.map.bgBlobId;
      delete state.map.bgBlobId;
    }
    if (state.map.drawingBlobId && !defaultMap.drawingBlobId) {
      defaultMap.drawingBlobId = state.map.drawingBlobId;
      delete state.map.drawingBlobId;
    }

    // Legacy: per-map settings stored at top-level
    if (typeof state.map.brushSize === 'number' && (defaultMap.brushSize == null)) {
      defaultMap.brushSize = state.map.brushSize;
      delete state.map.brushSize;
    }
    if (typeof state.map.colorKey === 'string' && !defaultMap.colorKey) {
      defaultMap.colorKey = state.map.colorKey;
      delete state.map.colorKey;
    }

    if (state.tracker?.ui?.textareaHeigts && !state.tracker.ui.textareaHeights) {
      state.tracker.ui.textareaHeights = state.tracker.ui.textareaHeigts;
    }

    saveAll(); // write migrated small state back
  } catch (err) {
    console.error("Migration failed:", err);
    setStatus("Loaded with issues. Consider exporting a backup.");
  }
}

function setStatus(msg) {
  if (!statusText) return;
  statusText.textContent = msg;
}

// ---------- Global error surface (ship hardening) ----------
window.addEventListener("error", (event) => {
  // event.error is often the actual Error object (not always present)
  console.error("Global error:", event.error || event.message, event);
  setStatus("Something went wrong. Check console for details.");
});

window.addEventListener("unhandledrejection", (event) => {
  console.error("Unhandled promise rejection:", event.reason, event);
  setStatus("Something went wrong. Check console for details.");
});

// CSP violations are not normal JS errors, so capture them explicitly
document.addEventListener("securitypolicyviolation", (e) => {
  console.error("CSP violation:", {
    blockedURI: e.blockedURI,
    violatedDirective: e.violatedDirective,
    effectiveDirective: e.effectiveDirective,
    sourceFile: e.sourceFile,
    lineNumber: e.lineNumber,
    columnNumber: e.columnNumber
  });

  // Friendly message in your UI
  setStatus(`Blocked by security policy: ${e.effectiveDirective || e.violatedDirective}`);
});

// ----- Keep dropdowns on screen when viewport changes -----
window.addEventListener("resize", () => {
  // Settings
  const settingsBtn = document.getElementById("settingsBtn");
  const settingsMenu = document.getElementById("settingsMenu");
  if (settingsBtn && settingsMenu && !settingsMenu.hidden) {
    positionMenuOnScreen(settingsMenu, settingsBtn, { preferRight: true });
  }

  // Map Tool/Color
  const toolBtn = document.getElementById("toolDropdownBtn");
  const toolMenu = document.getElementById("toolDropdownMenu");
  if (toolBtn && toolMenu && !toolMenu.hidden) {
    positionMenuOnScreen(toolMenu, toolBtn, { preferRight: false });
  }

  const colorBtn = document.getElementById("colorBtn");
  const colorMenu = document.getElementById("colorDropdownMenu");
  if (colorBtn && colorMenu && !colorMenu.hidden) {
    positionMenuOnScreen(colorMenu, colorBtn, { preferRight: false });
  }

  // Save Options
  const saveBtn = document.getElementById("saveOptionsBtn");
  const saveMenu = document.getElementById("saveOptionsMenu");
  if (saveBtn && saveMenu && !saveMenu.hidden) {
    positionMenuOnScreen(saveMenu, saveBtn, { preferRight: true });
  }
});

// Image Cropper for card portraits
async function cropImageModal(file, {
  aspect = 1,       // 1 = square
  outSize = 512,    // output width/height in px
  mime = "image/webp",
  quality = 0.9
} = {}) {
  // Basic feature detection for webp
  const test = document.createElement("canvas");
  const canWebp = test.toDataURL("image/webp").startsWith("data:image/webp");
  if (mime === "image/webp" && !canWebp) mime = "image/jpeg";

  // Load image
  const img = await new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const i = new Image();
    i.onload = () => { URL.revokeObjectURL(url); resolve(i); };
    i.onerror = (e) => { URL.revokeObjectURL(url); reject(e); };
    i.src = url;
  });

  return new Promise((resolve) => {
    // ---------- Modal UI ----------
    const overlay = document.createElement("div");
    overlay.className = "modalOverlay";

    const panel = document.createElement("div");
    panel.className = "modalPanel";

    const title = document.createElement("div");
    title.textContent = "Crop portrait";
    title.className = "modalTitle";

    const cropWrap = document.createElement("div");
    cropWrap.className = "cropWrap";
    cropWrap.style.aspectRatio = `${aspect} / 1`; // dynamic

    const canvas = document.createElement("canvas");
    canvas.width = 800;
    canvas.height = Math.round(800 / aspect);
    canvas.className = "cropCanvas";
    cropWrap.appendChild(canvas);

    // A subtle "crop frame" overlay
    const frame = document.createElement("div");
    frame.className = "cropFrame";
    cropWrap.appendChild(frame);

    const controls = document.createElement("div");
    controls.className = "modalControls";

    const zoomLabel = document.createElement("div");
    zoomLabel.textContent = "Zoom";
    zoomLabel.className = "modalLabel";

    const zoom = document.createElement("input");
    zoom.type = "range";
    zoom.min = "1";
    zoom.max = "3.5";
    zoom.step = "0.01";
    zoom.value = "1.2";
    zoom.className = "modalRange";

    const btnRow = document.createElement("div");
    btnRow.className = "modalBtnRow";

    const cancelBtn = document.createElement("button");
    cancelBtn.textContent = "Cancel";
    cancelBtn.className = "modalBtn";

    const saveBtn = document.createElement("button");
    saveBtn.textContent = "Save";
    saveBtn.className = "modalBtn modalBtnPrimary";

    controls.appendChild(zoomLabel);
    controls.appendChild(zoom);

    btnRow.appendChild(cancelBtn);
    btnRow.appendChild(saveBtn);

    panel.appendChild(title);
    panel.appendChild(cropWrap);
    panel.appendChild(controls);
    panel.appendChild(btnRow);

    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ---------- Crop math ----------
    const ctx = canvas.getContext("2d");

    // center of image in canvas coords
    let scale = parseFloat(zoom.value);
    let offsetX = 0; // pan in canvas pixels
    let offsetY = 0;

    // Fit image to canvas initially
    const baseScale = Math.max(canvas.width / img.width, canvas.height / img.height);
    scale = baseScale * scale;

    function redraw() {
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      // fill background (helps if image has transparency)
      const mapEmpty = getComputedStyle(document.documentElement)
        .getPropertyValue("--map-empty")
        .trim() || "#111";

      ctx.fillStyle = mapEmpty;
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      const drawW = img.width * scale;
      const drawH = img.height * scale;

      const x = (canvas.width - drawW) / 2 + offsetX;
      const y = (canvas.height - drawH) / 2 + offsetY;

      ctx.drawImage(img, x, y, drawW, drawH);
    }

    function clampPan() {
      const drawW = img.width * scale;
      const drawH = img.height * scale;

      // Ensure the image always covers the crop area (no empty gaps)
      const minX = (canvas.width - drawW) / 2;
      const maxX = (drawW - canvas.width) / 2;
      const minY = (canvas.height - drawH) / 2;
      const maxY = (drawH - canvas.height) / 2;

      offsetX = Math.max(-maxX, Math.min(-minX, offsetX));
      offsetY = Math.max(-maxY, Math.min(-minY, offsetY));
    }

    // Drag handling
    let dragging = false;
    let lastX = 0, lastY = 0;

    function onDown(e) {
      dragging = true;
      const p = ("touches" in e) ? e.touches[0] : e;
      lastX = p.clientX;
      lastY = p.clientY;
    }

    function onMove(e) {
      if (!dragging) return;
      e.preventDefault();
      const p = ("touches" in e) ? e.touches[0] : e;
      const dx = p.clientX - lastX;
      const dy = p.clientY - lastY;
      lastX = p.clientX;
      lastY = p.clientY;

      // Convert screen movement to canvas-ish movement; this is "good enough"
      offsetX += dx * 1.2;
      offsetY += dy * 1.2;
      clampPan();
      redraw();
    }

    function onUp() {
      dragging = false;
    }

    cropWrap.addEventListener("mousedown", onDown);
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);

    cropWrap.addEventListener("touchstart", onDown, { passive: false });
    window.addEventListener("touchmove", onMove, { passive: false });
    window.addEventListener("touchend", onUp);

    // Zoom changes
    zoom.addEventListener("input", () => {
      // recompute scale based on baseScale * slider
      const slider = parseFloat(zoom.value);
      scale = baseScale * slider;
      clampPan();
      redraw();
    });

    // Buttons
    function cleanup() {
      cropWrap.removeEventListener("mousedown", onDown);
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);

      cropWrap.removeEventListener("touchstart", onDown);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onUp);

      overlay.remove();
    }

    cancelBtn.onclick = () => {
      cleanup();
      resolve(null);
    };

    saveBtn.onclick = async () => {
      // Render final cropped output at outSize x outSize/aspect
      const out = document.createElement("canvas");
      out.width = outSize;
      out.height = Math.round(outSize / aspect);

      const outCtx = out.getContext("2d");

      // Draw from the preview canvas into output canvas
      outCtx.drawImage(canvas, 0, 0, out.width, out.height);

      out.toBlob((blob) => {
        cleanup();
        resolve(blob);
      }, mime, quality);
    };

    // initial clamp + draw
    clampPan();
    redraw();
  });
}

/************************ Tabs (pages) ***********************/
function setupTabs() {
  const tabButtons = Array.from(document.querySelectorAll(".tab[data-tab]"));
  const pages = {
    tracker: document.getElementById("page-tracker"),
    character: document.getElementById("page-character"),
    map: document.getElementById("page-map")
  };

  function setActiveTab(tab) {
    window.closeSettingsMenu?.();
    // fallback safety
    if (!pages[tab]) tab = "tracker";

    // buttons
    tabButtons.forEach(b => {
      const active = b.getAttribute("data-tab") === tab;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });

    // pages
    Object.entries(pages).forEach(([key, el]) => {
      el.classList.toggle("active", key === tab);
    });

    // persist active page (separate from the big state blob)
    safeSetItem(ACTIVE_TAB_KEY, tab);

    // keep your existing behavior
    saveAll();
  }

  // Restore last active tab on refresh (if present)
  const savedTab = localStorage.getItem(ACTIVE_TAB_KEY);
  if (savedTab && pages[savedTab]) setActiveTab(savedTab);

  // Clicking tabs
  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      const tab = btn.getAttribute("data-tab");
      setActiveTab(tab);
    });
  });
}

function setupTopbarClock() {
  const el = document.getElementById("topbarClock");
  if (!el) return;

  const fmt = new Intl.DateTimeFormat(undefined, {
    hour: "numeric",
    minute: "2-digit"
  });

  const tick = () => {
    el.textContent = fmt.format(new Date());
    el.title = new Date().toLocaleString(); // nice tooltip
  };

  tick();
  // align updates to the minute boundary
  const msToNextMinute = 60000 - (Date.now() % 60000);
  setTimeout(() => {
    tick();
    setInterval(tick, 60000);
  }, msToNextMinute);
}

// Theme application
let _systemThemeMql = null;
let _systemThemeHandler = null;

function resolveSystemTheme() {
  const prefersDark = window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches;
  return prefersDark ? "dark" : "light";
}

function stopSystemThemeListener() {
  if (_systemThemeMql && _systemThemeHandler) {
    // Safari older: removeListener, modern: removeEventListener
    try {
      _systemThemeMql.removeEventListener("change", _systemThemeHandler);
    }
    catch (err) {
      try {
        _systemThemeMql.removeListener(_systemThemeHandler);
      }
      catch (err) {
        console.error("stopSystemThemeListener() threw this error...", err);
      }
    }
  }
  _systemThemeMql = null;
  _systemThemeHandler = null;
}

function startSystemThemeListener() {
  stopSystemThemeListener();
  if (!window.matchMedia) return;

  _systemThemeMql = window.matchMedia("(prefers-color-scheme: dark)");
  _systemThemeHandler = () => {
    // Only react if we're still in system mode
    if ((state.ui?.theme || "system") !== "system") return;
    document.documentElement.dataset.theme = resolveSystemTheme();
    if (typeof redraw === "function") redraw();
  };

  try { _systemThemeMql.addEventListener("change", _systemThemeHandler); }
  catch (err) {
    try {
      _systemThemeMql.addListener(_systemThemeHandler);
    } catch (err) {
      console.error("startSystemThemeListener() threw this error...", err);
    }
  }
}

function applyTheme(theme) {
  const allowed = new Set(["system", "dark", "light", "purple", "teal", "green", "blue", "red", "red-gold", "rose", "beige", "slate", "forest", "ember", "sepia", "arcane", "arcane-gold"]); // add more here later
  const t = allowed.has(theme) ? theme : "system";

  if (!state.ui) state.ui = {};
  state.ui.theme = t;

  const resolved = (t === "system") ? resolveSystemTheme() : t;
  document.documentElement.dataset.theme = resolved;

  if (t === "system") startSystemThemeListener();
  else stopSystemThemeListener();

  // Refresh canvas so theme-based background updates immediately
  if (typeof redraw === "function") redraw();
}

// Settings dropdown
function setupSettings() {
  const dd = document.getElementById("settingsDropdown");
  const btn = document.getElementById("settingsBtn");
  const menu = document.getElementById("settingsMenu");

  if (!dd || !btn || !menu) return;

  const closeMenu = () => {
    menu.hidden = true;
    btn.setAttribute("aria-expanded", "false");
  };

  // allow other parts of the app (tabs) to close Settings
  window.closeSettingsMenu = closeMenu;

  btn.addEventListener("click", (e) => {
    e.stopPropagation();
    const isOpen = !menu.hidden;
    if (isOpen) {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    } else {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      positionMenuOnScreen(menu, btn, { preferRight: true });
    }
  });

  document.addEventListener("click", (e) => {
    if (menu.hidden) return;
    if (dd.contains(e.target)) return;
    closeMenu();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !menu.hidden) {
      closeMenu();
      btn.focus();
    }
  });

  // Theme select
  const themeSelect = document.getElementById("themeSelect");
  if (themeSelect) {
    const initial = (state.ui && typeof state.ui.theme === "string") ? state.ui.theme : "system";
    themeSelect.value = initial;
    applyTheme(initial);

    themeSelect.addEventListener("change", () => {
      applyTheme(themeSelect.value);
      setStatus("Saving...");
      saveAll();
    });
  }

  // Backup actions (now live in the dropdown)
  const exportBtn = document.getElementById("exportBtn");
  const importFile = document.getElementById("importFile");
  const resetBtn = document.getElementById("resetBtn");

  if (exportBtn) exportBtn.addEventListener("click", () => { exportBackup(); closeMenu(); });
  if (importFile) importFile.addEventListener("change", (e) => { importBackup(e); closeMenu(); });
  if (resetBtn) resetBtn.addEventListener("click", () => { resetAll(); closeMenu(); });
}

// ---- Dropdown/menu positioning: keep menus on-screen ----
function positionMenuOnScreen(menuEl, anchorEl, opts = {}) {
  if (!menuEl || !anchorEl) return;

  const pad = opts.pad ?? 8;   // viewport padding
  const gap = opts.gap ?? 8;   // space between button and menu
  const preferRight = !!opts.preferRight;

  // Temporarily ensure it can be measured
  const wasHidden = menuEl.hidden;
  if (wasHidden) menuEl.hidden = false;

  // Make it viewport-relative so we can clamp easily
  menuEl.style.position = "fixed";
  menuEl.style.left = "0px";
  menuEl.style.top = "0px";
  menuEl.style.right = "auto";
  menuEl.style.bottom = "auto";

  const a = anchorEl.getBoundingClientRect();

  // Measure after making visible/fixed
  const menuRect = menuEl.getBoundingClientRect();
  const menuW = menuRect.width;
  const menuH = menuRect.height;

  // Horizontal: align left by default, or right if requested
  let left = preferRight ? (a.right - menuW) : a.left;

  // Clamp into viewport
  left = Math.max(pad, Math.min(left, window.innerWidth - pad - menuW));

  // Vertical: prefer opening below; flip above if it would overflow
  let topBelow = a.bottom + gap;
  let topAbove = a.top - gap - menuH;

  let top = topBelow;
  if (topBelow + menuH > window.innerHeight - pad && topAbove >= pad) {
    top = topAbove;
  }

  // If still too tall, clamp top and let CSS max-height + scroll handle it
  top = Math.max(pad, Math.min(top, window.innerHeight - pad - Math.min(menuH, window.innerHeight - pad * 2)));

  menuEl.style.left = `${Math.round(left)}px`;
  menuEl.style.top = `${Math.round(top)}px`;

  // Restore hidden state if we only showed it for measurement
  if (wasHidden) menuEl.hidden = true;
}

/************************ Tracker bindings ***********************/
function setupTracker() {
  const titleEl = document.getElementById("campaignTitle");
  const ids = ["misc"];

  // --- Title ---
  titleEl.textContent = state.tracker.campaignTitle || "My Campaign";
  titleEl.addEventListener("input", () => {
    const raw = (titleEl.textContent || "")
      .replace(/\s+/g, " ")
      .trim();
    state.tracker.campaignTitle = raw || "My Campaign";
    setStatus("Saving...");
    saveAll();
  });

  // --- Simple textareas ---
  ids.forEach(id => {
    const el = document.getElementById(id);
    if (!el) return;
    el.value = state.tracker[id] || "";
    el.addEventListener("input", () => {
      state.tracker[id] = el.value;
      setStatus("Saving...");
      saveAll();
    });
  });

  // --- Tracker section reordering (panels) ---
  setupTrackerSectionReorder();

  // --- Sessions UI ---
  initSessionsUI();
  initNpcsUI();
  initPartyUI();
  initLocationsUI();
  initCharacterUI();
  enhanceNumberSteppers(document);
}

/************************ Tracker panel reordering - Move Up / Move Down buttons **********************/
function setupTrackerSectionReorder() {
  const trackerPage = document.getElementById("page-tracker");
  if (!trackerPage) return;

  const grid = trackerPage.querySelector(".grid2");
  if (!grid) return;

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
    setStatus("Saving...");
    saveAll();
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

function initSessionsUI() {
  // Ensure defaults exist (for older saved data)
  if (!Array.isArray(state.tracker.sessions) || state.tracker.sessions.length === 0) {
    state.tracker.sessions = [{ title: "Session 1", notes: "" }];
  }
  if (typeof state.tracker.activeSessionIndex !== "number") {
    state.tracker.activeSessionIndex = 0;
  }
  if (state.tracker.activeSessionIndex < 0) state.tracker.activeSessionIndex = 0;
  if (state.tracker.activeSessionIndex >= state.tracker.sessions.length) {
    state.tracker.activeSessionIndex = state.tracker.sessions.length - 1;
  }

  const tabsEl = document.getElementById("sessionTabs");
  const notesBox = document.getElementById("sessionNotesBox");
  const searchEl = document.getElementById("sessionSearch");
  if (searchEl) {
    searchEl.value = state.tracker.sessionSearch || "";
    searchEl.addEventListener("input", () => {
      state.tracker.sessionSearch = searchEl.value;
      setStatus("Saving...");
      saveAll();
      renderTabs();
    });
  }

  // Render tabs
  function renderTabs() {
    tabsEl.innerHTML = "";

    const query = (state.tracker.sessionSearch || "").trim().toLowerCase();

    // Decide which sessions to show in the tab strip
    const sessionsToShow = state.tracker.sessions
      .map((s, idx) => ({ s, idx }))
      .filter(({ s }) => {
        if (!query) return true;
        const title = (s.title || "").toLowerCase();
        const notes = (s.notes || "").toLowerCase();
        return title.includes(query) || notes.includes(query);
      });

    // If search hides the active session tab, we still keep the notes box showing
    // whatever is currently active. Tabs just show filtered results.
    sessionsToShow.forEach(({ s, idx }) => {
      const btn = document.createElement("button");
      btn.className = "sessionTab" + (idx === state.tracker.activeSessionIndex ? " active" : "");
      btn.type = "button";
      btn.textContent = s.title || `Session ${idx + 1}`;
      btn.addEventListener("click", () => {
        switchSession(idx);
      });
      tabsEl.appendChild(btn);
    });

    // Load current notes into box
    const current = state.tracker.sessions[state.tracker.activeSessionIndex];
    notesBox.value = current?.notes || "";

    // Optional: if there are no matches, show a tiny hint
    if (sessionsToShow.length === 0) {
      const hint = document.createElement("div");
      hint.className = "mutedSmall";
      hint.style.marginLeft = "6px";
      hint.textContent = "No matching sessions.";
      tabsEl.appendChild(hint);
    }
  }

  function switchSession(newIndex) {
    // Save current notes before switching
    const cur = state.tracker.sessions[state.tracker.activeSessionIndex];
    if (cur) cur.notes = notesBox.value;

    state.tracker.activeSessionIndex = newIndex;
    setStatus("Saving...");
    saveAll();
    renderTabs();
  }

  // Notes typing saves into active session
  notesBox.addEventListener("input", () => {
    const cur = state.tracker.sessions[state.tracker.activeSessionIndex];
    if (!cur) return;
    cur.notes = notesBox.value;
    setStatus("Saving...");
    saveAll();
  });

  // Buttons
  document.getElementById("addSessionBtn").addEventListener("click", () => {
    // Save current first
    const cur = state.tracker.sessions[state.tracker.activeSessionIndex];
    if (cur) cur.notes = notesBox.value;

    const nextNum = state.tracker.sessions.length + 1;
    state.tracker.sessions.push({ title: `Session ${nextNum}`, notes: "" });
    state.tracker.activeSessionIndex = state.tracker.sessions.length - 1;

    setStatus("Saving...");
    saveAll();
    renderTabs();
    notesBox.focus();
  });

  document.getElementById("renameSessionBtn").addEventListener("click", () => {
    const cur = state.tracker.sessions[state.tracker.activeSessionIndex];
    if (!cur) return;

    const proposed = prompt("Rename session tab to:", cur.title || "");
    if (proposed === null) return; // cancelled

    cur.title = proposed.trim() || cur.title || `Session ${state.tracker.activeSessionIndex + 1}`;
    setStatus("Saving...");
    saveAll();
    renderTabs();
  });

  document.getElementById("deleteSessionBtn").addEventListener("click", () => {
    if (state.tracker.sessions.length <= 1) {
      alert("You need at least one session.");
      e.target.value = "";
      return;
    }
    if (!confirm("Delete this session? This cannot be undone.")) return;

    const idx = state.tracker.activeSessionIndex;
    state.tracker.sessions.splice(idx, 1);

    // Adjust active index
    state.tracker.activeSessionIndex = Math.max(0, idx - 1);

    setStatus("Saving...");
    saveAll();
    renderTabs();
  });

  // Initial render
  renderTabs();
}

function initNpcsUI() {
  // Migrate old npc textarea string into first NPC note (if any old data exists)
  // Only runs if npcs is not an array.
  if (!Array.isArray(state.tracker.npcs)) {
    const old = String(state.tracker.npcs || "").trim();
    state.tracker.npcs = [];
    if (old) {
      state.tracker.npcs.push(makeNpc({ group: "undecided", name: "Imported NPC Notes", notes: old }));
    }
  }

  if (!state.tracker.npcActiveGroup) state.tracker.npcActiveGroup = "friendly";
  if (typeof state.tracker.npcSearch !== "string") state.tracker.npcSearch = "";

  const cardsEl = document.getElementById("npcCards");
  const addBtn = document.getElementById("addNpcBtn");
  const searchEl = document.getElementById("npcSearch");
  const tabButtons = Array.from(document.querySelectorAll(".npcTab"));

  // Bind search
  searchEl.value = state.tracker.npcSearch;
  searchEl.addEventListener("input", () => {
    state.tracker.npcSearch = searchEl.value;
    setStatus("Saving...");
    saveAll();
    renderNpcCards();
  });

  // Tabs
  function setActiveGroup(group) {
    state.tracker.npcActiveGroup = group;
    tabButtons.forEach(b => {
      const active = b.getAttribute("data-group") === group;
      b.classList.toggle("active", active);
      b.setAttribute("aria-selected", active ? "true" : "false");
    });
    setStatus("Saving...");
    saveAll();
    renderNpcCards();
  }

  tabButtons.forEach(btn => {
    btn.addEventListener("click", () => setActiveGroup(btn.getAttribute("data-group")));
  });

  // Add NPC
  addBtn.addEventListener("click", () => {
    const npc = makeNpc({ group: state.tracker.npcActiveGroup });
    state.tracker.npcs.unshift(npc);
    setStatus("Saving...");
    saveAll();
    renderNpcCards();
  });

  function matchesSearch(npc, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (npc.name || "").toLowerCase().includes(s) ||
      (npc.className || "").toLowerCase().includes(s) ||
      (npc.status || "").toLowerCase().includes(s) ||
      (npc.notes || "").toLowerCase().includes(s)
    );
  }

  function moveNpcCard(id, dir) {
    const group = state.tracker.npcActiveGroup;
    const q = (state.tracker.npcSearch || "").trim();

    // Build the same visible list logic as renderNpcCards()
    const visible = state.tracker.npcs
      .filter(n => n.group === group)
      .filter(n => matchesSearch(n, q));

    const pos = visible.findIndex(n => n.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = state.tracker.npcs.findIndex(n => n.id === aId);
    const bIdx = state.tracker.npcs.findIndex(n => n.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    // Swap in the master array
    const tmp = state.tracker.npcs[aIdx];
    state.tracker.npcs[aIdx] = state.tracker.npcs[bIdx];
    state.tracker.npcs[bIdx] = tmp;

    setStatus("Saving...");
    saveAll();
    renderNpcCards();
  }

  function renderNpcCards() {
    const group = state.tracker.npcActiveGroup;
    const q = (state.tracker.npcSearch || "").trim();

    const list = state.tracker.npcs
      .filter(n => n.group === group)
      .filter(n => matchesSearch(n, q));

    cardsEl.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mutedSmall";
      empty.textContent = q
        ? "No NPCs match your search in this group."
        : "No NPCs in this group yet. Click “+ Add NPC”.";
      cardsEl.appendChild(empty);
      return;
    }

    list.forEach(npc => {
      cardsEl.appendChild(renderNpcCard(npc));
    });
    enhanceNumberSteppers(cardsEl);
  }

  function renderNpcCard(npc) {
    const card = document.createElement("div");
    card.className = "npcCard npcCardStack";

    const isCollapsed = !!npc.collapsed;
    card.classList.toggle("collapsed", isCollapsed);

    // --- Portrait (full-width top) ---
    const portrait = document.createElement("div");
    portrait.className = "npcPortraitTop";
    portrait.title = "Click to set/replace image";

    if (npc.imgBlobId) {
      const img = document.createElement("img");
      img.alt = npc.name || "NPC Portrait";
      portrait.appendChild(img);

      // Load async
      blobIdToObjectUrl(npc.imgBlobId).then(url => {
        if (url) img.src = url;
      });
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "mutedSmall";
      placeholder.textContent = "Click to add image";
      portrait.appendChild(placeholder);
    }

    // click portrait to set image
    portrait.addEventListener("click", () => pickNpcImage(npc.id));

    // --- Main stacked fields ---
    const body = document.createElement("div");
    body.className = "npcCardBodyStack";

    // Header row: Name + collapse toggle
    const headerRow = document.createElement("div");
    headerRow.className = "npcHeaderRow";

    const nameInput = document.createElement("input");
    nameInput.className = "npcField npcNameBig";
    nameInput.placeholder = "Name";
    nameInput.value = npc.name || "";
    nameInput.addEventListener("input", () => updateNpc(npc.id, { name: nameInput.value }, false));

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "moveBtn";
    moveUp.textContent = "↑";
    moveUp.title = "Move card up";
    moveUp.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveNpcCard(npc.id, -1);
    });

    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "moveBtn";
    moveDown.textContent = "↓";
    moveDown.title = "Move card down";
    moveDown.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveNpcCard(npc.id, +1);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "npcCollapseToggle";
    toggle.setAttribute("aria-label", isCollapsed ? "Expand card" : "Collapse card");
    toggle.setAttribute("aria-expanded", (!isCollapsed).toString());
    toggle.textContent = isCollapsed ? "▼" : "▲";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateNpc(npc.id, { collapsed: !isCollapsed }, true);
    });

    headerRow.appendChild(nameInput);
    headerRow.appendChild(moveUp);
    headerRow.appendChild(moveDown);
    headerRow.appendChild(toggle);

    // Collapsible content: everything below name

    // Class (label + input)
    const collapsible = document.createElement("div");
    collapsible.className = "npcCollapsible";
    collapsible.hidden = isCollapsed;

    const classLabel = document.createElement("div");
    classLabel.className = "npcMiniLabel";
    classLabel.textContent = "Class";

    const classInput = document.createElement("input");
    classInput.className = "npcField npcClass";
    classInput.placeholder = "Class / Role";
    classInput.value = npc.className || "";
    classInput.classList.add("autosize");
    autoSizeInput(classInput, { min: 60, max: 200 });
    classInput.addEventListener("input", () => updateNpc(npc.id, { className: classInput.value }, false));

    const classBlock = document.createElement("div");
    classBlock.className = "npcRowBlock";
    classBlock.appendChild(classLabel);
    classBlock.appendChild(classInput);

    // HP row
    const hpRow = document.createElement("div");
    hpRow.className = "npcRowBlock npcHpRow";

    const hpLabel = document.createElement("div");
    hpLabel.className = "npcMiniLabel";
    hpLabel.textContent = "HP";

    const hpWrap = document.createElement("div");
    hpWrap.className = "npcHpWrap";

    const hpCur = document.createElement("input");
    hpCur.className = "npcField npcHpInput";
    hpCur.classList.add("num-lg");
    hpCur.type = "number";
    hpCur.placeholder = "Cur";
    hpCur.value = npc.hpCurrent ?? "";
    autoSizeInput(hpCur, { min: 30, max: 70 });
    hpCur.addEventListener("input", () => updateNpc(npc.id, { hpCurrent: numberOrNull(hpCur.value) }, false));

    const slash = document.createElement("span");
    slash.className = "muted";
    slash.textContent = "/";

    const hpMax = document.createElement("input");
    hpMax.className = "npcField npcHpInput";
    hpMax.classList.add("num-lg");
    hpMax.type = "number";
    hpMax.placeholder = "Max";
    hpMax.value = npc.hpMax ?? "";
    autoSizeInput(hpMax, { min: 30, max: 70 });
    hpMax.addEventListener("input", () => updateNpc(npc.id, { hpMax: numberOrNull(hpMax.value) }, false));

    hpWrap.appendChild(hpCur);
    hpWrap.appendChild(slash);
    hpWrap.appendChild(hpMax);

    hpRow.appendChild(hpLabel);
    hpRow.appendChild(hpWrap);

    // Status
    const statusBlock = document.createElement("div");
    statusBlock.className = "npcRowBlock";

    const statusLabel = document.createElement("div");
    statusLabel.className = "npcMiniLabel";
    statusLabel.textContent = "Status Effects";

    const statusInput = document.createElement("input");
    statusInput.className = "npcField";
    statusInput.placeholder = "Poisoned, Charmed, Blessed…";
    statusInput.value = npc.status || "";
    autoSizeInput(statusInput, { min: 60, max: 300 });
    statusInput.addEventListener("input", () => updateNpc(npc.id, { status: statusInput.value }, false));

    statusBlock.appendChild(statusLabel);
    statusBlock.appendChild(statusInput);

    // Notes (fixed-height + scroll)
    const notesBlock = document.createElement("div");
    notesBlock.className = "npcBlock";

    const notesLabel = document.createElement("div");
    notesLabel.className = "npcMiniLabel";
    notesLabel.textContent = "Notes";

    const notesArea = document.createElement("textarea");
    notesArea.className = "npcTextarea npcNotesBox";
    notesArea.placeholder = "Anything important...";
    notesArea.value = npc.notes || "";
    notesArea.addEventListener("input", () => updateNpc(npc.id, { notes: notesArea.value }, false));

    notesBlock.appendChild(notesLabel);
    notesBlock.appendChild(notesArea);

    // --- Footer actions ---
    const footer = document.createElement("div");
    footer.className = "npcCardFooter";

    const moves = document.createElement("div");
    moves.className = "npcMoves";

    const moveFriendly = makeMoveBtn("Friendly", () => moveNpc(npc.id, "friendly"));
    moveFriendly.classList.add("npcFriendlyBtn");
    const moveUndecided = makeMoveBtn("Undecided", () => moveNpc(npc.id, "undecided"));
    moveUndecided.classList.add("npcUndecidedBtn");
    const moveFoe = makeMoveBtn("Foe", () => moveNpc(npc.id, "foe"));
    moveFoe.classList.add("npcFoeBtn");

    if (npc.group !== "friendly") moves.appendChild(moveFriendly);
    if (npc.group !== "undecided") moves.appendChild(moveUndecided);
    if (npc.group !== "foe") moves.appendChild(moveFoe);

    const del = document.createElement("button");
    del.type = "button";
    del.className = "npcSmallBtn danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteNpc(npc.id));

    footer.appendChild(moves);
    footer.appendChild(del);

    // Build card
    collapsible.appendChild(classBlock);
    collapsible.appendChild(hpRow);
    collapsible.appendChild(statusBlock);
    collapsible.appendChild(notesBlock);

    body.appendChild(headerRow);
    body.appendChild(collapsible);

    card.appendChild(portrait);
    card.appendChild(body);
    // Footer should also collapse
    footer.hidden = isCollapsed;
    card.appendChild(footer);

    return card;
  }

  function makeMoveBtn(label, onClick) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "npcSmallBtn";
    b.textContent = `→ ${label}`;
    b.addEventListener("click", onClick);
    return b;
  }

  // Image picker per NPC (hidden file input)
  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "file";
  hiddenPicker.accept = "image/*";
  hiddenPicker.style.display = "none";
  document.body.appendChild(hiddenPicker);

  let pendingImageNpcId = null;

  function pickNpcImage(npcId) {
    pendingImageNpcId = npcId;
    hiddenPicker.value = "";
    hiddenPicker.click();
  }

  hiddenPicker.addEventListener("change", async () => {
    const file = hiddenPicker.files?.[0];
    if (!file || !pendingImageNpcId) return;

    // If replacing an old image, delete it
    const npc = state.tracker.npcs.find(n => n.id === pendingImageNpcId);
    if (!npc) return;

    setStatus("Saving image...");

    if (npc.imgBlobId) {
      try { await deleteBlob(npc.imgBlobId); }
      catch (err) { console.warn("Failed to delete npc image blob:", err); }
    }

    const aspect = getPortraitAspect(".npcPortraitTop");

    const cropped = await cropImageModal(file, { aspect, outSize: 512, mime: "image/webp", quality: 0.9 });
    if (!cropped) return; // user cancelled

    let blobId = null;
    try {
      blobId = await putBlob(cropped);
    } catch (err) {
      console.error("Failed to save npc image blob:", err);
      setStatus("Could not save image. Consider exporting a backup.");
      alert("Could not save that image (storage may be full).");
      return;
    }
    updateNpc(pendingImageNpcId, { imgBlobId: blobId });

    pendingImageNpcId = null;
  });

  // CRUD helpers
  function updateNpc(id, patch, rerender = true) {
    const idx = state.tracker.npcs.findIndex(n => n.id === id);
    if (idx === -1) return;
    state.tracker.npcs[idx] = { ...state.tracker.npcs[idx], ...patch };
    setStatus("Saving...");
    saveAll();
    if (rerender) renderNpcCards();
  }

  function moveNpc(id, group) {
    updateNpc(id, { group });
  }

  async function deleteNpc(id) {
    const npc = state.tracker.npcs.find(n => n.id === id);
    if (!npc) return;
    if (!confirm(`Delete NPC "${npc.name || "Unnamed"}"?`)) return;

    if (npc.imgBlobId) {
      try { await deleteBlob(npc.imgBlobId); }
      catch (err) { console.warn("Failed to delete npc image blob:", err); }
    }

    state.tracker.npcs = state.tracker.npcs.filter(n => n.id !== id);
    setStatus("Saving...");
    saveAll();
    renderNpcCards();
  }

  // Initial tab state + render
  setActiveGroup(state.tracker.npcActiveGroup);
  renderNpcCards();
}

function initPartyUI() {
  if (!Array.isArray(state.tracker.party)) state.tracker.party = [];
  if (typeof state.tracker.partySearch !== "string") state.tracker.partySearch = "";

  const cardsEl = document.getElementById("partyCards");
  const addBtn = document.getElementById("addPartyBtn");
  const searchEl = document.getElementById("partySearch");

  if (!cardsEl || !addBtn || !searchEl) return;

  // Bind search
  searchEl.value = state.tracker.partySearch;
  searchEl.addEventListener("input", () => {
    state.tracker.partySearch = searchEl.value;
    setStatus("Saving...");
    saveAll();
    renderPartyCards();
  });

  // Add party member
  addBtn.addEventListener("click", () => {
    const member = makePartyMember();
    state.tracker.party.unshift(member);
    setStatus("Saving...");
    saveAll();
    renderPartyCards();
  });

  function matchesSearch(m, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (m.name || "").toLowerCase().includes(s) ||
      (m.className || "").toLowerCase().includes(s) ||
      (m.status || "").toLowerCase().includes(s) ||
      (m.notes || "").toLowerCase().includes(s)
    );
  }


  function movePartyCard(id, dir) {
    const q = (state.tracker.partySearch || "").trim();

    const visible = state.tracker.party.filter(m => matchesSearch(m, q));
    const pos = visible.findIndex(m => m.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = state.tracker.party.findIndex(m => m.id === aId);
    const bIdx = state.tracker.party.findIndex(m => m.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    const tmp = state.tracker.party[aIdx];
    state.tracker.party[aIdx] = state.tracker.party[bIdx];
    state.tracker.party[bIdx] = tmp;

    setStatus("Saving...");
    saveAll();
    renderPartyCards();
  }

  function renderPartyCards() {
    const q = (state.tracker.partySearch || "").trim();

    const list = state.tracker.party
      .filter(m => matchesSearch(m, q));

    cardsEl.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mutedSmall";
      empty.textContent = q
        ? "No party members match your search."
        : "No party members yet. Click “+ Add Member”.";
      cardsEl.appendChild(empty);
      return;
    }

    list.forEach(m => cardsEl.appendChild(renderPartyCard(m)));
    enhanceNumberSteppers(cardsEl);
  }

  function renderPartyCard(m) {
    // Reuse the NPC card styling classes so it looks identical
    const card = document.createElement("div");
    card.className = "npcCard npcCardStack";

    const isCollapsed = !!m.collapsed;
    card.classList.toggle("collapsed", isCollapsed);

    const portrait = document.createElement("div");
    portrait.className = "npcPortraitTop";
    portrait.title = "Click to set/replace image";

    if (m.imgBlobId) {
      const img = document.createElement("img");
      img.alt = m.name || "Party Member Portrait";
      portrait.appendChild(img);

      // Load async
      blobIdToObjectUrl(m.imgBlobId).then(url => {
        if (url) img.src = url;
      });
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "mutedSmall";
      placeholder.textContent = "Click to add image";
      portrait.appendChild(placeholder);
    }

    portrait.addEventListener("click", () => pickPartyImage(m.id));

    const body = document.createElement("div");
    body.className = "npcCardBodyStack";

    // Header row: Name + collapse toggle
    const headerRow = document.createElement("div");
    headerRow.className = "npcHeaderRow";

    const nameInput = document.createElement("input");
    nameInput.className = "npcField npcNameBig";
    nameInput.placeholder = "Name";
    nameInput.value = m.name || "";
    nameInput.addEventListener("input", () => updateParty(m.id, { name: nameInput.value }, false));

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "moveBtn";
    moveUp.textContent = "↑";
    moveUp.title = "Move card up";
    moveUp.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      movePartyCard(m.id, -1);
    });

    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "moveBtn";
    moveDown.textContent = "↓";
    moveDown.title = "Move card down";
    moveDown.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      movePartyCard(m.id, +1);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "npcCollapseToggle";
    toggle.setAttribute("aria-label", isCollapsed ? "Expand card" : "Collapse card");
    toggle.setAttribute("aria-expanded", (!isCollapsed).toString());
    toggle.textContent = isCollapsed ? "▼" : "▲";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateParty(m.id, { collapsed: !isCollapsed }, true);
    });

    headerRow.appendChild(nameInput);
    headerRow.appendChild(moveUp);
    headerRow.appendChild(moveDown);
    headerRow.appendChild(toggle);

    // Collapsible content
    const collapsible = document.createElement("div");
    collapsible.className = "npcCollapsible";
    collapsible.hidden = isCollapsed;

    const classRow = document.createElement("div");
    classRow.className = "npcRowBlock";

    const classLabel = document.createElement("div");
    classLabel.className = "npcMiniLabel";
    classLabel.textContent = "Class";

    const classInput = document.createElement("input");
    classInput.className = "npcField npcClass";
    classInput.placeholder = "Class / Role";
    classInput.value = m.className || "";
    classInput.classList.add("autosize");
    autoSizeInput(classInput, { min: 60, max: 200 });
    classInput.addEventListener("input", () => updateParty(m.id, { className: classInput.value }, false));

    classRow.appendChild(classLabel);
    classRow.appendChild(classInput);

    // --- HP row ---

    const hpRow = document.createElement("div");
    hpRow.className = "npcRowBlock npcHpRow";

    const hpLabel = document.createElement("div");
    hpLabel.className = "npcMiniLabel";
    hpLabel.textContent = "HP";

    const hpWrap = document.createElement("div");
    hpWrap.className = "npcHpWrap";

    const hpCur = document.createElement("input");
    hpCur.className = "npcField npcHpInput";
    hpCur.classList.add("num-lg");
    hpCur.type = "number";
    hpCur.placeholder = "Cur";
    hpCur.value = m.hpCurrent ?? "";
    autoSizeInput(hpCur, { min: 30, max: 70 });
    hpCur.addEventListener("input", () => updateParty(m.id, { hpCurrent: numberOrNull(hpCur.value) }, false));

    const slash = document.createElement("span");
    slash.className = "muted";
    slash.textContent = "/";

    const hpMax = document.createElement("input");
    hpMax.className = "npcField npcHpInput";
    hpMax.classList.add("num-lg");
    hpMax.type = "number";
    hpMax.placeholder = "Max";
    hpMax.value = m.hpMax ?? "";
    autoSizeInput(hpMax, { min: 30, max: 70 });
    hpMax.addEventListener("input", () => updateParty(m.id, { hpMax: numberOrNull(hpMax.value) }, false));

    hpWrap.appendChild(hpCur);
    hpWrap.appendChild(slash);
    hpWrap.appendChild(hpMax);

    hpRow.appendChild(hpLabel);
    hpRow.appendChild(hpWrap);

    // --- Status Row ---

    const statusRow = document.createElement("div");
    statusRow.className = "npcRowBlock";

    const statusLabel = document.createElement("div");
    statusLabel.className = "npcMiniLabel";
    statusLabel.textContent = "Status Effects";

    const statusInput = document.createElement("input");
    statusInput.className = "npcField";
    statusInput.placeholder = "Poisoned, Charmed, Blessed…";
    statusInput.value = m.status || "";
    autoSizeInput(statusInput, { min: 60, max: 300 });
    statusInput.addEventListener("input", () => updateParty(m.id, { status: statusInput.value }, false));

    statusRow.appendChild(statusLabel);
    statusRow.appendChild(statusInput);

    const notesBlock = document.createElement("div");
    notesBlock.className = "npcBlock";

    const notesLabel = document.createElement("div");
    notesLabel.className = "npcMiniLabel";
    notesLabel.textContent = "Notes";

    const notesArea = document.createElement("textarea");
    notesArea.className = "npcTextarea npcNotesBox";
    notesArea.placeholder = "Anything important...";
    notesArea.value = m.notes || "";
    notesArea.addEventListener("input", () => updateParty(m.id, { notes: notesArea.value }, false));

    notesBlock.appendChild(notesLabel);
    notesBlock.appendChild(notesArea);

    const footer = document.createElement("div");
    footer.className = "npcCardFooter";

    const spacer = document.createElement("div");
    spacer.className = "mutedSmall";
    spacer.textContent = "Party member";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "npcSmallBtn danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteParty(m.id));

    footer.appendChild(spacer);
    footer.appendChild(del);

    collapsible.appendChild(classRow);
    collapsible.appendChild(hpRow);
    collapsible.appendChild(statusRow);
    collapsible.appendChild(notesBlock);

    body.appendChild(headerRow);
    body.appendChild(collapsible);

    card.appendChild(portrait);
    card.appendChild(body);
    // Footer should also collapse
    footer.hidden = isCollapsed;
    card.appendChild(footer);

    return card;
  }

  // Hidden picker (separate from NPC picker so they don't conflict)
  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "file";
  hiddenPicker.accept = "image/*";
  hiddenPicker.style.display = "none";
  document.body.appendChild(hiddenPicker);

  let pendingPartyId = null;

  function pickPartyImage(id) {
    pendingPartyId = id;
    hiddenPicker.value = "";
    hiddenPicker.click();
  }

  hiddenPicker.addEventListener("change", async () => {
    const file = hiddenPicker.files?.[0];
    if (!file || !pendingPartyId) return;

    // If replacing an old image, delete it
    const m = state.tracker.party.find(x => x.id === pendingPartyId);
    if (!m) return;

    setStatus("Saving image...");

    if (m.imgBlobId) {
      try { await deleteBlob(m.imgBlobId); }
      catch (err) { console.warn("Failed to delete party image blob:", err); }
    }

    const aspect = getPortraitAspect(".npcPortraitTop");

    const cropped = await cropImageModal(file, { aspect, outSize: 512, mime: "image/webp", quality: 0.9 });
    if (!cropped) return; // user cancelled

    let blobId = null;
    try {
      blobId = await putBlob(cropped);
    } catch (err) {
      console.error("Failed to save party image blob:", err);
      setStatus("Could not save image. Consider exporting a backup.");
      alert("Could not save that image (storage may be full).");
      return;
    }
    updateParty(pendingPartyId, { imgBlobId: blobId });

    pendingPartyId = null;
  });

  function updateParty(id, patch, rerender = true) {
    const idx = state.tracker.party.findIndex(m => m.id === id);
    if (idx === -1) return;
    state.tracker.party[idx] = { ...state.tracker.party[idx], ...patch };
    setStatus("Saving...");
    saveAll();
    if (rerender) renderPartyCards();
  }

  async function deleteParty(id) {
    const m = state.tracker.party.find(x => x.id === id);
    if (!m) return;
    if (!confirm(`Delete party member "${m.name || "Unnamed"}"?`)) return;

    if (m.imgBlobId) {
      try { await deleteBlob(m.imgBlobId); }
      catch (err) { console.warn("Failed to delete party image blob:", err); }
    }

    state.tracker.party = state.tracker.party.filter(x => x.id !== id);
    setStatus("Saving...");
    saveAll();
    renderPartyCards();
  }

  renderPartyCards();
}

function initLocationsUI() {
  // migrate old textarea into a location card (only once)
  if (!Array.isArray(state.tracker.locationsList)) state.tracker.locationsList = [];
  if (typeof state.tracker.locSearch !== "string") state.tracker.locSearch = "";
  if (typeof state.tracker.locFilter !== "string") state.tracker.locFilter = "all";

  if (typeof state.tracker.locations === "string") {
    const old = state.tracker.locations.trim();
    if (old && state.tracker.locationsList.length === 0) {
      state.tracker.locationsList.push(makeLocation({ title: "Imported Locations", notes: old }));
    }
    // optional: clear old string so it doesn't keep re-importing in backups
    // state.tracker.locations = "";
  }

  const cardsEl = document.getElementById("locCards");
  const addBtn = document.getElementById("addLocBtn");
  const searchEl = document.getElementById("locSearch");
  const filterEl = document.getElementById("locFilter");

  if (!cardsEl || !addBtn || !searchEl) return;

  searchEl.value = state.tracker.locSearch;

  searchEl.addEventListener("input", () => {
    state.tracker.locSearch = searchEl.value;
    setStatus("Saving...");
    saveAll();
    renderLocations();
  });

  filterEl.value = state.tracker.locFilter;

  filterEl.addEventListener("change", () => {
    state.tracker.locFilter = filterEl.value;
    setStatus("Saving...");
    saveAll();
    renderLocations();
  });

  addBtn.addEventListener("click", () => {
    state.tracker.locationsList.unshift(makeLocation());
    setStatus("Saving...");
    saveAll();
    renderLocations();
  });

  function matchesSearch(loc, q) {
    if (!q) return true;
    const s = q.toLowerCase();
    return (
      (loc.title || "").toLowerCase().includes(s) ||
      (loc.notes || "").toLowerCase().includes(s)
    );
  }


  function moveLocCard(id, dir) {
    const q = (state.tracker.locSearch || "").trim();
    const typeFilter = state.tracker.locFilter || "all";

    const visible = state.tracker.locationsList
      .filter(l => typeFilter === "all" ? true : ((l.type || "town") === typeFilter))
      .filter(l => matchesSearch(l, q));

    const pos = visible.findIndex(l => l.id === id);
    const newPos = pos + dir;
    if (pos === -1 || newPos < 0 || newPos >= visible.length) return;

    const aId = visible[pos].id;
    const bId = visible[newPos].id;

    const aIdx = state.tracker.locationsList.findIndex(l => l.id === aId);
    const bIdx = state.tracker.locationsList.findIndex(l => l.id === bId);
    if (aIdx === -1 || bIdx === -1) return;

    const tmp = state.tracker.locationsList[aIdx];
    state.tracker.locationsList[aIdx] = state.tracker.locationsList[bIdx];
    state.tracker.locationsList[bIdx] = tmp;

    setStatus("Saving...");
    saveAll();
    renderLocations();
  }

  function renderLocations() {
    const q = (state.tracker.locSearch || "").trim();
    const typeFilter = state.tracker.locFilter || "all";

    const list = state.tracker.locationsList
      .filter(l => typeFilter === "all" ? true : ((l.type || "town") === typeFilter))
      .filter(l => matchesSearch(l, q));

    cardsEl.innerHTML = "";

    if (list.length === 0) {
      const empty = document.createElement("div");
      empty.className = "mutedSmall";
      empty.textContent = q
        ? "No locations match your search."
        : "No locations yet. Click “+ Add Location”.";
      cardsEl.appendChild(empty);
      return;
    }

    list.forEach(loc => cardsEl.appendChild(renderLocationCard(loc)));
  }

  function renderLocationCard(loc) {
    // Reuse the same card frame/classes as NPCs/Party
    const card = document.createElement("div");
    card.className = "npcCard npcCardStack";

    const isCollapsed = !!loc.collapsed;
    card.classList.toggle("collapsed", isCollapsed);

    const portrait = document.createElement("div");
    portrait.className = "npcPortraitTop";
    portrait.title = "Click to set/replace image";

    if (loc.imgBlobId) {
      const img = document.createElement("img");
      img.alt = loc.title || "Location Image";
      portrait.appendChild(img);

      // Load async
      blobIdToObjectUrl(loc.imgBlobId).then(url => {
        if (url) img.src = url;
      });
    } else {
      const placeholder = document.createElement("div");
      placeholder.className = "mutedSmall";
      placeholder.textContent = "Click to add image";
      portrait.appendChild(placeholder);
    }

    portrait.addEventListener("click", () => pickLocImage(loc.id));

    const body = document.createElement("div");
    body.className = "npcCardBodyStack";

    // Header row: Location name + collapse toggle
    const headerRow = document.createElement("div");
    headerRow.className = "npcHeaderRow";

    const titleInput = document.createElement("input");

    const moveUp = document.createElement("button");
    moveUp.type = "button";
    moveUp.className = "moveBtn";
    moveUp.textContent = "↑";
    moveUp.title = "Move card up";
    moveUp.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveLocCard(loc.id, -1);
    });

    const moveDown = document.createElement("button");
    moveDown.type = "button";
    moveDown.className = "moveBtn";
    moveDown.textContent = "↓";
    moveDown.title = "Move card down";
    moveDown.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      moveLocCard(loc.id, +1);
    });

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "npcCollapseToggle";
    toggle.setAttribute("aria-label", isCollapsed ? "Expand card" : "Collapse card");
    toggle.setAttribute("aria-expanded", (!isCollapsed).toString());
    toggle.textContent = isCollapsed ? "▼" : "▲";
    toggle.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      updateLoc(loc.id, { collapsed: !isCollapsed }, true);
    });

    headerRow.appendChild(titleInput);
    headerRow.appendChild(moveUp);
    headerRow.appendChild(moveDown);
    headerRow.appendChild(toggle);

    // Collapsible content
    const collapsible = document.createElement("div");
    collapsible.className = "npcCollapsible";
    collapsible.hidden = isCollapsed;

    const typeBlock = document.createElement("div");
    typeBlock.className = "npcBlock";

    const typeLabel = document.createElement("div");
    typeLabel.className = "npcMiniLabel";
    typeLabel.textContent = "Type";

    const typeSelect = document.createElement("select");
    typeSelect.className = "npcField";
    typeSelect.innerHTML = `
      <option value="town">Town</option>
      <option value="dungeon">Dungeon</option>
      <option value="region">Region</option>
      <option value="other">Other</option>
    `;
    typeSelect.value = loc.type || "other";
    typeSelect.addEventListener("change", () => updateLoc(loc.id, { type: typeSelect.value }));

    typeBlock.appendChild(typeLabel);
    typeBlock.appendChild(typeSelect);
    titleInput.className = "npcField npcNameBig";
    titleInput.placeholder = "Location name (Town, Dungeon, Region...)";
    titleInput.value = loc.title || "";
    titleInput.addEventListener("input", () => updateLoc(loc.id, { title: titleInput.value }, false));

    const notesBlock = document.createElement("div");
    notesBlock.className = "npcBlock";

    const notesLabel = document.createElement("div");
    notesLabel.className = "npcMiniLabel";
    notesLabel.textContent = "Notes";

    const notesArea = document.createElement("textarea");
    notesArea.className = "npcTextarea npcNotesBox";
    notesArea.placeholder = "Details, hooks, NPCs here, secrets...";
    notesArea.value = loc.notes || "";
    notesArea.addEventListener("input", () => updateLoc(loc.id, { notes: notesArea.value }, false));

    notesBlock.appendChild(notesLabel);
    notesBlock.appendChild(notesArea);

    const footer = document.createElement("div");
    footer.className = "npcCardFooter";

    const spacer = document.createElement("div");
    spacer.className = "mutedSmall";
    spacer.textContent = "Location";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "npcSmallBtn danger";
    del.textContent = "Delete";
    del.addEventListener("click", () => deleteLoc(loc.id));

    footer.appendChild(spacer);
    footer.appendChild(del);

    // Build collapsible
    collapsible.appendChild(typeBlock);
    collapsible.appendChild(notesBlock);

    body.appendChild(headerRow);
    body.appendChild(collapsible);

    card.appendChild(portrait);
    card.appendChild(body);
    // Footer should also collapse
    footer.hidden = isCollapsed;
    card.appendChild(footer);

    return card;
  }

  // Hidden image picker for locations
  const hiddenPicker = document.createElement("input");
  hiddenPicker.type = "file";
  hiddenPicker.accept = "image/*";
  hiddenPicker.style.display = "none";
  document.body.appendChild(hiddenPicker);

  let pendingLocId = null;

  function pickLocImage(id) {
    pendingLocId = id;
    hiddenPicker.value = "";
    hiddenPicker.click();
  }

  hiddenPicker.addEventListener("change", async () => {
    const file = hiddenPicker.files?.[0];
    if (!file || !pendingLocId) return;

    // If replacing an old image, delete it
    const loc = state.tracker.locationsList.find(l => l.id === pendingLocId);
    if (!loc) return;

    setStatus("Saving image...");

    if (loc.imgBlobId) {
      try { await deleteBlob(loc.imgBlobId); }
      catch (err) { console.warn("Failed to delete location image blob:", err); }
    }

    const aspect = getPortraitAspect(".npcPortraitTop");
    const cropped = await cropImageModal(file, { aspect, outSize: 512, mime: "image/webp", quality: 0.9 });
    if (!cropped) return; // user cancelled

    let blobId = null;
    try {
      blobId = await putBlob(cropped);
    } catch (err) {
      console.error("Failed to save location image blob:", err);
      setStatus("Could not save image. Consider exporting a backup.");
      alert("Could not save that image (storage may be full).");
      return;
    }
    updateLoc(pendingLocId, { imgBlobId: blobId });

    pendingLocId = null;
  });

  function updateLoc(id, patch, rerender = true) {
    const idx = state.tracker.locationsList.findIndex(l => l.id === id);
    if (idx === -1) return;
    state.tracker.locationsList[idx] = { ...state.tracker.locationsList[idx], ...patch };
    setStatus("Saving...");
    saveAll();
    if (rerender) renderLocations();
  }

  async function deleteLoc(id) {
    const loc = state.tracker.locationsList.find(l => l.id === id);
    if (!loc) return;
    if (!confirm(`Delete location "${loc.title || "Unnamed"}"?`)) return;

    if (loc.imgBlobId) {
      try { await deleteBlob(loc.imgBlobId); }
      catch (err) { console.warn("Failed to delete location image blob:", err); }
    }

    state.tracker.locationsList = state.tracker.locationsList.filter(l => l.id !== id);
    setStatus("Saving...");
    saveAll();
    renderLocations();
  }

  renderLocations();
}

function getPortraitAspect(selector = ".npcPortraitTop") {
  const el = document.querySelector(selector);
  if (!el) return 1; // safe fallback

  const rect = el.getBoundingClientRect();
  if (!rect.width || !rect.height) return 1;

  return rect.width / rect.height;
}

function enhanceNumberSteppers(root = document) {
  const inputs = Array.from(root.querySelectorAll('input[type="number"]'));

  inputs.forEach((input) => {
    // Don't double-wrap
    if (input.closest(".numWrap")) return;

    // If you ever need to opt-out for a specific input:
    if (input.dataset.noStepper === "1") return;

    // Build wrapper
    const wrap = document.createElement("div");
    wrap.className = "numWrap";

    const stepper = document.createElement("div");
    stepper.className = "numStepper";

    const up = document.createElement("button");
    up.type = "button";
    up.className = "numStepBtn";
    up.setAttribute("aria-label", "Increase");
    up.textContent = "▲";

    const down = document.createElement("button");
    down.type = "button";
    down.className = "numStepBtn";
    down.setAttribute("aria-label", "Decrease");
    down.textContent = "▼";

    stepper.appendChild(up);
    stepper.appendChild(down);

    // Insert wrap around input (without losing listeners)
    input.parentNode.insertBefore(wrap, input);
    wrap.appendChild(input);
    wrap.appendChild(stepper);

    const pokeInput = () => {
      // This triggers your existing save bindings (bindNumber uses "input")3
      input.dispatchEvent(new Event("input", { bubbles: true }));
    };

    up.addEventListener("click", () => {
      input.stepUp();
      pokeInput();
    });

    down.addEventListener("click", () => {
      input.stepDown();
      pokeInput();
    });
  });
}

/************************ Character panel reordering (Character page) ***********************/
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
    setStatus("Saving...");
    saveAll();
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
    setStatus("Saving...");
    saveAll();
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
    setStatus("Saving...");
    saveAll();
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
      setStatus("Saving...");
      saveAll();
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

      setStatus("Saving...");
      saveAll();
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

    // Migration: older saves used single fields (resourceName/resourceCur/resourceMax)
    if (!Array.isArray(state.character.resources)) state.character.resources = [];

    if (state.character.resources.length === 0) {
      const hasLegacy = !!(state.character.resourceName || state.character.resourceCur != null || state.character.resourceMax != null);
      state.character.resources.push({
        id: `res_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`,
        name: hasLegacy ? (state.character.resourceName || "") : "",
        cur: hasLegacy ? (state.character.resourceCur ?? null) : null,
        max: hasLegacy ? (state.character.resourceMax ?? null) : null
      });
    }

    // Keep legacy fields roughly in-sync with the first resource (so old exports still look sensible)
    function syncLegacyFromFirst() {
      const first = state.character.resources?.[0];
      if (!first) return;
      state.character.resourceName = first.name ?? "";
      state.character.resourceCur = (first.cur ?? null);
      state.character.resourceMax = (first.max ?? null);
    }

    function setAndSave(msg = "Saving...") {
      setStatus(msg);
      syncLegacyFromFirst();
      saveAll();
    }

    function render() {
      // Remove any previously-rendered resource tiles
      Array.from(wrap.querySelectorAll('.charTile[data-vital-key^="res:"]')).forEach(el => el.remove());

      (state.character.resources || []).forEach((r, idx) => {
        const tile = document.createElement("div");
        tile.className = "charTile";
        tile.dataset.resourceId = r.id;
        tile.dataset.vitalKey = `res:${r.id}`;

        const header = document.createElement("div");
        header.className = "resourceHeader";

        const label = document.createElement("div");
        label.className = "charTileLabel";
        label.textContent = "Resource";

        const del = document.createElement("button");
        del.type = "button";
        del.className = "iconBtn danger";
        del.title = "Remove this resource";
        del.textContent = "✕";
        del.disabled = (state.character.resources.length <= 1);
        del.addEventListener("click", (e) => {
          e.preventDefault();
          e.stopPropagation();
          if (state.character.resources.length <= 1) return;
          const name = (r.name || "").trim();
          const label = name ? `"${name}"` : "this resource tracker";
          if (!confirm(`Delete ${label}?`)) return;
          state.character.resources.splice(idx, 1);
          setAndSave();
          render();
        });

        header.appendChild(label);
        header.appendChild(del);

        const name = document.createElement("input");
        name.placeholder = "Sorcery Pts, Ki, Rage...";
        name.value = r.name ?? "";
        autoSizeInput(name, { min: 30, max: 120 });
        name.addEventListener("input", () => {
          r.name = name.value;
          setAndSave();
        });

        const row = document.createElement("div");
        row.className = "charHpRow";

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

        row.appendChild(cur) + row.appendChild(slash);
        row.appendChild(max);

        // --- layout row: [name.................][cur / max] ---
        const mainRow = document.createElement("div");
        mainRow.className = "resourceMainRow";

        // Give the name input a class so we can size it cleanly
        name.classList.add("resourceName");

        // Give the numbers row a class so we can force nowrap + sizing
        row.classList.add("resourceNums");

        mainRow.appendChild(name);
        mainRow.appendChild(row);

        tile.appendChild(header);
        tile.appendChild(mainRow);

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
    syncLegacyFromFirst();
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
  migrateSpellsLegacy();
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

    const hiddenPicker = document.createElement("input");
    hiddenPicker.type = "file";
    hiddenPicker.accept = "image/*";
    hiddenPicker.style.display = "none";
    document.body.appendChild(hiddenPicker);

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
    boxEl.addEventListener("click", () => {
      hiddenPicker.value = "";
      hiddenPicker.click();
    });

    hiddenPicker.addEventListener("change", async () => {
      const file = hiddenPicker.files?.[0];
      if (!file) return;

      setStatus("Saving image...");

      if (state.character.imgBlobId) {
        try { await deleteBlob(state.character.imgBlobId); }
        catch (err) { console.warn("Failed to delete character image blob:", err); }
      }

      const aspect = getPortraitAspect("#charPortraitTop");
      const cropped = await cropImageModal(file, { aspect, outSize: 512, mime: "image/webp", quality: 0.9 });
      if (!cropped) return;

      let blobId = null;
      try {
        blobId = await putBlob(cropped);
      } catch (err) {
        console.error("Failed to save character image blob:", err);
        setStatus("Could not save image. Consider exporting a backup.");
        alert("Could not save that image (storage may be full).");
        return;
      }
      state.character.imgBlobId = blobId;

      setStatus("Saving...");
      saveAll();
      await renderPortrait();
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
    name.placeholder = "Dagger";
    name.value = a.name || "";
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

    bottom.appendChild(range);
    bottom.appendChild(type);

    const actions = document.createElement("div");
    actions.className = "attackActions";

    const del = document.createElement("button");
    del.type = "button";
    del.className = "danger";
    del.textContent = "X";
    del.addEventListener("click", () => deleteAttack(a.id));

    actions.appendChild(del);

    row.appendChild(top);
    row.appendChild(middle);
    row.appendChild(bottom);
    row.appendChild(actions);

    return row;
  }

  function patchAttack(id, patch) {
    const idx = state.character.attacks.findIndex(x => x.id === id);
    if (idx === -1) return;
    state.character.attacks[idx] = { ...state.character.attacks[idx], ...patch };
    setStatus("Saving...");
    saveAll();
  }

  function deleteAttack(id) {
    if (!confirm("Delete this attack?")) return;
    state.character.attacks = state.character.attacks.filter(x => x.id !== id);
    setStatus("Saving...");
    saveAll();
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
    setStatus("Saving...");
    saveAll();
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

      setStatus("Saving...");
      saveAll();
    });
  });
}

/***********************
 * Textarea sizing: autosize + persisted height
 ***********************/
function setupTextareaSizing() {
  // One place to store all textarea heights
  if (!state.tracker.ui) state.tracker.ui = {};
  if (!state.tracker.ui.textareaHeights) state.tracker.ui.textareaHeights = {};
  const store = state.tracker.ui.textareaHeights;

  const seen = new WeakSet();

  // Debounced save (so we don't spam saveAll)
  let saveTimer = null;
  function scheduleSave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      setStatus("Saving...");
      saveAll();
    }, 150);
  }

  function applySize(el) {
    if (!el || el.tagName !== "TEXTAREA") return;
    if (!el.hasAttribute("data-persist-size")) return;
    if (!el.id) return; // needs a stable id to persist

    const saved = store[el.id];
    const savedPx = Number.isFinite(saved) ? saved : 0;

    // Auto height first so scrollHeight is accurate
    el.style.height = "auto";

    // Use whichever is larger: content height OR previously-saved height
    const needed = el.scrollHeight;
    const target = Math.max(needed, savedPx);

    el.style.height = target + "px";
  }

  // Expose a tiny hook so async text loads can trigger a re-measure without faking input events.
  // (Closes over `store`, so it uses the same persisted sizes.)
  window.__applyTextareaSize = (el) => {
    try { applySize(el); } catch (_) { }
  };

  function bind(el) {
    if (seen.has(el)) return;
    seen.add(el);

    // Restore/apply immediately
    applySize(el);

    // Autosize as user types (and save)
    el.addEventListener("input", () => {
      applySize(el);
      // store the *current* height after autosize
      store[el.id] = Math.round(el.getBoundingClientRect().height);
      scheduleSave();
    });

    // Persist manual resizes (drag handle)
    if (window.ResizeObserver) {
      const ro = new ResizeObserver(() => {
        if (!document.body.contains(el)) return;
        store[el.id] = Math.round(el.getBoundingClientRect().height);
        scheduleSave();
      });
      ro.observe(el);
    }
  }

  function scan(root = document) {
    root.querySelectorAll("textarea[data-persist-size]").forEach(bind);
  }

  // Initial pass
  scan(document);

  // Fonts can load after DOMContentLoaded and change line-height, which affects scrollHeight.
  // Re-scan once fonts are ready so heights are correct on refresh.
  if (document.fonts?.ready) {
    document.fonts.ready.then(() => scan(document)).catch(() => { });
  }

  // Catch textareas created later (spells/npcs/party/locations renders, etc.)
  const mo = new MutationObserver(muts => {
    for (const m of muts) {
      for (const node of m.addedNodes) {
        if (!(node instanceof Element)) continue;
        if (node.matches?.("textarea[data-persist-size]")) bind(node);
        scan(node);
      }
    }
  });
  mo.observe(document.body, { childList: true, subtree: true });
}

async function exportBackup() {
  // Collect all blob IDs used by state
  const ids = new Set();

  for (const npc of (state.tracker.npcs || [])) if (npc.imgBlobId) ids.add(npc.imgBlobId);
  for (const m of (state.tracker.party || [])) if (m.imgBlobId) ids.add(m.imgBlobId);
  for (const loc of (state.tracker.locationsList || [])) if (loc.imgBlobId) ids.add(loc.imgBlobId);

  ensureMapManager();
  for (const mp of (state.map.maps || [])) {
    if (state.character?.imgBlobId) ids.add(state.character.imgBlobId);
    if (mp.bgBlobId) ids.add(mp.bgBlobId);
    if (mp.drawingBlobId) ids.add(mp.drawingBlobId);
  }

  // Turn blobs into dataURLs inside the backup file
  const blobs = {};
  for (const id of ids) {
    try {
      const blob = await getBlob(id);
      if (blob) blobs[id] = await blobToDataUrl(blob);
    } catch (err) {
      console.warn("Skipping image during export (failed to read):", id, err);
    }
  }

  const backup = {
    version: 2,
    exportedAt: new Date().toISOString(),
    state: {
      ...state,
      map: { ...state.map, undo: [], redo: [] }
    },
    blobs,
    texts: await getAllTexts()
  };

  const fileBlob = new Blob([JSON.stringify(backup, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(fileBlob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `campaign-backup-${new Date().toISOString().slice(0, 10)}.json`;
  try {
    a.click();
  } catch (err) {
    console.error("Export download failed:", err);
    alert("Export failed. Try again, or use a different browser.");
  } finally {
    URL.revokeObjectURL(url);
  }
}

const MAX_BACKUP_BYTES = 15 * 1024 * 1024; // 15 MB (tune this)
const MAX_BLOBS = 200;                      // tune this too

function isSafeImageDataUrl(s) {
  return typeof s === "string" && /^data:image\/(png|jpe?g|webp);base64,/.test(s);
}

function importBackup(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  if (file.size > MAX_BACKUP_BYTES) {
    alert("Backup file is too large.");
    e.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = async () => {
    try {
      const parsed = JSON.parse(reader.result);
      if (parsed?.version !== 2 || !parsed?.state) {
        alert("Unsupported backup format.");
        e.target.value = "";
        return;
      }
      const blobsObj = parsed.blobs || {};
      const blobEntries = Object.entries(blobsObj);
      if (blobEntries.length > MAX_BLOBS) {
        alert("Backup contains too many images.");
        e.target.value = "";
        return;
      }
      for (const [, dataUrl] of blobEntries) {
        if (!isSafeImageDataUrl(dataUrl)) {
          alert("Backup contains an unsupported image format.");
          e.target.value = "";
          return;
        }
      }
      // v2 backups include blobs
      if (parsed.version === 2 && parsed.state) {
        // Clear existing data
        try {
          await clearAllBlobs();
          await clearAllTexts();

          // Restore blobs
          const idMap = new Map(); // oldId -> newId (keeps safe if you ever change id scheme)
          for (const [oldId, dataUrl] of Object.entries(parsed.blobs || {})) {
            let blob;
            try {
              blob = dataUrlToBlob(dataUrl); // this can throw if base64 is corrupt
            } catch (err) {
              console.error("Import failed: corrupt image data for blob:", oldId, err);
              alert("Import failed: one of the images in this backup is corrupted.");
              e.target.value = "";
              return;
            }

            const newId = await putBlob(blob);
            idMap.set(oldId, newId);
          }

          // Restore texts (same ids)
          for (const [tid, tval] of Object.entries(parsed.texts || {})) {
            await putText(tval, tid);
          }

          // Restore state (with migrations) and remap blob IDs
          const migrated = migrateState(parsed.state);
          state.schemaVersion = migrated.schemaVersion;
          Object.assign(state.tracker, migrated.tracker || {});
          Object.assign(state.character, migrated.character || {});
          Object.assign(state.map, migrated.map || {});

          // restore root UI (theme, textarea heights)
          if (!state.ui || typeof state.ui !== "object") state.ui = {};
          Object.assign(state.ui, migrated.ui || {});

          // remap
          for (const npc of (state.tracker.npcs || [])) if (npc.imgBlobId) npc.imgBlobId = idMap.get(npc.imgBlobId) || npc.imgBlobId;
          for (const m of (state.tracker.party || [])) if (m.imgBlobId) m.imgBlobId = idMap.get(m.imgBlobId) || m.imgBlobId;
          for (const loc of (state.tracker.locationsList || [])) if (loc.imgBlobId) loc.imgBlobId = idMap.get(loc.imgBlobId) || loc.imgBlobId;

          ensureMapManager();
          for (const mp of (state.map.maps || [])) {
            if (mp.bgBlobId) mp.bgBlobId = idMap.get(mp.bgBlobId) || mp.bgBlobId;
            if (mp.drawingBlobId) mp.drawingBlobId = idMap.get(mp.drawingBlobId) || mp.drawingBlobId;
            if (state.character?.imgBlobId) {
              state.character.imgBlobId = idMap.get(state.character.imgBlobId) || state.character.imgBlobId;
            }
          }

          saveAll();
          location.reload();
          return;
        } catch (err) {
          console.error("Import failed mid-restore:", err);
          alert("Import failed while restoring data. Your local data may be incomplete. If you have an export, try importing again.");
          e.target.value = "";
          return;
        }
      }

      // fallback: old v1 import (no blobs/texts)
      const migrated = migrateState(parsed);
      state.schemaVersion = migrated.schemaVersion;
      Object.assign(state.tracker, migrated.tracker || {});
      Object.assign(state.map, migrated.map || {});
      Object.assign(state.character, migrated.character || {});
      // restore root UI (theme, textarea heights)
      if (!state.ui || typeof state.ui !== "object") state.ui = {};
      Object.assign(state.ui, migrated.ui || {});
      saveAll();
      location.reload();
    } catch (err) {
      console.error("Import parse failed:", err);
      alert("That file doesn't look like a valid backup.");
    }
  };

  reader.onerror = () => {
    alert("Could not read that file.");
    e.target.value = "";
  };

  reader.readAsText(file);
}

async function resetAll() {
  if (!confirm("Reset everything? This clears your local saved data.")) return;
  localStorage.removeItem(ACTIVE_TAB_KEY);
  localStorage.removeItem(STORAGE_KEY);
  await clearAllBlobs();
  await clearAllTexts();
  location.reload();
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

  // === Skill menu open/close (shared across ALL ability blocks) ===
  let openSkillMenu = null;
  let openSkillBtn = null;

  function closeOpenSkillMenu() {
    if (openSkillMenu) openSkillMenu.hidden = true;
    if (openSkillBtn) openSkillBtn.setAttribute("aria-expanded", "false");
    openSkillMenu = null;
    openSkillBtn = null;
  }

  if (!window.__skillMenuCloseWired) {
    window.__skillMenuCloseWired = true;

    // Match your other dropdowns: close on document click when clicking outside
    document.addEventListener("click", (e) => {
      if (!openSkillMenu || openSkillMenu.hidden) return;

      // click on the open button? let the button handler toggle it
      if (openSkillBtn && (e.target === openSkillBtn || openSkillBtn.contains(e.target))) return;

      // click inside the menu? ignore
      if (openSkillMenu.contains(e.target)) return;

      closeOpenSkillMenu();
    });

    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && openSkillMenu && !openSkillMenu.hidden) {
        closeOpenSkillMenu();
      }
    });

    window.addEventListener("resize", () => {
      if (openSkillMenu && openSkillBtn && !openSkillMenu.hidden) {
        positionMenuOnScreen(openSkillMenu, openSkillBtn, { preferRight: true });
      }
    });
  }

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
    menu.addEventListener("click", (e) => e.stopPropagation());
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
        saveAll();
      });
    });

    const sel = document.getElementById("saveModToAllSelect");
    if (sel) {
      sel.value = state.character.saveOptions.modToAll || "";
      sel.addEventListener("change", () => {
        state.character.saveOptions.modToAll = sel.value || "";
        document.querySelectorAll(".abilityBlock .abilityScore").forEach(x => x.dispatchEvent(new Event("input")));
        saveAll();
      });
    }

    function open() {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      positionMenuOnScreen(menu, btn, { preferRight: true });
    }
    function close() {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    }
    function toggle() {
      if (menu.hidden) open();
      else close();
    }

    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      toggle();
    });

    // click outside closes (for Save Options menu)
    document.addEventListener("click", (e) => {
      if (menu.hidden) return;
      if (btn.contains(e.target)) return;
      if (menu.contains(e.target)) return;
      close();
    });

    // escape closes
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) close();
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

      saveAll();
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

      // Open/close behavior
      btn.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // if clicking the same open one -> close
        if (openSkillMenu === menu && !menu.hidden) {
          closeOpenSkillMenu();
          return;
        }

        closeOpenSkillMenu();

        menu.hidden = false;
        btn.setAttribute("aria-expanded", "true");
        positionMenuOnScreen(menu, btn, { preferRight: true });

        openSkillMenu = menu;
        openSkillBtn = btn;
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
      saveAll();
    });

    recalc();
  });
}

/************************ Map page ***********************/
let canvas, ctx;
let drawLayer, drawCtx;
let drawing = false;
let lastPt = null;
// Touch: delay starting a stroke until we know it's not a 2-finger pan/zoom
let pendingDraw = false;
let pendingPointerId = null;
let pendingStartClient = null; // {x,y}
let pendingStartCanvas = null; // {x,y}
let bgImg = null;
// --- Mobile pan/zoom (two fingers) ---
let canvasWrap = null;
let viewScale = 1;
const MIN_VIEW_SCALE = 0.6;
const MAX_VIEW_SCALE = 3;
const activePointers = new Map(); // pointerId -> {x,y}
let gestureMode = null; // null | "panzoom"
let panStart = null;    // {cx,cy,scrollLeft,scrollTop}
let pinchStart = null;  // {dist,scale}

function clamp(n, a, b) { return Math.max(a, Math.min(b, n)); }

function applyViewScale(scale, anchorClientX = null, anchorClientY = null) {
  if (!canvas) return;
  viewScale = clamp(scale, MIN_VIEW_SCALE, MAX_VIEW_SCALE);
  state.map.ui ||= {};
  state.map.ui.viewScale = viewScale;

  // Keep zoom anchored under the user's fingers (or center if no anchor provided)
  if (canvasWrap && anchorClientX != null && anchorClientY != null) {
    const wrapRect = canvasWrap.getBoundingClientRect();
    const ax = anchorClientX - wrapRect.left;
    const ay = anchorClientY - wrapRect.top;

    const prev = Number(canvas.dataset.viewScale || 1) || 1;

    // Content coords under the anchor, in CSS px
    const contentX = canvasWrap.scrollLeft + ax;
    const contentY = canvasWrap.scrollTop + ay;

    // Convert to "unscaled canvas CSS px" (pre-zoom)
    const canvasX = contentX / prev;
    const canvasY = contentY / prev;

    // After zoom, where should that same canvas point land?
    const nextContentX = canvasX * viewScale;
    const nextContentY = canvasY * viewScale;

    canvasWrap.scrollLeft = nextContentX - ax;
    canvasWrap.scrollTop = nextContentY - ay;
  }

  canvas.dataset.viewScale = String(viewScale);
  canvas.style.transformOrigin = "top left";
  canvas.style.transform = `scale(${viewScale})`;

  saveAll();
}

function distance(a, b) {
  const dx = a.x - b.x, dy = a.y - b.y;
  return Math.hypot(dx, dy);
}

function startPanZoomFromPointers() {
  const pts = Array.from(activePointers.values());
  if (pts.length < 2) return;

  const cx = (pts[0].x + pts[1].x) / 2;
  const cy = (pts[0].y + pts[1].y) / 2;

  gestureMode = "panzoom";
  canvasWrap?.classList.add("gestureMode"); // ✅ ADD THIS

  panStart = {
    cx, cy,
    scrollLeft: canvasWrap?.scrollLeft || 0,
    scrollTop: canvasWrap?.scrollTop || 0
  };
  pinchStart = {
    dist: distance(pts[0], pts[1]),
    scale: viewScale
  };
}

function setupMap() {
  canvas = document.getElementById("mapCanvas");
  ctx = canvas.getContext("2d");

  // Separate drawing layer (transparent) so drawings survive background changes
  drawLayer = document.createElement("canvas");
  drawLayer.width = canvas.width;
  drawLayer.height = canvas.height;
  drawCtx = drawLayer.getContext("2d");

  // touch drawing should not scroll the page
  canvas.style.touchAction = "none";

  ensureMapManager();
  if (window.matchMedia("(max-width: 600px)").matches) {
    if (!state.map.ui.activeTool) state.map.ui.activeTool = "brush";
  }

  // --- Map picker UI ---
  const mapSelect = document.getElementById("mapSelect");
  const addMapBtn = document.getElementById("addMapBtn");
  const renameMapBtn = document.getElementById("renameMapBtn");
  const deleteMapBtn = document.getElementById("deleteMapBtn");

  // --- Tool + Color UI ---
  const toolDropdown = document.getElementById("toolDropdown");
  const toolBtn = document.getElementById("toolDropdownBtn");
  const toolMenu = document.getElementById("toolDropdownMenu");
  const toolOptions = Array.from(toolMenu?.querySelectorAll("[data-tool]") || []);
  const toolLabel = toolBtn?.querySelector("[data-tool-label]");

  const colorDropdown = document.getElementById("colorDropdown");
  const colorBtn = document.getElementById("colorBtn");
  const colorMenu = document.getElementById("colorDropdownMenu");
  const colorOptions = Array.from(colorMenu?.querySelectorAll(".colorSwatch") || []);
  const preview = document.getElementById("activeColorPreview");
  const colorSwatch = colorBtn?.querySelector("[data-swatch]");
  const colorLabel = colorBtn?.querySelector("[data-label]");
  canvasWrap = canvas.closest(".canvasWrap");

  // restore persisted zoom
  viewScale = Number(state.map.ui?.viewScale || 1) || 1;
  requestAnimationFrame(() => applyViewScale(viewScale));

  function applyMapInteractionMode() {
    const tool = state.map.ui?.activeTool || "brush";
    const drawing = (tool === "brush" || tool === "eraser");

    // Only block touch scrolling while drawing
    canvasWrap?.classList.toggle("drawingMode", drawing);

    // Helps iOS decide what to do with touches
    canvas.style.touchAction = drawing ? "none" : "pan-x pan-y";
  }

  function closeToolMenu() {
    if (!toolMenu || !toolBtn) return;
    toolMenu.hidden = true;
    toolBtn.setAttribute("aria-expanded", "false");
  }

  function openToolMenu() {
    if (!toolMenu || !toolBtn) return;
    toolMenu.hidden = false;
    toolBtn.setAttribute("aria-expanded", "true");
    positionMenuOnScreen(toolMenu, toolBtn, { preferRight: false });
  }

  function toggleToolMenu() {
    if (!toolMenu || !toolBtn) return;
    if (toolMenu.hidden) openToolMenu();
    else closeToolMenu();
  }

  function closeColorMenu() {
    if (!colorMenu || !colorBtn) return;
    colorMenu.hidden = true;
    colorMenu.setAttribute("hidden", "");
    colorBtn.setAttribute("aria-expanded", "false");
  }

  function openColorMenu() {
    if (!colorMenu || !colorBtn) return;
    colorMenu.hidden = false;
    colorMenu.removeAttribute("hidden");
    colorBtn.setAttribute("aria-expanded", "true");
    positionMenuOnScreen(colorMenu, colorBtn, { preferRight: false });
  }

  function toggleColorMenu() {
    if (!colorMenu || !colorBtn) return;
    if (colorMenu.hidden) openColorMenu();
    else closeColorMenu();
  }

  function setActiveToolUI(tool) {
    const nice = (tool || "brush").slice(0, 1).toUpperCase() + (tool || "brush").slice(1);
    if (toolLabel) toolLabel.textContent = `${nice}`;
    toolOptions.forEach(opt => opt.classList.toggle("active", opt.getAttribute("data-tool") === tool));
    if (colorDropdown) {
      colorDropdown.classList.toggle("disabled", tool === "eraser");
    }
    if (tool === "eraser") closeColorMenu();
    if (tool === "eraser") closeToolMenu();
  }

  function setActiveColorUI(colorKey) {
    if (preview) preview.style.setProperty("--swatch-color", colorFromKey(colorKey));

    colorOptions.forEach(opt => {
      opt.classList.toggle("active", opt.getAttribute("data-color") === colorKey);
    });
  }

  function refreshMapSelect() {
    ensureMapManager();
    mapSelect.innerHTML = "";
    for (const mp of state.map.maps) {
      const opt = document.createElement("option");
      opt.value = mp.id;
      opt.textContent = mp.name || "Map";
      if (mp.id === state.map.activeMapId) opt.selected = true;
      mapSelect.appendChild(opt);
    }
  }

  async function loadActiveMapIntoCanvas() {
    const mp = getActiveMap();

    // reset undo/redo when switching maps
    state.map.undo = [];
    state.map.redo = [];

    // shared tool + size, per-map color
    const brush = document.getElementById("brushSize");
    brush.value = state.map.ui.brushSize;
    // Keep per-map field aligned (older exports/backups)
    mp.brushSize = state.map.ui.brushSize;
    setActiveToolUI(state.map.ui.activeTool);
    setActiveColorUI(mp.colorKey);

    // background
    bgImg = null;
    if (mp.bgBlobId) {
      let url = null;
      try { url = await blobIdToObjectUrl(mp.bgBlobId); }
      catch (err) { console.warn("Failed to load map background blob:", err); }
      if (url) {
        bgImg = new Image();
        await new Promise((res) => {
          bgImg.onload = () => res();
          bgImg.onerror = () => res();
          bgImg.src = url;
        });
      }
    }

    // drawing layer (transparent)
    drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
    if (mp.drawingBlobId) {
      let durl = null;
      try { durl = await blobIdToObjectUrl(mp.drawingBlobId); }
      catch (err) { console.warn("Failed to load map drawing blob:", err); }
      if (durl) {
        const img = new Image();
        await new Promise((res) => {
          img.onload = () => {
            drawCtx.drawImage(img, 0, 0);
            res();
          };
          img.onerror = () => res();
          img.src = durl;
        });
      }
    }

    renderMap();
  }

  async function switchMap(newId) {
    // Save current drawing snapshot before switching
    await persistDrawingSnapshot();
    state.map.activeMapId = newId;
    saveAll();
    refreshMapSelect();
    await loadActiveMapIntoCanvas();
  }

  addMapBtn?.addEventListener("click", async () => {
    const name = prompt("Name for the new map?", "New Map");
    if (name == null) return;
    const mp = newMapEntry(name.trim() || "New Map");
    state.map.maps.push(mp);
    await switchMap(mp.id);
  });

  renameMapBtn?.addEventListener("click", () => {
    const mp = getActiveMap();
    const name = prompt("Rename map", mp.name || "Map");
    if (name == null) return;
    mp.name = name.trim() || mp.name;
    saveAll();
    refreshMapSelect();
  });

  deleteMapBtn?.addEventListener("click", async () => {
    if (state.map.maps.length <= 1) {
      alert("You must keep at least one map.");
      return;
    }
    const mp = getActiveMap();
    const ok = confirm(`Delete map "${mp.name || "Map"}"? This cannot be undone.`);
    if (!ok) return;

    // Remove blobs for this map
    if (mp.bgBlobId) {
      try { await deleteBlob(mp.bgBlobId); }
      catch (err) { console.warn("Failed to delete map image blob:", err); }
    }
    if (mp.drawingBlobId) {
      try { await deleteBlob(mp.drawingBlobId); }
      catch (err) { console.warn("Failed to delete map image blob:", err); }
    }

    state.map.maps = state.map.maps.filter(m => m.id !== mp.id);
    if (!state.map.maps.length) state.map.maps = [newMapEntry("World Map")];
    state.map.activeMapId = state.map.maps[0].id;
    saveAll();
    refreshMapSelect();
    await loadActiveMapIntoCanvas();
  });

  mapSelect?.addEventListener("change", async () => {
    await switchMap(mapSelect.value);
  });

  refreshMapSelect();
  // initial load
  loadActiveMapIntoCanvas();

  // brush size
  const brush = document.getElementById("brushSize");
  brush.addEventListener("input", () => {
    const mp = getActiveMap();
    state.map.ui.brushSize = Number(brush.value);
    // keep map field in sync for older exports/backups (but behavior is "shared" now)
    mp.brushSize = state.map.ui.brushSize;
    saveAll();
  });

  // tool dropdown
  toolBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    toggleToolMenu();
  });

  document.addEventListener("click", (e) => {
    if (!toolMenu || toolMenu.hidden) return;
    if (toolDropdown && !toolDropdown.contains(e.target)) closeToolMenu();
  });

  toolOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      const tool = opt.getAttribute("data-tool") || "brush";
      state.map.ui.activeTool = tool;
      setActiveToolUI(tool);

      // when returning to brush, restore this map's saved color
      if (tool === "brush") setActiveColorUI(getActiveMap().colorKey);
      applyMapInteractionMode();
      saveAll();
      closeToolMenu();
    });
  });

  // color dropdown
  colorBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation(); // <-- important
    if (state.map.ui.activeTool === "eraser") return;
    toggleColorMenu();
  });

  colorMenu?.addEventListener("click", (e) => {
    e.stopPropagation();
  });

  document.addEventListener("click", (e) => {
    if (!colorMenu || colorMenu.hidden) return;
    if (colorDropdown && !colorDropdown.contains(e.target)) closeColorMenu();
  });

  colorOptions.forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.map.ui.activeTool === "eraser") return;

      const colorKey = btn.dataset.color || "grey";
      const mp = getActiveMap();

      mp.colorKey = colorKey;
      setActiveColorUI(colorKey);
      closeColorMenu();
      saveAll();
    });
  });

  applyMapInteractionMode();

  // undo/redo/clear
  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("clearMapBtn").addEventListener("click", clearDrawing);

  // background image set/remove
  document.getElementById("mapImageInput").addEventListener("change", setMapImage);
  document.getElementById("removeMapImageBtn").addEventListener("click", removeMapImage);

  // pointer events (works for mouse + touch)
  canvas.addEventListener("pointerdown", onPointerDown);
  canvas.addEventListener("pointermove", onPointerMove);
  window.addEventListener("pointerup", onPointerUp);
}

function colorFromKey(key) {
  // Ink for drawing + preview circle
  switch (key) {
    case "teal": return "rgba(53, 208, 214, 0.85)";
    case "red": return "rgba(224, 75, 75, 0.85)";
    case "blue": return "rgba(58, 166, 255, 0.85)";
    case "green": return "rgba(52, 201, 123, 0.85)";
    case "yellow": return "rgba(242, 201, 76, 0.85)";
    case "purple": return "rgba(155, 123, 255, 0.85)";
    case "black": return "rgba(17, 17, 17, 0.85)";
    case "white": return "rgba(240, 240, 240, 0.85)";
    default: return "rgba(140, 140, 140, 0.85)"; // grey
  }
}

function renderMap() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  if (bgImg && bgImg.complete) {
    ctx.drawImage(bgImg, 0, 0, canvas.width, canvas.height);
  } else {
    // simple dark placeholder background
    const mapEmpty = getComputedStyle(document.documentElement)
      .getPropertyValue("--map-empty")
      .trim() || "#0f0f0f";
    ctx.fillStyle = mapEmpty;
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }

  // overlay drawings (transparent layer)
  if (drawLayer) ctx.drawImage(drawLayer, 0, 0);
}

function snapshotForUndo() {
  // store only the transparent drawing layer
  const url = drawLayer.toDataURL("image/png");
  state.map.undo.push(url);
  if (state.map.undo.length > 50) state.map.undo.shift();
  state.map.redo.length = 0; // clear redo on new action
}

function commitDrawing() {
  // fire-and-forget; we don't want to await in pointer handlers
  persistDrawingSnapshot();
}

function persistDrawingSnapshot() {
  return new Promise((resolve) => {
    const mp = getActiveMap();
    drawLayer.toBlob(async (blob) => {
      if (!blob) {
        resolve();
        return;
      }

      // Replace previous stored drawing for this map
      if (mp.drawingBlobId) {
        try { await deleteBlob(mp.drawingBlobId); }
        catch (err) { console.warn("Failed to delete map drawing blob:", err); }
      }
      mp.drawingBlobId = await putBlob(blob);
      saveAll();
      resolve();
    }, "image/png");
  });
}

function getCanvasPoint(e) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

function onPointerDown(e) {
  const tool = state.map.ui?.activeTool || "brush";
  const isDrawTool = (tool === "brush" || tool === "eraser");

  // Track touches for multi-touch gestures
  if (e.pointerType === "touch") {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });

    // If a 2nd finger lands, immediately switch to pan/zoom (and cancel any pending/drawing stroke)
    if (activePointers.size >= 2) {
      // cancel a "maybe drawing" tap/stroke so we don't leave a dot behind
      if (pendingDraw) {
        pendingDraw = false;
        pendingPointerId = null;
        pendingStartClient = null;
        pendingStartCanvas = null;
      }
      if (drawing) {
        drawing = false;
        lastPt = null;
        commitDrawing();
      }
      startPanZoomFromPointers();
      e.preventDefault();
      return;
    }
  }

  // Only primary button for mouse
  if (e.button !== undefined && e.button !== 0) return;

  // If we're in touch and already have 2 fingers, don't start drawing
  if (e.pointerType === "touch" && activePointers.size >= 2) return;

  // Touch: don't draw immediately. Wait until we see movement (or a clean tap on pointerup).
  if (e.pointerType === "touch" && isDrawTool) {
    pendingDraw = true;
    pendingPointerId = e.pointerId;
    pendingStartClient = { x: e.clientX, y: e.clientY };
    pendingStartCanvas = getCanvasPoint(e);
    canvas.setPointerCapture(e.pointerId);
    e.preventDefault();
    return;
  }

  // Mouse / pen: start drawing immediately
  if (!isDrawTool) return;
  drawing = true;
  canvas.setPointerCapture(e.pointerId);

  snapshotForUndo();
  lastPt = getCanvasPoint(e);
  drawDot(lastPt);
  commitDrawing();
}

function onPointerMove(e) {
  // Update pointer map
  if (activePointers.has(e.pointerId)) {
    activePointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
  }

  // Gesture: two-finger pan + pinch zoom
  if (gestureMode === "panzoom" && activePointers.size >= 2) {
    const pts = Array.from(activePointers.values());
    const cx = (pts[0].x + pts[1].x) / 2;
    const cy = (pts[0].y + pts[1].y) / 2;

    // Pan
    const dx = cx - panStart.cx;
    const dy = cy - panStart.cy;

    if (canvasWrap) {
      canvasWrap.scrollLeft = panStart.scrollLeft - dx;
      canvasWrap.scrollTop = panStart.scrollTop - dy;
    }

    // Pinch zoom (more "intent" gating to prevent zoom while panning)
    const distNow = distance(pts[0], pts[1]);
    const distDelta = distNow - (pinchStart?.dist || 0);

    const PINCH_DEADZONE_PX = 28;          // feel knob (bigger = less jitter)
    const PAN_VS_PINCH_RATIO = 0.35;       // feel knob (smaller = harder to trigger pinch)

    const panMag = Math.hypot(dx, dy);     // how much the center moved
    const pinchMag = Math.abs(distDelta);  // how much finger spacing changed

    const pinchLooksIntentional =
      pinchMag > PINCH_DEADZONE_PX &&
      pinchMag > (panMag * PAN_VS_PINCH_RATIO) &&
      (pinchStart?.dist || 0) > 0;

    if (pinchLooksIntentional) {
      const ratio = distNow / pinchStart.dist;
      const nextScale = pinchStart.scale * ratio;
      applyViewScale(nextScale, cx, cy);

      // ✅ reset baseline after applying, makes it feel stable/continuous
      pinchStart.dist = distNow;
      pinchStart.scale = viewScale;
    }

    e.preventDefault();
    return;
  }

  // If we were waiting to see if this is a tap vs a stroke, and the finger moved,
  // promote pendingDraw -> drawing once it passes a small movement threshold.
  if (pendingDraw && e.pointerId === pendingPointerId) {
    const dx = e.clientX - pendingStartClient.x;
    const dy = e.clientY - pendingStartClient.y;

    const START_DRAW_THRESHOLD_PX = 6; // feel knob
    if (Math.hypot(dx, dy) >= START_DRAW_THRESHOLD_PX) {
      // Start a real stroke
      pendingDraw = false;
      pendingPointerId = null;

      snapshotForUndo();
      drawing = true;

      // Start from where the finger initially went down
      lastPt = pendingStartCanvas;

      // Draw first segment to current point so it doesn't "skip"
      const pt = getCanvasPoint(e);
      drawLine(lastPt, pt);
      lastPt = pt;

      pendingStartClient = null;
      pendingStartCanvas = null;

      if (e.pointerType === "touch") e.preventDefault();
      return;
    }
  }

  // Drawing
  if (!drawing) return;
  const pt = getCanvasPoint(e);
  drawLine(lastPt, pt);
  lastPt = pt;
  if (e.pointerType === "touch") e.preventDefault();
}

function onPointerUp(e) {
  // Touch bookkeeping
  if (activePointers.has(e.pointerId)) activePointers.delete(e.pointerId);

  // If this was a simple tap (touch down+up without moving), place a dot.
  if (pendingDraw && e.pointerId === pendingPointerId) {
    pendingDraw = false;
    pendingPointerId = null;

    if (pendingStartCanvas) {
      snapshotForUndo();
      drawDot(pendingStartCanvas);
      commitDrawing();
    }

    pendingStartClient = null;
    pendingStartCanvas = null;
    return;
  }

  // If we were in a gesture and now have < 2 touches, end it
  if (gestureMode === "panzoom" && activePointers.size < 2) {
    gestureMode = null;
    panStart = null;
    pinchStart = null;
    // Don't fall through into drawing end logic
    canvasWrap?.classList.remove("gestureMode");
    drawing = false;
    lastPt = null;
    return;
  }

  if (!drawing) return;
  drawing = false;
  lastPt = null;
  commitDrawing();
}


function drawDot(pt) {
  const mp = getActiveMap();
  const tool = state.map.ui?.activeTool || "brush";
  const size = state.map.ui?.brushSize ?? mp.brushSize;

  // Eraser uses destination-out to punch transparency into the drawing layer
  drawCtx.save();
  if (tool === "eraser") {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.fillStyle = "rgba(0,0,0,1)"; // Color is irrelevant here; alpha controls erasing
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.fillStyle = colorFromKey(mp.colorKey);
  }
  drawCtx.beginPath();
  drawCtx.arc(pt.x, pt.y, size / 2, 0, Math.PI * 2);
  drawCtx.fill();
  drawCtx.restore();
  renderMap();
}

function drawLine(a, b) {
  const mp = getActiveMap();
  const tool = state.map.ui?.activeTool || "brush";
  const size = state.map.ui?.brushSize ?? mp.brushSize;

  drawCtx.save();
  if (tool === "eraser") {
    drawCtx.globalCompositeOperation = "destination-out";
    drawCtx.strokeStyle = "rgba(0,0,0,1)"; // Color is irrelevant here; alpha controls erasing
  } else {
    drawCtx.globalCompositeOperation = "source-over";
    drawCtx.strokeStyle = colorFromKey(mp.colorKey);
  }
  drawCtx.lineWidth = size;
  drawCtx.lineCap = "round";
  drawCtx.beginPath();
  drawCtx.moveTo(a.x, a.y);
  drawCtx.lineTo(b.x, b.y);
  drawCtx.stroke();
  drawCtx.restore();
  renderMap();
}

function undo() {
  if (!state.map.undo.length) return;
  const current = drawLayer.toDataURL("image/png");
  state.map.redo.push(current);

  const prev = state.map.undo.pop();
  restoreFromDataUrl(prev);
}

function redo() {
  if (!state.map.redo.length) return;
  const current = drawLayer.toDataURL("image/png");
  state.map.undo.push(current);

  const next = state.map.redo.pop();
  restoreFromDataUrl(next);
}

function restoreFromDataUrl(url) {
  const img = new Image();
  img.onload = () => {
    drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
    drawCtx.drawImage(img, 0, 0);
    renderMap();
    commitDrawing();
  };
  img.src = url;
}

function clearDrawing() {
  if (!confirm("Clear the map drawings?")) return;
  snapshotForUndo();
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  renderMap();
  commitDrawing();
}

function setMapImage(e) {
  const file = e.target.files?.[0];
  if (!file) return;

  (async () => {
    setStatus("Saving map image...");

    const mp = getActiveMap();
    if (mp.bgBlobId) {
      try { await deleteBlob(mp.bgBlobId); }
      catch (err) { console.warn("Failed to delete map image blob:", err); }
    }
    try {
      mp.bgBlobId = await putBlob(file);
    } catch (err) {
      console.error("Failed to save map image blob:", err);
      setStatus("Could not save map image. Consider exporting a backup.");
      alert("Could not save that map image (storage may be full).");
      return;
    }

    let url = null;
    try { url = await blobIdToObjectUrl(mp.bgBlobId); }
    catch (err) { console.warn("Failed to load map background blob:", err); }
    bgImg = new Image();
    bgImg.onload = () => { renderMap(); persistDrawingSnapshot(); };
    bgImg.src = url;

    saveAll();
  })();
}

async function removeMapImage() {
  const mp = getActiveMap();
  if (mp.bgBlobId) {
    try { await deleteBlob(mp.bgBlobId); }
    catch (err) { console.warn("Failed to delete map image blob:", err); }
  }
  mp.bgBlobId = null;
  bgImg = null;
  renderMap();
  await persistDrawingSnapshot();
}

/************************ Boot ***********************/
(async () => {
  await loadAll();
  applyTheme(state.ui?.theme || "system");
  setupTabs();
  setupSettings();
  setupTopbarClock();
  setupTracker();
  autosizeAllNumbers();
  setupTextareaSizing();
  setupMap();
  // Apply theme immediately on load (in case setupSettings didn't run yet)
  saveAll();
})();
