// @ts-check
// js/pages/map/mapPage.js

import { createMapController } from "./mapController.js";
import { getNoopDestroyApi } from "../../utils/domGuards.js";

/**
 * @typedef {{
 *   init: () => void,
 *   load: (incomingMapState?: unknown) => void,
 *   destroy: () => void,
 *   render?: () => void,
 *   serialize?: () => unknown
 * }} MapController
 */

/**
 * @typedef {{
 *   state?: { map?: unknown },
 *   setStatus?: (message: string, opts?: { stickyMs?: number }) => void,
 *   [key: string]: unknown
 * }} MapPageDeps
 */

/**
 * @typedef {{ destroy: () => void }} MapPageApi
 */

/** @type {MapController | null} */
let _activeMapPageController = null;
const NOOP_MAP_PAGE_API = /** @type {MapPageApi} */ (getNoopDestroyApi());

/**
 * @param {MapPageDeps} [deps]
 * @returns {MapPageApi}
 */
export function setupMapPage(deps = {}) {
  if (_activeMapPageController?.destroy) {
    _activeMapPageController.destroy();
    _activeMapPageController = null;
  }

  try {
    const controller = /** @type {MapController} */ (createMapController(deps));
    _activeMapPageController = controller;
    controller.load(deps.state?.map);
    controller.init();

    return {
      destroy() {
        controller.destroy();
        if (_activeMapPageController === controller) {
          _activeMapPageController = null;
        }
      }
    };
  } catch (err) {
    console.error("Map page init failed:", err);
    _activeMapPageController?.destroy?.();
    _activeMapPageController = null;
    deps.setStatus?.("Map page failed to initialize. Check console for details.", { stickyMs: 5000 });
    return NOOP_MAP_PAGE_API;
  }
}
