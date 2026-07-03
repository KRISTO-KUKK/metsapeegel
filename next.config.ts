import type { NextConfig } from "next";
import path from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const basePath = process.env.METSATARK_BASE_PATH?.trim();

const nextConfig: NextConfig = {
  outputFileTracingRoot: projectRoot,
  reactStrictMode: true,
  output: "standalone",
  env: {
    NEXT_PUBLIC_METSATARK_BASE_PATH: basePath ?? ""
  },
  ...(basePath ? { basePath } : {}),
  webpack(config) {
    config.module.rules.push({
      test: /\.geojson$/,
      type: "json"
    });

    return config;
  }
};

export default nextConfig;
