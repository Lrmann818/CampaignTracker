// @ts-check
// Development-only toggles and state mutation guardrails.

/** @typedef {"warn" | "throw" | "off"} GuardMode */
/** @typedef {string | symbol} StatePathSegment */
/** @typedef {{ search?: string | null | undefined, hostname?: string | null | undefined } | null | undefined} LocationLike */
/** @typedef {{ mode?: unknown, helperHint?: unknown }} StateMutationGuardOptions */
/** @typedef {{ mode: GuardMode, helperHint: string }} StateGuardContext */
/** @typedef {() => void} RestoreFn */
/** @typedef {{ capture?: EventListener, bubble?: EventListener }} WrappedListenerEntry */
/** @typedef {PromiseLike<unknown> & { finally: (onFinally: () => void) => PromiseLike<unknown> }} PromiseWithFinally */

export const DEV_QUERY_PARAM = "dev";
export const STATE_GUARD_QUERY_PARAM = "stateGuard";
export const DEV_DOCS_URL = "README.md#dev-flags";

const TRUE_VALUES = new Set(["1", "true", "on", "yes"]);
const FALSE_VALUES = new Set(["0", "false", "off", "no"]);
const DEFAULT_HELPER_HINT = "Use createStateActions(...) helpers (updateCharacterField, updateTrackerField, updateMapField, updateTrackerCardField).";
const DEFAULT_DEV_GUARD_MODE = "warn";

/**
 * @param {string} name
 * @param {LocationLike} [locationObj]
 * @returns {string | null}
 */
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

/**
 * @param {unknown} value
 * @returns {boolean | null}
 */
function parseBooleanFlag(value) {
  if (value == null) return null;
  const normalized = String(value).trim().toLowerCase();
  if (!normalized) return null;
  if (TRUE_VALUES.has(normalized)) return true;
  if (FALSE_VALUES.has(normalized)) return false;
  return null;
}

/**
 * @param {unknown} mode
 * @returns {GuardMode | null}
 */
function normalizeGuardMode(mode) {
  const normalized = String(mode || "").trim().toLowerCase();
  if (!normalized) return null;
  if (normalized === "warn" || normalized === "warning") return "warn";
  if (normalized === "throw" || normalized === "error") return "throw";
  if (normalized === "off" || normalized === "none") return "off";
  return null;
}

/**
 * @param {LocationLike} [locationObj]
 * @returns {boolean}
 */
function isLocalDevHost(locationObj = globalThis?.location) {
  const host = String(locationObj?.hostname || "").trim().toLowerCase();
  if (!host) return false;
  if (host === "localhost" || host === "127.0.0.1" || host === "::1") return true;
  if (host.endsWith(".local")) return true;
  return false;
}

/**
 * @param {LocationLike} [locationObj]
 * @returns {boolean}
 */
export function detectDevMode(locationObj = globalThis?.location) {
  const explicit = parseBooleanFlag(readQueryParam(DEV_QUERY_PARAM, locationObj));
  if (explicit != null) return explicit;
  return isLocalDevHost(locationObj);
}

/**
 * @param {LocationLike} [locationObj]
 * @param {boolean} [devMode]
 * @returns {GuardMode}
 */
export function detectStateGuardMode(locationObj = globalThis?.location, devMode = detectDevMode(locationObj)) {
  const explicit = normalizeGuardMode(readQueryParam(STATE_GUARD_QUERY_PARAM, locationObj));
  if (explicit) return explicit;
  return devMode ? DEFAULT_DEV_GUARD_MODE : "off";
}

export const DEV_MODE = detectDevMode();
export const DEV_STATE_GUARD_MODE = detectStateGuardMode();

let allowedMutationDepth = 0;
/** @type {Set<string>} */
const warnedMutations = new Set();
/** @type {WeakMap<object, object>} */
const proxyCache = new WeakMap();
let lifecycleAllowanceInstalled = false;
/** @type {RestoreFn | null} */
let restoreLifecycleAllowance = null;

/**
 * @param {unknown} value
 * @returns {value is PromiseWithFinally}
 */
