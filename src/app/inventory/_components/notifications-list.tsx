"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronLeft, ChevronRight, ChevronRight as ItemChevron } from "lucide-react";

import {
  markAllNotificationsRead,
  markNotificationRead,
  type NotificationItem,
} from "@/app/inventory/_actions/notifications";
import { formatDateTime } from "@/app/inventory/_lib/format";
import { cn } from "@/lib/utils";

type NotificationsListProps = {
  items: NotificationItem[];
  total: number;
  page: number;
  pageSize: number;
};

const TYPE_LABEL: Record<string, { label: string; className: string }> = {
  low_stock: { label: "Low stock", className: "bg-orange-100 text-orange-700" },
  stock_movement: { label: "Stock movement", className: "bg-blue-100 text-blue-700" },
  reservation_reminder: { label: "Reservation", className: "bg-purple-100 text-purple-700" },
};

export function NotificationsList({ items: initialItems, total, page, pageSize }: NotificationsListProps) {
  const router = useRouter();
  const [items, setItems] = useState(initialItems);
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const hasUnread = items.some((item) => !item.readAt);

  function goToPage(p: number) {
    router.push(`?page=${p}`);
  }

  function handleItemClick(item: NotificationItem) {
    if (!item.readAt) {
      setItems((current) =>
        current.map((n) => (n.id === item.id ? { ...n, readAt: new Date().toISOString() } : n)),
      );
      void markNotificationRead(item.id);
    }
    if (item.link) router.push(item.link);
  }

  async function handleMarkAllRead() {
    const now = new Date().toISOString();
    setItems((current) => current.map((n) => ({ ...n, readAt: n.readAt ?? now })));
    await markAllNotificationsRead();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-gray-500">
          {total === 0 ? "No notifications yet." : `${total.toLocaleString()} notification${total === 1 ? "" : "s"} total`}
        </p>
        {hasUnread ? (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="text-xs font-medium text-gray-500 hover:text-gray-900"
          >
            Mark all read
          </button>
        ) : null}
      </div>

      {items.length === 0 ? (
        <div className="rounded-2xl border border-gray-100 bg-white py-16 text-center">
          <p className="text-sm text-gray-400">Nothing to show here yet.</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-2xl border border-gray-100 bg-white shadow-sm">
          {items.map((item) => {
            const typeMeta = TYPE_LABEL[item.type] ?? { label: item.type, className: "bg-gray-100 text-gray-600" };
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleItemClick(item)}
                className={cn(
                  "flex w-full items-start gap-3 border-b border-gray-100 px-4 py-4 text-left transition-colors last:border-b-0 hover:bg-gray-50",
                  !item.readAt && "bg-blue-50/50",
                )}
              >
                <span
                  className={cn("mt-1.5 h-2 w-2 shrink-0 rounded-full", !item.readAt ? "bg-blue-500" : "bg-transparent")}
                />
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="text-sm font-medium text-gray-900">{item.title}</p>
                    <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-semibold", typeMeta.className)}>
                      {typeMeta.label}
                    </span>
                  </div>
                  {item.body ? <p className="mt-0.5 text-xs text-gray-500">{item.body}</p> : null}
                  <p className="mt-1 text-[11px] text-gray-400">{formatDateTime(item.createdAt)}</p>
                </div>
                {item.link ? <ItemChevron className="mt-1 h-4 w-4 shrink-0 text-gray-300" /> : null}
              </button>
            );
          })}
        </div>
      )}

      {totalPages > 1 ? (
        <div className="flex items-center justify-center gap-2">
          <button
            type="button"
            onClick={() => goToPage(page - 1)}
            disabled={page === 0}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <span className="text-sm text-gray-600">{page + 1} / {totalPages}</span>
          <button
            type="button"
            onClick={() => goToPage(page + 1)}
            disabled={page >= totalPages - 1}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-gray-200 text-gray-500 transition-colors hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      ) : null}
    </div>
  );
}
