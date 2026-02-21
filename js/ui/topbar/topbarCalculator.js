// Topbar calculator popover.

import { createTopbarPopover } from "./topbarPopover.js";
import { requireEl, getNoopDestroyApi } from "../../utils/domGuards.js";

let _activeTopbarCalculator = null;

export function initTopbarCalculator(deps) {
    _activeTopbarCalculator?.destroy?.();
    _activeTopbarCalculator = null;

    const {
        state,
        SaveManager,
        Popovers,
        positionMenuOnScreen,
        setStatus
    } = deps || {};

    const dd = requireEl("#calcDropdown", document, { prefix: "initTopbarCalculator", warn: false });
    const btn = requireEl("#calcBtn", document, { prefix: "initTopbarCalculator", warn: false });
    const menu = requireEl("#calcMenu", document, { prefix: "initTopbarCalculator", warn: false });
    const closeBtn = requireEl("#calcCloseBtn", document, { prefix: "initTopbarCalculator", warn: false });
    const display = requireEl("#calcDisplay", document, { prefix: "initTopbarCalculator", warn: false });
    const keys = menu?.querySelector(".calcKeys");
    const histEl = requireEl("#calcHistory", document, { prefix: "initTopbarCalculator", warn: false });

    if (!dd || !btn || !menu || !closeBtn || !display || !keys || !histEl) {
        setStatus?.("Topbar calculator unavailable (missing expected UI elements).", { stickyMs: 5000 });
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
            addListener(row, "click", () => {
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

    const pop = createTopbarPopover({
        button: btn,
        menu,
        closeButton: closeBtn,
        Popovers,
        positionMenuOnScreen,
        preferRight: true,

        // Calculator intentionally does NOT close on outside-click.
        closeOnOutside: false,
        closeOnEsc: true,
        stopInsideClick: true,

        onOpen: () => {
            renderHistory();
        },
        // Keep focus in the display when opening.
        focusOnOpen: display
    });

    const openMenu = () => pop?.open();
    const closeMenu = () => pop?.close();

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

        // If "=" was just pressed and the next key is a digit, start a new expression.
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

    addListener(keys, "click", (e) => {
        const b = e.target.closest("button[data-k]");
        if (!b) return;
        doKey(b.dataset.k);
    });

    // If they type directly, that’s fine too.
    addListener(display, "input", () => {
        // no autosave needed; only save on successful equals / history change
    });

    // Make keyboard/numpad behave like clicking the on-screen keys
    addListener(display, "keydown", (e) => {
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

    const api = {
        destroy() {
            pop?.destroy?.();
            listenerController.abort();
            if (_activeTopbarCalculator === api) _activeTopbarCalculator = null;
        }
    };

    _activeTopbarCalculator = api;
    return api;
}
