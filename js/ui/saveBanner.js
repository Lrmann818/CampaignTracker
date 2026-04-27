// @ts-check
import { createPersistentBanner } from "./persistentBanner.js";

/**
 * @typedef {{
 *   onExport?: () => Promise<unknown> | unknown,
 *   onDismiss?: () => void
 * }} SaveBannerOptions
 */

const banner = createPersistentBanner({
  className: "saveBanner",
  role: "alert",
  ariaLive: "assertive",
  dismissPolicy: "transient",
  message: "Unable to save your progress — your device storage is full. Export a backup to avoid losing your data.",
  primaryButton: { label: "Export Backup", className: "saveBanner__btn saveBanner__btn--primary" },
  dismissButton: { label: "Later" },
});

/**
 * @param {SaveBannerOptions} [options]
 * @returns {void}
 */
export function showSaveBanner({ onExport, onDismiss } = {}) {
  banner.show({ onPrimary: onExport, onDismiss });
}

/**
 * @returns {void}
 */
export function hideSaveBanner() {
  banner.hide();
}
