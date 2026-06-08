import "server-only";

import { createClient } from "@/lib/supabase/server";
import type { BlogPost } from "@/lib/blog-shared";

export type { BlogPost } from "@/lib/blog-shared";
export { formatBlogDate } from "@/lib/blog-shared";

export async function getPublishedBlogPosts(): Promise<BlogPost[]> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("published", true)
      .order("date", { ascending: false });

    if (error || !data) return [];
    return data as BlogPost[];
  } catch {
    return [];
  }
}

export async function getBlogPostById(id: string): Promise<BlogPost | null> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("blog_posts")
      .select("*")
      .eq("id", id)
      .eq("published", true)
      .single();

    if (error || !data) return null;
    return data as BlogPost;
  } catch {
    return null;
  }
}
