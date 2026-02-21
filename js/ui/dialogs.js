// Custom dialogs (alert/confirm/prompt) for a consistent in-app UI.
// Replaces native window.alert/confirm/prompt.
//
// Exports:
//   initDialogs()   -> safe to call once on startup
//   uiAlert(msg, {title, okText})
//   uiConfirm(msg, {title, okText, cancelText}) -> Promise<boolean>
//   uiPrompt(msg, {title, okText, cancelText, placeholder, value}) -> Promise<string|null>

let _initialized = false;

let _lastFocus = null;

function getFocusable(container) {
  if (!container) return [];
  const selectors = [
    "a[href]",
    "button:not([disabled])",
    "input:not([disabled])",
    "select:not([disabled])",
    "textarea:not([disabled])",
    "[tabindex]:not([tabindex='-1'])"
  ];
  /** @type {HTMLElement[]} */
  const nodes = Array.from(container.querySelectorAll(selectors.join(",")));
  return nodes.filter((el) => {
    // Must be visible
    if (el.hasAttribute("hidden")) return false;
    const style = window.getComputedStyle(el);
    if (style.display === "none" || style.visibility === "hidden") return false;
    return true;
  });
}

function setInert(el, val) {
  if (!el) return;
  try {
    // Prefer property when available
    if ("inert" in el) el.inert = !!val;
    // Keep attribute in sync for styling/hooks
    if (val) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  } catch {
    // Fallback: attribute only
    if (val) el.setAttribute("inert", "");
    else el.removeAttribute("inert");
  }
}



function hasValidShell(overlay) {
  if (!overlay) return false;
  // Validate required elements exist inside the overlay.
  const requiredSelectors = [
    ".uiDialogPanel",
    "#uiDialogTitle",
    "#uiDialogMessage",
    "#uiDialogInput",
    "#uiDialogOk",
    "#uiDialogCancel",
    "#uiDialogClose",
  ];
  return requiredSelectors.every((sel) => overlay.querySelector(sel));
}

function ensureShell() {
  let overlay = document.getElementById("uiDialogOverlay");
  // If an overlay exists but is missing required elements (older markup), rebuild it.
  if (overlay && hasValidShell(overlay)) return overlay;
  if (overlay && !hasValidShell(overlay)) {
    try { overlay.remove(); } catch { /* ignore */ }
    overlay = null;
  }

overlay = document.createElement("div");
  overlay.id = "uiDialogOverlay";
  overlay.className = "modalOverlay";
  overlay.hidden = true;
  setInert(overlay, true);
  overlay.setAttribute("aria-hidden", "true");

  const panel = document.createElement("div");
  panel.className = "modalPanel uiDialogPanel";
  panel.setAttribute("role", "dialog");
  panel.setAttribute("aria-modal", "true");
  panel.setAttribute("tabindex", "-1");

  // static-only template (no user text).
  panel.innerHTML = `
    <div class="uiDialogHeader">
      <div class="modalTitle" id="uiDialogTitle">Notice</div>
      <button type="button" class="npcSmallBtn" id="uiDialogClose" aria-label="Close">✕</button>
    </div>
    <div class="uiDialogBody">
      <div id="uiDialogMessage"></div>
      <input id="uiDialogInput" class="settingsInput" style="width:100%; display:none;" />
    </div>
    <div class="uiDialogFooter">
      <button type="button" class="npcSmallBtn" id="uiDialogCancel" style="display:none;">Cancel</button>
      <button type="button" class="npcSmallBtn" id="uiDialogOk">OK</button>
    </div>
  `;

  overlay.appendChild(panel);
  document.body.appendChild(overlay);

  return overlay;
}

