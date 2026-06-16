"use server";

import { Resend } from "resend";

const resend = new Resend(process.env.RESEND_API_KEY);

export type InquiryState = {
  success: boolean;
  error?: string;
} | null;

export async function sendInquiry(
  _prevState: InquiryState,
  formData: FormData,
): Promise<InquiryState> {
  // Honeypot — bots fill this hidden field; real users never see it
  const honeypot = formData.get("website")?.toString() ?? "";
  if (honeypot) return { success: true }; // silent reject, looks like success to bots

  // Cloudflare Turnstile verification
  const turnstileToken = formData.get("cf-turnstile-response")?.toString() ?? "";
  if (!turnstileToken) {
    return { success: false, error: "Security check incomplete. Please wait and try again." };
  }
  const verifyRes = await fetch("https://challenges.cloudflare.com/turnstile/v0/siteverify", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      secret: process.env.TURNSTILE_SECRET_KEY,
      response: turnstileToken,
    }),
  });
  const verifyData = await verifyRes.json() as { success: boolean };
  if (!verifyData.success) {
    return { success: false, error: "Security check failed. Please refresh and try again." };
  }

  const firstName = formData.get("firstName")?.toString().trim() ?? "";
  const lastName = formData.get("lastName")?.toString().trim() ?? "";
  const email = formData.get("email")?.toString().trim() ?? "";
  const projectType = formData.get("projectType")?.toString() ?? "";
  const message = formData.get("message")?.toString().trim() ?? "";

  if (!firstName || !email || !message) {
    return { success: false, error: "Please fill in your name, email, and message." };
  }

  const fullName = `${firstName} ${lastName}`.trim();

  const { error } = await resend.emails.send({
    from: "Trivedi Grani Marmo <onboarding@resend.dev>",
    to: ["admin@trivedigranimarmo.com"],
    replyTo: email,
    subject: `New Inquiry — ${fullName}`,
    html: `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>New Inquiry</title></head>
<body style="margin:0;padding:0;background:#f4f0ea;font-family:Georgia,serif;">
  <table width="100%" cellpadding="0" cellspacing="0" style="background:#f4f0ea;padding:40px 16px;">
    <tr><td align="center">
      <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;">

        <!-- Header -->
        <tr><td style="background:#000000;padding:36px 48px 32px;">
          <img src="${process.env.NEXT_PUBLIC_SITE_URL}/images/vijay-trivedi-logo-email.png" alt="Trivedi Grani Marmo" width="120" height="120" style="display:block;margin-bottom:24px;width:120px;height:120px;" />
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;letter-spacing:4px;text-transform:uppercase;color:#c8a96a;">Trivedi Grani Marmo</p>
          <h1 style="margin:0;font-family:Georgia,serif;font-size:26px;font-weight:400;color:#ffffff;letter-spacing:1px;">New Website Inquiry</h1>
          <div style="margin-top:20px;height:1px;background:#c8a96a;opacity:0.4;"></div>
        </td></tr>

        <!-- Gold accent bar -->
        <tr><td style="height:3px;background:#c8a96a;"></td></tr>

        <!-- Body -->
        <tr><td style="background:#ffffff;padding:40px 48px;">

          <p style="margin:0 0 28px;font-family:Arial,sans-serif;font-size:14px;color:#6f6258;line-height:1.6;">
            A new inquiry has been submitted through the website. Details are below.
          </p>

          <!-- Details card -->
          <table width="100%" cellpadding="0" cellspacing="0" style="background:#faf8f5;border:1px solid #e7dccd;">
            <tr>
              <td style="padding:18px 24px;border-bottom:1px solid #e7dccd;">
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">From</p>
                <p style="margin:0;font-family:Georgia,serif;font-size:17px;color:#000000;">${fullName}</p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;border-bottom:1px solid #e7dccd;">
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Email</p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#000000;"><a href="mailto:${email}" style="color:#000000;text-decoration:underline;">${email}</a></p>
              </td>
            </tr>
            <tr>
              <td style="padding:18px 24px;">
                <p style="margin:0 0 4px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Project Type</p>
                <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#000000;">${projectType || "Not specified"}</p>
              </td>
            </tr>
          </table>

          <!-- Message -->
          <div style="margin-top:28px;">
            <p style="margin:0 0 12px;font-family:Arial,sans-serif;font-size:10px;letter-spacing:2px;text-transform:uppercase;color:#c8a96a;">Message</p>
            <p style="margin:0;font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a;line-height:1.8;white-space:pre-wrap;">${message}</p>
          </div>

          <!-- Divider -->
          <div style="margin:36px 0;height:1px;background:#e7dccd;"></div>

          <!-- CTA -->
          <p style="margin:0 0 20px;font-family:Arial,sans-serif;font-size:13px;color:#6f6258;">Reply directly to this email to respond to ${firstName}.</p>
          <a href="mailto:${email}" style="display:inline-block;background:#000000;color:#ffffff;font-family:Arial,sans-serif;font-size:11px;letter-spacing:3px;text-transform:uppercase;text-decoration:none;padding:14px 28px;">Reply to Inquiry</a>

        </td></tr>

        <!-- Footer -->
        <tr><td style="background:#000000;padding:28px 48px;">
          <p style="margin:0 0 6px;font-family:Arial,sans-serif;font-size:11px;color:#c8a96a;letter-spacing:2px;text-transform:uppercase;">Trivedi Grani Marmo</p>
          <p style="margin:0;font-family:Arial,sans-serif;font-size:11px;color:#666666;line-height:1.7;">
            S.No.: 698/4, Ognaj, Ahmedabad — 380060, Gujarat, India<br>
            +91 90999 96869 &nbsp;·&nbsp; trivedigranimarmo.com
          </p>
        </td></tr>

      </table>
    </td></tr>
  </table>
</body>
</html>`,
  });

  if (error) {
    console.error("Resend error:", error);
    return { success: false, error: "Failed to send. Please try again or reach us on WhatsApp." };
  }

  return { success: true };
}
