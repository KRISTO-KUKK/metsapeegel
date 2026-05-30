import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  webpack(config) {
    config.module.rules.push({
      test: /\.geojson$/,
      type: "json"
    });

    return config;
  }
};

export default nextConfig;
