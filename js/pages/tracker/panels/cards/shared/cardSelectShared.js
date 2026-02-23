export function enhanceSelectOnce({
  select,
  Popovers,
  enhanceSelectDropdown,
  preferRight = true,
  buttonClass = "cardSelectBtn",
  optionClass = "swatchOption",
  groupLabelClass = "dropdownGroupLabel",
}) {
  if (!select) return;
  if (!Popovers) return;
  if (!enhanceSelectDropdown) return;
  if (select.dataset.dropdownEnhanced) return;

  enhanceSelectDropdown({
    select,
    Popovers,
    buttonClass,
    optionClass,
    groupLabelClass,
    preferRight
  });
}
