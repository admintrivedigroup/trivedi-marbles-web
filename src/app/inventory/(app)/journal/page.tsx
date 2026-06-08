import { JournalManager } from "@/app/inventory/_components/journal-manager";
import { getBlogPosts } from "@/app/inventory/_lib/blog";

export const metadata = {
  title: "Journal | Trivedi Marbles",
};

export default async function JournalPage() {
  const posts = await getBlogPosts();

  return <JournalManager initialPosts={posts} />;
}
