// js/pages/map/mapToolbarUI.js

export function initMapToolbarUI({
  state,
  SaveManager,
  Popovers,
  positionMenuOnScreen,
  canvas,
  canvasWrap,
  getActiveMap,
  colorFromKey,
  undo,
  redo,
  clearDrawing
}) {
  const toolBtn = document.getElementById("toolDropdownBtn");
  const toolMenu = document.getElementById("toolDropdownMenu");
  const toolOptions = Array.from(toolMenu?.querySelectorAll("[data-tool]") || []);
  const toolLabel = toolBtn?.querySelector("[data-tool-label]");

  const colorDropdown = document.getElementById("colorDropdown");
  const colorBtn = document.getElementById("colorBtn");
  const colorMenu = document.getElementById("colorDropdownMenu");
  const colorOptions = Array.from(colorMenu?.querySelectorAll(".colorSwatch") || []);
  const preview = document.getElementById("activeColorPreview");

  // Centralized popover registrations (outside click + Escape + resize reposition)
  const toolPopover = (Popovers && toolBtn && toolMenu)
    ? Popovers.register({
      button: toolBtn,
      menu: toolMenu,
      preferRight: false,
      closeOnOutside: true,
      closeOnEsc: true,
      stopInsideClick: true,
      wireButton: true,
      onOpen: () => {
        const first = toolMenu.querySelector("button:not([disabled])");
        try { first?.focus?.({ preventScroll: true }); } catch { first?.focus?.(); }
      }
    })
    : null;

  const colorPopover = (Popovers && colorBtn && colorMenu)
    ? Popovers.register({
      button: colorBtn,
      menu: colorMenu,
      preferRight: false,
      closeOnOutside: true,
      closeOnEsc: true,
      stopInsideClick: true,
      wireButton: false, // we add a conditional click handler below
      onOpen: () => {
        const first = colorMenu.querySelector("button:not([disabled])");
        try { first?.focus?.({ preventScroll: true }); } catch { first?.focus?.(); }
      }
    })
    : null;

  // Keyboard: make tool + color dropdowns feel closer to native <select>.
  const wireNativeLikeKeys = (btn, openFn, menu) => {
    if (!btn || !openFn || !menu) return;
    btn.addEventListener("keydown", (e) => {
      const k = e.key;
      if (k !== "ArrowDown" && k !== "ArrowUp" && k !== "Enter" && k !== " ") return;
      e.preventDefault();
      openFn();
      const opts = Array.from(menu.querySelectorAll("button:not([disabled])"));
      if (!opts.length) return;
      const target = (k === "ArrowUp") ? opts[opts.length - 1] : opts[0];
      try { target.focus({ preventScroll: true }); } catch { target.focus(); }
    });
  };

  wireNativeLikeKeys(toolBtn, () => toolPopover?.open?.(), toolMenu);
  wireNativeLikeKeys(colorBtn, () => colorPopover?.open?.(), colorMenu);

  function applyMapInteractionMode() {
    const tool = state.map.ui?.activeTool || "brush";
    const drawing = (tool === "brush" || tool === "eraser");
    canvasWrap?.classList.toggle("drawingMode", drawing);
    canvas.style.touchAction = drawing ? "none" : "pan-x pan-y";
  }

  function closeToolMenu() {
    if (toolPopover) return toolPopover.close();
    if (!toolMenu || !toolBtn) return;
    toolMenu.hidden = true;
    toolBtn.setAttribute("aria-expanded", "false");
  }

  function closeColorMenu() {
    if (colorPopover) return colorPopover.close();
    if (!colorMenu || !colorBtn) return;
    colorMenu.hidden = true;
    colorMenu.setAttribute("hidden", "");
    colorBtn.setAttribute("aria-expanded", "false");
  }

  function setActiveToolUI(tool) {
    const nice = (tool || "brush").slice(0, 1).toUpperCase() + (tool || "brush").slice(1);
    if (toolLabel) toolLabel.textContent = `${nice}`;
    toolOptions.forEach(opt => opt.classList.toggle("active", opt.getAttribute("data-tool") === tool));
    if (colorDropdown) colorDropdown.classList.toggle("disabled", tool === "eraser");
    if (tool === "eraser") closeColorMenu();
    if (tool === "eraser") closeToolMenu();
  }

  function setActiveColorUI(colorKey) {
    if (preview) preview.style.setProperty("--swatch-color", colorFromKey(colorKey));
    colorOptions.forEach(opt => opt.classList.toggle("active", opt.getAttribute("data-color") === colorKey));
  }

  const brush = document.getElementById("brushSize");
  brush.addEventListener("input", () => {
    const mp = getActiveMap();
    state.map.ui.brushSize = Number(brush.value);
    mp.brushSize = state.map.ui.brushSize;
    SaveManager.markDirty();
  });

  // Tool button is auto-wired by popovers manager (if present).

  toolOptions.forEach(opt => {
    opt.addEventListener("click", () => {
      const tool = opt.getAttribute("data-tool") || "brush";
      state.map.ui.activeTool = tool;
      setActiveToolUI(tool);
      if (tool === "brush") setActiveColorUI(getActiveMap().colorKey);
      applyMapInteractionMode();
      SaveManager.markDirty(); closeToolMenu();
    });
  });

  colorBtn?.addEventListener("click", (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (state.map.ui.activeTool === "eraser") return;
    if (colorPopover) colorPopover.toggle();
    else {
      // fallback: old behavior
      if (!colorMenu || !colorBtn) return;
      if (colorMenu.hidden) {
        colorMenu.hidden = false;
        colorMenu.removeAttribute("hidden");
        colorBtn.setAttribute("aria-expanded", "true");
        positionMenuOnScreen(colorMenu, colorBtn, { preferRight: false });
      } else {
        closeColorMenu();
      }
    }
  });

  colorMenu?.addEventListener("click", (e) => { e.stopPropagation(); });

  // Outside click close is handled by popovers manager (if present).

  colorOptions.forEach(btn => {
    btn.addEventListener("click", () => {
      if (state.map.ui.activeTool === "eraser") return;
      const colorKey = btn.dataset.color || "grey";
      const mp = getActiveMap();
      mp.colorKey = colorKey;
      setActiveColorUI(colorKey);
      closeColorMenu();
      SaveManager.markDirty();
    });
  });

  applyMapInteractionMode();

  document.getElementById("undoBtn").addEventListener("click", undo);
  document.getElementById("redoBtn").addEventListener("click", redo);
  document.getElementById("clearMapBtn").addEventListener("click", async () => { await clearDrawing(); });

  return { applyMapInteractionMode, setActiveToolUI, setActiveColorUI };
}
