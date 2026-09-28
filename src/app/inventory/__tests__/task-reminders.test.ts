import { beforeEach, describe, expect, it, vi } from "vitest";

type SentEmail = { to: string; subject: string; html: string };
const sendAppEmail = vi.fn<(message: SentEmail) => Promise<boolean>>(async () => true);

vi.mock("@/app/inventory/_lib/email", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/app/inventory/_lib/email")>()),
  sendAppEmail: (message: SentEmail) => sendAppEmail(message),
}));

import { checkTaskDueReminders } from "@/app/inventory/_lib/task-reminders";
import { createFakeDb } from "./helpers/fake-db";

// 08:30 IST on 28 Sep 2026 — the cron's real run time.
const NOW = new Date("2026-09-28T03:00:00Z");

const EMAILS: Record<string, string> = { alice: "alice@example.com", bob: "bob@example.com" };

function task(id: string, due: string, extra: Record<string, unknown> = {}) {
  return { id, title: `Task ${id}`, assigned_to: "alice", due_date: due, status: "pending", ...extra };
}

function setup(tasks: Record<string, unknown>[], log: Record<string, unknown>[] = []) {
  const db = createFakeDb({
    tasks,
    task_reminder_log: log,
    notifications: [],
    user_profiles: [
      { user_id: "alice", display_name: "Alice", task_emails_enabled: true },
      { user_id: "bob", display_name: "Bob", task_emails_enabled: false },
    ],
  });
  const client = {
    ...db.client,
    auth: {
      admin: {
        getUserById: async (id: string) => ({ data: { user: EMAILS[id] ? { id, email: EMAILS[id] } : null } }),
      },
    },
  };
  return { db, run: () => checkTaskDueReminders(client as never, NOW) };
}

beforeEach(() => sendAppEmail.mockClear());

describe("checkTaskDueReminders", () => {
  it("sends one bell per milestone and one digest email per assignee", async () => {
    const { db, run } = setup([
      task("over", "2026-09-26T10:00"),
      task("today", "2026-09-28T17:00"),
      task("tomorrow", "2026-09-29T09:00"),
    ]);

    const result = await run();

    expect(result).toEqual({ sent: 3, checked: 3, emailed: 1 });
    expect(db.tables.notifications.map((n) => [n.type, n.title])).toEqual([
      ["task_overdue", '"Task over" is overdue'],
      ["task_due_reminder", '"Task today" is due today'],
      ["task_due_reminder", '"Task tomorrow" is due tomorrow'],
    ]);
    expect(sendAppEmail).toHaveBeenCalledTimes(1);
    const email = sendAppEmail.mock.calls[0][0];
    expect(email.to).toBe("alice@example.com");
    expect(email.subject).toBe("Task reminder: 1 overdue, 1 due today, 1 due tomorrow");
    expect(email.html).toContain("Dear Alice,");
    expect(email.html).toContain("26 Sep 2026, 10:00 AM");
  });

  it("is a no-op when re-run the same day", async () => {
    const { db, run } = setup([task("today", "2026-09-28T17:00")]);
    await run();
    const second = await run();

    expect(second).toEqual({ sent: 0, checked: 1, emailed: 0 });
    expect(db.tables.notifications).toHaveLength(1);
    expect(sendAppEmail).toHaveBeenCalledTimes(1);
  });

  it("skips completed, draft, unassigned, long-overdue and later tasks", async () => {
    const { db, run } = setup([
      task("done", "2026-09-28T10:00", { status: "completed" }),
      task("draft", "2026-09-28T10:00", { status: "draft" }),
      task("nobody", "2026-09-28T10:00", { assigned_to: null }),
      task("ancient", "2026-08-01T10:00"),
      task("later", "2026-09-30T10:00"),
    ]);

    const result = await run();

    expect(result).toEqual({ sent: 0, checked: 0, emailed: 0 });
    expect(db.tables.notifications).toHaveLength(0);
    expect(sendAppEmail).not.toHaveBeenCalled();
  });

  it("still rings the bell but doesn't email someone who turned task emails off", async () => {
    const { db, run } = setup([task("b1", "2026-09-28T10:00", { assigned_to: "bob" })]);

    const result = await run();

    expect(result).toEqual({ sent: 1, checked: 1, emailed: 0 });
    expect(db.tables.notifications[0]).toMatchObject({ user_id: "bob", type: "task_due_reminder" });
    expect(sendAppEmail).not.toHaveBeenCalled();
  });

  it("uses the task title as the subject when there's only one", async () => {
    const { run } = setup([task("solo", "2026-09-27T10:00")]);
    await run();

    expect(sendAppEmail.mock.calls[0][0].subject).toBe("Overdue: Task solo");
  });
});
