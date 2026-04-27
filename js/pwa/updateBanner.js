// @ts-check
import { createPersistentBanner } from "../ui/persistentBanner.js";

/**
 * @typedef {{
 *   onRefresh?: () => Promise<unknown> | unknown,
 *   onDismiss?: () => void
 * }} UpdateBannerOptions
 */

const banner = createPersistentBanner({
  className: "updateBanner",
  role: "status",
  ariaLive: "polite",
  dismissPolicy: "session",
  message: "Update available",
  primaryButton: { label: "Refresh" },
  dismissButton: { label: "Later" },
});

/**
 * @param {UpdateBannerOptions} [options]
 * @returns {void}
 */
export function showUpdateBanner({ onRefresh, onDismiss } = {}) {
  banner.show({ onPrimary: onRefresh, onDismiss });
}

/**
 * @returns {void}
 */
export function hideUpdateBanner() {
  banner.hide();
}
