"use client";

import { useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { Filter } from "lucide-react";

import { marbleColors, marbles } from "@/data/marbles";

export function CollectionStaticSection() {
  const [activeCategory, setActiveCategory] = useState("All");

  const filtered = marbles.filter(
    (m) => activeCategory === "All" || m.color === activeCategory,
  );

  return (
    <>
      {/* Mobile pill filter */}
      <div className="mb-8 lg:hidden">
        <div className="flex items-center gap-2 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {marbleColors.map((cat) => (
            <button
              key={cat}
              onClick={() => setActiveCategory(cat)}
              className={`shrink-0 rounded-full border px-4 py-1.5 text-xs uppercase tracking-wider transition-colors ${
                activeCategory === cat
                  ? "border-secondary bg-secondary text-white"
                  : "border-border text-muted-foreground hover:border-primary hover:text-primary"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      <div className="flex flex-col gap-12 lg:flex-row">
        {/* Desktop sticky sidebar */}
        <aside className="hidden w-64 shrink-0 lg:block">
          <div className="sticky top-32">
            <div className="mb-6 flex items-center gap-2 font-serif text-xl text-primary">
              <Filter className="h-5 w-5" />
              <span>Filter by Color</span>
            </div>
            <ul className="space-y-4">
              {marbleColors.map((cat) => (
                <li key={cat}>
                  <button
                    onClick={() => setActiveCategory(cat)}
                    className={`text-sm uppercase tracking-wider transition-colors ${
                      activeCategory === cat
                        ? "font-medium text-secondary"
                        : "text-muted-foreground hover:text-primary"
                    }`}
                  >
                    {cat}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>

        <main className="flex-1">
          <motion.div
            layout
            className="grid grid-cols-2 gap-4 md:gap-8 xl:grid-cols-3"
          >
            <AnimatePresence>
              {filtered.map((marble) => (
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
                    <div className="relative mb-6 aspect-3/4 overflow-hidden bg-gray-100">
                      <Image
                        src={marble.image}
                        alt={marble.name}
                        fill
                        className="object-cover transition-transform duration-700 group-hover:scale-105"
                      />
                      <div className="absolute inset-0 bg-primary/20 opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
                    </div>
                    <div className="flex items-start justify-between transition-transform duration-500 group-hover:-translate-y-1">
                      <div>
                        <h3 className="mb-1 line-clamp-2 font-serif text-base text-primary md:line-clamp-none md:text-2xl">
                          {marble.name}
                        </h3>
                        <p className="hidden text-sm uppercase tracking-widest text-muted-foreground md:block">
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

          {filtered.length === 0 && (
            <div className="py-24 text-center font-serif text-xl text-muted-foreground">
              No products found in this category.
            </div>
          )}
        </main>
      </div>
    </>
  );
}
