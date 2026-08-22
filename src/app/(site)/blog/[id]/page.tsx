import { notFound, permanentRedirect } from "next/navigation";

import { getJournalSlugById } from "@/lib/journal";

type BlogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const slug = await getJournalSlugById(id);

  if (!slug) {
    notFound();
  }

  permanentRedirect(`/journal/${slug}`);
}
