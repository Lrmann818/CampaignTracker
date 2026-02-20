// js/ui/topbar.js
// Phase 3: topbar clock + calculator + dice roller.

import { initTopbarClock } from "./topbarClock.js";
import { initTopbarDiceRoller } from "./topbarDiceRoller.js";
import { initTopbarCalculator } from "./topbarCalculator.js";

export function initTopbarUI(deps) {
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
    return;
  }

  // Boot widgets
  initTopbarClock();
  initTopbarCalculator({ state, SaveManager, Popovers, positionMenuOnScreen, setStatus });
  initTopbarDiceRoller({ state, SaveManager, Popovers, positionMenuOnScreen, setStatus });
}
