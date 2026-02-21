export function renderCardPortrait({
  blobId,
  altText,
  title = "Click to set/replace image",
  placeholderText = "Click to add image",
  blobIdToObjectUrl,
  onPick,
} = {}) {
  const portrait = document.createElement("div");
  portrait.className = "npcPortraitTop";
  portrait.title = title;

  if (blobId) {
    const img = document.createElement("img");
    img.alt = altText;
    portrait.appendChild(img);

    blobIdToObjectUrl(blobId).then(url => {
      if (url) img.src = url;
    });
  } else {
    const placeholder = document.createElement("div");
    placeholder.className = "mutedSmall";
    placeholder.textContent = placeholderText;
    portrait.appendChild(placeholder);
  }

  portrait.addEventListener("click", () => onPick());
  return portrait;
}