function openShell({ title, message, mode, opts }) {
  const overlay = ensureShell();
  const panel = overlay.querySelector(".uiDialogPanel");
  const titleEl = overlay.querySelector("#uiDialogTitle");
  const msgEl = overlay.querySelector("#uiDialogMessage");
  const inputEl = overlay.querySelector("#uiDialogInput");
  const btnOk = overlay.querySelector("#uiDialogOk");
  const btnCancel = overlay.querySelector("#uiDialogCancel");
  const btnClose = overlay.querySelector("#uiDialogClose");

  titleEl.textContent = title || "Notice";
  msgEl.textContent = message ?? "";

  // mode: "alert" | "confirm" | "prompt"
  const isConfirm = mode === "confirm" || mode === "prompt";
  btnCancel.style.display = isConfirm ? "" : "none";
  btnCancel.textContent = (opts && opts.cancelText) ? String(opts.cancelText) : "Cancel";
  btnOk.textContent = (opts && opts.okText) ? String(opts.okText) : "OK";

  if (mode === "prompt") {
    inputEl.style.display = "";
    inputEl.placeholder = (opts && ("placeholder" in opts)) ? String(opts.placeholder ?? "") : "";
    const _val = (opts && ("value" in opts)) ? opts.value : ((opts && ("defaultValue" in opts)) ? opts.defaultValue : "");
    inputEl.value = (_val == null) ? "" : String(_val);
  } else {
    inputEl.style.display = "none";
    inputEl.value = "";
  }

  _lastFocus = document.activeElement;

  overlay.hidden = false;
  setInert(overlay, false);
  overlay.setAttribute("aria-hidden", "false");

  // focus
  queueMicrotask(() => {
    panel.focus();
    if (mode === "prompt") inputEl.focus();
    else btnOk.focus();
  });

  return { overlay, panel, titleEl, msgEl, inputEl, btnOk, btnCancel, btnClose };
}

function closeShell(overlay) {
  overlay.hidden = true;
  setInert(overlay, true);
  overlay.setAttribute("aria-hidden", "true");

  // Restore focus to whatever opened the dialog (best effort)
  const prev = _lastFocus;
  _lastFocus = null;
  queueMicrotask(() => {
    try {
      if (prev && typeof prev.focus === "function" && document.contains(prev)) prev.focus();
    } catch {
      // ignore
    }
  });
}

function wireCloseHandlers({ overlay, panel, btnOk, btnCancel, btnClose, inputEl }, resolve, mode) {
  const cleanup = (result) => {
    btnOk?.removeEventListener("click", onOk);
    btnCancel?.removeEventListener("click", onCancel);
    btnClose?.removeEventListener("click", onCancel);
    overlay?.removeEventListener("click", onOverlay);
    document.removeEventListener("keydown", onKeyDown);
    closeShell(overlay);
    resolve(result);
  };

  const onOk = (e) => {
    e?.preventDefault?.();
    if (mode === "prompt") cleanup(inputEl.value);
    else if (mode === "confirm") cleanup(true);
    else cleanup(undefined);
  };

  const onCancel = (e) => {
    e?.preventDefault?.();
    if (mode === "confirm") cleanup(false);
    else if (mode === "prompt") cleanup(null);
    else cleanup(undefined);
  };

  const onOverlay = (e) => {
    // click outside closes for alert, cancels for confirm/prompt
    if (e.target !== overlay) return;
    onCancel(e);
  };

  const onKeyDown = (e) => {
    if (e.key === "Escape") return onCancel(e);
    if (e.key === "Enter") {
      // Enter should submit prompt/confirm; for alert it's OK.
      return onOk(e);
    }

    // Trap focus inside the dialog while open
    if (e.key === "Tab") {
      const focusables = getFocusable(panel);
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      const active = document.activeElement;

      if (e.shiftKey) {
        if (active === first || active === panel) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (active === last) {
          e.preventDefault();
          first.focus();
        }
      }
    }
  };

  btnOk?.addEventListener("click", onOk);
  btnCancel?.addEventListener("click", onCancel);
  btnClose?.addEventListener("click", onCancel);
  overlay?.addEventListener("click", onOverlay);
  document.addEventListener("keydown", onKeyDown);
}

export function initDialogs() {
  if (_initialized) return;
  ensureShell();
  _initialized = true;
}

export function uiAlert(message, opts = {}) {
  return new Promise((resolve) => {
    const shell = openShell({ title: opts.title || "Notice", message, mode: "alert", opts });
    wireCloseHandlers(shell, resolve, "alert");
  });
}

export function uiConfirm(message, opts = {}) {
  return new Promise((resolve) => {
    const shell = openShell({ title: opts.title || "Confirm", message, mode: "confirm", opts });
    wireCloseHandlers(shell, resolve, "confirm");
  });
}

export function uiPrompt(message, opts = {}) {
  return new Promise((resolve) => {
    const shell = openShell({ title: opts.title || "Input", message, mode: "prompt", opts });
    wireCloseHandlers(shell, resolve, "prompt");
  });
}
