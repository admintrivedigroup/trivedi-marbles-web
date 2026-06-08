"use client";

import { createBrowserClient } from "@supabase/ssr";

function getRequiredClientEnv(name: string, value: string | undefined) {
  const normalizedValue = value?.trim();

  if (!normalizedValue) {
    throw new Error(`Missing ${name}. Restart the dev server after updating .env.local.`);
  }

  return normalizedValue;
}

export function createClient() {
  const url = getRequiredClientEnv(
    "NEXT_PUBLIC_SUPABASE_URL",
    process.env.NEXT_PUBLIC_SUPABASE_URL,
  );
  const anonKey = getRequiredClientEnv(
    "NEXT_PUBLIC_SUPABASE_ANON_KEY",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
  );

  return createBrowserClient(new URL(url).origin, anonKey);
}
