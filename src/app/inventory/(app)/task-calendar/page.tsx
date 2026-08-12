import { redirect } from "next/navigation";
import { TasksCalendar } from "@/app/inventory/_components/tasks-calendar";
import { getTasks } from "@/app/inventory/_lib/tasks";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export const metadata = {
  title: { absolute: "Task Calendar | Trivedi Marbles" },
};

export default async function TasksCalendarPage() {
  const profile = await getCurrentUserProfile();
  if (!profile) redirect("/inventory/login");

  const isAdmin = profile.role === "admin" || profile.role === "superadmin";
  const tasks = await getTasks(isAdmin ? undefined : { userId: profile.userId });

  return <TasksCalendar initialTasks={tasks} />;
}
