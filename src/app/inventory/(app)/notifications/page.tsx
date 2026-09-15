import { Bell } from "lucide-react";

import { getMyNotificationsPage } from "@/app/inventory/_actions/notifications";
import { NotificationsList } from "@/app/inventory/_components/notifications-list";

type NotificationsPageProps = {
  searchParams: Promise<{ page?: string }>;
};

export default async function NotificationsPage({ searchParams }: NotificationsPageProps) {
  const { page: pageParam } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? "0", 10) || 0);

  const { items, total, pageSize } = await getMyNotificationsPage(page);

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
          <Bell className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Notifications</h1>
          <p className="text-xs text-gray-500">Your full notification history</p>
        </div>
      </div>

      <NotificationsList
        items={items}
        total={total}
        page={page}
        pageSize={pageSize}
      />
    </div>
  );
}
