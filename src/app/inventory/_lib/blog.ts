import { createClient } from "@/lib/supabase/server";

export type BlogPost = {
  id: string;
  title: string;
  category: string;
  date: string; // ISO date: YYYY-MM-DD
  excerpt: string;
  cover_image: string;
  content: string[];
  published: boolean;
  created_at: string;
  updated_at: string;
};

export async function getBlogPosts(): Promise<BlogPost[]> {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("blog_posts")
    .select("*")
    .order("date", { ascending: false });

  if (error) throw new Error(error.message);
  return (data ?? []) as BlogPost[];
}
