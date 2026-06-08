import { ClipboardList } from "lucide-react";

import { getAuditLogs } from "@/app/inventory/_lib/audit-log";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { AuditLog } from "@/app/inventory/_components/audit-log";

type AuditPageProps = {
  searchParams: Promise<{ page?: string; from?: string; to?: string }>;
};

export default async function AuditPage({ searchParams }: AuditPageProps) {
  const profile = await getCurrentUserProfile();

  if (!profile || (profile.role !== "admin" && profile.role !== "superadmin")) {
    return (
      <div className="px-4 py-8 md:px-8">
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          You do not have permission to view the audit log.
        </div>
      </div>
    );
  }

  const { page: pageParam, from: dateFrom, to: dateTo } = await searchParams;
  const page = Math.max(0, parseInt(pageParam ?? "0", 10) || 0);

  const { entries, total, error } = await getAuditLogs(page, { dateFrom, dateTo });

  return (
    <div className="px-4 py-6 md:px-8">
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100">
          <ClipboardList className="h-4 w-4 text-gray-600" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-gray-900">Audit Log</h1>
          <p className="text-xs text-gray-500">
            All significant actions taken by users
          </p>
        </div>
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : (
        <AuditLog entries={entries} total={total} page={page} dateFrom={dateFrom} dateTo={dateTo} />
      )}
    </div>
  );
}
