import Link from "next/link";
import { ArrowRight } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { blogHeroImg, blogPosts } from "@/data/blog";

export default function BlogPage() {
  const featuredPost = blogPosts[0];
  const latestPosts = blogPosts.slice(1);

  return (
    <div className="min-h-screen w-full bg-background">
      <section className="relative flex h-[60vh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img
            src={blogHeroImg}
            alt="The Trivedi Journal"
            className="h-full w-full object-cover"
          />
          <div className="absolute inset-0 bg-primary/70 backdrop-blur-sm" />
        </div>
        <div className="relative z-10 mx-auto max-w-3xl px-6 pt-24 text-center">
          <FadeIn>
            <h1 className="mb-6 font-serif text-5xl text-white md:text-7xl">
              The Journal
            </h1>
            <p className="text-lg leading-relaxed font-light text-white/80 md:text-xl">
              Insights, trends, and narratives from the world of luxury natural
              stone and architectural design.
            </p>
          </FadeIn>
        </div>
      </section>

      <section className="mx-auto max-w-screen-2xl px-6 py-24 md:px-12 lg:px-24">
        <FadeIn>
          <div className="flex flex-col items-center gap-12 lg:flex-row lg:gap-24">
            <div className="group w-full overflow-hidden lg:w-3/5">
              <Link
                href={`/blog/${featuredPost.id}`}
                className="relative block aspect-[16/9] bg-gray-100 shadow-xl"
              >
                <img
                  src={featuredPost.image}
                  alt={featuredPost.title}
                  className="h-full w-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-105"
                />
              </Link>
            </div>
            <div className="flex w-full flex-col lg:w-2/5">
              <span className="mb-4 text-sm uppercase tracking-[0.2em] text-secondary">
                {featuredPost.category} - {featuredPost.date}
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

      <div className="mx-auto max-w-screen-2xl px-6 md:px-12 lg:px-24">
        <div className="mb-24 h-px w-full bg-border/40" />
      </div>

      <section className="mx-auto max-w-screen-2xl px-6 pb-32 md:px-12 lg:px-24">
        <FadeIn className="mb-16">
          <h3 className="font-serif text-3xl text-primary md:text-4xl">
            Latest Articles
          </h3>
        </FadeIn>

        <div className="grid grid-cols-1 gap-x-12 gap-y-16 md:grid-cols-2 lg:grid-cols-3">
          {latestPosts.map((post, index) => (
            <FadeIn key={post.id} delay={index * 0.15}>
              <article className="group flex h-full flex-col">
                <Link
                  href={`/blog/${post.id}`}
                  className="relative mb-6 aspect-[4/3] overflow-hidden bg-gray-100 shadow-sm transition-shadow duration-500 group-hover:shadow-xl"
                >
                  <img
                    src={post.image}
                    alt={post.title}
                    className="h-full w-full object-cover transition-transform duration-[1.5s] ease-out group-hover:scale-[1.03]"
                  />
                  <div className="absolute inset-0 bg-black/5 opacity-0 transition-opacity duration-500 group-hover:opacity-100" />
                </Link>
                <div className="flex flex-grow flex-col">
                  <span className="mb-3 text-xs uppercase tracking-[0.15em] text-secondary">
                    {post.category} - {post.date}
                  </span>
                  <h4 className="mb-4 font-serif text-2xl leading-tight text-primary">
                    <Link
                      href={`/blog/${post.id}`}
                      className="transition-colors hover:text-secondary"
                    >
                      {post.title}
                    </Link>
                  </h4>
                  <p className="mb-6 flex-grow text-sm leading-relaxed text-muted-foreground">
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

        <div className="mt-24 text-center">
          <button className="inline-block border border-primary px-10 py-4 text-sm uppercase tracking-widest text-primary transition-colors duration-300 hover:bg-primary hover:text-white">
            Load More Articles
          </button>
        </div>
      </section>
    </div>
  );
}
