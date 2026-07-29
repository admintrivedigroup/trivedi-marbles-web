import { JournalManager } from "@/app/inventory/_components/journal-manager";
import { getJournalPosts } from "@/app/inventory/_lib/journal";
import { getJournalCategories } from "@/lib/journal/categories";
import { requireJournalManager } from "@/app/inventory/_lib/journal-auth";

export const metadata = {
  title: { absolute: "Journal | Trivedi Marbles" },
};

export default async function JournalPage() {
  await requireJournalManager();
  const [posts, categories] = await Promise.all([getJournalPosts(), getJournalCategories()]);

  return <JournalManager initialPosts={posts} categories={categories} />;
}
