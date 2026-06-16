import type { MetadataRoute } from "next";

import { marbles } from "@/data/marbles";
import { getPublishedBlogPosts } from "@/lib/blog";
import { getWebsiteLots } from "@/lib/supabase/collection";

const BASE_URL = "https://www.trivedimarbles.co.in";

const STATIC_ROUTES: MetadataRoute.Sitemap = [
  { url: `${BASE_URL}/`, priority: 1.0, changeFrequency: "weekly" },
  { url: `${BASE_URL}/collection`, priority: 0.9, changeFrequency: "daily" },
  { url: `${BASE_URL}/projects`, priority: 0.8, changeFrequency: "monthly" },
  { url: `${BASE_URL}/about`, priority: 0.7, changeFrequency: "monthly" },
  { url: `${BASE_URL}/blog`, priority: 0.7, changeFrequency: "weekly" },
  { url: `${BASE_URL}/contact`, priority: 0.6, changeFrequency: "yearly" },
  { url: `${BASE_URL}/products`, priority: 0.6, changeFrequency: "monthly" },
];

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  // Static curated marble pages (from local data)
  const marbleRoutes: MetadataRoute.Sitemap = marbles.map((marble) => ({
    url: `${BASE_URL}/collection/${marble.id}`,
    priority: 0.8,
    changeFrequency: "monthly" as const,
  }));

  // Live inventory lot pages (from Supabase)
  const [lots, blogPosts] = await Promise.all([
    getWebsiteLots(),
    getPublishedBlogPosts(),
  ]);

  const lotRoutes: MetadataRoute.Sitemap = lots.map((lot) => ({
    url: `${BASE_URL}/collection/${lot.id}`,
    priority: 0.7,
    changeFrequency: "weekly" as const,
  }));

  // Blog post pages (from Supabase)
  const blogRoutes: MetadataRoute.Sitemap = blogPosts.map((post) => ({
    url: `${BASE_URL}/blog/${post.id}`,
    lastModified: new Date(post.date),
    priority: 0.6,
    changeFrequency: "monthly" as const,
  }));

  return [...STATIC_ROUTES, ...marbleRoutes, ...lotRoutes, ...blogRoutes];
}