function hasPromiseFinally(value) {
  if (!value || (typeof value !== "object" && typeof value !== "function")) return false;
  return typeof Reflect.get(value, "then") === "function"
    && typeof Reflect.get(value, "finally") === "function";
}

/**
 * @template T
 * @param {() => T} fn
 * @returns {T}
 */
function withMutationAllowance(fn) {
  allowedMutationDepth += 1;
  /** @type {T} */
  let result;
  try {
    result = fn();
  } catch (err) {
    allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
    throw err;
  }

  if (hasPromiseFinally(result)) {
    return /** @type {T} */ (result.finally(() => {
      allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
    }));
  }

  allowedMutationDepth = Math.max(0, allowedMutationDepth - 1);
  return result;
}

/**
 * @template T
 * @param {(() => T) | null | undefined} fn
 * @returns {T | undefined}
 */
export function withAllowedStateMutation(fn) {
  if (typeof fn !== "function") return undefined;
  return withMutationAllowance(fn);
}

/**
 * @template T
 * @param {(() => Promise<T>) | null | undefined} fn
 * @returns {Promise<T | undefined>}
 */
export async function withAllowedStateMutationAsync(fn) {
  if (typeof fn !== "function") return undefined;
  return withMutationAllowance(async () => await fn());
}

/**
 * @template {(...args: unknown[]) => unknown} T
 * @param {T} callbackFn
 * @returns {T}
 */
function wrapLifecycleCallback(callbackFn) {
  return /** @type {T} */ (function wrappedMutationAllowedCallback(...args) {
    return withMutationAllowance(() => callbackFn.apply(this, args));
  });
}

/**
 * @param {AddEventListenerOptions | boolean | undefined} options
 * @returns {boolean}
 */
function getListenerCapture(options) {
  if (typeof options === "boolean") return options;
  return !!options?.capture;
}

/**
 * @returns {RestoreFn | null}
 */
function installEventListenerAllowance() {
  const proto = globalThis?.EventTarget?.prototype;
  if (!proto?.addEventListener || !proto?.removeEventListener) return null;

  const originalAdd = proto.addEventListener;
  const originalRemove = proto.removeEventListener;
  /** @type {WeakMap<EventTarget, Map<string, WeakMap<EventListener, WrappedListenerEntry>>>} */
  const listenerWraps = new WeakMap();

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListener} listener
   * @param {boolean} capture
   * @returns {EventListener | null}
   */
  const getWrapped = (target, type, listener, capture) => {
    const targetMap = listenerWraps.get(target);
    const typeMap = targetMap?.get(type);
    const entry = typeMap?.get(listener);
    if (!entry) return null;
    return capture ? entry.capture : entry.bubble;
  };

  /**
   * @param {EventTarget} target
   * @param {string} type
   * @param {EventListener} listener
   * @param {boolean} capture
   * @param {EventListener} wrapped
   * @returns {EventListener}
   */
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

  proto.addEventListener = /** @type {typeof proto.addEventListener} */ (function patchedAddEventListener(type, listener, options) {
    if (typeof listener === "function") {
      const capture = getListenerCapture(options);
      let wrapped = getWrapped(this, type, listener, capture);
      if (!wrapped) {
        wrapped = setWrapped(this, type, listener, capture, wrapLifecycleCallback(listener));
      }
      return originalAdd.call(this, type, wrapped, options);
    }
    return originalAdd.call(this, type, listener, options);
  });

  proto.removeEventListener = /** @type {typeof proto.removeEventListener} */ (function patchedRemoveEventListener(type, listener, options) {
    if (typeof listener === "function") {
      const capture = getListenerCapture(options);
      const wrapped = getWrapped(this, type, listener, capture);
      return originalRemove.call(this, type, wrapped || listener, options);
    }
    return originalRemove.call(this, type, listener, options);
  });

  return () => {
    proto.addEventListener = originalAdd;
    proto.removeEventListener = originalRemove;
  };
}

/**
 * @returns {RestoreFn | null}
 */
