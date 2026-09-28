import "server-only";

import { Resend } from "resend";

import { createAdminClient } from "@/lib/supabase/admin";

type AdminClient = ReturnType<typeof createAdminClient>;

// onboarding@resend.dev only delivers to the Resend account owner, so staff
// emails need EMAIL_FROM set to an address on a domain verified in Resend,
// e.g. "Trivedi Grani Marmo <notifications@trivedigranimarmo.com>".
const DEFAULT_FROM = "Trivedi Grani Marmo <onboarding@resend.dev>";

let resend: Resend | null = null;

export function appUrl(path: string): string {
  const base = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}${path}`;
}

/** Sends one email; never throws. Returns false (and logs) when Resend isn't
 * configured or rejects the send, so callers can treat email as best-effort
 * alongside the bell notification. */
export async function sendAppEmail(message: {
  to: string;
  subject: string;
  html: string;
}): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return false;

  resend ??= new Resend(apiKey);
  try {
    const { error } = await resend.emails.send({
      from: process.env.EMAIL_FROM || DEFAULT_FROM,
      to: [message.to],
      subject: message.subject,
      html: message.html,
    });
    if (error) {
      console.error("[sendAppEmail] Resend error:", error);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[sendAppEmail] failed:", err);
    return false;
  }
}

export type EmailRecipient = { userId: string; email: string; name: string | null };

/** Resolves user ids to email addresses, dropping anyone who has turned off
 * task emails or has no address on their auth account. */
export async function getTaskEmailRecipients(
  admin: AdminClient,
  userIds: string[],
): Promise<Map<string, EmailRecipient>> {
  const recipients = new Map<string, EmailRecipient>();
  const ids = [...new Set(userIds.filter(Boolean))];
  if (ids.length === 0) return recipients;

  const { data: profiles } = await admin
    .from("user_profiles")
    .select("user_id, display_name, task_emails_enabled")
    .in("user_id", ids);
  const profileById = new Map((profiles ?? []).map((p) => [String(p.user_id), p]));

  await Promise.all(
    ids.map(async (id) => {
      const profile = profileById.get(id);
      if (profile?.task_emails_enabled === false) return;
      const { data } = await admin.auth.admin.getUserById(id);
      const email = data?.user?.email;
      if (!email) return;
      recipients.set(id, { userId: id, email, name: profile?.display_name ?? null });
    }),
  );
  return recipients;
}
