import { numberOrNull } from "../utils/number.js";

function getEl({ id, el, root = document }) {
  if (el) return el;
  if (!id) return null;
  if (root?.getElementById) return root.getElementById(id);
  if (root?.querySelector) return root.querySelector(`#${CSS.escape(id)}`);
  return null;
}

function markDirty(SaveManager) {
  SaveManager?.markDirty?.();
}

export function bindText({
  id,
  el,
  get,
  set,
  SaveManager,
  root = document,
  event = "input",
}) {
  const target = getEl({ id, el, root });
  if (!target) return null;

  target.value = get?.() ?? "";
  target.addEventListener(event, () => {
    set?.(target.value);
    markDirty(SaveManager);
  });

  return target;
}

export function bindNumber({
  id,
  el,
  get,
  set,
  SaveManager,
  autoSizeInput,
  autosizeOpts = { min: 30, max: 80 },
  parse = numberOrNull,
  format = (v) => (v === null || v === undefined ? "" : String(v)),
  root = document,
  event = "input",
}) {
  const target = getEl({ id, el, root });
  if (!target) return null;

  target.value = format(get?.());

  if (typeof autoSizeInput === "function") {
    target.classList.add("autosize");
    autoSizeInput(target, autosizeOpts);
  }

  target.addEventListener(event, () => {
    set?.(parse(target.value));

    if (typeof autoSizeInput === "function") {
      autoSizeInput(target, autosizeOpts);
    }

    markDirty(SaveManager);
  });

  return target;
}

export function bindContentText({
  id,
  el,
  get,
  set,
  SaveManager,
  normalize = (value) => value,
  format = (value) => (value ?? ""),
  root = document,
  event = "input",
}) {
  const target = getEl({ id, el, root });
  if (!target) return null;

  target.textContent = format(get?.());
  target.addEventListener(event, () => {
    const raw = target.textContent ?? "";
    set?.(normalize(raw));
    markDirty(SaveManager);
  });

  return target;
}

export function bindChecked({
  id,
  el,
  get,
  set,
  SaveManager,
  root = document,
  event = "change",
}) {
  const target = getEl({ id, el, root });
  if (!target) return null;

  target.checked = !!get?.();
  target.addEventListener(event, () => {
    set?.(!!target.checked);
    markDirty(SaveManager);
  });

  return target;
}

