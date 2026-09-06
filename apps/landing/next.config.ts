import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@0xslots/wallet"],
  images: {
    remotePatterns: [
      {
        hostname: "**",
      },
    ],
  },
  allowedDevOrigins: ["really-intense-guppy.ngrok-free.app"],
};

export default nextConfig;
