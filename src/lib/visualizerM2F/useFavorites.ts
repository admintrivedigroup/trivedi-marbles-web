"use client";

import { useCallback, useState } from "react";

// Session-only favorites — sessionStorage, not a database table. Staff can
// star renders/slabs while working a showroom visit; the list clears when
// the tab closes. No cross-device or cross-session persistence by design.
const STORAGE_KEY = "visualizer-favorites";

function readStored(): Set<string> {
  if (typeof window === "undefined") return new Set();
  try {
    const raw = window.sessionStorage.getItem(STORAGE_KEY);
    return raw ? new Set(JSON.parse(raw) as string[]) : new Set();
  } catch {
    return new Set();
  }
}

export function useFavorites() {
  const [ids, setIds] = useState<Set<string>>(() => readStored());

  const toggle = useCallback((id: string) => {
    setIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      try {
        window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify([...next]));
      } catch {
        // sessionStorage unavailable (private mode, quota) — favorites stay in-memory only
      }
      return next;
    });
  }, []);

  const isFavorite = useCallback((id: string) => ids.has(id), [ids]);

  return { isFavorite, toggle, favoriteIds: ids };
}
