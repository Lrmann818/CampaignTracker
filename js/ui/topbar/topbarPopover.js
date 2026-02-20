// js/ui/topbar/topbarPopover.js
// Shared popover wiring for topbar widgets (calculator, dice roller, etc.).
// Keeps topbar modules small + consistent while still allowing per-widget behavior.

export function createTopbarPopover(opts) {
  const {
    button,
    menu,
    closeButton,
    Popovers,
    positionMenuOnScreen,
    preferRight = true,

    // Behavior defaults match your current calculator/dice UX:
    // - stays open unless explicitly closed (no outside-click close)
    // - Escape closes (handled here, not by Popovers)
    closeOnOutside = false,
    closeOnEsc = true,
    stopInsideClick = true,

    // Hooks
    onOpen,
    onClose,
    focusOnOpen, // element OR () => element OR () => void
    focusReturnToButton = true,
  } = opts || {};

  if (!button || !menu) return null;

  const setExpanded = (isOpen) => {
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  const position = () => {
    if (typeof positionMenuOnScreen === "function") {
      positionMenuOnScreen(menu, button, { preferRight });
    }
  };

  const open = () => {
    menu.hidden = false;
    setExpanded(true);
    position();
    if (typeof onOpen === "function") onOpen();

    if (focusOnOpen) {
      const target =
        typeof focusOnOpen === "function" ? focusOnOpen() : focusOnOpen;

      if (target && typeof target.focus === "function") {
        target.focus({ preventScroll: true });
      }
    }
  };

  const close = () => {
    menu.hidden = true;
    setExpanded(false);
    if (typeof onClose === "function") onClose();

    if (focusReturnToButton) {
      button.focus?.({ preventScroll: true });
    }
  };

  const toggle = () => {
    if (menu.hidden) open();
    else close();
  };

  // --- Wiring ---
  button.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  if (closeButton) {
    closeButton.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }

  if (stopInsideClick) {
    menu.addEventListener("click", (e) => e.stopPropagation());
  }

  if (closeOnEsc) {
    document.addEventListener("keydown", (e) => {
      if (menu.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
  }

  if (closeOnOutside) {
    document.addEventListener(
      "click",
      (e) => {
        if (menu.hidden) return;

        const t = e.target;
        if (t === button || button.contains(t)) return;
        if (t === menu || menu.contains(t)) return;

        close();
      },
      true
    );
  }

  // Register with centralized popover manager for resize reposition.
  // We keep Popovers' own close behavior disabled so we don't have two systems.
  if (Popovers && typeof Popovers.register === "function") {
    Popovers.register({
      button,
      menu,
      preferRight,
      closeOnOutside: false,
      closeOnEsc: false,
      stopInsideClick: false,
      wireButton: false,
    });
  }

  return {
    open,
    close,
    toggle,
    position,
    isOpen: () => !menu.hidden,
  };
}