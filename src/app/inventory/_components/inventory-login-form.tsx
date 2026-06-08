"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { LoaderCircle, Lock, Mail, ShieldCheck } from "lucide-react";

import { login } from "@/app/inventory/_actions/auth";
import { initialLoginActionState } from "@/app/inventory/_actions/auth-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type InventoryLoginFormProps = {
  next?: string;
};

export function InventoryLoginForm({ next }: InventoryLoginFormProps) {
  const searchParams = useSearchParams();
  const [state, formAction, pending] = useActionState(
    login,
    initialLoginActionState,
  );
  const passwordUpdated = searchParams.get("passwordUpdated") === "1";

  return (
    <div className="rounded-[1.75rem] bg-white p-6 shadow-[0_24px_72px_rgba(15,23,42,0.14)] ring-1 ring-stone-200/80 md:rounded-[2rem] md:p-8">
      <div className="mb-6 text-center md:mb-8">
        <div className="mb-4 inline-flex items-center justify-center">
          <Image
            src="/images/vijay-trivedi-logo.webp"
            alt="Trivedi Marbles logo"
            width={96}
            height={96}
            className="h-16 w-16 object-contain md:h-20 md:w-20"
          />
        </div>
        <h1 className="text-2xl font-bold text-stone-900 md:text-3xl">
          Vijay Trivedi Group
        </h1>
        <p className="mt-2 text-sm text-stone-500 md:text-base">
          Marble Inventory
        </p>
      </div>

      <form action={formAction} className="space-y-4 md:space-y-5">
        {next && <input type="hidden" name="next" value={next} />}
        {passwordUpdated ? (
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Password updated. Sign in with your new password.
          </div>
        ) : null}

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
              placeholder="admin@marble.com"
              className="h-12 rounded-xl border-stone-200 bg-white pl-11 pr-4 text-sm shadow-none md:h-13"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <label
            htmlFor="password"
            className="block text-sm font-medium text-stone-700"
          >
            Password
          </label>
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs text-stone-500">
              Use your inventory account password
            </span>
            <Link
              href="/inventory/forgot-password"
              className="text-xs font-medium text-stone-700 transition-colors hover:text-stone-900"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative">
            <Lock className="pointer-events-none absolute left-3 top-1/2 size-5 -translate-y-1/2 text-stone-400" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
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

        <Button
          type="submit"
          className="h-12 w-full rounded-xl bg-[linear-gradient(90deg,#1f2937_0%,#4b5563_100%)] text-sm font-medium text-white shadow-none transition-all duration-200 hover:scale-[1.02] hover:shadow-lg disabled:hover:scale-100"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Signing In
            </>
          ) : (
            "Sign In Securely"
          )}
        </Button>
      </form>

      <div className="mt-6 flex items-center justify-center gap-2 text-sm text-stone-500">
        <ShieldCheck className="size-4" />
        <p>Secure encrypted connection</p>
      </div>
    </div>
  );
}
