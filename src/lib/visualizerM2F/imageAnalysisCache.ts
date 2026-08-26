"use client";

// Persistent (IndexedDB) cache of Mask2Former + Depth Anything V2 results,
// keyed by a content hash of the uploaded room photo. When staff re-upload
// a photo they've already analyzed (same visit, or a later session/reload),
// the AI calls are skipped and the prior segmentation/depth results are
// reused directly. Geometry (quad/homography) is still recomputed locally
// per room — it's cheap and not an AI call, see RoomCache.ts.

import type { PipelineSegResult, PipelineDepthResult } from "./types";

const DB_NAME    = "visualizerM2FCache";
const DB_VERSION = 1;
const STORE      = "rooms";
const MAX_ENTRIES = 20; // evict oldest beyond this to bound IndexedDB usage

export type CachedAnalysis = {
  imageHash:   string;
  imgWidth:    number;
  imgHeight:   number;
  segResult:   PipelineSegResult;
  depthResult: PipelineDepthResult;
  createdAt:   number;
};

function openDb(): Promise<IDBDatabase | null> {
  if (typeof window === "undefined" || !window.indexedDB) return Promise.resolve(null);
  return new Promise((resolve) => {
    const req = window.indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE)) {
        db.createObjectStore(STORE, { keyPath: "imageHash" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror   = () => resolve(null);
  });
}

/** SHA-256 of the file's bytes — stable identity for "is this the same photo". */
export async function hashImageFile(file: File): Promise<string | null> {
  if (typeof window === "undefined" || !window.crypto?.subtle) return null;
  try {
    const buf    = await file.arrayBuffer();
    const digest = await window.crypto.subtle.digest("SHA-256", buf);
    return Array.from(new Uint8Array(digest))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");
  } catch {
    return null;
  }
}

export async function getCachedAnalysis(imageHash: string): Promise<CachedAnalysis | null> {
  const db = await openDb();
  if (!db) return null;
  return new Promise((resolve) => {
    const tx  = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).get(imageHash);
    req.onsuccess = () => resolve((req.result as CachedAnalysis) ?? null);
    req.onerror   = () => resolve(null);
  });
}

export async function saveCachedAnalysis(entry: CachedAnalysis): Promise<void> {
  const db = await openDb();
  if (!db) return;
  await new Promise<void>((resolve) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put(entry);
    tx.oncomplete = () => resolve();
    tx.onerror    = () => resolve();
  });
  void evictOldest(db);
}

async function evictOldest(db: IDBDatabase): Promise<void> {
  const tx    = db.transaction(STORE, "readwrite");
  const store = tx.objectStore(STORE);
  const all: CachedAnalysis[] = await new Promise((resolve) => {
    const req = store.getAll();
    req.onsuccess = () => resolve((req.result as CachedAnalysis[]) ?? []);
    req.onerror   = () => resolve([]);
  });
  if (all.length <= MAX_ENTRIES) return;
  all
    .sort((a, b) => a.createdAt - b.createdAt)
    .slice(0, all.length - MAX_ENTRIES)
    .forEach((entry) => store.delete(entry.imageHash));
}
