/**
 * One-off report: maps the pre-existing journal posts' legacy /blog/{uuid}
 * URLs to their new (backfilled) /journal/{slug} URLs, and flags any post
 * whose category doesn't match the new controlled taxonomy.
 *
 * Run this AFTER applying migrations/upgrade_journal_posts.sql.
 * Does not modify any data and does not activate any redirects — reporting
 * only, per "do not activate redirects until replacement articles are
 * approved."
 *
 * Usage:
 *   node scripts/journal-migration-report.mjs
 *
 * Reads Supabase URL + service role key from .env.local automatically.
 */

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createClient } from "@supabase/supabase-js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, "..");
const BASE_URL = "https://www.trivedimarbles.co.in";

const CANONICAL_CATEGORIES = new Set([
  "Ambaji Marble",
  "Marble Selection Guides",
  "Applications & Design",
  "Finishes & Processing",
  "Care & Maintenance",
  "Architecture & Heritage",
  "Company & Quarry Stories",
  "Industry News",
]);

function loadEnvLocal() {
  const envPath = path.join(ROOT, ".env.local");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq < 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const val = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = val;
  }
}

loadEnvLocal();

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.VITE_SUPABASE_URL;
const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !serviceRoleKey) {
  console.error("Missing Supabase URL or SUPABASE_SERVICE_ROLE_KEY in .env.local.");
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const { data, error } = await supabase
  .from("journal_posts")
  .select("id, title, slug, category, status")
  .order("created_at", { ascending: true });

if (error) {
  console.error("Failed to fetch journal_posts:", error.message);
  process.exit(1);
}

console.log("| Title | Old URL | New URL | Category |");
console.log("|---|---|---|---|");
for (const post of data ?? []) {
  const oldUrl = `${BASE_URL}/blog/${post.id}`;
  const newUrl = post.slug ? `${BASE_URL}/journal/${post.slug}` : "(no slug yet)";
  const categoryFlag = CANONICAL_CATEGORIES.has(post.category) ? post.category : `${post.category} ⚠ needs review`;
  console.log(`| ${post.title} | ${oldUrl} | ${newUrl} | ${categoryFlag} |`);
}

console.log(`\n${(data ?? []).length} post(s). Redirects are NOT activated — this is a report only.`);
