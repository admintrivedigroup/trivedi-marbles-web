import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { JournalCategory } from "./types";

/**
 * Categories live in the journal_categories table (not a hardcoded array) so
 * the list can change without a code deploy.
 */
export async function getJournalCategories(): Promise<JournalCategory[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("journal_categories")
    .select("id, name, slug, sort_order")
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as JournalCategory[];
}
