// @ts-nocheck

export function positionMenuOnScreen(menuEl, anchorEl, opts = {}) {
  if (!menuEl || !anchorEl) return;

  const pad = opts.pad ?? 8;   // viewport padding
  const gap = opts.gap ?? 8;   // space between button and menu
  const preferRight = !!opts.preferRight;

  // Temporarily ensure it can be measured
  const wasHidden = menuEl.hidden;
  if (wasHidden) menuEl.hidden = false;

  // Make it viewport-relative so we can clamp easily
  menuEl.style.position = "fixed";
  menuEl.style.left = "0px";
  menuEl.style.top = "0px";
  menuEl.style.right = "auto";
  menuEl.style.bottom = "auto";

  const a = anchorEl.getBoundingClientRect();

  // Measure after making visible/fixed
  const menuRect = menuEl.getBoundingClientRect();
  const menuW = menuRect.width;
  const menuH = menuRect.height;

  // Horizontal: align left by default, or right if requested
  let left = preferRight ? (a.right - menuW) : a.left;

  // Clamp into viewport
  left = Math.max(pad, Math.min(left, window.innerWidth - pad - menuW));

  // Vertical: prefer opening below; flip above if it would overflow
  let topBelow = a.bottom + gap;
  let topAbove = a.top - gap - menuH;

  let top = topBelow;
  if (topBelow + menuH > window.innerHeight - pad && topAbove >= pad) {
    top = topAbove;
  }

  // If still too tall, clamp top and let CSS max-height + scroll handle it
  top = Math.max(pad, Math.min(top, window.innerHeight - pad - Math.min(menuH, window.innerHeight - pad * 2)));

  menuEl.style.left = `${Math.round(left)}px`;
  menuEl.style.top = `${Math.round(top)}px`;

  // Restore hidden state if we only showed it for measurement
  if (wasHidden) menuEl.hidden = true;
}
