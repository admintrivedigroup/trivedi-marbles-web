// Pure HTML builders for task emails — no I/O, so they're unit-testable.
// Styling mirrors the visualizer enquiry email (send-visualizer-enquiry.ts).

export type DigestSection = "overdue" | "due_day" | "day_before";

export type DigestTask = {
  id: string;
  title: string;
  dueDate: string;
  section: DigestSection;
};

const SECTION_HEADINGS: Record<DigestSection, string> = {
  overdue: "Overdue",
  due_day: "Due today",
  day_before: "Due tomorrow",
};

const SECTION_ORDER: DigestSection[] = ["overdue", "due_day", "day_before"];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** due_date is stored as entered (datetime-local, no offset), so format the
 * literal parts rather than round-tripping through Date and a timezone. */
export function formatDueDate(raw: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})(?:[T ](\d{2}):(\d{2}))?/.exec(raw);
  if (!match) return raw;
  const [, y, m, d, hh, mm] = match;
  const date = `${Number(d)} ${MONTHS[Number(m) - 1]} ${y}`;
  if (hh === undefined || (hh === "00" && mm === "00")) return date;
  const hour = Number(hh);
  const suffix = hour >= 12 ? "PM" : "AM";
  return `${date}, ${hour % 12 || 12}:${mm} ${suffix}`;
}

function layout(heading: string, intro: string, body: string, cta: { label: string; href: string }): string {
  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${heading}</title></head>
<body style="margin:0;padding:0;background:#f4f0ea;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ea;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#17130f;padding:32px 40px 28px;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c8a96a;">Trivedi Grani Marmo</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:24px;font-weight:400;color:#ffffff;letter-spacing:1px;">${heading}</h1>
        </td></tr>
        <tr><td style="height:3px;background:#c8a96a;"></td></tr>
        <tr><td style="background:#ffffff;padding:32px 40px;">
          <p style="margin:0 0 24px;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;">${intro}</p>
          ${body}
          <table cellpadding="0" cellspacing="0" style="margin-top:28px;"><tr><td style="background:#17130f;">
            <a href="${cta.href}" style="display:inline-block;padding:12px 24px;font-family:Arial,sans-serif;font-size:13px;letter-spacing:1px;color:#ffffff;text-decoration:none;">${cta.label}</a>
          </td></tr></table>
        </td></tr>
        <tr><td style="background:#17130f;padding:20px 40px;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#8a7f70;line-height:1.7;">
            You're receiving this because task emails are on for your inventory account. Turn them off in Settings → Notifications.
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function taskRow(title: string, meta: string, href: string, last: boolean): string {
  return `<tr><td style="padding:14px 20px;${last ? "" : "border-bottom:1px solid #e7dccd;"}">
    <a href="${href}" style="font-family:Georgia,serif;font-size:16px;color:#000000;text-decoration:none;">${escapeHtml(title)}</a>
    <p style="margin:4px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#6b6155;">${meta}</p>
  </td></tr>`;
}

function card(rows: string): string {
  return `<table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e7dccd;">${rows}</table>`;
}

export function buildTaskAssignedEmail(params: {
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string | null;
  assignedByName: string | null;
  taskUrl: string;
}): { subject: string; html: string } {
  const meta = [
    params.dueDate ? `Due ${formatDueDate(params.dueDate)}` : "No due date",
    params.priority ? `${params.priority[0].toUpperCase()}${params.priority.slice(1)} priority` : null,
  ]
    .filter(Boolean)
    .join(" · ");
  const description = params.description
    ? `<p style="margin:20px 0 0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.7;white-space:pre-wrap;">${escapeHtml(params.description)}</p>`
    : "";
  const by = params.assignedByName ? ` by ${escapeHtml(params.assignedByName)}` : "";

  return {
    subject: `New task: ${params.title}`,
    html: layout(
      "New task assigned",
      `You've been assigned a task${by}.`,
      card(taskRow(params.title, meta, params.taskUrl, true)) + description,
      { label: "Open task", href: params.taskUrl },
    ),
  };
}

export function buildTaskCompletedEmail(params: {
  title: string;
  completedByName: string | null;
  taskUrl: string;
}): { subject: string; html: string } {
  const who = params.completedByName ? escapeHtml(params.completedByName) : "Someone";
  return {
    subject: `Task completed: ${params.title}`,
    html: layout(
      "Task completed",
      `${who} marked a task you created as completed.`,
      card(taskRow(params.title, "Completed", params.taskUrl, true)),
      { label: "Open task", href: params.taskUrl },
    ),
  };
}

export function buildTaskDigestEmail(params: {
  recipientName: string | null;
  tasks: DigestTask[];
  taskUrl: (id: string) => string;
  tasksUrl: string;
}): { subject: string; html: string } {
  const counts = SECTION_ORDER.map((s) => [s, params.tasks.filter((t) => t.section === s).length] as const);
  const summary = counts
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${SECTION_HEADINGS[s].toLowerCase()}`)
    .join(", ");

  const sections = SECTION_ORDER.map((section) => {
    const tasks = params.tasks.filter((t) => t.section === section);
    if (tasks.length === 0) return "";
    const color = section === "overdue" ? "#b42318" : "#c8a96a";
    const rows = tasks
      .map((t, i) => taskRow(t.title, `Due ${formatDueDate(t.dueDate)}`, params.taskUrl(t.id), i === tasks.length - 1))
      .join("");
    return `<p style="margin:24px 0 10px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:${color};">${SECTION_HEADINGS[section]} (${tasks.length})</p>${card(rows)}`;
  }).join("");

  const greeting = params.recipientName ? `Hi ${escapeHtml(params.recipientName)}, here` : "Here";
  const single = params.tasks.length === 1 ? params.tasks[0] : null;

  return {
    subject: single
      ? `${SECTION_HEADINGS[single.section]}: ${single.title}`
      : `Task reminder: ${summary}`,
    html: layout(
      "Task reminders",
      `${greeting}'s what needs your attention today.`,
      sections,
      { label: "View all tasks", href: params.tasksUrl },
    ),
  };
}
