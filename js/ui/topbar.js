// js/ui/topbar.js
// Phase 3: topbar clock + calculator + dice roller.

export function initTopbarUI(deps) {
  const {
    state,
    SaveManager,
    Popovers,
    positionMenuOnScreen,
    setStatus
  } = deps || {};

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
  
  /************************ Tabs / Navigation (Tracker / Character / Map) ***********************/
  // Moved to ./js/ui/navigation.js (keeps app.js slim and makes it easy to add new pages)
  
  // Theme application
  let _systemThemeMql = null;
  let _systemThemeHandler = null;
  function setupCalculator() {
    const dd = document.getElementById("calcDropdown");
    const btn = document.getElementById("calcBtn");
    const menu = document.getElementById("calcMenu");
    const closeBtn = document.getElementById("calcCloseBtn");
    const display = document.getElementById("calcDisplay");
    const keys = menu?.querySelector(".calcKeys");
    const histEl = document.getElementById("calcHistory");
  
    if (!dd || !btn || !menu || !closeBtn || !display || !keys || !histEl) return;
  
    // persisted state bucket
    if (!state.ui) state.ui = {};
    if (!state.ui.calc) state.ui.calc = { history: [] };
    if (!Array.isArray(state.ui.calc.history)) state.ui.calc.history = [];
  
    const HISTORY_MAX = 10;
    let calcJustEvaluated = false;

    // Double-press clear (C) to clear calculator history (mirrors dice roller clear).
    let lastClearAt = 0;
    const CLEAR_DOUBLE_MS = 900;

    const clearHistory = () => {
      state.ui.calc.history = [];
      SaveManager.markDirty();
      renderHistory();
      setStatus("Calc history cleared.");
    };

    const armHistoryClearHint = () => {
      lastClearAt = Date.now();
      // keep it subtle; status bar already exists in topbar
      setStatus("Press C again to clear history.");
    };
  
    const renderHistory = () => {
      histEl.innerHTML = "";
      const h = state.ui.calc.history || [];
      if (!h.length) {
        const empty = document.createElement("div");
        empty.className = "mutedSmall";
        empty.textContent = "No calculations yet.";
        histEl.appendChild(empty);
        return;
      }
  
      h.slice(0, HISTORY_MAX).forEach(item => {
        const row = document.createElement("div");
        row.className = "calcHistItem";
        row.textContent = item;
        row.title = "Click to copy result back to input";
        row.addEventListener("click", () => {
          // item format: "2+2 = 4"
          const parts = String(item).split("=");
          const rhs = (parts[1] || "").trim();
          if (rhs) {
            display.value = rhs;
            display.focus();
          }
        });
        histEl.appendChild(row);
      });
    };
  
    const openMenu = () => {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
      positionMenuOnScreen(menu, btn, { preferRight: true }); // reuse your helper
      renderHistory();
      setTimeout(() => display.focus(), 0);
    };
  
    const closeMenu = () => {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };
  
    // IMPORTANT: stays open until X (or Escape). No outside-click close.
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      const isOpen = !menu.hidden;
      if (isOpen) closeMenu();
      else openMenu();
    });
  
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      closeMenu();
      btn.focus();
    });
  
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !menu.hidden) {
        closeMenu();
        btn.focus();
        return;
      }
  
      // Let the calcDisplay's own keydown handler handle Enter when it's focused
      if (e.key === "Enter" && !menu.hidden) {
        if (e.target === display) return; // ✅ prevents double-equals
        // (If you ever add other inputs inside calcMenu, Enter can still evaluate from them)
        e.preventDefault();
        doEquals();
      }
    });
  
    // Register with centralized popover manager for resize reposition.
    // (Calculator intentionally does NOT close on outside-click.)
    Popovers.register({
      button: btn,
      menu,
      preferRight: true,
      closeOnOutside: false,
      closeOnEsc: false,
      stopInsideClick: false,
      wireButton: false
    });
  
    function tryCompute(exprRaw) {
      if (!exprRaw) return { ok: false, error: "Empty" };
  
      // normalize user-friendly operators
      let expr = String(exprRaw)
        .replace(/×/g, "*")
        .replace(/÷/g, "/")
        .replace(/−/g, "-")
        .replace(/\s+/g, "");
  
      // allow only digits/operators/decimal/parentheses
      if (!/^[0-9+\-*/().]+$/.test(expr)) {
        return { ok: false, error: "Invalid characters" };
      }
  
      try {
        const value = evalMathExprNoEval(expr);
        if (typeof value !== "number" || !isFinite(value)) {
          return { ok: false, error: "Math error" };
        }
        return { ok: true, value, normalized: expr };
      } catch {
        return { ok: false, error: "Parse error" };
      }
    }
  
    /**
     * CSP-safe math evaluator for + - * / parentheses, decimals, unary minus.
     * No eval, no Function.
     */
    function evalMathExprNoEval(expr) {
      const tokens = tokenize(expr);
      const rpn = toRpn(tokens);
      return evalRpn(rpn);
  
      function tokenize(s) {
        const out = [];
        let i = 0;
  
        const isOp = (t) => ["+", "-", "*", "/"].includes(t);
  
        while (i < s.length) {
          const ch = s[i];
  
          // number (supports decimals)
          if ((ch >= "0" && ch <= "9") || ch === ".") {
            let j = i;
            while (j < s.length && ((s[j] >= "0" && s[j] <= "9") || s[j] === ".")) j++;
            const numStr = s.slice(i, j);
            if (numStr === "." || numStr.split(".").length > 2) throw new Error("bad number");
            out.push({ type: "num", value: parseFloat(numStr) });
            i = j;
            continue;
          }
  
          // parentheses
          if (ch === "(" || ch === ")") {
            out.push({ type: "par", value: ch });
            i++;
            continue;
          }
  
          // operators
          if (ch === "+" || ch === "-" || ch === "*" || ch === "/") {
            // unary minus handling: treat "-x" as "0 - x" when it appears at start,
            // or after another operator or after "("
            const prev = out[out.length - 1];
            const isUnaryMinus =
              ch === "-" &&
              (!prev || (prev.type === "op") || (prev.type === "par" && prev.value === "("));
  
            if (isUnaryMinus) {
              out.push({ type: "num", value: 0 });
            }
            out.push({ type: "op", value: ch });
            i++;
            continue;
          }
  
          throw new Error("invalid char");
        }
  
        // prevent trailing operator like "1+"
        const last = out[out.length - 1];
        if (last && last.type === "op") throw new Error("trailing op");
  
        return out;
      }
  
      function toRpn(tokens) {
        const output = [];
        const ops = [];
  
        const prec = (op) => (op === "+" || op === "-" ? 1 : 2);
  
        for (const t of tokens) {
          if (t.type === "num") {
            output.push(t);
          } else if (t.type === "op") {
            while (ops.length) {
              const top = ops[ops.length - 1];
              if (top.type === "op" && prec(top.value) >= prec(t.value)) {
                output.push(ops.pop());
              } else break;
            }
            ops.push(t);
          } else if (t.type === "par" && t.value === "(") {
            ops.push(t);
          } else if (t.type === "par" && t.value === ")") {
            while (ops.length && !(ops[ops.length - 1].type === "par" && ops[ops.length - 1].value === "(")) {
              output.push(ops.pop());
            }
            if (!ops.length) throw new Error("mismatched parens");
            ops.pop(); // pop "("
          }
        }
  
        while (ops.length) {
          const t = ops.pop();
          if (t.type === "par") throw new Error("mismatched parens");
          output.push(t);
        }
  
        return output;
      }
  
      function evalRpn(rpn) {
        const stack = [];
  
        for (const t of rpn) {
          if (t.type === "num") {
            stack.push(t.value);
          } else if (t.type === "op") {
            const b = stack.pop();
            const a = stack.pop();
            if (a == null || b == null) throw new Error("bad expr");
  
            switch (t.value) {
              case "+": stack.push(a + b); break;
              case "-": stack.push(a - b); break;
              case "*": stack.push(a * b); break;
              case "/": stack.push(a / b); break;
              default: throw new Error("bad op");
            }
          }
        }
  
        if (stack.length !== 1) throw new Error("bad expr");
        return stack[0];
      }
    }
  
    const pushHistory = (line) => {
      const h = state.ui.calc.history;
      // dedupe exact repeats at top
      if (h[0] === line) return;
  
      h.unshift(line);
      if (h.length > HISTORY_MAX) h.length = HISTORY_MAX;
  
      SaveManager.markDirty();
      renderHistory();
    };
  
    function doEquals() {
      const raw = display.value;
      const res = tryCompute(raw);
  
      if (!res.ok) {
        // light feedback: keep input, just flash status
        setStatus(`Calc: ${res.error}`);
        return;
      }
  
      // Round tiny float noise (like 0.30000000000004)
      const shown = Number.isInteger(res.value) ? String(res.value) : String(+res.value.toFixed(10));
      const line = `${res.normalized} = ${shown}`;
  
      pushHistory(line);
      display.value = shown;
      calcJustEvaluated = true;
      display.focus();
    }
  
    function doKey(k) {
      const isDigit = /^[0-9]$/.test(k) || k === ".";
      const isOp = ["*", "/", "-", "+"].includes(k);
  
      // ✅ if we just hit "=", and now we're starting a NEW number, clear first
      if (calcJustEvaluated && isDigit) {
        display.value = "";
      }
  
      // if they hit an operator after "=", allow chaining (keep result)
      if (calcJustEvaluated && isOp) {
        // keep display.value as-is
      }
  
      // once they press anything other than "=", we’re no longer “just evaluated”
      if (k !== "=") calcJustEvaluated = false;
      if (k === "C") {
        const now = Date.now();

        // If display is already empty, treat a quick second press as "clear history".
        if (display.value === "") {
          if ((now - lastClearAt) <= CLEAR_DOUBLE_MS && (state.ui.calc.history?.length || 0) > 0) {
            clearHistory();
            lastClearAt = 0;
          } else {
            armHistoryClearHint();
          }
        } else {
          // First press clears the display and arms a history clear on a quick second press.
          display.value = "";
          armHistoryClearHint();
        }

        display.focus();
        return;
      }
      if (k === "⌫") {
        display.value = display.value.slice(0, -1);
        display.focus();
        return;
      }
      if (k === "=") {
        doEquals();
        return;
      }
  
      // map operator buttons to display symbols (nice)
      const map = { "*": "×", "/": "÷", "-": "−", "+": "+" };
      display.value += (map[k] || k);
      display.focus();
    }
  
    keys.addEventListener("click", (e) => {
      const b = e.target.closest("button[data-k]");
      if (!b) return;
      doKey(b.dataset.k);
    });
  
    // If they type directly, that’s fine too.
    display.addEventListener("input", () => {
      // no autosave needed; only save on successful equals / history change
    });
  
    // Make keyboard/numpad behave like clicking the on-screen keys
    display.addEventListener("keydown", (e) => {
      if (menu.hidden) return; // only when calculator is open
  
      const k = e.key;
  
      // Enter already handled globally, but this keeps behavior consistent if focus is here
      if (k === "Enter") {
        e.preventDefault();
        e.stopPropagation();
        doKey("=");
        return;
      }
  
      if (k === "Escape") {
        e.preventDefault();
        e.stopPropagation();
        closeMenu();
        btn.focus();
        return;
      }
  
      if (k === "Backspace") {
        e.preventDefault();
        e.stopPropagation();
        doKey("⌫");
        return;
      }
  
      // Digits + decimal
      if (/^[0-9]$/.test(k) || k === ".") {
        e.preventDefault();
        e.stopPropagation();
        doKey(k);
        return;
      }
  
      // Operators (numpad + normal keys)
      if (k === "+" || k === "-" || k === "*" || k === "/") {
        e.preventDefault();
        e.stopPropagation();
        doKey(k);
        return;
      }
  
      // Optional: clear with Delete key
      if (k === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        doKey("C");
        return;
      }
  
      // Otherwise let normal typing happen (arrows, home/end, etc.)
    });
  
    renderHistory();
  }
  
  function setupDiceRoller() {
    const dd = document.getElementById("diceDropdown");
    const btn = document.getElementById("diceBtn");
    const menu = document.getElementById("diceMenu");
    const closeBtn = document.getElementById("diceCloseBtn");
  
    const countEl = document.getElementById("diceCount");
    const modEl = document.getElementById("diceMod");
    const rollBtn = document.getElementById("diceRollBtn");
    const clearBtn = document.getElementById("diceClearBtn");
    const histEl = document.getElementById("diceHistory");
  
    const advBtn = document.getElementById("diceAdvBtn");
    const disBtn = document.getElementById("diceDisBtn");
    const activeIcon = document.getElementById("diceActiveIcon");
    const presetBtns = menu?.querySelectorAll(".dicePreset");
    const modPlusEl = document.getElementById("diceModPlus");
  
    if (!dd || !btn || !menu || !closeBtn || !countEl || !modEl || !rollBtn || !clearBtn || !histEl || !advBtn || !disBtn) return;
  
    // persisted state bucket
    if (!state.ui) state.ui = {};
    if (!state.ui.dice) state.ui.dice = { history: [], last: { count: 1, sides: 20, mod: 0, mode: "normal" } };
    if (!Array.isArray(state.ui.dice.history)) state.ui.dice.history = [];
    if (!state.ui.dice.last) state.ui.dice.last = { count: 1, sides: 20, mod: 0, mode: "normal" };
    // ✅ ALWAYS start Mod at 0 on page refresh
    state.ui.dice.last.mod = 0;
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
      const topImg = document.getElementById("diceBtnIcon");
      const src = diceIconMap[sides] || diceIconMap[20];
      if (topImg) topImg.src = src || diceIconMap[20];
      if (activeIcon) activeIcon.src = src || diceIconMap[20];
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
        row.addEventListener("click", () => tryCopy(entry.text));
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
  
    // --- Open/close (calculator-style, ONE system only) ---
    const open = () => {
      menu.hidden = false;
      btn.setAttribute("aria-expanded", "true");
  
      writeUi(state.ui.dice.last);
      syncModPlus();
      updateDiceIcon(Number(state.ui.dice.last.sides || 20));
  
      if (typeof positionMenuOnScreen === "function") {
        positionMenuOnScreen(menu, btn, { preferRight: true });
      }
  
      rollBtn.focus?.({ preventScroll: true });
    };
  
    const close = () => {
      menu.hidden = true;
      btn.setAttribute("aria-expanded", "false");
    };
  
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      if (menu.hidden) open();
      else close();
    });
  
    closeBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
      btn.focus?.({ preventScroll: true });
    });
  
    // click inside menu should NOT close it
    menu.addEventListener("click", (e) => e.stopPropagation());
  
    // escape closes it
    document.addEventListener("keydown", (e) => {
      if (menu.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
        btn.focus?.({ preventScroll: true });
      }
    });
  
    // Register with centralized popover manager for resize reposition.
    // (Dice roller intentionally does NOT close on outside-click.)
    Popovers.register({
      button: btn,
      menu,
      preferRight: true,
      closeOnOutside: false,
      closeOnEsc: false,
      stopInsideClick: false,
      wireButton: false
    });
  
    // buttons
    rollBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.ui.dice.last.mode = "normal";
      doRoll();
    });
  
    advBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.ui.dice.last.mode = "adv";
      doRoll();
    });
  
    disBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.ui.dice.last.mode = "dis";
      doRoll();
    });
  
    [countEl, modEl].forEach((el) => {
      el.addEventListener("keydown", (e) => {
        if (e.key === "Enter") {
          e.preventDefault();
          doRoll();
        }
      });
    });
  
    clearBtn.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      state.ui.dice.history = [];
      SaveManager.markDirty();
      renderHistory();
    });
  
    presetBtns?.forEach((b) => {
      b.addEventListener("click", (e) => {
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
  
  
    modEl.addEventListener("input", syncModPlus);
    modEl.addEventListener("change", syncModPlus);
  
    // Initial UI
    writeUi(state.ui.dice.last);
    syncModPlus();
    updateDiceIcon(Number(state.ui.dice.last.sides || 20));
    renderHistory();
  }
  

  // Boot widgets
  setupTopbarClock();
  setupCalculator();
  setupDiceRoller();
}
