"use server";

import { Resend } from "resend";

import { createClient } from "@/lib/supabase/server";

const resend = new Resend(process.env.RESEND_API_KEY);

export type VisualizerEnquiryInput = {
  customerName: string;
  customerPhone: string;
  customerEmail: string;
  notes: string;
  slabCode: string | null;
  marbleName: string | null;
  dimensions: string | null;
  renderShareUrl: string | null;
};

export type VisualizerEnquiryResult = {
  success: boolean;
  error?: string;
};

// Staff-initiated inquiry from inside the visualizer (showroom consult, not the
// public contact form) — no Turnstile/honeypot since this runs behind staff auth.
export async function sendVisualizerEnquiry(
  input: VisualizerEnquiryInput,
): Promise<VisualizerEnquiryResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: "Please sign in again before sending." };
  }

  if (!input.customerName.trim() || (!input.customerPhone.trim() && !input.customerEmail.trim())) {
    return { success: false, error: "Add the customer's name and a phone or email." };
  }

  const slabLine = [input.marbleName, input.slabCode ? `#${input.slabCode}` : null, input.dimensions]
    .filter(Boolean)
    .join(" · ");

  const { error } = await resend.emails.send({
    from: "Trivedi Grani Marmo Visualizer <onboarding@resend.dev>",
    to: ["admin@trivedigranimarmo.com"],
    replyTo: input.customerEmail || undefined,
    subject: `Visualizer enquiry — ${input.customerName}${slabLine ? ` — ${slabLine}` : ""}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Visualizer Enquiry</title></head>
<body style="margin:0;padding:0;background:#f4f0ea;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ea;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">
        <tr><td style="background:#17130f;padding:36px 48px 32px;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c8a96a;">Trivedi Grani Marmo</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#ffffff;letter-spacing:1px;">Visualizer Enquiry</h1>
          <p style="margin:14px 0 0;font-family:Arial,sans-serif;font-size:12px;color:#9c8f7c;">Logged by ${user.email ?? "a staff member"} during a showroom visualizer session.</p>
        </td></tr>
        <tr><td style="height:3px;background:#c8a96a;"></td></tr>
        <tr><td style="background:#ffffff;padding:40px 48px;">
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e7dccd;">
            <tr><td style="padding:18px 24px;border-bottom:1px solid #e7dccd;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Customer</p>
              <p style="margin:0;font-family:Georgia,serif;font-size:17px;color:#000000;">${input.customerName}</p>
            </td></tr>
            <tr><td style="padding:18px 24px;border-bottom:1px solid #e7dccd;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Contact</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#000000;">${[input.customerPhone, input.customerEmail].filter(Boolean).join(" · ") || "Not provided"}</p>
            </td></tr>
            <tr><td style="padding:18px 24px;${input.renderShareUrl ? "border-bottom:1px solid #e7dccd;" : ""}">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Slab</p>
              <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#000000;">${slabLine || "Not specified"}</p>
            </td></tr>
            ${input.renderShareUrl ? `<tr><td style="padding:18px 24px;">
              <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Rendered preview</p>
              <a href="${input.renderShareUrl}" style="color:#9c7c42;font-family:Arial,sans-serif;font-size:13px;">${input.renderShareUrl}</a>
            </td></tr>` : ""}
          </table>
          ${input.notes ? `<div style="margin-top:28px;">
            <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Notes</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.8;white-space:pre-wrap;">${input.notes}</p>
          </div>` : ""}
        </td></tr>
        <tr><td style="background:#17130f;padding:28px 48px;">
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#666666;line-height:1.7;">
            Trivedi Grani Marmo · S.No.: 698/4, Ognaj, Ahmedabad — 380060, Gujarat, India
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (error) {
    console.error("[sendVisualizerEnquiry] Resend error:", error);
    return { success: false, error: "Failed to send. Please try again." };
  }

  return { success: true };
}
