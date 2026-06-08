"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { ArrowRight, Loader2 } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { formatBlogDate, type BlogPost } from "@/lib/blog-shared";

const INITIAL_VISIBLE = 7; // 1 featured + 6 grid
const LOAD_MORE_BATCH = 6;

export function BlogList({ posts }: { posts: BlogPost[] }) {
  const [visibleCount, setVisibleCount] = useState(INITIAL_VISIBLE);
  const [isLoading, setIsLoading] = useState(false);

  const featuredPost = posts[0] ?? null;
  const gridPosts = posts.slice(1, visibleCount);
  const hasMore = visibleCount < posts.length;

  function handleLoadMore() {
    setIsLoading(true);
    // Small delay so the button gives feedback before React re-renders
    setTimeout(() => {
      setVisibleCount((prev) => prev + LOAD_MORE_BATCH);
      setIsLoading(false);
    }, 300);
  }

  if (posts.length === 0) {
    return (
      <div className="mx-auto max-w-screen-2xl px-6 py-32 text-center md:px-12 lg:px-24">
        <p className="font-serif text-2xl text-muted-foreground">
          No articles published yet.
        </p>
      </div>
    );
  }

  return (
    <>
      {/* Featured post */}
      {featuredPost ? (
        <section className="mx-auto max-w-screen-2xl px-6 py-24 md:px-12 lg:px-24">
          <FadeIn>
            <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-24">
              <div className="group w-full overflow-hidden lg:w-3/5">
                <Link
                  href={`/blog/${featuredPost.id}`}
                  className="relative block aspect-video bg-gray-100 shadow-xl"
                >
                  <Image
                    src={featuredPost.cover_image}
                    alt={featuredPost.title}
                    fill
                    className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                  />
                </Link>
              </div>
              <div className="flex w-full flex-col lg:w-2/5">
                <span className="mb-4 text-sm uppercase tracking-[0.2em] text-secondary">
                  {featuredPost.category} - {formatBlogDate(featuredPost.date)}
                </span>
                <h2 className="mb-6 font-serif text-4xl leading-tight text-primary md:text-5xl">
                  <Link
                    href={`/blog/${featuredPost.id}`}
                    className="transition-colors hover:text-secondary"
                  >
                    {featuredPost.title}
                  </Link>
                </h2>
                <p className="mb-10 text-lg leading-relaxed text-muted-foreground">
                  {featuredPost.excerpt}
                </p>
                <Link
                  href={`/blog/${featuredPost.id}`}
                  className="inline-flex w-max items-center gap-2 border-b border-primary pb-1 text-sm uppercase tracking-widest transition-all hover:border-secondary hover:text-secondary"
                >
                  Read Article <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </div>
          </FadeIn>
        </section>
      ) : null}

      {/* Grid of remaining visible posts */}
      {gridPosts.length > 0 ? (
        <>
          <div className="mx-auto max-w-screen-2xl px-6 md:px-12 lg:px-24">
            <div className="mb-24 h-px w-full bg-border/40" />
          </div>

          <section className="mx-auto max-w-screen-2xl px-6 pb-16 md:px-12 lg:px-24">
            <FadeIn className="mb-16">
              <h3 className="font-serif text-3xl text-primary md:text-4xl">
                Latest Articles
              </h3>
            </FadeIn>

            <div className="grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
              {gridPosts.map((post, index) => (
                <FadeIn key={post.id} direction="scale" delay={index * 0.1}>
                  <article className="group flex h-full flex-col">
                    <Link
                      href={`/blog/${post.id}`}
                      className="relative mb-6 aspect-4/3 overflow-hidden bg-gray-100 shadow-sm transition-shadow duration-500 group-hover:shadow-xl"
                    >
                      <Image
                        src={post.cover_image}
                        alt={post.title}
                        fill
                        className="object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.03]"
                      />
                      <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                    </Link>
                    <div className="flex grow flex-col">
                      <span className="mb-3 text-xs uppercase tracking-[0.15em] text-secondary">
                        {post.category} - {formatBlogDate(post.date)}
                      </span>
                      <h4 className="mb-4 font-serif text-2xl leading-tight text-primary">
                        <Link
                          href={`/blog/${post.id}`}
                          className="transition-colors hover:text-secondary"
                        >
                          {post.title}
                        </Link>
                      </h4>
                      <p className="mb-6 grow text-sm leading-relaxed text-muted-foreground">
                        {post.excerpt}
                      </p>
                      <Link
                        href={`/blog/${post.id}`}
                        className="mt-auto inline-flex w-max items-center gap-2 text-xs font-semibold uppercase tracking-widest text-primary transition-colors hover:text-secondary"
                      >
                        Read More <ArrowRight className="h-3 w-3" />
                      </Link>
                    </div>
                  </article>
                </FadeIn>
              ))}
            </div>

            {/* Load more / end of list */}
            <div className="mt-24 text-center">
              {hasMore ? (
                <button
                  type="button"
                  onClick={handleLoadMore}
                  disabled={isLoading}
                  className="inline-flex items-center gap-2 border border-primary px-10 py-4 text-sm uppercase tracking-widest text-primary transition-colors duration-300 hover:bg-primary hover:text-white disabled:cursor-wait disabled:opacity-60"
                >
                  {isLoading ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Loading…
                    </>
                  ) : (
                    <>
                      Load More Articles
                      <span className="ml-1 text-xs opacity-60">
                        ({posts.length - visibleCount} remaining)
                      </span>
                    </>
                  )}
                </button>
              ) : (
                posts.length > INITIAL_VISIBLE && (
                  <p className="text-sm uppercase tracking-widest text-muted-foreground">
                    You've read them all
                  </p>
                )
              )}
            </div>
          </section>
        </>
      ) : null}
    </>
  );
}
