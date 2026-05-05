import "client-only";

import {
  createClient,
  type SupabaseClient,
} from "@supabase/supabase-js";

function ensureValidHttpUrl(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    console.error(
      "[Supabase] Invalid VITE_SUPABASE_URL. Set it in .env.local to a valid http:// or https:// URL and restart the dev server.",
    );
    throw new Error("Invalid VITE_SUPABASE_URL.");
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    console.error(
      `[Supabase] Invalid VITE_SUPABASE_URL protocol: "${parsedUrl.protocol}". Use http:// or https:// and restart the dev server.`,
    );
    throw new Error("Invalid VITE_SUPABASE_URL protocol.");
  }

  return parsedUrl.origin;
}

function getSupabaseBrowserConfig() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.trim();
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim();

  if (!supabaseUrl) {
    console.error(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_URL. It is mapped from VITE_SUPABASE_URL in .env.local. Restart the dev server after changing env values.",
    );
    return null;
  }

  if (!supabaseAnonKey) {
    console.error(
      "[Supabase] Missing NEXT_PUBLIC_SUPABASE_ANON_KEY. It is mapped from VITE_SUPABASE_ANON_KEY in .env.local. Restart the dev server after changing env values.",
    );
    return null;
  }

  return {
    url: ensureValidHttpUrl(supabaseUrl),
    anonKey: supabaseAnonKey,
  };
}

let supabaseClient: SupabaseClient | null = null;

export function getSupabaseClient() {
  if (supabaseClient) {
    return supabaseClient;
  }

  let config: ReturnType<typeof getSupabaseBrowserConfig>;

  try {
    config = getSupabaseBrowserConfig();
  } catch (error) {
    console.error("[Supabase] Failed to create browser client.", error);
    return null;
  }

  if (!config) {
    return null;
  }

  supabaseClient = createClient(config.url, config.anonKey);

  return supabaseClient;
}

export const supabase = getSupabaseClient();
