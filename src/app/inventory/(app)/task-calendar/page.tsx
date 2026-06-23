import { TasksCalendar } from "@/app/inventory/_components/tasks-calendar";
import { getTasks } from "@/app/inventory/_lib/tasks";

export const metadata = {
  title: "Task Calendar | Trivedi Marbles",
};

export default async function TasksCalendarPage() {
  const tasks = await getTasks();

  return <TasksCalendar initialTasks={tasks} />;
}
