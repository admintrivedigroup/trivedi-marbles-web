import Link from "next/link";
import Image from "next/image";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight } from "lucide-react";
import type { Metadata } from "next";

import { FadeIn } from "@/components/animations/FadeIn";
import {
  getBlogPostById,
  getPublishedBlogPosts,
  formatBlogDate,
} from "@/lib/blog";

export const revalidate = 3600;
export const dynamicParams = true;

type BlogDetailPageProps = {
  params: Promise<{
    id: string;
  }>;
};

export async function generateMetadata({ params }: BlogDetailPageProps): Promise<Metadata> {
  const { id } = await params;
  const post = await getBlogPostById(id);
  if (!post) return {};
  const ogImage = post.cover_image
    ? [{ url: post.cover_image, width: 1200, height: 800, alt: post.title }]
    : undefined;
  return {
    title: `${post.title} — The Journal`,
    description: post.excerpt,
    alternates: { canonical: `/blog/${id}` },
    openGraph: {
      title: `${post.title} — The Journal`,
      description: post.excerpt,
      url: `/blog/${id}`,
      type: "article",
      publishedTime: post.date,
      images: ogImage,
    },
    twitter: {
      card: "summary_large_image",
      title: `${post.title} — The Journal`,
      description: post.excerpt,
      images: post.cover_image ? [post.cover_image] : undefined,
    },
  };
}

export default async function BlogDetailPage({ params }: BlogDetailPageProps) {
  const { id } = await params;
  const [post, allPosts] = await Promise.all([
    getBlogPostById(id),
    getPublishedBlogPosts(),
  ]);

  if (!post) {
    notFound();
  }

  const currentIndex = allPosts.findIndex((p) => p.id === post.id);
  const prevPost = allPosts[currentIndex + 1] ?? null;
  const nextPost = allPosts[currentIndex - 1] ?? null;
  const relatedPosts = allPosts
    .filter((p) => p.id !== post.id && p.category === post.category)
    .slice(0, 2);
  const fallbackPosts = allPosts.filter((p) => p.id !== post.id).slice(0, 2);
  const suggestedPosts = relatedPosts.length > 0 ? relatedPosts : fallbackPosts;

  const articleSchema = {
    "@context": "https://schema.org",
    "@type": "Article",
    headline: post.title,
    description: post.excerpt,
    datePublished: post.date,
    ...(post.cover_image && { image: post.cover_image }),
    author: {
      "@type": "Organization",
      name: "Trivedi Marbles Pvt Ltd",
      url: "https://www.trivedimarbles.co.in",
    },
    publisher: {
      "@type": "Organization",
      name: "Trivedi Marbles Pvt Ltd",
      logo: {
        "@type": "ImageObject",
        url: "https://www.trivedimarbles.co.in/images/vijay-trivedi-logo.webp",
      },
    },
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(articleSchema) }}
      />
    <div className="min-h-screen w-full bg-background">
      {/* Hero */}
      <div className="relative flex h-[65vh] items-end overflow-hidden">
        <Image
          src={post.cover_image}
          alt={post.title}
          fill
          className="object-cover"
          priority
        />
        <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />
        <div className="relative z-10 w-full px-6 pb-12 md:px-12 lg:px-24">
          <FadeIn>
            <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
              {post.category}
            </span>
            <h1 className="max-w-4xl font-serif text-4xl leading-tight text-white md:text-5xl lg:text-6xl">
              {post.title}
            </h1>
            <p className="mt-4 text-sm uppercase tracking-widest text-white/60">
              {formatBlogDate(post.date)}
            </p>
          </FadeIn>
        </div>
      </div>

      {/* Article body */}
      <div className="mx-auto max-w-3xl px-6 py-16 md:px-12 lg:px-0">
        <FadeIn>
          {/* Back link */}
          <Link
            href="/blog"
            className="mb-12 flex items-center gap-2 text-sm uppercase tracking-wider text-muted-foreground transition-colors hover:text-primary"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to Journal
          </Link>

          {/* Lead paragraph */}
          <p className="mb-10 border-l-2 border-secondary pl-6 font-serif text-xl leading-relaxed text-primary md:text-2xl">
            {post.excerpt}
          </p>

          {/* Body */}
          <div className="space-y-6 text-[1.0625rem] leading-8 text-muted-foreground">
            {post.content.map((paragraph, index) => (
              <p key={index}>{paragraph}</p>
            ))}
          </div>

          {/* Divider */}
          <div className="my-16 h-px w-full bg-border/40" />

          {/* Prev / Next navigation */}
          <div className="flex flex-col gap-6 sm:flex-row sm:justify-between">
            {prevPost ? (
              <Link
                href={`/blog/${prevPost.id}`}
                className="group flex max-w-xs flex-col gap-1 text-left"
              >
                <span className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-secondary">
                  <ArrowLeft className="h-3 w-3" /> Previous
                </span>
                <span className="font-serif text-lg text-primary transition-colors group-hover:text-secondary">
                  {prevPost.title}
                </span>
              </Link>
            ) : <div />}
            {nextPost ? (
              <Link
                href={`/blog/${nextPost.id}`}
                className="group flex max-w-xs flex-col gap-1 text-right sm:items-end"
              >
                <span className="flex items-center gap-1 text-xs uppercase tracking-widest text-muted-foreground transition-colors group-hover:text-secondary">
                  Next <ArrowRight className="h-3 w-3" />
                </span>
                <span className="font-serif text-lg text-primary transition-colors group-hover:text-secondary">
                  {nextPost.title}
                </span>
              </Link>
            ) : <div />}
          </div>
        </FadeIn>
      </div>

      {/* More articles */}
      {suggestedPosts.length > 0 ? (
        <section className="border-t border-border bg-white px-6 py-20 md:px-12 lg:px-24">
          <div className="mx-auto max-w-7xl">
            <FadeIn>
              <h3 className="mb-12 font-serif text-3xl text-primary">More from the Journal</h3>
            </FadeIn>
            <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
              {suggestedPosts.map((related, index) => (
                <FadeIn key={related.id} delay={index * 0.15}>
                  <Link href={`/blog/${related.id}`} className="group flex flex-col gap-5">
                    <div className="relative aspect-video overflow-hidden bg-gray-100">
                      <Image
                        src={related.cover_image}
                        alt={related.title}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                      />
                    </div>
                    <div>
                      <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-secondary">
                        {related.category} — {formatBlogDate(related.date)}
                      </span>
                      <h4 className="font-serif text-2xl leading-snug text-primary transition-colors group-hover:text-secondary">
                        {related.title}
                      </h4>
                      <p className="mt-2 text-sm leading-relaxed text-muted-foreground line-clamp-2">
                        {related.excerpt}
                      </p>
                    </div>
                  </Link>
                </FadeIn>
              ))}
            </div>
          </div>
        </section>
      ) : null}
    </div>
    </>
  );
}
