// js/ui/topbar/topbarPopover.js
// Shared popover wiring for topbar widgets (calculator, dice roller, etc.).
// Keeps topbar modules small + consistent while still allowing per-widget behavior.

const popoverRegistrationByButton = new WeakMap();
const activePopoverByButton = new WeakMap();

export function createTopbarPopover(opts) {
  const {
    button,
    menu,
    closeButton,
    Popovers,
    positionMenuOnScreen,
    preferRight = true,

    // Defaults mirror current topbar widget behavior:
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

  const previousPopover = activePopoverByButton.get(button);
  previousPopover?.destroy?.();
  if (previousPopover) activePopoverByButton.delete(button);

  const listenerController = new AbortController();
  const listenerSignal = listenerController.signal;
  const addListener = (target, type, handler, options) => {
    if (!target || typeof target.addEventListener !== "function") return;
    const listenerOptions =
      typeof options === "boolean"
        ? { capture: options }
        : (options || {});
    target.addEventListener(type, handler, { ...listenerOptions, signal: listenerSignal });
  };

  const setExpanded = (isOpen) => {
    button.setAttribute("aria-expanded", isOpen ? "true" : "false");
  };

  let popoverRegEntryForInstance = null;

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

  const close = ({ focus = focusReturnToButton } = {}) => {
    menu.hidden = true;
    setExpanded(false);
    if (typeof onClose === "function") onClose();

    if (focus) {
      button.focus?.({ preventScroll: true });
    }
  };

  const toggle = () => {
    if (menu.hidden) open();
    else close({ focus: focusReturnToButton });
  };

  // --- Wiring ---
  addListener(button, "click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    toggle();
  });

  if (closeButton) {
    addListener(closeButton, "click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      close();
    });
  }

  if (stopInsideClick) {
    addListener(menu, "click", (e) => e.stopPropagation());
  }

  if (closeOnEsc) {
    addListener(document, "keydown", (e) => {
      if (menu.hidden) return;
      if (e.key === "Escape") {
        e.preventDefault();
        close();
      }
    });
  }

  if (closeOnOutside) {
    addListener(
      document,
      "click",
      (e) => {
        if (menu.hidden) return;

        const t = e.target;
        if (t === button || button.contains(t)) return;
        if (t === menu || menu.contains(t)) return;

        close();
      },
      { capture: true }
    );
  }

  // Register with centralized popover manager for resize reposition.
  // We keep Popovers' own close behavior disabled so we don't have two systems.
  if (Popovers && typeof Popovers.register === "function") {
    const existingReg = popoverRegistrationByButton.get(button);
    if (existingReg?.popovers === Popovers && existingReg?.menu === menu) {
      popoverRegEntryForInstance = existingReg;
    } else {
      existingReg?.popoverReg?.destroy?.();
      const popoverReg = Popovers.register({
        button,
        menu,
        preferRight,
        closeOnOutside: false,
        closeOnEsc: false,
        stopInsideClick: false,
        wireButton: false,
      });
      const regEntry = { popovers: Popovers, menu, popoverReg };
      popoverRegistrationByButton.set(button, regEntry);
      popoverRegEntryForInstance = regEntry;
    }
  }

  const api = {
    menu,
    open,
    close: () => close({ focus: focusReturnToButton }),
    toggle,
    position,
    isOpen: () => !menu.hidden,
    destroy: () => {
      close({ focus: false });
      listenerController.abort();
      const storedReg = popoverRegistrationByButton.get(button);
      if (
        storedReg &&
        storedReg === popoverRegEntryForInstance &&
        storedReg.popovers === Popovers &&
        storedReg.menu === menu
      ) {
        storedReg.popoverReg?.destroy?.();
        popoverRegistrationByButton.delete(button);
      }
      if (activePopoverByButton.get(button) === api) {
        activePopoverByButton.delete(button);
      }
    }
  };

  activePopoverByButton.set(button, api);
  return api;
}
