// Pure HTML builders for task emails — no I/O, so they're unit-testable.
// Palette matches the site's other emails (send-visualizer-enquiry.ts):
// espresso #17130f, gold #c8a96a, parchment #f4f0ea.

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

const C = {
  ink: "#17130f",
  gold: "#c8a96a",
  goldDeep: "#9c7c42",
  page: "#f4f0ea",
  card: "#ffffff",
  panel: "#faf8f5",
  rule: "#e7dccd",
  text: "#2b2520",
  muted: "#7a6f62",
  danger: "#b42318",
};

const SANS = "'Helvetica Neue',Helvetica,Arial,sans-serif";
const SERIF = "Georgia,'Times New Roman',serif";

const PRIORITY_STYLE: Record<string, { fg: string; bg: string }> = {
  high: { fg: "#b42318", bg: "#fbeceb" },
  medium: { fg: "#8a6a32", bg: "#f6efe2" },
  low: { fg: "#3f6147", bg: "#edf3ee" },
};

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

function capitalize(value: string): string {
  return value ? `${value[0].toUpperCase()}${value.slice(1)}` : value;
}

// ─── Building blocks ──────────────────────────────────────────────────────────

function layout(params: {
  title: string;
  preheader: string;
  eyebrow: string;
  heading: string;
  body: string;
  settingsUrl: string;
}): string {
  return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="x-apple-disable-message-reformatting">
<title>${escapeHtml(params.title)}</title>
<style>
  @media only screen and (max-width:620px) {
    .px { padding-left:24px !important; padding-right:24px !important; }
    .label-col { width:100px !important; }
    .wordmark { font-size:15px !important; letter-spacing:3px !important; }
    .hide-sm { display:none !important; }
    .stack { display:block !important; width:auto !important; text-align:left !important; }
    .due-cell { padding:0 0 14px !important; border-top:0 !important; white-space:normal !important; }
    .stat-num { font-size:24px !important; }
    .stat-label { font-size:9px !important; letter-spacing:1px !important; }
  }
</style>
</head>
<body style="margin:0;padding:0;background:${C.page};-webkit-text-size-adjust:100%;">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent;">${escapeHtml(params.preheader)}</div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${C.page};">
    <tr><td align="center" style="padding:40px 12px;">
      <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <tr><td class="px" style="background:${C.ink};padding:28px 48px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr>
            <td class="wordmark" style="font-family:${SERIF};font-size:20px;letter-spacing:5px;color:#ffffff;text-transform:uppercase;">Trivedi<span style="color:${C.gold};"> Grani Marmo</span></td>
            <td class="hide-sm" align="right" style="font-family:${SANS};font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#a39684;">Inventory</td>
          </tr></table>
        </td></tr>
        <tr><td style="height:2px;line-height:2px;font-size:0;background:${C.gold};">&nbsp;</td></tr>

        <tr><td class="px" style="background:${C.card};padding:44px 48px 40px;border-left:1px solid ${C.rule};border-right:1px solid ${C.rule};">
          <p style="margin:0 0 10px;font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:3px;text-transform:uppercase;color:${C.goldDeep};">${params.eyebrow}</p>
          <h1 style="margin:0 0 28px;font-family:${SERIF};font-size:26px;line-height:1.3;font-weight:400;color:${C.ink};">${params.heading}</h1>
          ${params.body}
          <p style="margin:36px 0 0;font-family:${SANS};font-size:14px;line-height:1.7;color:${C.text};">Regards,<br><span style="font-family:${SERIF};font-size:16px;color:${C.ink};">Trivedi Grani Marmo</span></p>
        </td></tr>

        <tr><td class="px" style="background:${C.panel};padding:20px 48px;border:1px solid ${C.rule};border-top:0;">
          <p style="margin:0;font-family:${SANS};font-size:12px;line-height:1.7;color:${C.muted};">This is an automated message from the Trivedi Grani Marmo inventory system. Please do not reply to this email.</p>
        </td></tr>

        <tr><td align="center" style="padding:24px 24px 0;">
          <p style="margin:0 0 6px;font-family:${SANS};font-size:11px;line-height:1.7;color:${C.muted};">Trivedi Grani Marmo · S.No. 698/4, Ognaj, Ahmedabad 380060, Gujarat, India</p>
          <p style="margin:0;font-family:${SANS};font-size:11px;line-height:1.7;color:${C.muted};">You're receiving this because task emails are enabled for your account. <a href="${params.settingsUrl}" style="color:${C.goldDeep};text-decoration:underline;">Manage email preferences</a></p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`;
}

