const SUPABASE_URL_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_URL",
  "VITE_SUPABASE_URL",
] as const;

const SUPABASE_ANON_KEY_ENV_NAMES = [
  "NEXT_PUBLIC_SUPABASE_ANON_KEY",
  "VITE_SUPABASE_ANON_KEY",
] as const;

function getFirstEnvValue(envNames: readonly string[]) {
  for (const envName of envNames) {
    const value = process.env[envName]?.trim();

    if (value) {
      return value;
    }
  }

  return undefined;
}

function ensureValidHttpUrl(url: string) {
  let parsedUrl: URL;

  try {
    parsedUrl = new URL(url);
  } catch {
    throw new Error(
      `Invalid Supabase URL: "${url}". Set NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL to a valid HTTP or HTTPS URL.`,
    );
  }

  if (parsedUrl.protocol !== "http:" && parsedUrl.protocol !== "https:") {
    throw new Error(
      `Invalid Supabase URL protocol: "${parsedUrl.protocol}". Use http:// or https://.`,
    );
  }

  return parsedUrl.origin;
}

export function getSupabaseConfig() {
  const supabaseUrl = getFirstEnvValue(SUPABASE_URL_ENV_NAMES);
  const supabaseAnonKey = getFirstEnvValue(SUPABASE_ANON_KEY_ENV_NAMES);

  if (!supabaseUrl) {
    console.error(
      "Missing Supabase URL. Add NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL to .env.local and restart the dev server.",
    );
    throw new Error(
      "Missing Supabase URL. Set NEXT_PUBLIC_SUPABASE_URL or VITE_SUPABASE_URL in your environment.",
    );
  }

  if (!supabaseAnonKey) {
    console.error(
      "Missing Supabase anon key. Add NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY to .env.local and restart the dev server.",
    );
    throw new Error(
      "Missing Supabase anon key. Set NEXT_PUBLIC_SUPABASE_ANON_KEY or VITE_SUPABASE_ANON_KEY in your environment.",
    );
  }

  return {
    url: ensureValidHttpUrl(supabaseUrl),
    anonKey: supabaseAnonKey,
  };
}
