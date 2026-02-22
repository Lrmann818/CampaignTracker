// Dice roller popover in topbar. One system only, calculator-style 
// (not a full dialog with system selection, etc).

import { createTopbarPopover } from "./topbarPopover.js";
import { requireEl, assertEl, getNoopDestroyApi } from "../../utils/domGuards.js";

let _activeTopbarDiceRoller = null;

function requireCriticalEl(selector, prefix) {
    const el = requireEl(selector, document, { prefix });
    if (el) return el;
    try {
        assertEl(selector, document, { prefix, warn: false });
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

export function initTopbarDiceRoller(deps) {
    _activeTopbarDiceRoller?.destroy?.();
    _activeTopbarDiceRoller = null;

    const {
        state,
        SaveManager,
        Popovers,
        positionMenuOnScreen,
        setStatus
    } = deps || {};

    const prefix = "initTopbarDiceRoller";
    const dd = requireCriticalEl("#diceDropdown", prefix);
    const btn = requireCriticalEl("#diceBtn", prefix);
    const menu = requireCriticalEl("#diceMenu", prefix);
    const closeBtn = requireCriticalEl("#diceCloseBtn", prefix);

    const countEl = requireCriticalEl("#diceCount", prefix);
    const modEl = requireCriticalEl("#diceMod", prefix);
    const rollBtn = requireCriticalEl("#diceRollBtn", prefix);
    const clearBtn = requireCriticalEl("#diceClearBtn", prefix);
    const histEl = requireCriticalEl("#diceHistory", prefix);

    const advBtn = requireCriticalEl("#diceAdvBtn", prefix);
    const disBtn = requireCriticalEl("#diceDisBtn", prefix);
    const activeIcon = requireEl("#diceActiveIcon", document, { prefix, warn: false });
    const presetBtns = menu?.querySelectorAll(".dicePreset");
    const modPlusEl = requireEl("#diceModPlus", document, { prefix, warn: false });

    if (!dd || !btn || !menu || !closeBtn || !countEl || !modEl || !rollBtn || !clearBtn || !histEl || !advBtn || !disBtn) {
        notifyMissingCritical(setStatus, "Topbar dice roller unavailable (missing expected UI elements).");
        return getNoopDestroyApi();
    }

    const listenerController = new AbortController();
    const listenerSignal = listenerController.signal;
    const addListener = (target, type, handler, options) => {
        if (!target || typeof target.addEventListener !== "function") return;
        const listenerOptions =
            typeof options === "boolean"
                ? { capture: options }
                : (options || {});
        target.addEventListener(type, handler, { ...listenerOptions, signal: listenerSignal });
    };

    // Runtime state bucket.
    if (!state.ui) state.ui = {};
    if (!state.ui.dice) state.ui.dice = { history: [], last: { count: 1, sides: 20, mod: 0, mode: "normal" } };
    if (!Array.isArray(state.ui.dice.history)) state.ui.dice.history = [];
    if (!state.ui.dice.last) state.ui.dice.last = { count: 1, sides: 20, mod: 0, mode: "normal" };
    const HISTORY_MAX = 20;

    const syncModPlus = () => {
        if (!modPlusEl) return;
        const n = Number(modEl.value);
        const wrap = modEl.closest(".modWrap");
        if (!wrap) return;

        wrap.classList.toggle("showPlus", Number.isFinite(n) && n > 0);
    };

    const diceIconMap = {
        4: "icons/dice/d4.svg",
        6: "icons/dice/d6.svg",
        8: "icons/dice/d8.svg",
        10: "icons/dice/d10.svg",
        12: "icons/dice/d12.svg",
        20: "icons/dice/d20.svg",
        100: "icons/dice/d100.svg"
    };

    const clampInt = (v, min, max, fallback) => {
        const n = Math.trunc(Number(v));
        if (!Number.isFinite(n)) return fallback;
        return Math.max(min, Math.min(max, n));
    };

    const updateDiceIcon = (sides) => {
        const topIcon = document.getElementById("diceBtnIcon");
        const src = diceIconMap[sides] || diceIconMap[20];
        // Icons are CSS-mask based (span.iconMask), so we swap the --icon url.
        if (topIcon) topIcon.style.setProperty("--icon", `url('${src || diceIconMap[20]}')`);
        if (activeIcon) activeIcon.style.setProperty("--icon", `url('${src || diceIconMap[20]}')`);
    };

    const readUi = () => {
        const count = clampInt(countEl.value, 1, 100, 1);
        const mod = clampInt(modEl.value, -999, 999, 0);
        const last = state.ui?.dice?.last || {};
        const sides = clampInt(last.sides ?? 20, 2, 1000, 20);
        const mode = (last.mode === "adv" || last.mode === "dis") ? last.mode : "normal";
        return { count, sides, mod, mode };
    };

    const writeUi = (v) => {
        countEl.value = String(clampInt(v.count, 1, 100, 1));
        modEl.value = String(clampInt(v.mod, -999, 999, 0));
        const sides = clampInt(v.sides ?? 20, 2, 1000, 20);
        const mode = (v.mode === "adv" || v.mode === "dis") ? v.mode : "normal";
        state.ui.dice.last = { ...state.ui.dice.last, sides, mode };
    };

    const rollOnce = (sides) => 1 + Math.floor(Math.random() * sides);
    const formatMod = (m) => (m === 0 ? "" : (m > 0 ? `+${m}` : `${m}`));

    const tryCopy = async (text) => {
        try {
            await navigator.clipboard.writeText(text);
            setStatus("Copied.");
            return true;
        } catch {
            const ta = document.createElement("textarea");
            ta.value = text;
            ta.setAttribute("readonly", "");
            ta.style.position = "fixed";
            ta.style.left = "-9999px";
            document.body.appendChild(ta);
            ta.select();
            try {
                document.execCommand("copy");
                setStatus("Copied.");
                return true;
            } catch {
                return false;
            } finally {
                document.body.removeChild(ta);
            }
        }
    };

    const renderHistory = () => {
        histEl.innerHTML = "";
        const h = state.ui.dice.history || [];
        if (!h.length) {
            const empty = document.createElement("div");
            empty.className = "mutedSmall";
            empty.textContent = "No rolls yet.";
            histEl.appendChild(empty);
            return;
        }
        h.forEach((entry) => {
            const row = document.createElement("button");
            row.type = "button";
            row.className = "diceHistRow";
            row.title = "Tap to copy";
            row.textContent = entry.text;
            addListener(row, "click", () => tryCopy(entry.text));
            histEl.appendChild(row);
        });
    };

    const doRoll = () => {
        const v = readUi();
        state.ui.dice.last = { ...state.ui.dice.last, ...v };

        const isD20 = v.sides === 20;
        const mode = isD20 ? v.mode : "normal";

        let kept = [];
        let detail = "";

        if (mode === "adv" || mode === "dis") {
            const a = rollOnce(20);
            const b = rollOnce(20);
            const pick = (mode === "adv") ? Math.max(a, b) : Math.min(a, b);
            kept = [pick];
            detail = ` (${a}, ${b})`;
        } else {
            const rolls = [];
            for (let i = 0; i < v.count; i++) rolls.push(rollOnce(v.sides));
            kept = rolls;
            detail = ` (${rolls.join(", ")})`;
        }

        const subtotal = kept.reduce((s, n) => s + n, 0);
        const total = subtotal + v.mod;

        const expr =
            (mode === "adv") ? `d20 adv${formatMod(v.mod)}` :
                (mode === "dis") ? `d20 dis${formatMod(v.mod)}` :
                    `${v.count}d${v.sides}${formatMod(v.mod)}`;

        // ✅ IMPORTANT: don't append mod twice
        const text = `${expr} = ${total}${detail}`;

        state.ui.dice.history.unshift({ t: Date.now(), text });
        if (state.ui.dice.history.length > HISTORY_MAX) state.ui.dice.history.length = HISTORY_MAX;

        SaveManager.markDirty();
        renderHistory();
    };

    // --- Open/close (shared helper, ONE system only) ---
    const pop = createTopbarPopover({
        button: btn,
        menu,
        closeButton: closeBtn,
        Popovers,
        positionMenuOnScreen,
        preferRight: true,

        // Dice roller intentionally does NOT close on outside-click.
        closeOnOutside: false,
        closeOnEsc: true,
        stopInsideClick: true,

        onOpen: () => {
            writeUi(state.ui.dice.last);
            syncModPlus();
            updateDiceIcon(Number(state.ui.dice.last.sides || 20));
        },
        focusOnOpen: rollBtn
    });

    const open = () => pop?.open();
    const close = () => pop?.close();


    // buttons
    addListener(rollBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.ui.dice.last.mode = "normal";
        doRoll();
    });

    addListener(advBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.ui.dice.last.mode = "adv";
        doRoll();
    });

    addListener(disBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.ui.dice.last.mode = "dis";
        doRoll();
    });

    [countEl, modEl].forEach((el) => {
        addListener(el, "keydown", (e) => {
            if (e.key === "Enter") {
                e.preventDefault();
                doRoll();
            }
        });
    });

    addListener(clearBtn, "click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        state.ui.dice.history = [];
        SaveManager.markDirty();
        renderHistory();
    });

    presetBtns?.forEach((b) => {
        addListener(b, "click", (e) => {
            e.preventDefault();
            e.stopPropagation();

            const sides = Number(b.getAttribute("data-sides"));
            if (!Number.isFinite(sides) || sides <= 1) return;

            const base = readUi();
            // select die, keep mod/count
            writeUi({ ...base, sides, mode: "normal" });
            updateDiceIcon(sides);

            SaveManager.markDirty();
        });
    });


    addListener(modEl, "input", syncModPlus);
    addListener(modEl, "change", syncModPlus);

    // Initial UI
    writeUi(state.ui.dice.last);
    syncModPlus();
    updateDiceIcon(Number(state.ui.dice.last.sides || 20));
    renderHistory();

    const api = {
        destroy() {
            pop?.destroy?.();
            listenerController.abort();
            if (_activeTopbarDiceRoller === api) _activeTopbarDiceRoller = null;
        }
    };

    _activeTopbarDiceRoller = api;
    return api;
}
