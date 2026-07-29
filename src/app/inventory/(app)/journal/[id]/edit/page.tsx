import { notFound } from "next/navigation";

import { requireJournalManager } from "@/app/inventory/_lib/journal-auth";
import { getJournalCategories } from "@/lib/journal/categories";
import {
  getJournalPostById,
  getJournalPosts,
  getRelatedArticleOptions,
  getRelatedProductOptions,
} from "@/app/inventory/_lib/journal";
import { PostEditorForm } from "@/app/inventory/_components/journal/post-editor-form";

export const metadata = { title: { absolute: "Edit Post | Journal | Trivedi Marbles" } };

export default async function EditJournalPostPage({ params }: { params: Promise<{ id: string }> }) {
  await requireJournalManager();
  const { id } = await params;

  const [post, categories, productOptions, articleOptions, posts] = await Promise.all([
    getJournalPostById(id),
    getJournalCategories(),
    getRelatedProductOptions(),
    getRelatedArticleOptions(id),
    getJournalPosts(),
  ]);

  if (!post) notFound();

  const existingSlugs = posts
    .filter((p) => p.id !== id)
    .map((p) => p.slug)
    .filter((slug): slug is string => Boolean(slug));

  return (
    <PostEditorForm
      post={post}
      categories={categories}
      productOptions={productOptions}
      articleOptions={articleOptions}
      existingSlugs={existingSlugs}
    />
  );
}
