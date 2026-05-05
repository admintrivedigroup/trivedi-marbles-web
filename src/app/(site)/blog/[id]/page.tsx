import { notFound } from "next/navigation";

import { blogPosts } from "@/data/blog";

type BlogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const post = blogPosts.find((entry) => entry.id === Number(id));

  if (!post) {
    notFound();
  }

  return (
    <article className="mx-auto max-w-5xl px-6 py-24">
      <p className="text-sm uppercase tracking-[0.3em] text-accent">
        {post.category}
      </p>
      <h1 className="mt-6 font-serif text-5xl leading-tight text-primary">
        {post.title}
      </h1>
      <p className="mt-4 text-sm uppercase tracking-[0.2em] text-muted-foreground">
        {post.date}
      </p>
      <div className="mt-10 overflow-hidden bg-gray-100 shadow-xl">
        <img src={post.image} alt={post.title} className="aspect-[16/9] w-full object-cover" />
      </div>
      <p className="mt-10 max-w-3xl text-lg leading-8 text-muted-foreground">
        {post.excerpt}
      </p>
      <p className="mt-6 max-w-3xl leading-8 text-muted-foreground">
        Send the individual blog detail page design if you want this route to match
        the Figma layout instead of using this placeholder article template.
      </p>
    </article>
  );
}
