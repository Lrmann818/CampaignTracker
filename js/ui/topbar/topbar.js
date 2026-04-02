// @ts-check
// js/ui/topbar/topbar.js
// Topbar clock + calculator + dice roller wiring.

import { initTopbarClock } from "./topbarClock.js";
import { initTopbarDiceRoller } from "./topbarDiceRoller.js";
import { initTopbarCalculator } from "./topbarCalculator.js";
import { getNoopDestroyApi } from "../../utils/domGuards.js";
import { DEV_MODE } from "../../utils/dev.js";

/** @typedef {import("../../state.js").State} State */
/** @typedef {ReturnType<typeof import("../../storage/saveManager.js").createSaveManager>} SaveManager */
/** @typedef {ReturnType<typeof import("../popovers.js").createPopoverManager>} PopoversApi */
/** @typedef {{ stickyMs?: number }} StatusOptions */
/** @typedef {(message: string, opts?: StatusOptions) => void} SetStatusFn */
/** @typedef {(menuEl: HTMLElement, anchorEl: HTMLElement, opts?: { preferRight?: boolean }) => void} PositionMenuFn */
/** @typedef {{ destroy?: () => void } | void} WidgetInitResult */
/**
 * @typedef {{
 *   state?: State,
 *   SaveManager?: SaveManager,
 *   Popovers?: PopoversApi,
 *   positionMenuOnScreen?: PositionMenuFn,
 *   setStatus?: SetStatusFn
 * }} TopbarDeps
 */
/** @typedef {{ destroy: () => void }} TopbarApi */

/** @type {TopbarApi | null} */
let _activeTopbarUI = null;

/**
 * @param {string} widgetName
 * @returns {string}
 */
function buildInitErrorMessage(widgetName) {
  return DEV_MODE
    ? `${widgetName} failed in DEV mode. Check console for details.`
    : `${widgetName} failed to initialize. Check console for details.`;
}

/**
 * @param {TopbarDeps} [deps]
 * @returns {TopbarApi}
 */
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

  // Require complete deps to avoid partial widget wiring.
  if (!state || !SaveManager || !Popovers || !positionMenuOnScreen || !setStatus) {
    // Missing deps leaves topbar widgets unavailable.
    console.warn("[topbar] Missing deps; calculator/dice not initialized.");
    return getNoopDestroyApi();
  }

  /**
   * @param {string} widgetName
   * @param {() => WidgetInitResult} initFn
   * @returns {{ destroy?: () => void }}
   */
  const runWidgetInit = (widgetName, initFn) => {
    try {
      return initFn() || getNoopDestroyApi();
    } catch (err) {
      console.error(`[topbar] ${widgetName} init failed:`, err);
      setStatus(buildInitErrorMessage(widgetName), { stickyMs: 5000 });
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
  const childDestroyFns = [clock, calculator, diceRoller].map(
    (widgetApi) => () => widgetApi?.destroy?.()
  );

  /** @type {TopbarApi} */
  const api = {
    destroy() {
      for (const destroyChild of childDestroyFns) destroyChild();
      if (_activeTopbarUI === api) _activeTopbarUI = null;
    }
  };

  _activeTopbarUI = api;
  return api;
}
