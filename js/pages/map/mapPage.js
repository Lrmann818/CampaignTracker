// js/pages/map/mapPage.js

import { createMapController } from "./mapController.js";

let _activeMapPageController = null;

export function setupMapPage(deps = {}) {
  if (_activeMapPageController?.destroy) {
    _activeMapPageController.destroy();
    _activeMapPageController = null;
  }

  const controller = createMapController(deps);
  _activeMapPageController = controller;

  try {
    controller.load(deps.state?.map);
    controller.init();
  } catch (err) {
    controller.destroy();
    if (_activeMapPageController === controller) {
      _activeMapPageController = null;
    }
    throw err;
  }

  return {
    destroy() {
      controller.destroy();
      if (_activeMapPageController === controller) {
        _activeMapPageController = null;
      }
    }
  };
}
