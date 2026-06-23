"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";
import type { LoginActionState, ForgotPasswordActionState } from "@/app/inventory/_actions/auth-state";

export async function login(
  _previousState: LoginActionState,
  formData: FormData,
): Promise<LoginActionState> {
  const email = String(formData.get("email") ?? "").trim();
  const password = String(formData.get("password") ?? "");

  if (!email || !password) {
    return {
      error: "Email and password are required.",
    };
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email,
    password,
  });

  if (error) {
    return {
      error: "Unable to sign in with those credentials.",
    };
  }

  revalidatePath("/inventory", "layout");
  const next = String(formData.get("next") ?? "").trim();
  const safePath = next.startsWith("/inventory/") ? next : "/inventory/dashboard";
  redirect(safePath);
}

export async function logout() {
  const supabase = await createClient();

  await supabase.auth.signOut();

  revalidatePath("/inventory", "layout");
  redirect("/inventory/login");
}

export async function forgotPassword(
  _previousState: ForgotPasswordActionState,
  formData: FormData,
): Promise<ForgotPasswordActionState> {
  const email = String(formData.get("email") ?? "").trim();

  if (!email) {
    return { error: "Enter the email address used for inventory access.", success: false };
  }

  const siteUrl = (process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000").replace(/\/$/, "");
  const redirectTo = `${siteUrl}/inventory/reset-password`;

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo });

  if (error) {
    return {
      error: error.message || "Unable to send a reset link right now. Please try again.",
      success: false,
    };
  }

  return { error: null, success: true };
}
