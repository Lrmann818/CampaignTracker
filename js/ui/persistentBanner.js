// @ts-check

/**
 * @typedef {{
 *   className: string,
 *   role: "alert" | "status",
 *   ariaLive: "assertive" | "polite",
 *   dismissPolicy: "transient" | "session",
 *   message: string,
 *   primaryButton: { label: string, className?: string },
 *   dismissButton: { label: string, className?: string }
 * }} PersistentBannerConfig
 */

/**
 * @typedef {{
 *   onPrimary?: () => Promise<unknown> | unknown,
 *   onDismiss?: () => void,
 *   message?: string
 * }} PersistentBannerShowOptions
 */

/**
 * @typedef {{
 *   show: (opts?: PersistentBannerShowOptions) => void,
 *   hide: () => void,
 *   destroy: () => void
 * }} PersistentBannerApi
 */

/**
 * @param {PersistentBannerConfig} config
 * @returns {PersistentBannerApi}
 */
export function createPersistentBanner(config) {
  const { className, role, ariaLive, dismissPolicy, message, primaryButton, dismissButton } = config;

  /** @type {HTMLDivElement | null} */
  let bannerEl = null;
  /** @type {HTMLSpanElement | null} */
  let textEl = null;
  /** @type {HTMLButtonElement | null} */
  let primaryBtnEl = null;
  /** @type {HTMLButtonElement | null} */
  let dismissBtnEl = null;

  let isVisible = false;
  let sessionDismissed = false;
  let destroyed = false;

  function ensureMounted() {
    if (bannerEl) return;

    bannerEl = document.createElement("div");
    bannerEl.className = className;
    bannerEl.setAttribute("role", role);
    bannerEl.setAttribute("aria-live", ariaLive);
    bannerEl.hidden = true;

    textEl = document.createElement("span");
    textEl.textContent = message;

    const actionsEl = document.createElement("div");
    actionsEl.className = `${className}__actions`;

    primaryBtnEl = document.createElement("button");
    primaryBtnEl.type = "button";
    primaryBtnEl.className = primaryButton.className ?? `${className}__btn`;
    primaryBtnEl.textContent = primaryButton.label;

    dismissBtnEl = document.createElement("button");
    dismissBtnEl.type = "button";
    dismissBtnEl.className = dismissButton.className ?? `${className}__btn`;
    dismissBtnEl.textContent = dismissButton.label;

    actionsEl.append(primaryBtnEl, dismissBtnEl);
    bannerEl.append(textEl, actionsEl);
    document.body.appendChild(bannerEl);
  }

  /** @returns {void} */
  function hide() {
    isVisible = false;
    if (!bannerEl) return;
    bannerEl.hidden = true;
    bannerEl.classList.add("isHidden");
    bannerEl.style.display = "none";
  }

  /**
   * @param {PersistentBannerShowOptions} [opts]
   * @returns {void}
   */
  function show(opts = {}) {
    if (destroyed) return;
    if (isVisible) return;
    if (dismissPolicy === "session" && sessionDismissed) return;

    ensureMounted();
    if (!bannerEl || !primaryBtnEl || !dismissBtnEl || !textEl) return;

    if (opts.message !== undefined) {
      textEl.textContent = opts.message;
    }

    primaryBtnEl.onclick = async () => {
      hide();
      if (typeof opts.onPrimary === "function") {
        await opts.onPrimary();
      }
    };

    dismissBtnEl.onclick = () => {
      if (dismissPolicy === "session") {
        sessionDismissed = true;
      }
      hide();
      if (typeof opts.onDismiss === "function") {
        opts.onDismiss();
      }
    };

    isVisible = true;
    bannerEl.hidden = false;
    bannerEl.classList.remove("isHidden");
    bannerEl.style.display = "";
  }

  /** @returns {void} */
  function destroy() {
    if (destroyed) return;
    destroyed = true;
    hide();
    bannerEl?.remove();
    bannerEl = null;
    textEl = null;
    primaryBtnEl = null;
    dismissBtnEl = null;
  }

  return { show, hide, destroy };
}
