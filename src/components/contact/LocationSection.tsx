"use client";

import { useState } from "react";
import { ArrowUpRight, MapPin } from "lucide-react";

import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

const AHMEDABAD_MAP_EMBED_URL =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3669.741900490303!2d72.52164847535549!3d23.10654221318925!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x395e9d3f15555555%3A0x3e1c1365cba580e2!2sTrivedi%20Marbles%20Pvt.%20Ltd.!5e0!3m2!1sen!2sin!4v1776423819684!5m2!1sen!2sin";
const AMBAJI_MAP_EMBED_URL = "";

type Location = {
  id: string;
  name: string;
  description: string;
  address: string[];
  directionsUrl: string;
  mapEmbedUrl: string;
};

const locations: Location[] = [
  {
    id: "ahmedabad",
    name: "Ahmedabad Office",
    description:
      "A refined consultation space for architects, designers, and private clients exploring premium marble selections.",
    address: [
      "S.No.: 698/4, Ognaj",
      "Opp. Vasant Nagar Township",
      "Gota-Vadsar Road, Ahmedabad-380060",
      "Gujarat, India",
    ],
    directionsUrl: "https://maps.google.com/?q=Trivedi%20Marbles%20Pvt.%20Ltd.",
    mapEmbedUrl: AHMEDABAD_MAP_EMBED_URL,
  },
  {
    id: "ambaji",
    name: "Ambaji Factory & Quarry",
    description:
      "The source of our craftsmanship, where heritage stone is quarried and shaped with modern precision.",
    address: [
      "Ambaji, Banaskantha District",
      "Gujarat, India",
      "Factory and quarry address",
      "Add full location details here",
    ],
    directionsUrl: "https://maps.google.com/?q=Ambaji%20Factory%20and%20Quarry",
    mapEmbedUrl: AMBAJI_MAP_EMBED_URL,
  },
];

export function LocationSection() {
  const [selectedLocationId, setSelectedLocationId] = useState("ahmedabad");

  const selectedLocation =
    locations.find((location) => location.id === selectedLocationId) ?? locations[0];

  return (
    <section className="mt-24">
      <FadeIn className="mb-10 text-center">
        <span className="mb-4 block text-sm font-medium uppercase tracking-[0.3em] text-secondary">
          Visit Our Locations
        </span>
        <h2 className="font-serif text-4xl text-primary md:text-5xl">
          Visit Our Locations
        </h2>
      </FadeIn>

      <div className="grid gap-8 lg:grid-cols-[0.9fr_1.1fr] lg:items-stretch">
        <FadeIn delay={0.15} className="h-full">
          <div className="h-full rounded-[28px] border border-[#b08a3c]/20 bg-[#0d0d0d] p-5 shadow-[0_24px_80px_rgba(0,0,0,0.28)] md:p-7">
            <div className="space-y-4">
              {locations.map((location) => {
                const isSelected = location.id === selectedLocation.id;

                return (
                  <button
                    key={location.id}
                    type="button"
                    onClick={() => setSelectedLocationId(location.id)}
                    className={cn(
                      "w-full rounded-[22px] border px-5 py-5 text-left transition-all duration-300 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-secondary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-[#0d0d0d] md:px-6 md:py-6",
                      isSelected
                        ? "border-[#d4af37]/50 bg-[linear-gradient(135deg,rgba(212,175,55,0.18),rgba(212,175,55,0.06))] shadow-[0_16px_45px_rgba(212,175,55,0.12)]"
                        : "border-white/10 bg-white/[0.03] hover:border-[#d4af37]/30 hover:bg-white/[0.05]",
                    )}
                    aria-pressed={isSelected}
                  >
                    <div className="mb-4 flex items-start justify-between gap-4">
                      <div>
                        <p className="mb-2 text-xs uppercase tracking-[0.28em] text-[#d4af37]/70">
                          {location.id === "ahmedabad" ? "Corporate Office" : "Production Site"}
                        </p>
                        <h3 className="font-serif text-2xl text-white">
                          {location.name}
                        </h3>
                      </div>
                      <span
                        className={cn(
                          "mt-1 h-3 w-3 rounded-full border",
                          isSelected
                            ? "border-[#d4af37] bg-[#d4af37] shadow-[0_0_20px_rgba(212,175,55,0.45)]"
                            : "border-white/30 bg-transparent",
                        )}
                      />
                    </div>

                    <p className="mb-5 max-w-xl text-sm leading-7 text-white/70">
                      {location.description}
                    </p>

                    <div className="mb-6 flex gap-3 text-sm leading-7 text-white/65">
                      <MapPin className="mt-1 h-5 w-5 shrink-0 text-[#d4af37]" />
                      <address className="not-italic">
                        {location.address.map((line) => (
                          <div key={line}>{line}</div>
                        ))}
                      </address>
                    </div>

                    <Button
                      asChild
                      className="h-11 rounded-full border border-[#d4af37]/40 bg-transparent px-5 text-xs uppercase tracking-[0.24em] text-[#f2d57a] hover:bg-[#d4af37] hover:text-black"
                    >
                      <a
                        href={location.directionsUrl}
                        target="_blank"
                        rel="noreferrer"
                        onClick={(event) => event.stopPropagation()}
                      >
                        Get Directions
                        <ArrowUpRight className="h-4 w-4" />
                      </a>
                    </Button>
                  </button>
                );
              })}
            </div>
          </div>
        </FadeIn>

        <FadeIn delay={0.3} className="h-full">
          <div className="relative flex h-full min-h-[420px] flex-col overflow-hidden rounded-[32px] border border-[#b08a3c]/20 bg-[#111111] shadow-[0_24px_80px_rgba(0,0,0,0.28)] lg:min-h-full">
            <div className="flex items-center justify-between border-b border-white/10 px-5 py-4 md:px-7">
              <div>
                <p className="text-xs uppercase tracking-[0.28em] text-[#d4af37]/70">
                  Selected Destination
                </p>
                <h3 className="mt-2 font-serif text-2xl text-white">
                  {selectedLocation.name}
                </h3>
              </div>
            </div>

            {selectedLocation.mapEmbedUrl ? (
              <iframe
                key={selectedLocation.id}
                src={selectedLocation.mapEmbedUrl}
                title={`${selectedLocation.name} map`}
                className="min-h-[420px] w-full flex-1"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
              />
            ) : (
              <div className="flex min-h-[420px] flex-1 items-center justify-center px-6 text-center">
                <div className="max-w-md rounded-[24px] border border-dashed border-[#d4af37]/30 bg-white/[0.03] p-8">
                  <MapPin className="mx-auto mb-4 h-8 w-8 text-[#d4af37]" />
                  <p className="font-serif text-2xl text-white">
                    Ambaji map embed pending
                  </p>
                  <p className="mt-3 text-sm leading-7 text-white/65">
                    Replace <code>AMBAJI_MAP_EMBED_URL</code> with the final Google
                    Maps iframe URL to enable this view.
                  </p>
                </div>
              </div>
            )}
          </div>
        </FadeIn>
      </div>
    </section>
  );
}
