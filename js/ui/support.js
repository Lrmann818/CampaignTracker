// @ts-check

export const SUPPORT_EMAIL = "support@lore-ledger.com";
export const BUG_REPORT_SUBJECT = "Lore Ledger Bug Report";

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function toNonEmptyString(value, fallback = "") {
  const normalized = String(value ?? "").trim();
  return normalized || fallback;
}

/**
 * @param {{ version?: unknown, build?: unknown }} [options]
 * @returns {{ version: string, build: string }}
 */
export function getAppReleaseInfo(options = {}) {
  const defaultVersion = typeof __APP_VERSION__ === "string" ? __APP_VERSION__ : "";
  const defaultBuild = typeof __APP_BUILD__ === "string" ? __APP_BUILD__ : "";

  return {
    version: toNonEmptyString(options.version, toNonEmptyString(defaultVersion, "dev")),
    build: toNonEmptyString(options.build)
  };
}

/**
 * @param {{ version?: unknown, build?: unknown }} [options]
 * @returns {string}
 */
export function formatSupportSummary(options = {}) {
  const { version, build } = getAppReleaseInfo(options);
  return build ? `Version ${version} • Build ${build}` : `Version ${version}`;
}

/**
 * @param {unknown} value
 * @param {string} fallback
 * @returns {string}
 */
function normalizeSupportRoute(value, fallback = "(unknown)") {
  const route = toNonEmptyString(value);
  if (!route) return fallback;
  if (route === fallback) return fallback;
  if (route.startsWith("#")) return route;
  return `#${route.replace(/^#+/, "")}`;
}

/**
 * @param {{ windowObj?: { matchMedia?: ((query: string) => { matches: boolean }) | undefined } | null, query: string }} options
 * @returns {boolean}
 */
function matchesDisplayMode({ windowObj, query }) {
  try {
    return !!windowObj?.matchMedia?.(query)?.matches;
  } catch {
    return false;
  }
}

/**
 * @param {{ windowObj?: { matchMedia?: ((query: string) => { matches: boolean }) | undefined } | null, navigatorObj?: unknown }} [options]
 * @returns {"browser-tab" | "installed-pwa" | "standalone-window" | "fullscreen" | "minimal-ui"}
 */
export function detectRuntimeContext(options = {}) {
  const windowObj = options.windowObj ?? globalThis.window;
  const navigatorObj = options.navigatorObj ?? globalThis.navigator;

  if (matchesDisplayMode({ windowObj, query: "(display-mode: window-controls-overlay)" })) {
    return "standalone-window";
  }
  if (matchesDisplayMode({ windowObj, query: "(display-mode: fullscreen)" })) {
    return "fullscreen";
  }
  if (matchesDisplayMode({ windowObj, query: "(display-mode: minimal-ui)" })) {
    return "minimal-ui";
  }
  if (matchesDisplayMode({ windowObj, query: "(display-mode: standalone)" })) {
    return "installed-pwa";
  }

  const standalone = navigatorObj && typeof navigatorObj === "object"
    ? Reflect.get(navigatorObj, "standalone")
    : undefined;
  if (standalone === true) return "installed-pwa";

  return "browser-tab";
}

/**
 * @param {{ windowObj?: { matchMedia?: ((query: string) => { matches: boolean }) | undefined } | null, navigatorObj?: unknown }} [options]
 * @returns {"web" | "pwa"}
 */
export function detectRuntimeMode(options = {}) {
  return detectRuntimeContext(options) === "browser-tab" ? "web" : "pwa";
}

/**
 * @param {{ locationObj?: { hash?: unknown, pathname?: unknown, search?: unknown } | null, fallbackPage?: unknown }} [options]
 * @returns {string}
 */
export function getCurrentRoute(options = {}) {
  const locationObj = options.locationObj ?? globalThis.location;
  const hash = toNonEmptyString(locationObj?.hash);
  if (hash) return normalizeSupportRoute(hash);

  const fallbackPage = toNonEmptyString(options.fallbackPage);
  if (fallbackPage) return normalizeSupportRoute(fallbackPage);

  return "(unknown)";
}

/**
 * @param {unknown} value
 * @returns {"active" | "none"}
 */
function normalizeCampaignState(value) {
  return value === "active" ? "active" : "none";
}

/**
 * @param {{
 *   navigatorObj?: unknown,
 *   documentObj?: { execCommand?: unknown } | null,
 *   locationObj?: { href?: unknown } | null
 * }} [options]
 * @returns {{
 *   clipboardSupport: "async" | "execCommand" | "unavailable",
 *   mailtoSupport: "location-href" | "unavailable",
 *   updateSupport: "service-worker" | "unavailable",
 *   storageEstimateSupport: "available" | "unavailable",
 *   connectivity: "online" | "offline" | "unknown"
 * }}
 */
