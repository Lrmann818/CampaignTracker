let bannerEl = null;
let refreshBtnEl = null;
let laterBtnEl = null;
let isVisible = false;

function ensureBanner() {
  if (bannerEl) return;

  bannerEl = document.createElement("div");
  bannerEl.className = "saveBanner";
  bannerEl.setAttribute("role", "alert");
  bannerEl.setAttribute("aria-live", "assertive");
  bannerEl.hidden = true;

  const textEl = document.createElement("span");
  textEl.textContent = "Unable to save your progress — your device storage is full. Export a backup to avoid losing your data.";

  const actionsEl = document.createElement("div");
  actionsEl.className = "saveBanner__actions";

  refreshBtnEl = document.createElement("button");
  refreshBtnEl.type = "button";
  refreshBtnEl.className = "saveBanner__btn saveBanner__btn--primary";
  refreshBtnEl.textContent = "Export Backup";

  laterBtnEl = document.createElement("button");
  laterBtnEl.type = "button";
  laterBtnEl.className = "saveBanner__btn";
  laterBtnEl.textContent = "Later";

  actionsEl.append(refreshBtnEl, laterBtnEl);
  bannerEl.append(textEl, actionsEl);
  document.body.appendChild(bannerEl);
}

export function showSaveBanner({ onExport, onDismiss } = {}) {
  if (isVisible) return;
  isVisible = true;

  ensureBanner();
  if (!bannerEl || !refreshBtnEl || !laterBtnEl) return;

  refreshBtnEl.onclick = async () => {
    hideSaveBanner();
    if (typeof onExport === "function") {
      await onExport();
    }
  };

  laterBtnEl.onclick = () => {
    hideSaveBanner();
    if (typeof onDismiss === "function") {
      onDismiss();
    }
  };

  bannerEl.hidden = false;
  bannerEl.classList.remove("isHidden");
  bannerEl.style.display = "";
}

export function hideSaveBanner() {
  isVisible = false;
  if (!bannerEl) return;
  bannerEl.hidden = true;
  bannerEl.classList.add("isHidden");
  bannerEl.style.display = "none";
}