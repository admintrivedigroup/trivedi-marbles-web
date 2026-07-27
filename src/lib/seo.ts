import type { Metadata } from "next";

import type { Marble } from "@/data/marbles";

export const SITE_NAME = "Trivedi Marbles Pvt. Ltd.";
export const BRAND_SHORT = "Trivedi Marbles";

/** Default directive for public, indexable pages. */
export const PUBLIC_ROBOTS: Metadata["robots"] = {
  index: true,
  follow: true,
  googleBot: {
    index: true,
    follow: true,
    "max-image-preview": "large",
    "max-snippet": -1,
  },
};

/** Directive for private/internal routes (inventory, auth, debug/admin tools). */
export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: {
    index: false,
    follow: false,
  },
};

/** Strips a marketing subtitle from a marble name, e.g. "Ambaji White - An Essence of Purity" -> "Ambaji White". */
function marbleBaseName(marble: Pick<Marble, "name">): string {
  return marble.name.split(" - ")[0].trim();
}

/** Extracts the place name from an origin string, e.g. "India - Ambaji" -> "Ambaji". */
function marbleOriginLocation(marble: Pick<Marble, "origin">): string {
  const parts = marble.origin.split(" - ");
  return (parts.length > 1 ? parts[1] : parts[0]).trim();
}

/** First listed use case, e.g. "Flooring, Wall Cladding, Countertops" -> "Flooring". */
function marblePrimaryApplication(marble: Pick<Marble, "applications">): string {
  return marble.applications.split(",")[0].trim();
}

export function getMarbleMetaTitle(marble: Marble): string {
  const baseName = marbleBaseName(marble);
  return `${baseName} Marble | ${BRAND_SHORT}, Ahmedabad`;
}

export function getMarbleMetaDescription(marble: Marble): string {
  const baseName = marbleBaseName(marble);
  const origin = marbleOriginLocation(marble);
  const application = marblePrimaryApplication(marble).toLowerCase();
  const color = marble.color.toLowerCase();
  return `${baseName} is a premium ${color} marble quarried in ${origin}, Gujarat, and supplied by ${BRAND_SHORT}. Popular for ${application} in luxury interiors.`;
}

export function getMarbleImageAlt(marble: Marble): string {
  const baseName = marbleBaseName(marble);
  return `${baseName} ${marble.color.toLowerCase()} marble slab by ${BRAND_SHORT}`;
}
