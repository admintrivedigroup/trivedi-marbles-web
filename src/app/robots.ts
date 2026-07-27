import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/inventory/", "/api/", "/debug/"],
    },
    sitemap: "https://www.trivedimarbles.co.in/sitemap.xml",
  };
}
