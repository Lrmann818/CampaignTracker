import { DEV_MODE } from "./dev.js";

const NOOP_DESTROY_API = Object.freeze({
  destroy() { }
});

function resolveRoot(root) {
  if (root && typeof root.querySelector === "function") return root;
  if (typeof document !== "undefined") return document;
  return null;
}

export function requireEl(selector, root, options = {}) {
  const resolvedRoot = resolveRoot(root);
  if (!resolvedRoot) return null;

  let el = null;
  try {
    el = resolvedRoot.querySelector(selector);
  } catch (err) {
    if (options.warn !== false) {
      console.warn(`[dom] Invalid selector "${selector}"`, err);
    }
    return null;
  }

  if (el) return el;

  if (options.warn !== false) {
    const prefix = options.prefix ? `${options.prefix}: ` : "";
    console.warn(`[dom] ${prefix}Missing required element "${selector}"`);
  }

  return null;
}

export function assertEl(selector, root, options = {}) {
  const el = requireEl(selector, root, options);
  if (el) return el;

  if (DEV_MODE) {
    const prefix = options.prefix ? `${options.prefix}: ` : "";
    throw new Error(`${prefix}Missing required element "${selector}"`);
  }

  return null;
}

export function getNoopDestroyApi() {
  return NOOP_DESTROY_API;
}
