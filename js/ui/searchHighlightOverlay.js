// Search highlight overlay for inputs/textareas.
// True "highlight each occurrence" even inside <textarea> by using an underlay div.
// The overlay renders the same text with transparent color, but wraps matches in <mark>
// so only the highlight background is visible behind the real input text.

const _wrapped = new WeakMap();

function escapeRegExp(str) {
  return String(str).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function buildHighlightedFragment(value, query) {
  const fragment = document.createDocumentFragment();
  const text = String(value ?? "");
  const q = String(query ?? "").trim();

  if (!q) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  const re = new RegExp(escapeRegExp(q), "gi");
  let lastIndex = 0;
  let match = re.exec(text);

  if (!match) {
    fragment.appendChild(document.createTextNode(text));
    return fragment;
  }

  while (match) {
    const start = match.index;
    const end = start + match[0].length;

    if (start > lastIndex) {
      fragment.appendChild(document.createTextNode(text.slice(lastIndex, start)));
    }

    const mark = document.createElement("mark");
    mark.className = "searchMark";
    mark.textContent = text.slice(start, end);
    fragment.appendChild(mark);

    lastIndex = end;
    match = re.exec(text);
  }

  if (lastIndex < text.length) {
    fragment.appendChild(document.createTextNode(text.slice(lastIndex)));
  }

  return fragment;
}

/**
 * Wrap an <input> or <textarea> with an overlay that highlights matches.
 *
 * @param {HTMLInputElement|HTMLTextAreaElement} fieldEl
 * @param {() => string} getQuery - function that returns the current search query
 * @returns {{ update: () => void, destroy: () => void }}
 */
export function attachSearchHighlightOverlay(fieldEl, getQuery) {
  if (!fieldEl) return { update() {}, destroy() {} };

  // If already wrapped, just update query source.
  const existing = _wrapped.get(fieldEl);
  if (existing) {
    existing.getQuery = getQuery;
    existing.update();
    return { update: existing.update, destroy: existing.destroy };
  }

  const wrap = document.createElement("div");
  wrap.className = "hlWrap";

  const overlay = document.createElement("div");
  overlay.className = "hlOverlay";
  overlay.setAttribute("aria-hidden", "true");

  // Insert wrapper around field
  const parent = fieldEl.parentNode;
  if (!parent) return { update() {}, destroy() {} };

  parent.insertBefore(wrap, fieldEl);
  wrap.appendChild(overlay);
  wrap.appendChild(fieldEl);

  // Keep field above overlay
  fieldEl.classList.add("hlField");

  // Copy key font/padding props so overlay lines up exactly.
  function syncStyles() {
    const cs = getComputedStyle(fieldEl);
    overlay.style.font = cs.font;
    overlay.style.letterSpacing = cs.letterSpacing;
    overlay.style.lineHeight = cs.lineHeight;
    overlay.style.textTransform = cs.textTransform;
    overlay.style.textIndent = cs.textIndent;
    overlay.style.textAlign = cs.textAlign;
    overlay.style.padding = cs.padding;
    overlay.style.borderRadius = cs.borderRadius;

    // Inputs typically have nowrap; textarea wraps.
    overlay.style.whiteSpace = fieldEl.tagName === "INPUT" ? "pre" : "pre-wrap";
  }

  function syncScroll() {
    overlay.scrollTop = fieldEl.scrollTop;
    overlay.scrollLeft = fieldEl.scrollLeft;
  }

  function update() {
    syncStyles();

    const q = (getQuery ? getQuery() : "") || "";
    overlay.replaceChildren(buildHighlightedFragment(fieldEl.value, q));

    // Keep heights aligned (use clientHeight, because borders are on field)
    overlay.style.height = fieldEl.clientHeight + "px";
    overlay.style.width = fieldEl.clientWidth + "px";

    syncScroll();
  }

  // Event wiring
  const onInput = () => update();
  const onScroll = () => syncScroll();

  fieldEl.addEventListener("input", onInput);
  fieldEl.addEventListener("scroll", onScroll);

  // ResizeObserver keeps overlay aligned when autosize/responsive changes happen.
  let ro = null;
  if (typeof ResizeObserver !== "undefined") {
    ro = new ResizeObserver(() => update());
    ro.observe(fieldEl);
  }

  // First paint: wait a tick to ensure styles are computed correctly in DOM.
  queueMicrotask(() => update());

  function destroy() {
    fieldEl.removeEventListener("input", onInput);
    fieldEl.removeEventListener("scroll", onScroll);
    if (ro) ro.disconnect();

    // Unwrap (best-effort)
    try {
      const p = wrap.parentNode;
      if (p) {
        p.insertBefore(fieldEl, wrap);
        wrap.remove();
      }
      fieldEl.classList.remove("hlField");
      _wrapped.delete(fieldEl);
    } catch {
      // no-op
    }
  }

  const record = { wrap, overlay, getQuery, update, destroy };
  _wrapped.set(fieldEl, record);

  return { update, destroy };
}
