// @ts-check
import { registerSW } from "virtual:pwa-register";

/**
 * @typedef {() => void | Promise<void>} PwaUpdateCallback
 */
/**
 * @typedef {{
 *   onNeedRefresh?: PwaUpdateCallback,
 *   onOfflineReady?: PwaUpdateCallback
 * }} PwaUpdatesOptions
 */
/**
 * @typedef {{
 *   checkForUpdates: () => Promise<boolean>,
 *   applyUpdate: () => Promise<boolean>
 * }} PwaUpdatesApi
 */
/**
 * @typedef {(reloadPage?: boolean) => Promise<void>} UpdateServiceWorker
 */

/** @type {Promise<UpdateServiceWorker | null> | null} */
let registerPromise = null;
/** @type {UpdateServiceWorker | null} */
let updateServiceWorker = null;
/** @type {Set<PwaUpdateCallback>} */
const needRefreshHandlers = new Set();
/** @type {Set<PwaUpdateCallback>} */
const offlineReadyHandlers = new Set();
const appMeta = /** @type {ImportMeta & { env?: { PROD?: boolean } }} */ (import.meta);

/**
 * @param {Iterable<PwaUpdateCallback>} handlers
 * @returns {void}
 */
function notifyHandlers(handlers) {
  for (const handler of handlers) {
    try {
      handler?.();
    } catch (err) {
      console.error(err);
    }
  }
}

/**
 * @returns {Promise<UpdateServiceWorker | null>}
 */
function ensureRegistration() {
  if (registerPromise) return registerPromise;

  registerPromise = Promise.resolve().then(() => {
    if (!appMeta.env?.PROD) return null;
    updateServiceWorker = /** @type {UpdateServiceWorker} */ (registerSW({
      immediate: true,
      onNeedRefresh() {
        notifyHandlers(needRefreshHandlers);
      },
      onOfflineReady() {
        notifyHandlers(offlineReadyHandlers);
      }
    }));
    return updateServiceWorker;
  });

  return registerPromise;
}

/**
 * @param {PwaUpdatesOptions} [options]
 * @returns {PwaUpdatesApi}
 */
export function initPwaUpdates({ onNeedRefresh, onOfflineReady } = {}) {
  if (typeof onNeedRefresh === "function") {
    needRefreshHandlers.add(onNeedRefresh);
  }
  if (typeof onOfflineReady === "function") {
    offlineReadyHandlers.add(onOfflineReady);
  }

  if (typeof window === "undefined" || !("serviceWorker" in navigator)) {
    return {
      checkForUpdates: async () => false,
      applyUpdate: async () => false
    };
  }

  ensureRegistration().catch((err) => {
    console.error(err);
  });

  return {
    checkForUpdates: async () => {
      await ensureRegistration();
      if (!updateServiceWorker) return false;
      await updateServiceWorker(false);
      return true;
    },
    applyUpdate: async () => {
      await ensureRegistration();
      if (!updateServiceWorker) return false;
      await updateServiceWorker(true);
      return true;
    }
  };
}
