import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
  allowedDevOrigins: ["192.168.31.108"],
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com" },
      { protocol: "https", hostname: "res.cloudinary.com" },
    ],
  },
  outputFileTracingRoot: process.cwd(),
  async redirects() {
    return [
      {
        source: "/products",
        destination: "/collection",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "/journal",
        permanent: true,
      },
    ];
  },
  env: {
    NEXT_PUBLIC_SUPABASE_URL: process.env.VITE_SUPABASE_URL ?? "",
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.VITE_SUPABASE_ANON_KEY ?? "",
    NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME:
      process.env.VITE_CLOUDINARY_CLOUD_NAME ?? "",
    NEXT_PUBLIC_CLOUDINARY_UPLOAD_PRESET:
      process.env.VITE_CLOUDINARY_UPLOAD_PRESET ?? "",
  },
};

export default nextConfig;
