"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Bell, Camera, LoaderCircle, Lock, Moon, UserRound, X } from "lucide-react";

import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback, AvatarImage } from "@/app/inventory/_components/ui/avatar";
import { createClient } from "@/lib/supabase/client";
import { compressImage } from "@/lib/cloudinary/compress";
import { uploadToCloudinary, withCloudinaryThumbnail } from "@/lib/cloudinary/upload";
import { updateOwnProfile } from "@/app/inventory/_actions/profile";
import {
  updateLowStockThreshold,
  updateNotificationPreference,
} from "@/app/inventory/_actions/notifications";
import { useLookupOptions } from "@/app/inventory/_components/lookup-options-context";
import { ROLE_BADGE } from "@/app/inventory/_components/inventory-shell";
import { useInventoryTheme } from "@/app/inventory/_components/theme-provider";
import type { UserProfile } from "@/app/inventory/_lib/user-profile";

function Toggle({
  checked,
  onClick,
  disabled,
}: {
  checked: boolean;
  onClick?: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`h-8 w-14 rounded-full transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
        checked ? "bg-primary" : "bg-muted"
      }`}
    >
      <div
        className={`h-6 w-6 rounded-full bg-background shadow-md transition-transform ${
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
  const [confirmRemoveAvatar, setConfirmRemoveAvatar] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [feedback, setFeedback] = useState<FeedbackState>(null);

  useEffect(() => {
    if (!confirmRemoveAvatar) return;
    const timer = setTimeout(() => setConfirmRemoveAvatar(false), 3000);
    return () => clearTimeout(timer);
  }, [confirmRemoveAvatar]);

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
    setConfirmRemoveAvatar(false);
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

  function handleRemoveAvatarClick() {
    if (!confirmRemoveAvatar) {
      setConfirmRemoveAvatar(true);
      return;
    }
    setAvatarUrl("");
    setConfirmRemoveAvatar(false);
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
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-8">
      <div className="mb-4 flex items-center gap-3 md:mb-6">
        <UserRound className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
        <h2 className="text-lg font-bold text-foreground md:text-xl">Profile</h2>
      </div>

      <form onSubmit={handleSave} className="space-y-4 md:space-y-6">
        <div className="flex flex-col items-center gap-4 sm:flex-row">
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploadingAvatar}
              className="group relative block"
            >
              <Avatar className="size-20 border border-border">
                <AvatarImage
                  src={avatarUrl ? withCloudinaryThumbnail(avatarUrl) : undefined}
                  alt=""
                />
                <AvatarFallback className="bg-muted text-xl font-semibold text-muted-foreground">
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

            {avatarUrl && !isUploadingAvatar ? (
              <button
                type="button"
                onClick={handleRemoveAvatarClick}
                onBlur={() => setConfirmRemoveAvatar(false)}
                aria-label={
                  confirmRemoveAvatar
                    ? "Click again to confirm removing your profile picture"
                    : "Remove profile picture"
                }
                title={confirmRemoveAvatar ? "Click again to remove" : "Remove profile picture"}
                className={`absolute -right-1 -top-1 flex h-6 w-6 items-center justify-center rounded-full border shadow-sm transition-colors ${
                  confirmRemoveAvatar
                    ? "border-red-600 bg-red-600 text-white hover:bg-red-700"
                    : "border-border bg-card text-muted-foreground hover:bg-red-50 hover:text-red-600 dark:hover:bg-red-950/30 dark:hover:text-red-400"
                }`}
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}

            {confirmRemoveAvatar ? (
              <p className="absolute top-full left-1/2 mt-1 w-max -translate-x-1/2 text-xs font-medium text-red-600">
                Click again to remove
              </p>
            ) : null}
          </div>

          <div className="flex-1 space-y-1 text-center sm:text-left">
            <p className="font-medium text-foreground">{profile?.email ?? "—"}</p>
            <div className="flex flex-wrap items-center justify-center gap-2 sm:justify-start">
              {badge ? (
                <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${badge.className}`}>
                  {badge.label}
                </span>
              ) : null}
              <span className="text-xs text-muted-foreground">
                {warehouseNames === null
                  ? "All warehouses"
                  : warehouseNames.length > 0
                    ? warehouseNames.join(", ")
                    : "No warehouse access"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground">
              Joined {formatDate(profile?.createdAt ?? null)} · Last active{" "}
              {formatDate(profile?.lastSeenAt ?? null)}
            </p>
          </div>
        </div>

        <div className="max-w-sm">
          <label
            htmlFor="display-name"
            className="mb-2 block text-sm font-medium text-foreground"
          >
            Display Name
          </label>
          <Input
            id="display-name"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            placeholder="Your name"
            className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {feedback ? (
          <div
            className={`rounded-xl border px-4 py-3 text-sm ${
              feedback.type === "error"
                ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                : "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
            }`}
          >
            {feedback.message}
          </div>
        ) : null}

        <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
          <button
            type="submit"
            disabled={isPending || isUploadingAvatar || !isDirty}
            className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
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

function NotificationsSection({
  profile,
  initialLowStockThreshold,
}: {
  profile: UserProfile | null;
  initialLowStockThreshold: number | null;
}) {
  const [lowStockAlertsEnabled, setLowStockAlertsEnabled] = useState(
    profile?.lowStockAlertsEnabled ?? true,
  );
  const [isSavingPreference, setIsSavingPreference] = useState(false);

  const canEditThreshold = profile?.role === "admin" || profile?.role === "superadmin";
  const [threshold, setThreshold] = useState(String(initialLowStockThreshold ?? 5));
  const [thresholdFeedback, setThresholdFeedback] = useState<FeedbackState>(null);
  const [isSavingThreshold, setIsSavingThreshold] = useState(false);

  async function handleToggleLowStock() {
    const next = !lowStockAlertsEnabled;
    setLowStockAlertsEnabled(next);
    setIsSavingPreference(true);
    const res = await updateNotificationPreference(next);
    setIsSavingPreference(false);
    if (res.error) {
      setLowStockAlertsEnabled(!next);
    }
  }

  async function handleSaveThreshold(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setThresholdFeedback(null);

    const parsed = Number(threshold);
    if (!Number.isInteger(parsed) || parsed < 0) {
      setThresholdFeedback({ message: "Enter a whole number, 0 or greater.", type: "error" });
      return;
    }

    setIsSavingThreshold(true);
    const res = await updateLowStockThreshold(parsed);
    setIsSavingThreshold(false);

    if (res.error) {
      setThresholdFeedback({ message: res.error, type: "error" });
    } else {
      setThresholdFeedback({ message: "Threshold updated.", type: "success" });
    }
  }

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-8">
      <div className="mb-4 flex items-center gap-3 md:mb-6">
        <Bell className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
        <h2 className="text-lg font-bold text-foreground md:text-xl">
          Notifications
        </h2>
      </div>
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="font-medium text-foreground">Low Stock Alerts</p>
            <p className="text-sm text-muted-foreground">
              Get notified in the bell menu when a category is running low
            </p>
          </div>
          <Toggle
            checked={lowStockAlertsEnabled}
            onClick={handleToggleLowStock}
            disabled={isSavingPreference}
          />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4 opacity-60">
          <div>
            <p className="font-medium text-foreground">Reservation Reminders</p>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
          <Toggle checked={false} />
        </div>
        <div className="flex items-center justify-between border-t border-border pt-4 opacity-60">
          <div>
            <p className="font-medium text-foreground">Stock Movement Alerts</p>
            <p className="text-sm text-muted-foreground">Coming soon</p>
          </div>
          <Toggle checked={false} />
        </div>

        {canEditThreshold ? (
          <form
            onSubmit={handleSaveThreshold}
            className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-end"
          >
            <div className="max-w-40">
              <label
                htmlFor="low-stock-threshold"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Low stock threshold
              </label>
              <Input
                id="low-stock-threshold"
                type="number"
                min={0}
                step={1}
                value={threshold}
                onChange={(event) => setThreshold(event.target.value)}
                className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
              />
            </div>
            <button
              type="submit"
              disabled={isSavingThreshold}
              className="rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
            >
              {isSavingThreshold ? "Saving" : "Save"}
            </button>
            {thresholdFeedback ? (
              <p
                className={`text-sm ${
                  thresholdFeedback.type === "error"
                    ? "text-red-600 dark:text-red-400"
                    : "text-emerald-600 dark:text-emerald-400"
                }`}
              >
                {thresholdFeedback.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground sm:pb-3">
                Alerts fire when a category&apos;s available slabs in a warehouse drop to or below this number.
              </p>
            )}
          </form>
        ) : null}
      </div>
    </section>
  );
}

function AppearanceSection() {
  const { isDark, toggleDark } = useInventoryTheme();

  return (
    <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-8">
      <div className="mb-4 flex items-center gap-3 md:mb-6">
        <Moon className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
        <h2 className="text-lg font-bold text-foreground md:text-xl">Appearance</h2>
      </div>
      <div className="flex items-center justify-between">
        <div>
          <p className="font-medium text-foreground">Dark Mode</p>
          <p className="text-sm text-muted-foreground">
            Switch the inventory app to a dark color scheme
          </p>
        </div>
        <Toggle checked={isDark} onClick={toggleDark} />
      </div>
    </section>
  );
}

export function InventorySettings({
  profile,
  lowStockThreshold,
}: {
  profile: UserProfile | null;
  lowStockThreshold: number | null;
}) {
  const router = useRouter();
  const [supabase] = useState(() => createClient());
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
        <h1 className="mb-2 text-2xl font-bold text-foreground md:text-3xl">
          Settings
        </h1>
        <p className="text-muted-foreground">Manage your account and preferences</p>
      </div>

      <div className="max-w-4xl space-y-4 md:space-y-6">
        <ProfileSection profile={profile} />

        <section className="rounded-xl border border-border bg-card p-4 shadow-sm md:rounded-2xl md:p-8">
          <div className="mb-4 flex items-center gap-3 md:mb-6">
            <Lock className="h-5 w-5 text-muted-foreground md:h-6 md:w-6" />
            <h2 className="text-lg font-bold text-foreground md:text-xl">
              Security
            </h2>
          </div>

          <form onSubmit={handlePasswordSubmit} className="space-y-4 md:space-y-6">
            <div className="flex flex-col gap-4 md:grid md:grid-cols-2 md:gap-6">
              <div>
                <div className="mb-2 flex items-center justify-between gap-3">
                  <label
                    htmlFor="current-password"
                    className="block text-sm font-medium text-foreground"
                  >
                    Current Password
                  </label>
                  <Link
                    href="/inventory/forgot-password"
                    className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="new-password"
                  className="mb-2 block text-sm font-medium text-foreground"
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
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm-new-password"
                  className="mb-2 block text-sm font-medium text-foreground"
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
                  className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>

              {requiresVerificationCode ? (
                <div>
                  <div className="mb-2 flex items-center justify-between gap-3">
                    <label className="block text-sm font-medium text-foreground">
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
                      className="text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
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
                    className="w-full rounded-xl border border-border px-4 py-3 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-ring"
                  />
                </div>
              ) : null}
            </div>

            {passwordFeedback ? (
              <div
                className={`rounded-xl border px-4 py-3 text-sm ${
                  passwordFeedback.type === "error"
                    ? "border-red-200 bg-red-50 text-red-700 dark:border-red-900/50 dark:bg-red-950/30 dark:text-red-400"
                    : passwordFeedback.type === "success"
                      ? "border-emerald-200 bg-emerald-50 text-emerald-700 dark:border-emerald-900/50 dark:bg-emerald-950/30 dark:text-emerald-400"
                      : "border-blue-200 bg-blue-50 text-blue-700 dark:border-blue-900/50 dark:bg-blue-950/30 dark:text-blue-400"
                }`}
              >
                {passwordFeedback.message}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Use settings if you know your current password. If not, use the
                reset flow from login or the link above.
              </p>
            )}

            <div className="flex flex-col items-stretch gap-3 sm:flex-row sm:items-center">
              <button
                type="submit"
                disabled={updatingPassword}
                className="flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3 font-medium text-primary-foreground transition-all hover:scale-[1.02] hover:shadow-lg disabled:cursor-not-allowed disabled:opacity-70 disabled:hover:scale-100"
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

        <NotificationsSection profile={profile} initialLowStockThreshold={lowStockThreshold} />
        <AppearanceSection />
      </div>
    </div>
  );
}
