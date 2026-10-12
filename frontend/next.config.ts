import type { NextConfig } from "next";

const apiUrl = process.env.NEXT_PUBLIC_API_URL;
const apiKey = process.env.NEXT_PUBLIC_API_KEY;

if (!apiUrl || !apiUrl.trim()) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_URL. Set it in .env.local (e.g. http://localhost:8000).",
  );
}

if (!apiKey || !apiKey.trim()) {
  throw new Error(
    "Missing NEXT_PUBLIC_API_KEY. Set it in .env.local to match the backend API_KEY.",
  );
}

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
