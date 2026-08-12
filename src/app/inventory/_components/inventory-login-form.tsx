"use client";

import Image from "next/image";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useActionState } from "react";
import { LoaderCircle, Lock, Mail } from "lucide-react";

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
    <div className="relative rounded-[3px] bg-[#f2ece0] p-6 shadow-[0_40px_70px_rgba(0,0,0,0.45)] before:absolute before:inset-x-0 before:top-0 before:h-[3px] before:bg-[linear-gradient(90deg,#b3874a_0%,#dcbc8a_50%,#b3874a_100%)] md:p-8">
      <div className="mb-7 text-center md:mb-9">
        <div className="mb-4 inline-flex items-center justify-center gap-3">
          <Image
            src="/images/vijay-trivedi-logo.webp"
            alt="Vijay Trivedi Group logo"
            width={96}
            height={96}
            className="h-16 w-16 shrink-0 object-contain md:h-20 md:w-20"
          />
          <span className="h-16 w-px shrink-0 bg-[#241c15]/15 md:h-20" aria-hidden="true" />
          <Image
            src="/images/trivedi marbles pvt ltd login page.webp"
            alt="Trivedi Marbles Pvt. Ltd. logo"
            width={500}
            height={500}
            className="h-20 w-20 shrink-0 object-contain md:h-24 md:w-24"
          />
        </div>
        <h1 className="font-serif text-2xl font-normal tracking-[0.02em] text-[#241c15] md:text-3xl">
          Vijay Trivedi Group
        </h1>
        <p className="mt-2 font-serif text-sm italic tracking-[0.01em] text-[#b3874a] md:text-base">
          Marble Inventory — Authorized Access
        </p>
      </div>

      <form action={formAction} className="space-y-5 md:space-y-6">
        {next && <input type="hidden" name="next" value={next} />}
        {passwordUpdated ? (
          <div className="rounded-[3px] border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            Password updated. Sign in with your new password.
          </div>
        ) : null}

        <div className="space-y-2">
          <label
            htmlFor="email"
            className="block font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[#7d715f]"
          >
            Email Address
          </label>
          <div className="relative border-b-[1.5px] border-[#241c15]/15 pb-2 transition-colors focus-within:border-[#b3874a]">
            <Mail className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-[#b3874a]" />
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="you@trivedigranimarmo.com"
              className="h-auto rounded-none border-0 bg-transparent py-0 pl-6 pr-0 text-sm text-[#241c15] shadow-none placeholder:text-[#7d715f]/70 focus-visible:border-transparent focus-visible:ring-0"
              required
            />
          </div>
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor="password"
              className="block font-mono text-[0.66rem] uppercase tracking-[0.14em] text-[#7d715f]"
            >
              Password
            </label>
            <Link
              href="/inventory/forgot-password"
              className="font-mono text-[0.66rem] uppercase tracking-[0.06em] text-[#b3874a] transition-colors hover:text-[#241c15]"
            >
              Forgot?
            </Link>
          </div>
          <div className="relative border-b-[1.5px] border-[#241c15]/15 pb-2 transition-colors focus-within:border-[#b3874a]">
            <Lock className="pointer-events-none absolute left-0 top-1/2 size-4 -translate-y-1/2 text-[#b3874a]" />
            <Input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Enter your password"
              className="h-auto rounded-none border-0 bg-transparent py-0 pl-6 pr-0 text-sm text-[#241c15] shadow-none placeholder:text-[#7d715f]/70 focus-visible:border-transparent focus-visible:ring-0"
              required
            />
          </div>
        </div>

        {state.error ? (
          <div className="rounded-[3px] border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            {state.error}
          </div>
        ) : null}

        <Button
          type="submit"
          className="h-auto w-full rounded-none bg-[#241c15] py-3.5 font-mono text-[0.74rem] uppercase tracking-[0.16em] text-[#f2ece0] shadow-none transition-colors duration-200 hover:bg-[#b3874a] hover:text-[#241c15]"
          disabled={pending}
        >
          {pending ? (
            <>
              <LoaderCircle className="size-4 animate-spin" />
              Signing In
            </>
          ) : (
            "Sign In"
          )}
        </Button>
      </form>

      <div className="mt-7 flex items-center justify-center gap-3">
        <span className="h-px w-6 bg-[#241c15]/15" aria-hidden="true" />
        <p className="font-mono text-[0.62rem] uppercase tracking-[0.14em] text-[#7d715f]">
          Encrypted Connection
        </p>
        <span className="h-px w-6 bg-[#241c15]/15" aria-hidden="true" />
      </div>
    </div>
  );
}
