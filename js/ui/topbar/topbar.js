// js/ui/topbar.js
// Phase 3: topbar clock + calculator + dice roller.

import { initTopbarClock } from "./topbarClock.js";
import { initTopbarDiceRoller } from "./topbarDiceRoller.js";
import { initTopbarCalculator } from "./topbarCalculator.js";
import { getNoopDestroyApi } from "../../utils/domGuards.js";

let _activeTopbarUI = null;

export function initTopbarUI(deps) {
  _activeTopbarUI?.destroy?.();
  _activeTopbarUI = null;

  const {
    state,
    SaveManager,
    Popovers,
    positionMenuOnScreen,
    setStatus
  } = deps || {};

  // These *do* need deps. If any are missing, fail fast in dev.
  if (!state || !SaveManager || !Popovers || !positionMenuOnScreen || !setStatus) {
    // In production you could just return, but during refactor this is safer.
    console.warn("[topbar] Missing deps; calculator/dice not initialized.");
    return getNoopDestroyApi();
  }

  const runWidgetInit = (widgetName, initFn) => {
    try {
      return initFn();
    } catch (err) {
      console.error(`[topbar] ${widgetName} init failed:`, err);
      setStatus(`${widgetName} failed to initialize. Check console for details.`);
      return getNoopDestroyApi();
    }
  };

  // Boot widgets
  const clock = runWidgetInit("Topbar clock", () => initTopbarClock({ setStatus }));
  const calculator = runWidgetInit(
    "Topbar calculator",
    () => initTopbarCalculator({ state, SaveManager, Popovers, positionMenuOnScreen, setStatus })
  );
  const diceRoller = runWidgetInit(
    "Topbar dice roller",
    () => initTopbarDiceRoller({ state, SaveManager, Popovers, positionMenuOnScreen, setStatus })
  );

  const api = {
    destroy() {
      clock?.destroy?.();
      calculator?.destroy?.();
      diceRoller?.destroy?.();
      if (_activeTopbarUI === api) _activeTopbarUI = null;
    }
  };

  _activeTopbarUI = api;
  return api;
}
