// @ts-nocheck
import { DEV_MODE } from "../utils/dev.js";

/**
 * Creates a lightweight status line helper and installs global error handlers.
 *
 * @param {{ statusEl?: HTMLElement|null }} opts
 */
export function createStatus(opts = {}) {
  const statusEl = opts.statusEl || null;
  let lockUntil = 0;

  function setStatus(msg, opts = {}) {
    if (!statusEl) return;
    const stickyMs = Number(opts?.stickyMs);
    lockUntil = stickyMs > 0 ? Date.now() + stickyMs : 0;
    statusEl.textContent = msg || "";
  }

  function setSaveStatus(msg) {
    if (!statusEl) return;
    if (Date.now() < lockUntil) return;
    statusEl.textContent = msg || "";
  }

  function installGlobalErrorHandlers() {
    // JS/runtime errors
    window.addEventListener("error", (event) => {
      // event.error is often the actual Error object (not always present)
      console.error("Global error:", event.error || event.message, event);
      setStatus("Something went wrong. Check console for details.");
    });

    window.addEventListener("unhandledrejection", (event) => {
      console.error("Unhandled promise rejection:", event.reason, event);
      setStatus("Something went wrong. Check console for details.");
    });

    if (!DEV_MODE) return;

    // CSP violations are not normal JS errors, so capture them explicitly (DEV only).
    document.addEventListener("securitypolicyviolation", (e) => {
      const details = {
        violatedDirective: e.violatedDirective || "(unknown)",
        blockedURI: e.blockedURI || "(unknown)",
        effectiveDirective: e.effectiveDirective || "(unknown)",
        documentURI: e.documentURI || location.href
      };
      if (e.sample) details.sample = e.sample;

      console.error("[DEV][CSP VIOLATION] securitypolicyviolation event", details);

      // Optional, non-invasive indicator in existing status line.
      setStatus(`CSP violation: ${details.effectiveDirective}`, { stickyMs: 5000 });
    });
  }

  return { setStatus, setSaveStatus, installGlobalErrorHandlers };
}