export function collectSupportCapabilities(options = {}) {
  const navigatorObj = options.navigatorObj ?? globalThis.navigator;
  const documentObj = options.documentObj ?? globalThis.document;
  const locationObj = options.locationObj ?? globalThis.location;
  const clipboard = navigatorObj && typeof navigatorObj === "object"
    ? Reflect.get(navigatorObj, "clipboard")
    : null;
  const storage = navigatorObj && typeof navigatorObj === "object"
    ? Reflect.get(navigatorObj, "storage")
    : null;

  const clipboardSupport = clipboard && typeof clipboard === "object" && typeof Reflect.get(clipboard, "writeText") === "function"
    ? "async"
    : (typeof documentObj?.execCommand === "function" ? "execCommand" : "unavailable");

  const mailtoSupport =
    locationObj && typeof locationObj === "object" && "href" in locationObj
      ? "location-href"
      : "unavailable";

  const updateSupport =
    navigatorObj && typeof navigatorObj === "object" && "serviceWorker" in navigatorObj
      ? "service-worker"
      : "unavailable";

  const storageEstimateSupport = storage && typeof storage === "object" && typeof Reflect.get(storage, "estimate") === "function"
    ? "available"
    : "unavailable";

  const rawOnline = navigatorObj && typeof navigatorObj === "object"
    ? Reflect.get(navigatorObj, "onLine")
    : undefined;
  const connectivity =
    rawOnline === true ? "online" :
      rawOnline === false ? "offline" :
        "unknown";

  return {
    clipboardSupport,
    mailtoSupport,
    updateSupport,
    storageEstimateSupport,
    connectivity
  };
}

/**
 * @param {{
 *   version?: unknown,
  *   build?: unknown,
 *   campaignState?: unknown,
 *   currentRoute?: unknown,
 *   fallbackPage?: unknown,
 *   locationObj?: { href?: unknown, hash?: unknown, pathname?: unknown, search?: unknown } | null,
 *   documentObj?: { execCommand?: unknown } | null,
 *   navigatorObj?: unknown,
 *   windowObj?: { matchMedia?: ((query: string) => { matches: boolean }) | undefined } | null,
 *   timestamp?: unknown
 * }} [options]
 * @returns {{
 *   version: string,
 *   build: string,
 *   runtimeMode: string,
 *   runtimeContext: string,
 *   campaignState: "active" | "none",
 *   currentRoute: string,
 *   clipboardSupport: "async" | "execCommand" | "unavailable",
 *   mailtoSupport: "location-href" | "unavailable",
 *   updateSupport: "service-worker" | "unavailable",
 *   storageEstimateSupport: "available" | "unavailable",
 *   connectivity: "online" | "offline" | "unknown",
 *   timestamp: string,
 *   userAgent: string
 * }}
 */
export function collectDebugInfoSnapshot(options = {}) {
  const { version, build } = getAppReleaseInfo(options);
  const navigatorObj = options.navigatorObj ?? globalThis.navigator;
  const runtimeContext = detectRuntimeContext({ windowObj: options.windowObj, navigatorObj });
  const capabilities = collectSupportCapabilities({
    navigatorObj,
    documentObj: options.documentObj,
    locationObj: options.locationObj
  });
  const currentRoute = toNonEmptyString(options.currentRoute);

  return {
    version,
    build,
    runtimeMode: detectRuntimeMode({ windowObj: options.windowObj, navigatorObj }),
    runtimeContext,
    campaignState: normalizeCampaignState(options.campaignState),
    currentRoute: currentRoute
      ? normalizeSupportRoute(currentRoute, "(unknown)")
      : getCurrentRoute({ locationObj: options.locationObj, fallbackPage: options.fallbackPage }),
    clipboardSupport: capabilities.clipboardSupport,
    mailtoSupport: capabilities.mailtoSupport,
    updateSupport: capabilities.updateSupport,
    storageEstimateSupport: capabilities.storageEstimateSupport,
    connectivity: capabilities.connectivity,
    timestamp: toNonEmptyString(options.timestamp, new Date().toISOString()),
    userAgent: toNonEmptyString(
      navigatorObj && typeof navigatorObj === "object"
        ? Reflect.get(navigatorObj, "userAgent")
        : "",
      "(unknown)"
    )
  };
}

/**
 * @param {{
 *   version?: unknown,
 *   build?: unknown,
 *   runtimeMode?: unknown,
 *   runtimeContext?: unknown,
 *   campaignState?: unknown,
 *   currentRoute?: unknown,
 *   clipboardSupport?: unknown,
 *   mailtoSupport?: unknown,
 *   updateSupport?: unknown,
 *   storageEstimateSupport?: unknown,
 *   connectivity?: unknown,
 *   timestamp?: unknown,
 *   userAgent?: unknown
 * }} [options]
 * @returns {string}
 */
