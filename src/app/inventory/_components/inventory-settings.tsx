"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Bell, LoaderCircle, Lock } from "lucide-react";

import { Input } from "@/components/ui/input";
import { createClient } from "@/lib/supabase/client";

function Toggle({
  checked,
  onClick,
}: {
  checked: boolean;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`h-8 w-14 rounded-full transition-colors ${
        checked ? "bg-gray-900" : "bg-gray-300"
      }`}
    >
      <div
        className={`h-6 w-6 rounded-full bg-white shadow-md transition-transform ${
          checked ? "translate-x-7" : "translate-x-1"
        }`}
      />
    </button>
  );
}

type PasswordFormState = {
  confirmPassword: string;
  currentPassword: string;
  newPassword: string;
  verificationCode: string;
};

type FeedbackState =
  | {
      message: string;
      type: "error" | "info" | "success";
    }
  | null;

const initialPasswordFormState: PasswordFormState = {
  confirmPassword: "",
  currentPassword: "",
  newPassword: "",
  verificationCode: "",
};

function getChangePasswordErrorMessage(error: { code?: string; message?: string }) {
  switch (error.code) {
    case "invalid_credentials":
      return "The current password is incorrect.";
    case "same_password":
      return "Choose a new password different from the current one.";
    case "weak_password":
      return error.message || "Choose a stronger password.";
    case "otp_expired":
    case "reauthentication_not_valid":
      return "The verification code is invalid or expired. Request a new one and try again.";
    case "session_not_found":
    case "session_expired":
      return "Your session expired. Sign in again before changing the password.";
    default:
      return error.message || "Unable to update the password. Please try again.";
  }
}

