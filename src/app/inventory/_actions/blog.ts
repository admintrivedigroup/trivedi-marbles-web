"use server";

import { revalidatePath } from "next/cache";

import { createClient } from "@/lib/supabase/server";

export type BlogPostFormData = {
  title: string;
  category: string;
  date: string;
  excerpt: string;
  cover_image: string;
  content: string[];
  published: boolean;
};

export type BlogActionResult =
  | { success: true; id: string }
  | { success: false; error: string };

export async function createBlogPost(
  data: BlogPostFormData,
): Promise<BlogActionResult> {
  const supabase = await createClient();

  const { data: row, error } = await supabase
    .from("blog_posts")
    .insert([sanitize(data)])
    .select("id")
    .single();

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/blog");
  return { success: true, id: row.id as string };
}

export async function updateBlogPost(
  id: string,
  data: BlogPostFormData,
): Promise<BlogActionResult> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("blog_posts")
    .update(sanitize(data))
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/blog");
  revalidatePath(`/blog/${id}`);
  return { success: true, id };
}

export async function deleteBlogPost(
  id: string,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase.from("blog_posts").delete().eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/blog");
  return { success: true };
}

export async function toggleBlogPostPublished(
  id: string,
  published: boolean,
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();

  const { error } = await supabase
    .from("blog_posts")
    .update({ published })
    .eq("id", id);

  if (error) return { success: false, error: error.message };

  revalidatePath("/inventory/journal");
  revalidatePath("/blog");
  revalidatePath(`/blog/${id}`);
  return { success: true };
}

function sanitize(data: BlogPostFormData) {
  return {
    title: data.title.trim(),
    category: (data.category ?? "").trim(),
    date: data.date,
    excerpt: (data.excerpt ?? "").trim(),
    cover_image: (data.cover_image ?? "").trim(),
    content: (data.content ?? []).map((p) => p.trim()).filter(Boolean),
    published: Boolean(data.published),
  };
}
