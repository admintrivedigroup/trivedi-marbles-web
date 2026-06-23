import { notFound } from "next/navigation";
import { TaskDetail } from "@/app/inventory/_components/task-detail";
import { getTaskWithChecklist } from "@/app/inventory/_lib/tasks";
import { getAllManagedUsers, getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";

type Props = {
  params: Promise<{ id: string }>;
};

export async function generateMetadata({ params }: Props) {
  const { id } = await params;
  const task = await getTaskWithChecklist(id);
  return { title: task ? `${task.title} | Tasks` : "Task Not Found" };
}

export default async function TaskDetailPage({ params }: Props) {
  const { id } = await params;

  const [task, users, profile] = await Promise.all([
    getTaskWithChecklist(id),
    getAllManagedUsers(),
    getCurrentUserProfile(),
  ]);

  if (!task) notFound();

  const assignableUsers = users.map((u) => ({
    userId: u.userId,
    displayName: u.displayName,
    email: u.email,
  }));

  return (
    <TaskDetail
      task={task}
      users={assignableUsers}
      currentUserId={profile?.userId ?? ""}
      currentUserRole={profile?.role ?? "staff"}
    />
  );
}
