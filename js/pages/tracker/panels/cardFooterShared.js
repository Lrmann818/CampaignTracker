export function createDeleteButton({ onDelete, className, text = "Delete", title }) {
  const button = document.createElement("button");
  button.type = "button";
  button.className = className;
  button.textContent = text;
  if (title) button.title = title;
  button.addEventListener("click", () => onDelete());
  return button;
}