export function InventorySettings() {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
  const [notifications, setNotifications] = useState(true);
  const [passwordForm, setPasswordForm] = useState(initialPasswordFormState);
  const [passwordFeedback, setPasswordFeedback] = useState<FeedbackState>(null);
  const [requiresVerificationCode, setRequiresVerificationCode] = useState(false);
  const [updatingPassword, setUpdatingPassword] = useState(false);

  const updatePasswordField = (
    field: keyof PasswordFormState,
    value: string,
  ) => {
    setPasswordForm((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const requestVerificationCode = async () => {
    const { error } = await supabase.auth.reauthenticate();

    if (error) {
      setPasswordFeedback({
        message:
          error.message ||
          "Unable to send a verification code right now. Please try again.",
        type: "error",
      });
      return false;
    }

    setRequiresVerificationCode(true);
    setPasswordFeedback({
      message:
        "We sent a verification code to your email. Enter it below to finish changing your password.",
      type: "info",
    });
    return true;
  };

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();

    const currentPassword = passwordForm.currentPassword.trim();
    const newPassword = passwordForm.newPassword.trim();
    const confirmPassword = passwordForm.confirmPassword.trim();
    const verificationCode = passwordForm.verificationCode.trim();

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordFeedback({
        message: "Fill in the current password, new password, and confirmation.",
        type: "error",
      });
      return;
    }

    if (newPassword.length < 8) {
      setPasswordFeedback({
        message: "Use at least 8 characters for the new password.",
        type: "error",
      });
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordFeedback({
        message: "The new password confirmation does not match.",
        type: "error",
      });
      return;
    }

    if (requiresVerificationCode && !verificationCode) {
      setPasswordFeedback({
        message: "Enter the verification code sent to your email.",
        type: "error",
      });
      return;
    }

    setUpdatingPassword(true);
    setPasswordFeedback(null);

    const { error } = await supabase.auth.updateUser({
      current_password: currentPassword,
      password: newPassword,
      ...(requiresVerificationCode ? { nonce: verificationCode } : {}),
    });

    if (error?.code === "reauth_nonce_missing" || error?.code === "reauthentication_needed") {
      const verificationRequested = await requestVerificationCode();
      setUpdatingPassword(false);

      if (verificationRequested) {
        updatePasswordField("verificationCode", "");
      }

      return;
    }

    if (error) {
      setUpdatingPassword(false);
      setPasswordFeedback({
        message: getChangePasswordErrorMessage(error),
        type: "error",
      });
      return;
    }

    setUpdatingPassword(false);
    setPasswordFeedback({
      message: "Password updated. Redirecting to inventory login.",
      type: "success",
    });
    setPasswordForm(initialPasswordFormState);
    setRequiresVerificationCode(false);

    await supabase.auth.signOut();
    router.replace("/inventory/login?passwordUpdated=1");
  };

  return (
    <div className="p-4 md:p-8">
      <div className="mb-6 md:mb-8">
        <h1 className="mb-2 text-2xl font-bold text-gray-900 md:text-3xl">
          Settings
        </h1>
        <p className="text-gray-500">Manage your account and preferences</p>
      </div>

      <div className="max-w-4xl space-y-4 md:space-y-6">
        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Lock className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Security
            </h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="current-password"
                    className="block text-sm font-medium text-gray-700"
                  >
                    Current Password
                  </label>
                  <Link
                    href="/inventory/forgot-password"
                    className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
                  >
                    Forgot password?
                  </Link>
                </div>
                <Input
                  id="current-password"
                  name="current-password"
                  type="password"
                  autoComplete="current-password"
                  value={passwordForm.currentPassword}
                  onChange={(event) =>
                    updatePasswordField("currentPassword", event.target.value)
                  }
                  placeholder="Enter current password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  New Password
                </label>
                <Input
                  id="new-password"
                  name="new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.newPassword}
                  onChange={(event) =>
                    updatePasswordField("newPassword", event.target.value)
                  }
                  placeholder="Use at least 8 characters"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-2 block text-sm font-medium text-gray-700"
                >
                  Confirm New Password
                </label>
                <Input
                  id="confirm-new-password"
                  name="confirm-new-password"
                  type="password"
                  autoComplete="new-password"
                  value={passwordForm.confirmPassword}
                  onChange={(event) =>
                    updatePasswordField("confirmPassword", event.target.value)
                  }
                  placeholder="Re-enter the new password"
                  className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                />
              </div>

              {requiresVerificationCode ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-gray-700">
                      Email Verification Code
                    </label>
                    <button
                      type="button"
                      onClick={() => {
                        setUpdatingPassword(true);
                        setPasswordFeedback(null);

                        void requestVerificationCode().finally(() => {
                          setUpdatingPassword(false);
                        });
                      }}
                      className="text-xs font-medium text-gray-600 transition-colors hover:text-gray-900"
                    >
                      Resend code
                    </button>
                  </div>
                  <input
                    type="text"
                    inputMode="numeric"
                    value={passwordForm.verificationCode}
                    onChange={(event) =>
                      updatePasswordField("verificationCode", event.target.value)
                    }
                    placeholder="Enter verification code"
                    className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
                  />
                </div>
              ) : null}
            </div>

            {passwordFeedback ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  passwordFeedback.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700"
                    : passwordFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                      : "border-blue-200 bg-blue-50 text-blue-700"
                }`}
              >
                {passwordFeedback.message}
              </div>
            ) : (
              <p className="text-sm text-gray-500">
                Use settings if you know your current password. If not, use the
                reset flow from login or the link above.
              </p>
            )}

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={updatingPassword}
                className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
              >
                {updatingPassword ? (
                  <>
                    <LoaderCircle className="h-5 w-5 animate-spin" />
                    Updating Password
                  </>
                ) : (
                  "Update Password"
                )}
              </button>
            </div>
          </form>
        </section>

        <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Bell className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-gray-900 md:text-xl">
              Notifications
            </h2>
          </div>
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-gray-900">Low Stock Alerts</p>
                <p className="text-sm text-gray-500">
                  Get notified when inventory is low
                </p>
              </div>
              <Toggle
                checked={notifications}
                onClick={() => setNotifications(!notifications)}
              />
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <p className="font-medium text-gray-900">Reservation Reminders</p>
                <p className="text-sm text-gray-500">
                  Reminders for reserved slabs
                </p>
              </div>
              <Toggle checked />
            </div>
            <div className="flex items-center justify-between border-t border-gray-200 pt-4">
              <div>
                <p className="font-medium text-gray-900">Stock Movement Alerts</p>
                <p className="text-sm text-gray-500">
                  Notifications for stock transfers
                </p>
              </div>
              <Toggle checked={false} />
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
