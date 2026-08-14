"use client";

import { useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { EmailOtpType } from "@supabase/supabase-js";
import { LoaderCircle, ShieldCheck, TriangleAlert } from "lucide-react";

import { Button } from "@/components/ui/button";
import { createClient } from "@/lib/supabase/client";

const VALID_TYPES: EmailOtpType[] = ["invite", "recovery", "signup", "magiclink", "email_change", "email"];

const COPY: Record<EmailOtpType, { title: string; description: string; action: string; nextPath: string }> = {
  invite: {
    title: "Accept Your Invitation",
    description: "Confirm you'd like to join the Trivedi Grani Marmo inventory team.",
    action: "Accept Invitation",
    nextPath: "/inventory/reset-password?from=invite",
  },
  recovery: {
    title: "Reset Your Password",
    description: "Confirm this was you to continue resetting your password.",
    action: "Continue",
    nextPath: "/inventory/reset-password?type=recovery",
  },
  signup: {
    title: "Confirm Your Email",
    description: "Confirm your email address to activate your account.",
    action: "Confirm Email",
    nextPath: "/inventory/login?confirmed=1",
  },
  magiclink: {
    title: "Confirm Sign-In",
    description: "Confirm this was you to sign in.",
    action: "Continue",
    nextPath: "/inventory/dashboard",
  },
  email_change: {
    title: "Confirm Email Change",
    description: "Confirm this new email address for your account.",
    action: "Confirm",
    nextPath: "/inventory/dashboard",
  },
  email: {
    title: "Confirm Your Email",
    description: "Confirm your email address.",
    action: "Confirm",
    nextPath: "/inventory/dashboard",
  },
};

// A bare GET on this page never verifies anything — only this explicit click
// does. Mail-security scanners that auto-follow links (Microsoft Defender
// Safe Links, Gmail link scanning, etc.) burn a direct Supabase verify link
// before the recipient clicks it, which was expiring invite links in transit.
export function InventoryAuthConfirm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [supabase] = useState(() => createClient());
  const [status, setStatus] = useState<"idle" | "verifying" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const tokenHash = searchParams.get("token_hash");
  const typeParam = searchParams.get("type");
  const type = VALID_TYPES.includes(typeParam as EmailOtpType) ? (typeParam as EmailOtpType) : null;
  const copy = type ? COPY[type] : null;

  const isLinkValid = Boolean(tokenHash && copy);

  const handleConfirm = async () => {
    if (!tokenHash || !type) return;

    setStatus("verifying");
    setErrorMessage(null);

    const { error } = await supabase.auth.verifyOtp({ token_hash: tokenHash, type });

    if (error) {
      setStatus("error");
      setErrorMessage(
        error.code === "otp_expired"
          ? "This link has expired or was already used. Ask an admin to send a fresh one."
          : error.message || "Unable to confirm this link. Please try again.",
      );
      return;
    }

    router.replace(COPY[type].nextPath);
  };

  return (
    <div className="rounded-[1.75rem] bg-white p-6 text-center shadow-[0_24px_72px_rgba(15,23,42,0.14)] ring-1 ring-stone-200/80 md:rounded-[2rem] md:p-8">
      <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
        {isLinkValid ? <ShieldCheck className="size-8" /> : <TriangleAlert className="size-8" />}
      </div>

      {isLinkValid && copy ? (
        <>
          <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">{copy.title}</h1>
          <p className="mt-2 text-sm text-stone-500 md:text-base">{copy.description}</p>

          {status === "error" && errorMessage ? (
            <div className="mt-6 rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-left text-sm text-red-700">
              {errorMessage}
            </div>
          ) : null}

          <Button
            type="button"
            onClick={handleConfirm}
            disabled={status === "verifying"}
            className="mt-6 h-12 w-full rounded-xl bg-[linear-gradient(90deg,#1f2937_0%,#4b5563_100%)] text-sm font-medium text-white shadow-none transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100"
          >
            {status === "verifying" ? (
              <>
                <LoaderCircle className="size-4 animate-spin" />
                Confirming
              </>
            ) : (
              copy.action
            )}
          </Button>
        </>
      ) : (
        <>
          <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">Invalid Link</h1>
          <p className="mt-2 text-sm text-stone-500 md:text-base">
            This confirmation link is missing or malformed. Ask an admin to send a fresh one.
          </p>
        </>
      )}
    </div>
  );
}
