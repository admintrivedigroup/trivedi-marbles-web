import { redirect } from "next/navigation";
import { KraManager } from "@/app/inventory/_components/kra-manager";
import { getKraColumns, getKraEntries, getFinancialYears } from "@/app/inventory/_lib/kra";
import { getAllManagedUsers, getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export const metadata = {
  title: "KRA / KPI | Trivedi Marbles",
};

type KraPageProps = {
  searchParams: Promise<{ employee?: string; year?: string }>;
};

export default async function KraPage({ searchParams }: KraPageProps) {
  const [profile, users] = await Promise.all([
    getCurrentUserProfile(),
    getAllManagedUsers(),
  ]);

  if (!profile) redirect("/inventory/login");

  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  const years = getFinancialYears();

  const { employee, year } = await searchParams;

  const defaultEmployee = isAdmin
    ? (users[0]?.userId ?? profile.userId)
    : profile.userId;

  const selectedEmployeeId = (isAdmin ? employee : profile.userId) ?? defaultEmployee;
  const selectedYear = year && years.includes(year) ? year : years[1];

  const assignableUsers = users.map((u) => ({
    userId: u.userId,
    email: u.email,
    displayName: u.displayName,
  }));

  const [columns, entries] = await Promise.all([
    getKraColumns(selectedEmployeeId),
    getKraEntries(selectedEmployeeId, selectedYear),
  ]);

  return (
    <KraManager
      key={`${selectedEmployeeId}-${selectedYear}`}
      columns={columns}
      entries={entries}
      users={isAdmin ? assignableUsers : assignableUsers.filter((u) => u.userId === profile.userId)}
      isAdmin={isAdmin}
      selectedEmployeeId={selectedEmployeeId}
      selectedYear={selectedYear}
      financialYears={years}
    />
  );
}
