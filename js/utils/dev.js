// @ts-nocheck
// Development-only toggles and state mutation guardrails.

export const DEV_QUERY_PARAM = "dev";
export const STATE_GUARD_QUERY_PARAM = "stateGuard";
export const DEV_DOCS_URL = "README.md#dev-flags";

const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const DEFAULT_HELPER_HINT = "Use createStateActions(...) helpers (updateCharacterField, updateTrackerField, updateMapField, updateTrackerCardField).";
const DEFAULT_DEV_GUARD_MODE = "warn";

function readQueryParam(name, locationObj = globalThis?.location) {
  try {
    const search = String(locationObj?.search || "");
    if (!search) return null;
    const params = new URLSearchParams(search);
    if (!params.has(name)) return null;
    return String(params.get(name) || "").trim();
  } catch (_) {
    return null;
  }
}

function parseBooleanFlag(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

function normalizeGuardMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "warn" || normalized === "warning") return "warn";
  if (normalized === "throw" || normalized === "error") return "throw";
  if (normalized === "off" || normalized === "none") return "off";
  return null;
}

function isLocalDevHost(locationObj = globalThis?.location) {
  const host = String(locationObj?.hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local")) return true;
  return false;
}

export function detectDevMode(locationObj = globalThis?.location) {
  const explicit = parseBooleanFlag(readQueryParam(DEV_QUERY_PARAM, locationObj));
  if (explicit != null) return explicit;
  return isLocalDevHost(locationObj);
}

export function detectStateGuardMode(locationObj = globalThis?.location, devMode = detectDevMode(locationObj)) {
  const explicit = normalizeGuardMode(readQueryParam(STATE_GUARD_QUERY_PARAM, locationObj));
  if (explicit) return explicit;
  return devMode ? DEFAULT_DEV_GUARD_MODE : "off";
}

export const DEV_MODE = detectDevMode();
export const DEV_STATE_GUARD_MODE = detectStateGuardMode();

let allowedMutationDepth = 0;
const warnedMutations = new Set();
const proxyCache = new WeakMap();
let lifecycleAllowanceInstalled = false;
let restoreLifecycleAllowance = null;

function withMutationAllowance(fn) {
  allowedMutationDepth += 1;
  let result;
  try {
    result = fn();
  } catch (err) {
    allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
    throw err;
  }

  if (result && typeof result.then === "function") {
    return result.finally(() => {
      allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
    });
  }

  allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
  return result;
}

export function withAllowedStateMutation(fn) {
  if (typeof fn !== "function") return undefined;
  return withMutationAllowance(fn);
}

export async function withAllowedStateMutationAsync(fn) {
  if (typeof fn !== "function") return undefined;
  return withMutationAllowance(async () => await fn());
}

function wrapLifecycleCallback(callback) {
  if (typeof callback !== "function") return callback;
  return function wrappedMutationAllowedCallback(...args) {
    return withMutationAllowance(() => callback.apply(this, args));
  };
}

function getListenerCapture(options) {
  if (typeof options === "boolean") return options;
  return !!options?.capture;
}

function installEventListenerAllowance() {
  const proto = globalThis?.EventTarget?.prototype;
  if (!proto?.addEventListener || !proto?.removeEventListener) return null;

  const originalAdd = proto.addEventListener;
  const originalRemove = proto.removeEventListener;
  const listenerWraps = new WeakMap();

  const getWrapped = (target, type, listener, capture) => {
    const targetMap = listenerWraps.get(target);
    const typeMap = targetMap?.get(type);
    const entry = typeMap?.get(listener);
    if (!entry) return null;
    return capture ? entry.capture : entry.bubble;
  };

  const setWrapped = (target, type, listener, capture, wrapped) => {
    let targetMap = listenerWraps.get(target);
    if (!targetMap) {
      targetMap = new Map();
      listenerWraps.set(target, targetMap);
    }
    let typeMap = targetMap.get(type);
    if (!typeMap) {
      typeMap = new WeakMap();
      targetMap.set(type, typeMap);
    }
    const entry = typeMap.get(listener) || {};
    if (capture) entry.capture = wrapped;
    else entry.bubble = wrapped;
    typeMap.set(listener, entry);
    return wrapped;
  };

  proto.addEventListener = function patchedAddEventListener(type, listener, options) {
    if (typeof listener === "function") {
      const capture = getListenerCapture(options);
      let wrapped = getWrapped(this, type, listener, capture);
      if (!wrapped) {
        wrapped = setWrapped(this, type, listener, capture, wrapLifecycleCallback(listener));
      }
      return originalAdd.call(this, type, wrapped, options);
    }
    return originalAdd.call(this, type, listener, options);
  };

  proto.removeEventListener = function patchedRemoveEventListener(type, listener, options) {
    if (typeof listener === "function") {
      const capture = getListenerCapture(options);
      const wrapped = getWrapped(this, type, listener, capture);
      return originalRemove.call(this, type, wrapped || listener, options);
    }
    return originalRemove.call(this, type, listener, options);
  };

  return () => {
    proto.addEventListener = originalAdd;
    proto.removeEventListener = originalRemove;
  };
}

function installTimerAllowance() {
  const originalTimeout = globalThis?.setTimeout;
  const originalInterval = globalThis?.setInterval;
  const originalRaf = globalThis?.requestAnimationFrame;
  if (typeof originalTimeout !== "function" || typeof originalInterval !== "function") return null;

  globalThis.setTimeout = function patchedSetTimeout(callback, delay, ...args) {
    return originalTimeout.call(this, wrapLifecycleCallback(callback), delay, ...args);
  };

  globalThis.setInterval = function patchedSetInterval(callback, delay, ...args) {
    return originalInterval.call(this, wrapLifecycleCallback(callback), delay, ...args);
  };

  if (typeof originalRaf === "function") {
    globalThis.requestAnimationFrame = function patchedRequestAnimationFrame(callback) {
      return originalRaf.call(this, wrapLifecycleCallback(callback));
    };
  }

  return () => {
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
    if (typeof originalRaf === "function") {
      globalThis.requestAnimationFrame = originalRaf;
    }
  };
}

export function installStateMutationAllowanceLifecycle() {
  if (lifecycleAllowanceInstalled) {
    return { installed: true };
  }

  const restores = [];
  const restoreEvents = installEventListenerAllowance();
  const restoreTimers = installTimerAllowance();
  if (typeof restoreEvents === "function") restores.push(restoreEvents);
  if (typeof restoreTimers === "function") restores.push(restoreTimers);

  if (restores.length === 0) {
    return { installed: false };
  }

  lifecycleAllowanceInstalled = true;
  restoreLifecycleAllowance = () => {
    for (const restore of restores) {
      try {
        restore();
      } catch (_) {
        // Best effort in DEV only.
      }
    }
    lifecycleAllowanceInstalled = false;
    restoreLifecycleAllowance = null;
  };
  return { installed: true };
}

export function uninstallStateMutationAllowanceLifecycle() {
  if (typeof restoreLifecycleAllowance === "function") {
    restoreLifecycleAllowance();
  }
}

function shouldGuardObject(value) {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Date) return false;
  if (value instanceof RegExp) return false;
  if (ArrayBuffer.isView(value)) return false;
  return true;
}

