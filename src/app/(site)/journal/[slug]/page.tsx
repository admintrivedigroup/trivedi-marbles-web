import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";

import { FadeIn } from "@/components/animations/FadeIn";
import { formatBlogDate } from "@/lib/blog-shared";
import {
  getJournalPostBySlugForPreview,
  getPublishedJournalPostBySlug,
  getRelatedArticleSummaries,
} from "@/lib/journal";
import { findRedirectTargetSlug } from "@/lib/journal/redirects";
import { computeReadingTimeMinutes } from "@/lib/journal/reading-time";
import {
  journalArticleUrl,
  resolveCanonicalUrl,
  resolveMetaDescription,
  resolveRobots,
  resolveSeoTitle,
  resolveSocialDescription,
  resolveSocialImage,
  resolveSocialTitle,
} from "@/lib/journal/seo-fallbacks";
import { buildArticleJsonLd, buildBreadcrumbJsonLd, buildFaqJsonLd, safeJsonLdString } from "@/lib/journal/jsonld";
import { buildTableOfContents } from "@/lib/journal/toc";
import { getCurrentUserProfile } from "@/app/inventory/_lib/user-profile";
import { getWebsiteLots } from "@/lib/supabase/collection";
import { BlockRenderer } from "../_components/block-renderer";

type Props = { params: Promise<{ slug: string }> };

async function loadPost(slug: string) {
  const published = await getPublishedJournalPostBySlug(slug);
  if (published) return { post: published, isPreview: false as const };

  const profile = await getCurrentUserProfile();
  if (profile && (profile.role === "admin" || profile.role === "superadmin")) {
    const draft = await getJournalPostBySlugForPreview(slug);
    if (draft) return { post: draft, isPreview: true as const };
  }
  return null;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const result = await loadPost(slug);
  if (!result) return {};

  const { post, isPreview } = result;
  const robots = isPreview ? { index: false, follow: false } : resolveRobots(post);
  const title = resolveSeoTitle(post);
  const description = resolveMetaDescription(post);
  const canonical = resolveCanonicalUrl(post) ?? journalArticleUrl(post.slug ?? slug);
  const socialTitle = resolveSocialTitle(post);
  const socialDescription = resolveSocialDescription(post);
  const socialImage = resolveSocialImage(post);

  return {
    title,
    description,
    alternates: { canonical },
    robots,
    openGraph: {
      title: socialTitle,
      description: socialDescription,
      url: canonical,
      type: "article",
      publishedTime: post.published_at ?? undefined,
      modifiedTime: post.updated_at,
      authors: [post.author_name],
      images: socialImage
        ? [{ url: socialImage, width: 1200, height: 800, alt: post.cover_image_alt || post.title }]
        : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: socialTitle,
      description: socialDescription,
      images: socialImage ? [socialImage] : undefined,
    },
  };
}