function installTimerAllowance() {
  /** @type {typeof globalThis.setTimeout | undefined} */
  const originalTimeout = globalThis?.setTimeout;
  /** @type {typeof globalThis.setInterval | undefined} */
  const originalInterval = globalThis?.setInterval;
  /** @type {typeof globalThis.requestAnimationFrame | undefined} */
  const originalRaf = globalThis?.requestAnimationFrame;
  if (typeof originalTimeout !== "function" || typeof originalInterval !== "function") return null;

  globalThis.setTimeout = /** @type {typeof globalThis.setTimeout} */ (function patchedSetTimeout(callback, delay, ...args) {
    const wrappedCallback = typeof callback === "function"
      ? wrapLifecycleCallback(/** @type {(...args: unknown[]) => unknown} */ (callback))
      : callback;
    return originalTimeout.call(this, wrappedCallback, delay, ...args);
  });

  globalThis.setInterval = /** @type {typeof globalThis.setInterval} */ (function patchedSetInterval(callback, delay, ...args) {
    const wrappedCallback = typeof callback === "function"
      ? wrapLifecycleCallback(/** @type {(...args: unknown[]) => unknown} */ (callback))
      : callback;
    return originalInterval.call(this, wrappedCallback, delay, ...args);
  });

  if (typeof originalRaf === "function") {
    globalThis.requestAnimationFrame = /** @type {typeof globalThis.requestAnimationFrame} */ (function patchedRequestAnimationFrame(callback) {
      return originalRaf.call(this, wrapLifecycleCallback(callback));
    });
  }

  return () => {
    globalThis.setTimeout = originalTimeout;
    globalThis.setInterval = originalInterval;
    if (typeof originalRaf === "function") {
      globalThis.requestAnimationFrame = originalRaf;
    }
  };
}

/**
 * @returns {{ installed: boolean }}
 */
export function installStateMutationAllowanceLifecycle() {
  if (lifecycleAllowanceInstalled) {
    return { installed: true };
  }

  /** @type {RestoreFn[]} */
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

/**
 * @returns {void}
 */
export function uninstallStateMutationAllowanceLifecycle() {
  if (typeof restoreLifecycleAllowance === "function") {
    restoreLifecycleAllowance();
  }
}

/**
 * @param {unknown} value
 * @returns {value is object}
 */
function shouldGuardObject(value) {
  if (!value || typeof value !== "object") return false;
  if (value instanceof Date) return false;
  if (value instanceof RegExp) return false;
  if (ArrayBuffer.isView(value)) return false;
  return true;
}

/**
 * @param {readonly StatePathSegment[]} pathSegments
 * @returns {string}
 */
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

/**
 * @param {{ op: string, path: readonly StatePathSegment[], helperHint?: string | null | undefined }} params
 * @returns {string}
 */
function createViolationMessage({ op, path, helperHint }) {
  return `[state-guard] Direct state ${op} at "${normalizePath(path)}". ${helperHint || DEFAULT_HELPER_HINT}`;
}

/**
 * @param {{ op: string, path: readonly StatePathSegment[], mode: GuardMode, helperHint?: string | null | undefined }} params
 * @returns {void}
 */
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

/**
 * @template {object} T
 * @param {T} target
 * @param {StateGuardContext} ctx
 * @param {readonly StatePathSegment[]} [pathSegments=[]]
 * @returns {T}
 */
function buildStateProxy(target, ctx, pathSegments = []) {
  if (!shouldGuardObject(target)) return target;
  const cached = proxyCache.get(target);
  if (cached) return /** @type {T} */ (cached);

  const proxy = new Proxy(/** @type {object} */ (target), {
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
  return /** @type {T} */ (proxy);
}

/**
 * @template T
 * @param {T} state
 * @param {StateMutationGuardOptions} [options]
 * @returns {{ state: T, enabled: boolean, mode: GuardMode }}
 */
export function installStateMutationGuard(state, options = {}) {
  const mode = normalizeGuardMode(options.mode) || DEV_STATE_GUARD_MODE;
  const helperHint = String(options.helperHint || DEFAULT_HELPER_HINT);
  if (!shouldGuardObject(state)) {
    return { state, enabled: false, mode: "off" };
  }

  if (mode === "off") {
    return { state, enabled: false, mode };
  }

  const guarded = buildStateProxy(state, { mode, helperHint }, []);
  return { state: guarded, enabled: true, mode };
}
