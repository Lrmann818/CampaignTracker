// @ts-nocheck
// js/storage/texts-idb.js — large text storage helpers (IndexedDB)

import { openDb, TEXT_STORE } from "./idb.js";

export function textKey_spellNotes(spellId) {
  return `spell_notes_${spellId}`;
}

export async function putText(text, id) {
  const db = await openDb();
  const textId = id;
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).put({ id: textId, text: String(text ?? ""), updatedAt: Date.now() });
    tx.oncomplete = () => resolve(textId);
    tx.onerror = () => reject(tx.error);
  });
}

export async function getText(id) {
  if (!id) return "";
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readonly");
    const req = tx.objectStore(TEXT_STORE).get(id);
    req.onsuccess = () => resolve(req.result?.text ?? "");
    req.onerror = () => reject(req.error);
  });
}

export async function deleteText(id) {
  if (!id) return;
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).delete(id);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function clearAllTexts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, "readwrite");
    tx.objectStore(TEXT_STORE).clear();
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

export async function getAllTexts() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(TEXT_STORE, 'readonly');
    const req = tx.objectStore(TEXT_STORE).getAll();
    req.onsuccess = () => {
      const out = {};
      for (const row of (req.result || [])) out[row.id] = row.text ?? '';
      resolve(out);
    };
    req.onerror = () => reject(req.error);
  });
}
