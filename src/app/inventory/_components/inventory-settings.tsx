"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useRef, useState, useTransition } from "react";
import { Bell, Camera, LoaderCircle, Lock, UserRound } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/inventory/_components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary, withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { updateOwnProfile } from "@/app/inventory/_actions/profile";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import { ROLE_BADGE } from "@/app/inventory/_components/inventory-shell";
import type { UserProfile } from "@/app/inventory/_lib/user-profile";

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

function formatDate(iso: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function ProfileSection({ profile }: { profile: UserProfile | null }) {
  const { options } = useLookupOptions();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [displayName, setDisplayName] = useState(profile?.displayName ?? "");
  const [avatarUrl, setAvatarUrl] = useState(profile?.avatarUrl ?? "");
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  const badge = profile ? ROLE_BADGE[profile.role] : null;
  const warehouseNames = profile?.warehouseIds
    ? options.warehouses
        .filter((w) => profile.warehouseIds!.includes(w.id))
        .map((w) => w.name)
    : null;
  const isDirty =
    displayName !== (profile?.displayName ?? "") ||
    avatarUrl !== (profile?.avatarUrl ?? "");

  async function handleAvatarFile(file: File) {
    setFeedback(null);
    setIsUploadingAvatar(true);
    try {
      const compressed = await compressImage(file);
      const { secureUrl } = await uploadToCloudinary(compressed);
      setAvatarUrl(secureUrl);
    } catch {
      setFeedback({ message: "Avatar upload failed. Please try again.", type: "error" });
    } finally {
      setIsUploadingAvatar(false);
    }
  }

  function handleSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFeedback(null);
    const formData = new FormData();
    formData.set("displayName", displayName);
    formData.set("avatarUrl", avatarUrl);

    startTransition(async () => {
      const res = await updateOwnProfile(formData);
      if (res.error) {
        setFeedback({ message: res.error, type: "error" });
      } else {
        setFeedback({ message: "Profile updated.", type: "success" });
      }
    });
  }

  return (
    <section className="rounded-xl border border-gray-100 bg-white p-4 shadow-sm md:rounded-2xl md:p-8">
      <div className="mb-4 flex items-center gap-3 md:mb-6">
        <UserRound className="h-5 w-5 text-gray-700 md:h-6 md:w-6" />
        <h2 className="text-lg font-bold text-gray-900 md:text-xl">Profile</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4 md:space-y-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={isUploadingAvatar}
            className="group relative shrink-0"
          >
            <Avatar className="size-20 border border-gray-200">
              <AvatarImage
                src={avatarUrl ? withCloudinaryThumbnail(avatarUrl) : undefined}
                alt=""
              />
              <AvatarFallback className="bg-gray-100 text-xl font-semibold text-gray-500">
                {(displayName || profile?.email || "?").trim().charAt(0).toUpperCase()}
              </AvatarFallback>
            </Avatar>
            <span className="absolute inset-0 flex items-center justify-center rounded-full text-white opacity-0 transition-opacity group-hover:bg-black/40 group-hover:opacity-100">
              {isUploadingAvatar ? (
                <LoaderCircle className="h-5 w-5 animate-spin" />
              ) : (
                <Camera className="h-5 w-5" />
              )}
            </span>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void handleAvatarFile(file);
              }}
            />
          </button>

          <div className="flex-1 space-y-1 text-center sm:text-left">
            <p className="font-medium text-gray-900">{profile?.email ?? "—"}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {badge ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              ) : null}
              <span className="text-xs text-gray-500">
                {warehouseNames === null
                  ? "All warehouses"
                  : warehouseNames.length > 0
                    ? warehouseNames.join(", ")
                    : "No warehouse access"}
              </span>
            </div>
            <p className="text-xs text-gray-400">
              Joined {formatDate(profile?.createdAt ?? null)} · Last active{" "}
              {formatDate(profile?.lastSeenAt ?? null)}
            </p>
          </div>
        </div>

        <div className="max-w-sm">
          <label
            htmlFor="display-name"
            className="mb-2 block text-sm font-medium text-gray-700"
          >
            Display Name
          </label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-gray-200 px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-gray-800"
          />
        </div>

        {feedback ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isPending || isUploadingAvatar || !isDirty}
            className="flex items-center justify-center gap-2 rounded-xl bg-gray-900 px-6 py-3 font-medium text-white transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
          >
            {isPending ? (
              <>
                <LoaderCircle className="h-5 w-5 animate-spin" />
                Saving
              </>
            ) : (
              "Save Profile"
            )}
          </button>
        </div>
      </form>
    </section>
  );
}

export function InventorySettings({ profile }: { profile: UserProfile | null }) {
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

    // Supabase only enforces `current_password` server-side when the
    // project has GOTRUE_SECURITY_UPDATE_PASSWORD_REQUIRE_CURRENT_PASSWORD
    // enabled — otherwise updateUser() happily changes the password on the
    // strength of the active session alone. Verify it ourselves first so a
    // wrong current password is always rejected regardless of that setting.
    if (!requiresVerificationCode) {
      if (!profile?.email) {
        setUpdatingPassword(false);
        setPasswordFeedback({
          message: "Unable to verify your account email. Please refresh and try again.",
          type: "error",
        });
        return;
      }

      const { error: verifyError } = await supabase.auth.signInWithPassword({
        email: profile.email,
        password: currentPassword,
      });

      if (verifyError) {
        setUpdatingPassword(false);
        setPasswordFeedback({
          message: "The current password is incorrect.",
          type: "error",
        });
        return;
      }
    }

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
        <ProfileSection profile={profile} />

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
