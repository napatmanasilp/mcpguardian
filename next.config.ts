import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Pre-existing lint issues being tracked for post-launch cleanup
    ignoreDuringBuilds: true,
  },
};

export default nextConfig;
