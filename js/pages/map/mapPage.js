// js/pages/map/mapPage.js

import { createMapController } from "./mapController.js";
import { getNoopDestroyApi } from "../../utils/domGuards.js";

let _activeMapPageController = null;
const NOOP_MAP_PAGE_API = getNoopDestroyApi();

export function setupMapPage(deps = {}) {
  if (_activeMapPageController?.destroy) {
    _activeMapPageController.destroy();
    _activeMapPageController = null;
  }

  try {
    const controller = createMapController(deps);
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
    deps.setStatus?.("Map page failed to initialize. Check console for details.");
    return NOOP_MAP_PAGE_API;
  }
}
