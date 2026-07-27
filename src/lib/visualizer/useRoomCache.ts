"use client";

import { useCallback, useRef, useState } from "react";
import type { RoomCache } from "./RoomCache";
import { roomCacheManager } from "./RoomCacheManager";
import { buildRoomCache, type BuildRoomCacheParams } from "./processingPipeline";

export type RoomCacheStatus = "idle" | "processing" | "ready";

/**
 * Thin React wrapper around RoomCacheManager for use inside VisualizerAI.
 * Owns the "which room is active + is it ready" state; the manager itself
 * stays a plain module-level store so it isn't tied to component lifecycle.
 *
 * Exposes both `roomCache` (state, for rendering a status badge) and
 * `roomCacheRef` (ref, read synchronously by render calls) — the same
 * ref-mirrors-state pattern already used throughout visualizer-ai.tsx
 * (objectBoxesR, depthValuesR, ...) to avoid stale closures in async
 * handlers that fire immediately after creating/invalidating a room.
 */
export function useRoomCache() {
  const [roomCache, setRoomCache] = useState<RoomCache | null>(null);
  const [status, setStatus]       = useState<RoomCacheStatus>("idle");
  const roomCacheRef = useRef<RoomCache | null>(null);

  const startProcessing = useCallback(() => {
    setStatus("processing");
  }, []);

  const createRoom = useCallback((params: BuildRoomCacheParams) => {
    const room = buildRoomCache(params);
    roomCacheRef.current = room;
    setRoomCache(room);
    setStatus("ready");
    return room;
  }, []);

  const invalidate = useCallback(() => {
    const current = roomCacheRef.current;
    if (current) roomCacheManager.removeRoom(current.roomId);
    roomCacheRef.current = null;
    setRoomCache(null);
    setStatus("idle");
  }, []);

  return { roomCache, roomCacheRef, status, startProcessing, createRoom, invalidate };
}
