import { TasksManager } from "@/app/inventory/_components/tasks-manager";
import { getTasks } from "@/app/inventory/_lib/tasks";
import { getAllManagedUsers, getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

export const metadata = {
  title: "Tasks | Trivedi Marbles",
};

export default async function TasksPage() {
  const [tasks, users, profile] = await Promise.all([
    getTasks(),
    getAllManagedUsers(),
    getCurrentUserProfile(),
  ]);

  const assignableUsers = users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    email: u.email,
  }));

  return (
    <TasksManager
      initialTasks={tasks}
      users={assignableUsers}
      currentUserId={profile?.userId ?? ""}
      currentUserRole={profile?.role ?? "staff"}
    />
  );
}
