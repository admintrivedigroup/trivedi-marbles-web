import { FadeIn } from "@/components/animations/FadeIn";
import { CollectionStaticSection } from "@/components/collection/CollectionStaticSection";
import { CollectionGrid } from "@/components/collection/CollectionGrid";
import { getWebsiteLots } from "@/lib/supabase/collection";

export const dynamic = "force-dynamic";

export default async function CollectionPage() {
  const lots = await getWebsiteLots();
  const categories = [...new Set(lots.map((l) => l.categoryName).filter(Boolean))];

  return (
    <div className="mx-auto min-h-screen w-full max-w-400 bg-background px-6 pb-24 pt-32 md:px-12 lg:px-24">
      <FadeIn className="mb-16">
        <h1 className="mb-6 font-serif text-5xl text-primary md:text-6xl">
          The Collection
        </h1>
        <p className="max-w-2xl text-lg text-muted-foreground">
          Explore our extensive range of premium natural stones, sourced from
          the finest D.K. Trivedi &amp; Sons Quarries.
        </p>
      </FadeIn>

      {/* Section 1: Curated catalogue */}
      <CollectionStaticSection />

      {/* Section 2: Live inventory lots */}
      {lots.length > 0 && (
        <div className="mt-24">
          <FadeIn className="mb-12">
            <div className="flex items-center gap-6">
              <div className="h-px flex-1 bg-border" />
              <div className="text-center">
                <h2 className="font-serif text-3xl text-primary md:text-4xl">
                  Available Now
                </h2>
                <p className="mt-2 text-sm text-muted-foreground">
                  Live inventory — select lots available for immediate inquiry
                </p>
              </div>
              <div className="h-px flex-1 bg-border" />
            </div>
          </FadeIn>

          <CollectionGrid lots={lots} categories={categories} />
        </div>
      )}
    </div>
  );
}
