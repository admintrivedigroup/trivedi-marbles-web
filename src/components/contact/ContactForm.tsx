"use client";

import { useActionState, useState } from "react";
import { CheckCircle, Send } from "lucide-react";
import { Turnstile } from "@marsidev/react-turnstile";

import { sendInquiry } from "@/app/(site)/contact/_actions/send-inquiry";

export function ContactForm() {
  const [state, action, isPending] = useActionState(sendInquiry, null);
  const [turnstileToken, setTurnstileToken] = useState("");

  if (state?.success) {
    return (
      <div className="flex flex-col items-center justify-center gap-6 border border-border bg-white p-12 text-center shadow-[0_0_50px_rgba(0,0,0,0.03)] md:p-16">
        <CheckCircle className="h-12 w-12 text-secondary" />
        <div>
          <h3 className="mb-2 font-serif text-3xl text-primary">Thank You</h3>
          <p className="text-muted-foreground">
            We&apos;ve received your inquiry and will be in touch shortly.
          </p>
        </div>
      </div>
    );
  }

  return (
    <form
      action={action}
      className="space-y-8 border border-border bg-white p-8 shadow-[0_0_50px_rgba(0,0,0,0.03)] md:p-12"
    >
      <h3 className="mb-8 font-serif text-3xl text-primary">Send an Inquiry</h3>

      {/* Honeypot — hidden from real users, bots fill it and get silently rejected */}
      <div aria-hidden="true" style={{ position: "absolute", left: "-9999px", width: "1px", height: "1px", overflow: "hidden" }}>
        <label htmlFor="website">Website</label>
        <input
          id="website"
          name="website"
          type="text"
          tabIndex={-1}
          autoComplete="off"
        />
      </div>

      {/* Turnstile token passed as hidden input */}
      <input type="hidden" name="cf-turnstile-response" value={turnstileToken} />

      <div className="space-y-6 text-sm">
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              First Name <span className="text-secondary">*</span>
            </label>
            <input
              name="firstName"
              type="text"
              required
              placeholder="First name"
              className="w-full border-b border-border bg-transparent pb-3 outline-none transition-colors focus:border-secondary"
            />
          </div>
          <div>
            <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
              Last Name
            </label>
            <input
              name="lastName"
              type="text"
              placeholder="Last name"
              className="w-full border-b border-border bg-transparent pb-3 outline-none transition-colors focus:border-secondary"
            />
          </div>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
            Email Address <span className="text-secondary">*</span>
          </label>
          <input
            name="email"
            type="email"
            required
            placeholder="john@example.com"
            className="w-full border-b border-border bg-transparent pb-3 outline-none transition-colors focus:border-secondary"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
            Contact Number <span className="text-secondary">*</span>
          </label>
          <input
            name="phone"
            type="tel"
            required
            placeholder="+91 98765 43210"
            className="w-full border-b border-border bg-transparent pb-3 outline-none transition-colors focus:border-secondary"
          />
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
            Project Type
          </label>
          <select
            name="projectType"
            className="w-full border-b border-border bg-transparent pb-3 text-primary outline-none transition-colors focus:border-secondary"
          >
            <option value="">Select an option</option>
            <option value="residential">Residential</option>
            <option value="commercial">Commercial</option>
            <option value="hotel">Hotel / Hospitality</option>
            <option value="other">Other</option>
          </select>
        </div>

        <div>
          <label className="mb-2 block text-xs uppercase tracking-widest text-muted-foreground">
            Message <span className="text-secondary">*</span>
          </label>
          <textarea
            name="message"
            rows={4}
            required
            placeholder="Tell us about your requirements..."
            className="w-full resize-none border-b border-border bg-transparent pb-3 outline-none transition-colors focus:border-secondary"
          />
        </div>
      </div>

      {/* Cloudflare Turnstile widget */}
      <div className="w-full overflow-hidden">
        <div className="origin-top-left scale-[0.75] min-[480px]:scale-[0.85] sm:scale-100">
          <Turnstile
            siteKey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY!}
            onSuccess={setTurnstileToken}
            onExpire={() => setTurnstileToken("")}
            options={{ theme: "light", size: "normal" }}
          />
        </div>
      </div>

      {state?.error ? (
        <p className="text-sm text-red-600">{state.error}</p>
      ) : null}

      <button
        type="submit"
        disabled={isPending || !turnstileToken}
        className="flex w-full items-center justify-center gap-3 bg-primary py-5 text-sm uppercase tracking-widest text-white transition-colors hover:bg-secondary disabled:opacity-60"
      >
        {isPending ? (
          <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
        ) : (
          <Send className="h-4 w-4" />
        )}
        {isPending ? "Sending…" : "Submit Inquiry"}
      </button>
    </form>
  );
}
