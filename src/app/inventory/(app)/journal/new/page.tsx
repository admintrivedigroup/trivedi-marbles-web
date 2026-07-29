import { requireJournalManager } from "@/app/inventory/_lib/journal-auth";
import { getJournalCategories } from "@/lib/journal/categories";
import { getJournalPosts, getRelatedArticleOptions, getRelatedProductOptions } from "@/app/inventory/_lib/journal";
import { PostEditorForm } from "@/app/inventory/_components/journal/post-editor-form";

export const metadata = { title: { absolute: "New Post | Journal | Trivedi Marbles" } };

export default async function NewJournalPostPage() {
  await requireJournalManager();
  const [categories, productOptions, articleOptions, posts] = await Promise.all([
    getJournalCategories(),
    getRelatedProductOptions(),
    getRelatedArticleOptions(),
    getJournalPosts(),
  ]);
  const existingSlugs = posts.map((post) => post.slug).filter((slug): slug is string => Boolean(slug));

  return (
    <PostEditorForm
      post={null}
      categories={categories}
      productOptions={productOptions}
      articleOptions={articleOptions}
      existingSlugs={existingSlugs}
    />
  );
}
