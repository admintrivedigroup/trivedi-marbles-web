import Image from "next/image";

import { FadeIn } from "@/components/animations/FadeIn";
import { blogHeroImg } from "@/data/blog";
import { getPublishedBlogPosts } from "@/lib/blog";
import { BlogList } from "./_components/blog-list";

export const revalidate = 3600;

export default async function BlogPage() {
  const posts = await getPublishedBlogPosts();

  return (
    <div className="min-h-screen w-full bg-background">
      {/* Hero */}
      <section className="relative flex h-[60vh] items-center justify-center overflow-hidden">
        <div className="absolute inset-0 z-0">
          <Image
            src={blogHeroImg}
            alt="The Trivedi Journal"
            fill
            className="object-cover"
            priority
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

      {/* List with load-more pagination */}
      <BlogList posts={posts} />
    </div>
  );
}
