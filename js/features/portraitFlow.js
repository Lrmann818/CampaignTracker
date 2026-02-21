// Shared "pick → crop → store" helper for portrait-style images.
// Keeps app.js handlers tiny and consistent.

/**
import { uiAlert } from "../ui/dialogs.js";
 * Picks one image file, crops it via the shared crop modal, stores it in the blobs DB,
 * and (optionally) deletes a previous blob.
 *
 * @param {Object} opts
 * @param {Object} opts.picker - createFilePicker() instance (must expose pickOne()).
 * @param {string|null|undefined} opts.currentBlobId - existing blob id to delete when replacing.
 * @param {Function} opts.deleteBlob - async (blobId) => void
 * @param {Function} opts.putBlob - async (blob) => blobId
 * @param {Function} opts.cropImageModal - async (file, {aspect,outSize,mime,quality}) => Blob|null
 * @param {Function} opts.getPortraitAspect - (selector) => number
 * @param {string} opts.aspectSelector - DOM selector for the portrait box (for aspect).
 * @param {Function} opts.setStatus - (msg) => void
 * @param {number} [opts.outSize=512]
 * @param {string} [opts.mime="image/webp"]
 * @param {number} [opts.quality=0.9]
 * @param {Function} [opts.onError] - (err) => void
 * @returns {Promise<string|null>} new blob id, or null if cancelled/failed
 */
export async function pickCropStorePortrait(opts) {
  const {
    picker,
    currentBlobId,
    deleteBlob,
    putBlob,
    cropImageModal,
    getPortraitAspect,
    aspectSelector,
    setStatus,
    outSize = 512,
    mime = "image/webp",
    quality = 0.9,
    onError,
  } = opts || {};

  if (!picker?.pickOne) throw new Error("pickCropStorePortrait: missing picker.pickOne()");
  if (typeof deleteBlob !== "function") throw new Error("pickCropStorePortrait: missing deleteBlob");
  if (typeof putBlob !== "function") throw new Error("pickCropStorePortrait: missing putBlob");
  if (typeof cropImageModal !== "function") throw new Error("pickCropStorePortrait: missing cropImageModal");
  if (typeof getPortraitAspect !== "function") throw new Error("pickCropStorePortrait: missing getPortraitAspect");
  if (typeof aspectSelector !== "string" || !aspectSelector) throw new Error("pickCropStorePortrait: missing aspectSelector");
  if (typeof setStatus !== "function") throw new Error("pickCropStorePortrait: missing setStatus");

  const file = await picker.pickOne({ accept: "image/*" });
  if (!file) return null;

  try {
    setStatus("Saving image...");

    // If replacing an old image, delete it (best effort)
    if (currentBlobId) {
      try {
        await deleteBlob(currentBlobId);
      } catch (err) {
        console.warn("Failed to delete old image blob:", err);
      }
    }

    const aspect = getPortraitAspect(aspectSelector);
    const cropped = await cropImageModal(file, { aspect, outSize, mime, quality, setStatus });
    if (!cropped) return null; // user cancelled

    const blobId = await putBlob(cropped);
    return blobId;
  } catch (err) {
    console.error("Portrait pick/crop/store failed:", err);
    setStatus("Could not save image. Consider exporting a backup.");
    if (typeof onError === "function") onError(err);
    else {
      // Fallback: keep prior behavior (some flows relied on this alert)
      try {
        // eslint-disable-next-line no-alert
        await uiAlert("Could not save that image (storage may be full).", { title: "Save Failed" });
      } catch (_) {}
    }
    return null;
  }
}
