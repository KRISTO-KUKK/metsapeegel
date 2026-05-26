import type { NextConfig } from "next";

const nextConfig: NextConfig = {
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
