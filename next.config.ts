import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  images: {
    domains: ["tradebusinessschool.com"],
  },
  // Disable static optimization for API routes to prevent build-time evaluation
  experimental: {
    serverComponentsExternalPackages: ['openai'],
  },
};

export default nextConfig;
