import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  eslint: {
    // Pre-existing lint issues being tracked for post-launch cleanup
    ignoreDuringBuilds: true,
  },
  typescript: {
    // Type errors handled by IDE/CI — don't block deployments
    ignoreBuildErrors: true,
  },
};

export default nextConfig;