export default async function JournalDetailPage({ params }: Props) {
  const { slug } = await params;
  const result = await loadPost(slug);

  if (!result) {
    const redirectTarget = await findRedirectTargetSlug(slug);
    if (redirectTarget) redirect(`/journal/${redirectTarget}`);
    notFound();
  }

  const { post, isPreview } = result;

  const [lots, relatedArticles] = await Promise.all([
    getWebsiteLots(),
    getRelatedArticleSummaries(post.related_post_ids),
  ]);
  const productLookup = new Map(
    lots.filter((lot) => post.related_product_ids.includes(lot.id)).map((lot) => [lot.id, lot]),
  );

  const toc = buildTableOfContents(post.content);
  const readingTime = computeReadingTimeMinutes(post.content);
  const publishedDay = (post.published_at ?? post.updated_at).slice(0, 10);
  const showUpdated = post.updated_at.slice(0, 10) !== publishedDay;

  const articleJsonLd = buildArticleJsonLd(post);
  const breadcrumbJsonLd = buildBreadcrumbJsonLd([
    { name: "Home", url: "https://www.trivedimarbles.co.in" },
    { name: "Journal", url: "https://www.trivedimarbles.co.in/journal" },
    { name: post.title, url: journalArticleUrl(post.slug ?? slug) },
  ]);
  const faqJsonLd = buildFaqJsonLd(post, post.content);

  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(articleJsonLd) }} />
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(breadcrumbJsonLd) }} />
      {faqJsonLd ? (
        <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLdString(faqJsonLd) }} />
      ) : null}

      <div className="min-h-screen w-full bg-background">
        {isPreview ? (
          <div className="bg-amber-500 px-6 py-2 text-center text-sm font-medium text-white">
            Draft Preview — not publicly visible or indexed
          </div>
        ) : null}

        <div className="relative flex h-[65vh] items-end overflow-hidden">
          <Image
            src={post.cover_image_url}
            alt={post.cover_image_alt || post.title}
            fill
            className="object-cover"
            priority
          />
          <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/30 to-black/10" />
          <div className="relative z-10 w-full px-6 pb-12 md:px-12 lg:px-24">
            <FadeIn>
              <nav aria-label="Breadcrumb" className="mb-4 text-xs uppercase tracking-widest text-white/60">
                <Link href="/" className="hover:text-white">
                  Home
                </Link>{" "}
                / <Link href="/journal" className="hover:text-white">Journal</Link> / {post.category}
              </nav>
              <span className="mb-4 block text-sm font-medium uppercase tracking-[0.2em] text-secondary">
                {post.category}
              </span>
              <h1 className="max-w-4xl font-serif text-4xl leading-tight text-white md:text-5xl lg:text-6xl">
                {post.title}
              </h1>
              <p className="mt-4 text-sm uppercase tracking-widest text-white/60">
                {post.author_name}
                {post.published_at ? ` · ${formatBlogDate(publishedDay)}` : ""}
                {showUpdated ? ` · Updated ${formatBlogDate(post.updated_at.slice(0, 10))}` : ""} · {readingTime} min
                read
              </p>
            </FadeIn>
          </div>
        </div>

        <div className="mx-auto max-w-3xl px-6 py-16 md:px-12 lg:px-0">
          <FadeIn>
            <p className="mb-10 border-l-2 border-secondary pl-6 font-serif text-xl leading-relaxed text-primary md:text-2xl">
              {post.excerpt}
            </p>

            {toc.length > 0 ? (
              <nav aria-label="Table of contents" className="mb-10 rounded-xl border border-border p-5">
                <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  On this page
                </p>
                <ul className="space-y-1 text-sm">
                  {toc.map((entry) => (
                    <li key={entry.id} className={entry.level === 3 ? "pl-4" : ""}>
                      <a href={`#${entry.id}`} className="text-primary hover:text-secondary">
                        {entry.text}
                      </a>
                    </li>
                  ))}
                </ul>
              </nav>
            ) : null}

            <BlockRenderer content={post.content} productLookup={productLookup} />
          </FadeIn>
        </div>

        {relatedArticles.length > 0 ? (
          <section className="border-t border-border bg-white px-6 py-20 md:px-12 lg:px-24">
            <div className="mx-auto max-w-7xl">
              <FadeIn>
                <h3 className="mb-12 font-serif text-3xl text-primary">More from the Journal</h3>
              </FadeIn>
              <div className="grid grid-cols-1 gap-10 md:grid-cols-2">
                {relatedArticles.map((related, index) => (
                  <FadeIn key={related.id} delay={index * 0.15}>
                    <Link href={`/journal/${related.slug}`} className="group flex flex-col gap-5">
                      <div className="relative aspect-video overflow-hidden bg-gray-100">
                        <Image
                          src={related.cover_image_url}
                          alt={related.cover_image_alt || related.title}
                          fill
                          loading="lazy"
                          className="object-cover transition-transform duration-700 group-hover:scale-[1.04]"
                        />
                      </div>
                      <div>
                        <span className="mb-2 block text-xs uppercase tracking-[0.15em] text-secondary">
                          {related.category}
                          {related.published_at ? ` — ${formatBlogDate(related.published_at.slice(0, 10))}` : ""}
                        </span>
                        <h4 className="font-serif text-2xl leading-snug text-primary transition-colors group-hover:text-secondary">
                          {related.title}
                        </h4>
                        <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-muted-foreground">
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
