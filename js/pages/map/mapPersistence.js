// js/pages/map/mapPersistence.js

export function persistDrawingSnapshot({
  drawLayer,
  getActiveMap,
  putBlob,
  deleteBlob,
  SaveManager
}) {
  return new Promise((resolve) => {
    const mp = getActiveMap();

    drawLayer.toBlob(async (blob) => {
      if (!blob) { resolve(); return; }

      if (mp.drawingBlobId) {
        try { await deleteBlob(mp.drawingBlobId); }
        catch (err) { console.warn("Failed to delete map drawing blob:", err); }
      }

      mp.drawingBlobId = await putBlob(blob);
      SaveManager.markDirty();
      resolve();
    }, "image/png");
  });
}

export async function loadMapBackgroundImage({ mp, blobIdToObjectUrl }) {
  if (!mp?.bgBlobId) return null;

  let url = null;
  try { url = await blobIdToObjectUrl(mp.bgBlobId); }
  catch (err) { console.warn("Failed to load map background blob:", err); }

  if (!url) return null;

  const img = new Image();
  await new Promise((res) => {
    img.onload = () => res();
    img.onerror = () => res();
    img.src = url;
  });
  return img;
}

export async function loadMapDrawingLayer({ mp, blobIdToObjectUrl, drawCtx, drawLayer }) {
  drawCtx.clearRect(0, 0, drawLayer.width, drawLayer.height);
  if (!mp?.drawingBlobId) return;

  let url = null;
  try { url = await blobIdToObjectUrl(mp.drawingBlobId); }
  catch (err) { console.warn("Failed to load map drawing blob:", err); }

  if (!url) return;

  const img = new Image();
  await new Promise((res) => {
    img.onload = () => { drawCtx.drawImage(img, 0, 0); res(); };
    img.onerror = () => res();
    img.src = url;
  });
}