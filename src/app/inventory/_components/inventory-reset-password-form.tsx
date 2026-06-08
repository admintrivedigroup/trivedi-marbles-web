"use client";

import Link from "next/link";
import { useEffect, useEffectEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import type { AuthChangeEvent, Session } from "@supabase/supabase-js";
import { ArrowLeft, KeyRound, LoaderCircle, ShieldCheck } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

type FeedbackState =
  | {
      message: string;
      type: "error" | "info" | "success";
    }
  | null;

function getResetPasswordErrorMessage(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "same_password":
      return "Choose a password different from the current one.";
    case "weak_password":
      return error.message || "Choose a stronger password.";
    case "session_not_found":
    case "session_expired":
      return "This reset session is no longer valid. Request a new reset link.";
    default:
      return error.message || "Unable to update the password. Please try again.";
  }
}

export function InventoryResetPasswordForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const errorDescription = searchParams.get("error_description");
  const fromInvite = searchParams.get("from") === "invite";
  const recoveryAuthorizedFromUrl = Boolean(
    fromInvite ||
      searchParams.get("code") ||
      searchParams.get("token") ||
      searchParams.get("token_hash") ||
      searchParams.get("access_token") ||
      searchParams.get("refresh_token") ||
      searchParams.get("type") === "recovery",
  );
  const [supabase] = useState(() => createClient());
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [feedback, setFeedback] = useState<FeedbackState>(null);
  const [hasRecoverySession, setHasRecoverySession] = useState(false);
  const [recoveryEventReceived, setRecoveryEventReceived] = useState(false);
  const [initializing, setInitializing] = useState(true);
  const [pending, setPending] = useState(false);
  const recoveryAuthorized =
    recoveryAuthorizedFromUrl || recoveryEventReceived;
  const isResetUnavailable =
    Boolean(errorDescription) || !recoveryAuthorized || !hasRecoverySession;
  const isBusy = Boolean(errorDescription) ? false : initializing;

  const applySession = useEffectEvent(
    (event: AuthChangeEvent, session: Session | null) => {
      if (event === "SIGNED_OUT") {
        setHasRecoverySession(false);
        return;
      }

      setHasRecoverySession(Boolean(session));
      setInitializing(false);

      if (event === "PASSWORD_RECOVERY") {
        setRecoveryEventReceived(true);
        setFeedback({
          message: "Recovery link verified. Set a new password below.",
          type: "info",
        });
      }
    },
  );

  useEffect(() => {
    if (errorDescription) {
      return;
    }

    let active = true;

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) {
        return;
      }

      if (error) {
        setFeedback({
          message: "Unable to verify the reset session. Request a new link.",
          type: "error",
        });
        setHasRecoverySession(false);
        setInitializing(false);
        return;
      }

      setHasRecoverySession(Boolean(data.session));
      setInitializing(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) {
        return;
      }

      applySession(event, session);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, [errorDescription, supabase]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (errorDescription || !recoveryAuthorized || !hasRecoverySession) {
      setFeedback({
        message: "This reset link is invalid or expired. Request a new one.",
        type: "error",
      });
      return;
    }

    if (!newPassword || !confirmPassword) {
      setFeedback({
        message: "Enter and confirm your new password.",
        type: "error",
      });
      return;
    }

    if (newPassword.length < 8) {
      setFeedback({
        message: "Use at least 8 characters for the new password.",
        type: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setFeedback({
        message: "The password confirmation does not match.",
        type: "error",
      });
      return;
    }

    setPending(true);
    setFeedback(null);

    const { error } = await supabase.auth.updateUser({
      password: newPassword,
    });

    if (error) {
      setPending(false);
      setFeedback({
        message: getResetPasswordErrorMessage(error),
        type: "error",
      });
      return;
    }

    setFeedback({
      message: "Password updated. Redirecting to inventory login.",
      type: "success",
    });
    setNewPassword("");
    setConfirmPassword("");

    await supabase.auth.signOut();
    router.replace("/inventory/login?passwordUpdated=1");
  };

  return (
    <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_24px_72px_rgba(15,23,42,0.14)] ring-1 ring-stone-200/80 md:rounded-[2rem] md:p-8">
      <div className="mb-6 text-center md:mb-8">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">
          {fromInvite ? "Set your password" : "Set a new password"}
        </h1>
        <p className="mt-2 text-sm text-stone-500 md:text-base">
          {fromInvite
            ? "Choose a password to activate your inventory account."
            : "Use the reset link from your email to choose a new inventory login password."}
        </p>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4 md:space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="new-password"
            className="block text-sm font-medium text-stone-700"
          >
            New Password
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
            <Input
              id="new-password"
              name="new-password"
              type="password"
              autoComplete="new-password"
              value={newPassword}
              onChange={(event) => setNewPassword(event.target.value)}
              placeholder="Enter a new password"
              className="h-12 rounded-xl border-stone-200 bg-white pl-11 pr-4 text-sm shadow-none md:h-13"
              disabled={isBusy || pending || isResetUnavailable}
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="confirm-password"
            className="block text-sm font-medium text-stone-700"
          >
            Confirm Password
          </label>
          <div className="relative">
            <KeyRound className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
            <Input
              id="confirm-password"
              name="confirm-password"
              type="password"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => setConfirmPassword(event.target.value)}
              placeholder="Confirm the new password"
              className="h-12 rounded-xl border-stone-200 bg-white pl-11 pr-4 text-sm shadow-none md:h-13"
              disabled={isBusy || pending || isResetUnavailable}
              required
            />
          </div>
        </div>

        {errorDescription ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {errorDescription}
          </div>
        ) : feedback ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : feedback.type === "success"
                  ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                  : "border-blue-200 bg-blue-50 text-blue-700"
            }`}
          >
            {feedback.message}
          </div>
        ) : isBusy ? (
          <div className="rounded-xl border border-stone-200 bg-stone-50 px-4 py-3 text-sm text-stone-600">
            Verifying your reset link...
          </div>
        ) : isResetUnavailable ? (
          <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">
            This reset link is no longer active. Request a fresh one to continue.
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[linear-gradient(90deg,#1f2937_0%,#4b5563_100%)] text-sm font-medium text-white shadow-none transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100"
          disabled={isBusy || pending || isResetUnavailable}
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Updating Password
            </>
          ) : (
            "Update Password"
          )}
        </Button>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/inventory/forgot-password"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Request a new reset link
        </Link>
      </div>
    </div>
  );
}
