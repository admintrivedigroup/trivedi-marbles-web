/**
 * In-memory RoomCache store for the Mask2Former-based production visualizer.
 *
 * A module-level singleton is sufficient today (single-tab showroom tool,
 * one active session at a time).
 */

import type { RoomCache } from "./RoomCache";

class RoomCacheManager {
  private rooms = new Map<string, RoomCache>();

  generateRoomId(): string {
    return `roomM2F_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
  }

  saveRoom(room: RoomCache): void {
    this.rooms.set(room.roomId, room);
  }

  getRoom(roomId: string): RoomCache | undefined {
    return this.rooms.get(roomId);
  }

  hasRoom(roomId: string): boolean {
    return this.rooms.has(roomId);
  }

  removeRoom(roomId: string): void {
    this.rooms.delete(roomId);
  }

  /** Attach a lazily-computed FloorGeometry to an existing room. */
  updateGeometry(roomId: string, geometry: RoomCache["geometry"]): void {
    const room = this.rooms.get(roomId);
    if (!room) return;
    room.geometry = geometry;
  }
}

export const roomCacheManagerM2F = new RoomCacheManager();
