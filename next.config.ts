import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  eslint: {
    ignoreDuringBuilds: true,
  },
  output: "export",
  // assetPrefix: "/dvbt/",
  // basePath: "/dvbt",
  trailingSlash: true,
};

export default nextConfig;