function paragraph(html: string): string {
  return `<p style="margin:0 0 16px;font-family:${SANS};font-size:15px;line-height:1.7;color:${C.text};">${html}</p>`;
}

function salutation(name: string | null): string {
  return paragraph(name ? `Dear ${escapeHtml(name)},` : "Hello,");
}

function pill(label: string, style: { fg: string; bg: string }): string {
  return `<span style="display:inline-block;padding:3px 10px;border-radius:2px;background:${style.bg};font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1px;text-transform:uppercase;color:${style.fg};">${label}</span>`;
}

/** Formal two-column record: uppercase labels on the left, values on the right. */
function detailsTable(rows: [label: string, valueHtml: string][]): string {
  const body = rows
    .map(
      ([label, value], i) => `<tr>
        <td class="label-col" valign="top" style="width:140px;padding:14px 16px 14px 0;${i ? `border-top:1px solid ${C.rule};` : ""}font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">${label}</td>
        <td valign="top" style="padding:13px 0;${i ? `border-top:1px solid ${C.rule};` : ""}font-family:${SANS};font-size:15px;line-height:1.6;color:${C.ink};">${value}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;border-top:2px solid ${C.ink};border-bottom:1px solid ${C.rule};">${body}</table>`;
}

function button(label: string, href: string): string {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:32px 0 0;"><tr>
    <td style="background:${C.ink};border-bottom:2px solid ${C.gold};">
      <a href="${href}" style="display:inline-block;padding:14px 32px;font-family:${SANS};font-size:12px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:#ffffff;text-decoration:none;">${label}</a>
    </td>
  </tr></table>
  <p style="margin:14px 0 0;font-family:${SANS};font-size:12px;line-height:1.6;color:${C.muted};">Or open this link: <a href="${href}" style="color:${C.goldDeep};word-break:break-all;">${href}</a></p>`;
}

function taskTitle(title: string, href: string): string {
  return `<a href="${href}" style="font-family:${SERIF};font-size:17px;color:${C.ink};text-decoration:none;">${escapeHtml(title)}</a>`;
}

// ─── Emails ───────────────────────────────────────────────────────────────────

export function buildTaskAssignedEmail(params: {
  recipientName: string | null;
  title: string;
  description: string | null;
  dueDate: string | null;
  priority: string | null;
  assignedByName: string | null;
  taskUrl: string;
  settingsUrl: string;
}): { subject: string; html: string } {
  const rows: [string, string][] = [["Task", taskTitle(params.title, params.taskUrl)]];
  if (params.assignedByName) rows.push(["Assigned by", escapeHtml(params.assignedByName)]);
  rows.push(["Due date", params.dueDate ? formatDueDate(params.dueDate) : `<span style="color:${C.muted};">Not set</span>`]);
  if (params.priority) {
    rows.push(["Priority", pill(capitalize(params.priority), PRIORITY_STYLE[params.priority] ?? PRIORITY_STYLE.medium)]);
  }
  if (params.description) {
    rows.push(["Details", `<span style="white-space:pre-wrap;color:${C.text};">${escapeHtml(params.description)}</span>`]);
  }

  const by = params.assignedByName ? ` by ${escapeHtml(params.assignedByName)}` : "";
  return {
    subject: `New task: ${params.title}`,
    html: layout({
      title: "New task assigned",
      preheader: `${params.title}${params.dueDate ? ` — due ${formatDueDate(params.dueDate)}` : ""}`,
      eyebrow: "Task Assignment",
      heading: "A new task has been assigned to you",
      settingsUrl: params.settingsUrl,
      body:
        salutation(params.recipientName) +
        paragraph(`A task has been assigned to you${by}. Please review the details below.`) +
        detailsTable(rows) +
        button("View Task", params.taskUrl),
    }),
  };
}

export function buildTaskCompletedEmail(params: {
  recipientName: string | null;
  title: string;
  completedByName: string | null;
  completedOn: string;
  taskUrl: string;
  settingsUrl: string;
}): { subject: string; html: string } {
  const who = params.completedByName ? escapeHtml(params.completedByName) : "A team member";
  const rows: [string, string][] = [
    ["Task", taskTitle(params.title, params.taskUrl)],
    ["Status", pill("Completed", { fg: "#3f6147", bg: "#edf3ee" })],
    ["Completed by", who],
    ["Completed on", escapeHtml(params.completedOn)],
  ];

  return {
    subject: `Task completed: ${params.title}`,
    html: layout({
      title: "Task completed",
      preheader: `${params.completedByName ?? "A team member"} completed “${params.title}”`,
      eyebrow: "Task Update",
      heading: "A task you created has been completed",
      settingsUrl: params.settingsUrl,
      body:
        salutation(params.recipientName) +
        paragraph(`${who} has marked the following task as completed.`) +
        detailsTable(rows) +
        button("View Task", params.taskUrl),
    }),
  };
}

function summaryStrip(counts: Record<DigestSection, number>): string {
  const cells = SECTION_ORDER.map((s, i) => {
    const n = counts[s];
    const color = n === 0 ? C.rule : s === "overdue" ? C.danger : C.ink;
    return `<td width="33%" align="center" style="padding:18px 8px;${i ? `border-left:1px solid ${C.rule};` : ""}">
      <p class="stat-num" style="margin:0;font-family:${SERIF};font-size:30px;line-height:1;color:${color};">${n}</p>
      <p class="stat-label" style="margin:8px 0 0;font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">${SECTION_HEADINGS[s]}</p>
    </td>`;
  }).join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 0;background:${C.panel};border:1px solid ${C.rule};"><tr>${cells}</tr></table>`;
}

function digestSection(section: DigestSection, tasks: DigestTask[], taskUrl: (id: string) => string): string {
  const accent = section === "overdue" ? C.danger : C.goldDeep;
  const rows = tasks
    .map(
      (t) => `<tr>
        <td class="stack" valign="top" style="padding:14px 12px 14px 0;border-top:1px solid ${C.rule};">${taskTitle(t.title, taskUrl(t.id))}</td>
        <td class="stack due-cell" valign="top" align="right" style="padding:16px 0 14px;border-top:1px solid ${C.rule};white-space:nowrap;font-family:${SANS};font-size:13px;color:${section === "overdue" ? C.danger : C.text};">${formatDueDate(t.dueDate)}</td>
      </tr>`,
    )
    .join("");
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:32px 0 0;border-bottom:1px solid ${C.rule};">
    <tr>
      <td style="padding:0 0 10px;border-bottom:2px solid ${accent};font-family:${SANS};font-size:11px;font-weight:600;letter-spacing:2px;text-transform:uppercase;color:${accent};">${SECTION_HEADINGS[section]} (${tasks.length})</td>
      <td class="hide-sm" align="right" style="padding:0 0 10px;border-bottom:2px solid ${accent};font-family:${SANS};font-size:10px;font-weight:600;letter-spacing:1.5px;text-transform:uppercase;color:${C.muted};">Due</td>
    </tr>
    ${rows}
  </table>`;
}

export function buildTaskDigestEmail(params: {
  recipientName: string | null;
  dateLabel: string;
  tasks: DigestTask[];
  taskUrl: (id: string) => string;
  tasksUrl: string;
  settingsUrl: string;
}): { subject: string; html: string } {
  const counts = Object.fromEntries(
    SECTION_ORDER.map((s) => [s, params.tasks.filter((t) => t.section === s).length]),
  ) as Record<DigestSection, number>;
  const summary = SECTION_ORDER.filter((s) => counts[s] > 0)
    .map((s) => `${counts[s]} ${SECTION_HEADINGS[s].toLowerCase()}`)
    .join(", ");

  const sections = SECTION_ORDER.map((s) => {
    const tasks = params.tasks.filter((t) => t.section === s);
    return tasks.length ? digestSection(s, tasks, params.taskUrl) : "";
  }).join("");

  const single = params.tasks.length === 1 ? params.tasks[0] : null;
  const intro = counts.overdue
    ? "The following tasks assigned to you require your attention. Overdue items are listed first."
    : "The following tasks assigned to you are due shortly.";

  return {
    subject: single
      ? `${SECTION_HEADINGS[single.section]}: ${single.title}`
      : `Task reminder: ${summary}`,
    html: layout({
      title: "Task reminders",
      preheader: `You have ${summary}.`,
      eyebrow: `Daily Task Summary · ${escapeHtml(params.dateLabel)}`,
      heading: "Your tasks requiring attention",
      settingsUrl: params.settingsUrl,
      body:
        salutation(params.recipientName) +
        paragraph(intro) +
        summaryStrip(counts) +
        sections +
        button("View All Tasks", params.tasksUrl),
    }),
  };
}