export function buildDebugInfoText(options = {}) {
  const { version, build } = getAppReleaseInfo(options);
  const runtimeMode = toNonEmptyString(options.runtimeMode, "web");
  const runtimeContext = toNonEmptyString(options.runtimeContext, "browser-tab");
  const campaignState = normalizeCampaignState(options.campaignState);
  const currentRoute = normalizeSupportRoute(options.currentRoute, "(unknown)");
  const clipboardSupport = toNonEmptyString(options.clipboardSupport, "unavailable");
  const mailtoSupport = toNonEmptyString(options.mailtoSupport, "unavailable");
  const updateSupport = toNonEmptyString(options.updateSupport, "unavailable");
  const storageEstimateSupport = toNonEmptyString(options.storageEstimateSupport, "unavailable");
  const connectivity = toNonEmptyString(options.connectivity, "unknown");
  const timestamp = toNonEmptyString(options.timestamp, "(unknown)");
  const userAgent = toNonEmptyString(options.userAgent, "(unknown)");

  return [
    `App version: ${version}`,
    build ? `Build id: ${build}` : null,
    `Runtime mode: ${runtimeMode}`,
    `Runtime context: ${runtimeContext}`,
    `Campaign state: ${campaignState === "active" ? "active campaign" : "no active campaign"}`,
    `Current page: ${currentRoute}`,
    `Connectivity: ${connectivity}`,
    `Clipboard support: ${clipboardSupport}`,
    `Email draft support: ${mailtoSupport}`,
    `Update support: ${updateSupport}`,
    `Storage estimate support: ${storageEstimateSupport}`,
    `Timestamp: ${timestamp}`,
    `User agent: ${userAgent}`
  ]
    .filter((line) => typeof line === "string")
    .join("\n");
}

/**
 * @param {{ debugInfoText: string }} options
 * @returns {string}
 */
export function buildBugReportBody(options) {
  const debugInfoText = toNonEmptyString(options?.debugInfoText);
  return [
    "Please describe the bug:",
    "",
    "What were you doing?",
    "",
    "What did you expect to happen?",
    "",
    "What happened instead?",
    "",
    "Can you reproduce it?",
    "",
    "Debug info:",
    debugInfoText
  ].join("\n");
}

/**
 * @param {{ recipient?: unknown, subject?: unknown, debugInfoText: string }} options
 * @returns {string}
 */
export function buildBugReportMailtoUrl(options) {
  const recipient = toNonEmptyString(options?.recipient, SUPPORT_EMAIL);
  const subject = toNonEmptyString(options?.subject, BUG_REPORT_SUBJECT);
  const body = buildBugReportBody({ debugInfoText: options?.debugInfoText || "" });
  const query = [
    `subject=${encodeURIComponent(subject)}`,
    `body=${encodeURIComponent(body)}`
  ].join("&");
  return `mailto:${encodeURIComponent(recipient)}?${query}`;
}

/**
 * @param {{
 *   recipient?: unknown,
 *   subject?: unknown,
 *   debugInfoText: string,
 *   locationObj?: { href?: string } | null
 * }} options
 * @returns {string}
 */
export function openBugReportMailto(options) {
  const locationObj = options?.locationObj ?? globalThis.location;
  const mailtoUrl = buildBugReportMailtoUrl(options);
  if (locationObj) {
    locationObj.href = mailtoUrl;
  }
  return mailtoUrl;
}

/**
 * @param {string} text
 * @param {{ clipboard?: { writeText?: (value: string) => Promise<void> } | null, documentObj?: Document | null }} [options]
 * @returns {Promise<boolean>}
 */
export async function copyPlainText(text, options = {}) {
  const clipboard = options.clipboard ?? globalThis.navigator?.clipboard ?? null;
  if (clipboard?.writeText) {
    try {
      await clipboard.writeText(text);
      return true;
    } catch {
      // Fall back to the best-effort DOM copy path below.
    }
  }

  return fallbackCopyPlainText(text, options.documentObj ?? globalThis.document ?? null);
}

/**
 * @param {string} text
 * @param {Document | null} documentObj
 * @returns {boolean}
 */
function fallbackCopyPlainText(text, documentObj) {
  if (!documentObj?.createElement || !documentObj.body?.appendChild || typeof documentObj.execCommand !== "function") {
    return false;
  }

  const textarea = /** @type {HTMLTextAreaElement} */ (documentObj.createElement("textarea"));
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.setAttribute("aria-hidden", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  textarea.style.pointerEvents = "none";
  textarea.style.left = "-9999px";
  textarea.style.top = "0";

  documentObj.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  textarea.setSelectionRange?.(0, textarea.value.length);

  try {
    return !!documentObj.execCommand("copy");
  } catch {
    return false;
  } finally {
    textarea.remove();
  }
}