function normalizePath(pathSegments) {
  if (!Array.isArray(pathSegments) || pathSegments.length === 0) return "<root>";
  return pathSegments
    .map((segment) => {
      if (typeof segment === "symbol") return `[${String(segment)}]`;
      const txt = String(segment);
      if (/^\d+$/.test(txt)) return "[]";
      return txt;
    })
    .join(".");
}

function createViolationMessage({ op, path, helperHint }) {
  return `[state-guard] Direct state ${op} at "${normalizePath(path)}". ${helperHint || DEFAULT_HELPER_HINT}`;
}

function maybeReportViolation({ op, path, mode, helperHint }) {
  const key = `${op}:${normalizePath(path)}`;
  if (warnedMutations.has(key)) return;
  warnedMutations.add(key);

  const message = createViolationMessage({ op, path, helperHint });
  if (mode === "throw") {
    throw new Error(message);
  }
  console.warn(message);
}

function buildStateProxy(target, ctx, pathSegments = []) {
  if (!shouldGuardObject(target)) return target;
  if (proxyCache.has(target)) return proxyCache.get(target);

  const proxy = new Proxy(target, {
    get(obj, prop, receiver) {
      const value = Reflect.get(obj, prop, receiver);
      if (!shouldGuardObject(value)) return value;
      return buildStateProxy(value, ctx, [...pathSegments, prop]);
    },
    set(obj, prop, value, receiver) {
      if (allowedMutationDepth === 0) {
        maybeReportViolation({
          op: "write",
          path: [...pathSegments, prop],
          mode: ctx.mode,
          helperHint: ctx.helperHint
        });
      }
      return Reflect.set(obj, prop, value, receiver);
    },
    deleteProperty(obj, prop) {
      if (allowedMutationDepth === 0) {
        maybeReportViolation({
          op: "delete",
          path: [...pathSegments, prop],
          mode: ctx.mode,
          helperHint: ctx.helperHint
        });
      }
      return Reflect.deleteProperty(obj, prop);
    },
    setPrototypeOf(obj, prototype) {
      if (allowedMutationDepth === 0) {
        maybeReportViolation({
          op: "setPrototypeOf",
          path: pathSegments,
          mode: ctx.mode,
          helperHint: ctx.helperHint
        });
      }
      return Reflect.setPrototypeOf(obj, prototype);
    }
  });

  proxyCache.set(target, proxy);
  return proxy;
}

export function installStateMutationGuard(state, options = {}) {
  const mode = normalizeGuardMode(options.mode) || DEV_STATE_GUARD_MODE;
  const helperHint = String(options.helperHint || DEFAULT_HELPER_HINT);
  if (!state || typeof state !== "object") {
    return { state, enabled: false, mode: "off" };
  }

  if (mode === "off") {
    return { state, enabled: false, mode };
  }

  const guarded = buildStateProxy(state, { mode, helperHint }, []);
  return { state: guarded, enabled: true, mode };
}
