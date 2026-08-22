import type { MetadataRoute } from "next";

import { marbles } from "@/data/marbles";
import { getPublishedJournalPosts } from "@/lib/journal";
import { getJournalSitemapEntries } from "@/lib/journal/sitemap";
import { getWebsiteLots } from "@/lib/supabase/collection";

const BASE_URL = "https://www.trivedimarbles.co.in";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, priority: 1.0, changeFrequency: "weekly" },
  { url: `${BASE_URL}/collection`, priority: 0.9, changeFrequency: "daily" },
  { url: `${BASE_URL}/projects`, priority: 0.8, changeFrequency: "monthly" },
  { url: `${BASE_URL}/about`, priority: 0.7, changeFrequency: "monthly" },
  { url: `${BASE_URL}/journal`, priority: 0.7, changeFrequency: "weekly" },
  { url: `${BASE_URL}/contact`, priority: 0.6, changeFrequency: "yearly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static curated marble pages (from local data)
  const marbleRoutes: MetadataRoute.Sitemap = marbles.map((marble) => ({
    url: `${BASE_URL}/collection/${marble.id}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  // Live inventory lot pages (from Supabase)
  const [lots, journalPosts] = await Promise.all([
    getWebsiteLots(),
    getPublishedJournalPosts(),
  ]);

  const lotRoutes: MetadataRoute.Sitemap = lots.map((lot) => ({
    url: `${BASE_URL}/collection/${lot.id}`,
    priority: 0.7,
    changeFrequency: "weekly" as const,
  }));

  // Journal post pages (from Supabase)
  const journalRoutes = await getJournalSitemapEntries(journalPosts);

  return [...STATIC_ROUTES, ...marbleRoutes, ...lotRoutes, ...journalRoutes];
}
