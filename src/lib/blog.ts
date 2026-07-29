import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/blog-shared";
import type { ContentBlock } from "@/lib/journal/types";

export type { BlogPost } from "@/lib/blog-shared";
export { formatBlogDate } from "@/lib/blog-shared";

/**
 * Legacy compatibility layer for the pre-existing /blog and /blog/[id] public
 * routes, kept working unchanged while the new canonical /journal/[slug]
 * route is built out separately (dark, not yet linked/sitemapped). Reads
 * from the same journal_posts table (renamed from blog_posts) and flattens
 * the new JSON block content back into plain paragraphs — lossless for the
 * pre-existing posts, which are 100% paragraph blocks after migration.
 */
function blocksToParagraphs(content: unknown): string[] {
  if (!Array.isArray(content)) return [];
  return (content as ContentBlock[])
    .filter((block): block is Extract<ContentBlock, { type: "paragraph" }> => block.type === "paragraph")
    .map((block) => block.data.text)
    .filter(Boolean);
}

function mapRow(row: Record<string, unknown>): BlogPost {
  return {
    id: String(row.id),
    title: String(row.title ?? ""),
    category: String(row.category ?? ""),
    date: String(row.date ?? ""),
    excerpt: String(row.excerpt ?? ""),
    cover_image: String(row.cover_image_url ?? ""),
    content: blocksToParagraphs(row.content),
    published: row.status === "published",
    created_at: String(row.created_at ?? ""),
  };
}

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("journal_posts")
      .select("*")
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .order("date", { ascending: false });

    if (error || !data) return [];
    return data.map((row) => mapRow(row as Record<string, unknown>));
  } catch {
    return [];
  }
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("journal_posts")
      .select("*")
      .eq("id", id)
      .eq("status", "published")
      .lte("published_at", new Date().toISOString())
      .single();

    if (error || !data) return null;
    return mapRow(data as Record<string, unknown>);
  } catch {
    return null;
  }
}
