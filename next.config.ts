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
        source: "/all-products",
        destination: "/collection",
        permanent: true,
      },
      {
        source: "/blog",
        destination: "/journal",
        permanent: true,
      },
      {
        source: "/collection/1",
        destination: "/collection/ambaji-white-marble",
        permanent: true,
      },
      {
        source: "/collection/2",
        destination: "/collection/fusion-black-marble",
        permanent: true,
      },
      {
        source: "/collection/3",
        destination: "/collection/exotic-green-marble",
        permanent: true,
      },
      {
        source: "/collection/4",
        destination: "/collection/ice-white-marble",
        permanent: true,
      },
      {
        source: "/collection/5",
        destination: "/collection/lava-green-marble",
        permanent: true,
      },
      {
        source: "/collection/6",
        destination: "/collection/fusion-green-extra-marble",
        permanent: true,
      },
      {
        source: "/collection/7",
        destination: "/collection/fusion-brown-marble",
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
