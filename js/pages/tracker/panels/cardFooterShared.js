export function createDeleteButton({ onDelete, className, text = "Delete", title }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  if (title) button.title = title;
  button.addEventListener("click", () => onDelete());
  return button;
}

export function createSectionSelectRow({
  sections,
  value,
  onChange,
  enhanceSelectOnce,
  Popovers,
  enhanceSelectDropdown,
  buttonClass = "cardSelectBtn",
  optionClass = "swatchOption",
  groupLabelClass = "dropdownGroupLabel",
  preferRight = true,
} = {}) {
  const sectionWrap = document.createElement("div");
  sectionWrap.className = "row";
  sectionWrap.style.gap = "4px";

  const sectionLabel = document.createElement("div");
  sectionLabel.className = "mutedSmall";
  sectionLabel.textContent = "Section";

  const sectionSelect = document.createElement("select");
  sectionSelect.className = "cardSelect";
  sectionSelect.title = "Move to section";

  (sections || []).forEach(sec => {
    const opt = document.createElement("option");
    opt.value = sec.id;
    opt.textContent = sec.name || "Section";
    sectionSelect.appendChild(opt);
  });

  sectionSelect.value = value;
  sectionSelect.addEventListener("change", () => onChange(sectionSelect.value));

  sectionWrap.appendChild(sectionLabel);
  sectionWrap.appendChild(sectionSelect);

  enhanceSelectOnce({
    select: sectionSelect,
    Popovers,
    enhanceSelectDropdown,
    buttonClass,
    optionClass,
    groupLabelClass,
    preferRight
  });

  return { sectionWrap, sectionSelect };
}
