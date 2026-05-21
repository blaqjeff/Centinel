import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    // Explicitly set the Turbopack workspace root to the monorepo root
    root: path.join(__dirname, ".."),
  },
};

export default nextConfig;

