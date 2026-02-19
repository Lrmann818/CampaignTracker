// @ts-nocheck
// js/storage/blobs.js — image/blob storage helpers (IndexedDB)

import { openDb, BLOB_STORE } from "./idb.js";

let _blobUrlCache = new Map(); // blobId -> objectURL

export function newBlobId(prefix = "blob") {
  return `${prefix}_${Math.random().toString(36).slice(2)}_${Date.now().toString(36)}`;
}

export async function putBlob(blob, id = null) {
  const db = await openDb();
  const blobId = id || newBlobId();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).put({
      id: blobId,
      blob,
      type: blob.type || "application/octet-stream",
      updatedAt: Date.now()
    });
    tx.oncomplete = () => resolve(blobId);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getBlob(blobId) {
  if (!blobId) return null;
  const db = await openDb();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readonly");
    const req = tx.objectStore(BLOB_STORE).get(blobId);
    req.onsuccess = () => resolve(req.result?.blob || null);
    req.onerror = () => reject(req.error);
  });
}

export async function deleteBlob(blobId) {
  if (!blobId) return;
  const db = await openDb();

  // Revoke any cached objectURL
  const oldUrl = _blobUrlCache.get(blobId);
  if (oldUrl) {
    URL.revokeObjectURL(oldUrl);
    _blobUrlCache.delete(blobId);
  }

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).delete(blobId);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function blobIdToObjectUrl(blobId) {
  if (!blobId) return null;
  if (_blobUrlCache.has(blobId)) return _blobUrlCache.get(blobId);

  try {
    const blob = await getBlob(blobId);
    if (!blob) return null;

    const url = URL.createObjectURL(blob);
    _blobUrlCache.set(blobId, url);
    return url;
  } catch (err) {
    console.warn("blobIdToObjectUrl failed:", blobId, err);
    return null;
  }
}

export function dataUrlToBlob(dataUrl) {
  const [meta, base64] = dataUrl.split(",");
  const mime = (meta.match(/data:(.*?);base64/) || [])[1] || "application/octet-stream";
  const bin = atob(base64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export function blobToDataUrl(blob) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });
}

export async function clearAllBlobs() {
  const db = await openDb();
  // Revoke cached URLs
  for (const url of _blobUrlCache.values()) URL.revokeObjectURL(url);
  _blobUrlCache.clear();

  return new Promise((resolve, reject) => {
    const tx = db.transaction(BLOB_STORE, "readwrite");
    tx.objectStore(BLOB_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}
