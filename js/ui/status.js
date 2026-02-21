// @ts-nocheck

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

    // CSP violations are not normal JS errors, so capture them explicitly
    document.addEventListener("securitypolicyviolation", (e) => {
      console.error("CSP violation:", {
        blockedURI: e.blockedURI,
        violatedDirective: e.violatedDirective,
        effectiveDirective: e.effectiveDirective,
        sourceFile: e.sourceFile,
        lineNumber: e.lineNumber,
        columnNumber: e.columnNumber
      });

      // Show a user-facing status message.
      setStatus(`Blocked by security policy: ${e.effectiveDirective || e.violatedDirective}`);
    });
  }

  return { setStatus, setSaveStatus, installGlobalErrorHandlers };
}
