import { describe, expect, it } from "vitest";

import {
  buildTaskAssignedEmail,
  buildTaskDigestEmail,
  formatDueDate,
} from "@/app/inventory/_lib/task-email-templates";

describe("formatDueDate", () => {
  it("formats the stored local date/time without shifting timezones", () => {
    expect(formatDueDate("2026-09-28T17:05")).toBe("28 Sep 2026, 5:05 PM");
    expect(formatDueDate("2026-01-03T00:30")).toBe("3 Jan 2026, 12:30 AM");
  });

  it("drops a midnight or missing time", () => {
    expect(formatDueDate("2026-09-28T00:00")).toBe("28 Sep 2026");
    expect(formatDueDate("2026-09-28")).toBe("28 Sep 2026");
  });
});

describe("task emails", () => {
  it("escapes user-entered text in the HTML", () => {
    const { subject, html } = buildTaskAssignedEmail({
      title: "Polish <b>slab</b> & ship",
      description: '<script>alert("x")</script>',
      dueDate: null,
      priority: "high",
      assignedByName: "Ravi",
      taskUrl: "https://example.com/inventory/tasks/1",
    });

    expect(subject).toBe("New task: Polish <b>slab</b> & ship");
    expect(html).toContain("Polish &lt;b&gt;slab&lt;/b&gt; &amp; ship");
    expect(html).not.toContain("<script>");
    expect(html).toContain("No due date · High priority");
    expect(html).toContain("assigned a task by Ravi");
  });

  it("orders digest sections overdue → today → tomorrow", () => {
    const { html } = buildTaskDigestEmail({
      recipientName: null,
      tasks: [
        { id: "a", title: "Tomorrow task", dueDate: "2026-09-29", section: "day_before" },
        { id: "b", title: "Late task", dueDate: "2026-09-26", section: "overdue" },
      ],
      taskUrl: (id) => `/t/${id}`,
      tasksUrl: "/t",
    });

    expect(html.indexOf("Overdue (1)")).toBeLessThan(html.indexOf("Due tomorrow (1)"));
    expect(html).not.toContain("Due today (");
  });
});
