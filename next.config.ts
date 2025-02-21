import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  basePath: "/dvbt",
  output: "export",
  eslint: {
    ignoreDuringBuilds: true,
  }
};

export default nextConfig;
