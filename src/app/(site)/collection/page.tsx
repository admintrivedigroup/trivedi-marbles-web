"use client";

import { useState } from "react";
import Link from "next/link";
import { AnimatePresence, motion } from "motion/react";
import { Filter } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { marbleColors, marbles } from "@/data/marbles";

export default function CollectionPage() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filteredMarbles = marbles.filter(
    (marble) =>
      activeCategory === "All" || marble.color === activeCategory,
  );

  return (
    <div className="mx-auto min-h-screen w-full max-w-[1600px] bg-background px-6 pb-24 pt-32 md:px-12 lg:px-24">
      <FadeIn className="mb-16">
        <h1 className="mb-6 font-serif text-5xl text-primary md:text-6xl">
          The Collection
        </h1>
        <p className="max-w-2xl text-lg text-[#6f6258]">
          Explore our extensive range of premium natural stones, sourced from
          the finest D.K. Trivedi & Sons Quarries.
        </p>
      </FadeIn>

      <div className="flex flex-col gap-12 lg:flex-row">
        <aside className="w-full flex-shrink-0 lg:w-64">
          <div className="sticky top-32">
            <div className="mb-6 flex items-center gap-2 font-serif text-xl text-primary">
              <Filter className="h-5 w-5" />
              <span>Filter by Color</span>
            </div>
            <ul className="space-y-4">
              {marbleColors.map((category) => (
                <li key={category}>
                  <button
                    onClick={() => setActiveCategory(category)}
                    className={`text-sm uppercase tracking-wider transition-colors ${
                      activeCategory === category
                        ? "font-medium text-secondary"
                        : "text-[#7a6b5f] hover:text-primary"
                    }`}
                  >
                    {category}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1">
          <motion.div
            layout
            className="grid grid-cols-1 gap-8 md:grid-cols-2 xl:grid-cols-3"
          >
            <AnimatePresence>
              {filteredMarbles.map((marble) => (
                <motion.div
                  key={marble.id}
                  layout
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ duration: 0.4 }}
                  className="group relative"
                >
                  <Link href={`/collection/${marble.id}`} className="block">
                    <div className="relative mb-6 aspect-[3/4] overflow-hidden bg-gray-100">
                      <img
                        src={marble.image}
                        alt={marble.name}
                        className="h-full w-full object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                    <div className="flex items-start justify-between">
                      <div>
                        <h3 className="mb-1 font-serif text-2xl text-primary">
                          {marble.name}
                        </h3>
                        <p className="text-sm uppercase tracking-widest text-[#7a6b5f]">
                          {marble.finish}
                        </p>
                      </div>
                      <span className="text-xs uppercase tracking-wider text-secondary opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                        Explore
                      </span>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>

          {filteredMarbles.length === 0 && (
            <div className="py-24 text-center font-serif text-xl text-[#7a6b5f]">
              No products found in this category.
            </div>
          )}
        </main>
      </div>
    </div>
  );
}
