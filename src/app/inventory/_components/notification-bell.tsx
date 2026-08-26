"use client";

import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";

import {
  getMyNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/app/inventory/_actions/notifications";
import { formatRelativeTime } from "@/app/inventory/_lib/format";
import { cn } from "@/lib/utils";

export function NotificationBell({
  align = "right",
  tourId,
}: {
  align?: "left" | "right";
  tourId?: string;
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [items, setItems] = useState<NotificationItem[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  function refresh() {
    return getMyNotifications().then((res) => {
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setLoaded(true);
    });
  }

  useEffect(() => {
    getMyNotifications().then((res) => {
      setItems(res.items);
      setUnreadCount(res.unreadCount);
      setLoaded(true);
    });
    const interval = setInterval(refresh, 2 * 60_000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  function handleToggle() {
    const next = !isOpen;
    setIsOpen(next);
    if (next) void refresh();
  }

  async function handleItemClick(item: NotificationItem) {
    if (item.readAt) return;
    setItems((current) =>
      current.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
    );
    setUnreadCount((count) => Math.max(0, count - 1));
    await markNotificationRead(item.id);
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    setUnreadCount(0);
    await markAllNotificationsRead();
  }

  return (
    <div ref={containerRef} data-tour={tourId} className="relative">
      <button
        type="button"
        onClick={handleToggle}
        aria-label="Notifications"
        className="relative rounded-lg p-2 transition-colors hover:bg-muted"
      >
        <Bell className="h-5 w-5 text-muted-foreground" />
        {unreadCount > 0 ? (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-red-500 px-1 text-[10px] font-semibold text-white">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        ) : null}
      </button>

      {isOpen ? (
        <div
          className={cn(
            "absolute z-40 mt-2 w-80 max-w-[calc(100vw-2rem)] rounded-xl border border-border bg-card shadow-lg",
            align === "left" ? "left-0" : "right-0",
          )}
        >
          <div className="flex items-center justify-between border-b border-border px-4 py-3">
            <p className="text-sm font-semibold text-foreground">Notifications</p>
            {unreadCount > 0 ? (
              <button
                type="button"
                onClick={handleMarkAllRead}
                className="text-xs font-medium text-muted-foreground hover:text-foreground"
              >
                Mark all read
              </button>
            ) : null}
          </div>

          <div className="max-h-96 overflow-y-auto">
            {!loaded ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">Loading…</p>
            ) : items.length === 0 ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">No notifications yet.</p>
            ) : (
              items.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleItemClick(item)}
                  className={cn(
                    "block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 hover:bg-muted",
                    !item.readAt && "bg-blue-50/50 dark:bg-blue-950/20",
                  )}
                >
                  <div className="flex items-start gap-2">
                    <span
                      className={cn(
                        "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                        !item.readAt && "bg-blue-500",
                      )}
                    />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-foreground">{item.title}</p>
                      {item.body ? (
                        <p className="mt-0.5 text-xs text-muted-foreground">{item.body}</p>
                      ) : null}
                      <p className="mt-1 text-[11px] text-muted-foreground">
                        {formatRelativeTime(item.createdAt)}
                      </p>
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
