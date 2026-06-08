"use client";

import Link from "next/link";
import { useActionState } from "react";
import { ArrowLeft, LoaderCircle, Mail, ShieldCheck } from "lucide-react";

import { forgotPassword } from "@/app/inventory/_actions/auth";
import { initialForgotPasswordActionState } from "@/app/inventory/_actions/auth-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function InventoryForgotPasswordForm() {
  const [state, formAction, pending] = useActionState(
    forgotPassword,
    initialForgotPasswordActionState,
  );

  return (
    <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_24px_72px_rgba(15,23,42,0.14)] ring-1 ring-stone-200/80 md:rounded-[2rem] md:p-8">
      <div className="mb-6 text-center md:mb-8">
        <div className="mb-4 inline-flex size-16 items-center justify-center rounded-2xl bg-stone-100 text-stone-700">
          <ShieldCheck className="size-8" />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">
          Reset inventory password
        </h1>
        <p className="mt-2 text-sm text-stone-500 md:text-base">
          Enter your login email and we will send a password reset link.
        </p>
      </div>

      <form action={formAction} className="space-y-4 md:space-y-5">
        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block text-sm font-medium text-stone-700"
          >
            Email Address
          </label>
          <div className="relative">
            <Mail className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="Enter your email address"
              className="h-12 rounded-xl border-stone-200 bg-white pl-11 pr-4 text-sm shadow-none md:h-13"
              required
            />
          </div>
        </div>

        {state.error ? (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        {state.success ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            If an inventory account exists for that email, a reset link has been sent.
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[linear-gradient(90deg,#1f2937_0%,#4b5563_100%)] text-sm font-medium text-white shadow-none transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Sending Reset Link
            </>
          ) : (
            "Send Reset Link"
          )}
        </Button>
      </form>

      <div className="mt-6 flex justify-center">
        <Link
          href="/inventory/login"
          className="inline-flex items-center gap-2 text-sm font-medium text-stone-600 transition-colors hover:text-stone-900"
        >
          <ArrowLeft className="size-4" />
          Back to login
        </Link>
      </div>
    </div>
  );
}
