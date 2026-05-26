import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [
    {
      name: "geojson-loader",
      transform(code, id) {
        if (!id.endsWith(".geojson")) {
          return null;
        }

        return {
          code: `export default ${code};`,
          map: null
        };
      }
    }
  ],
  test: {
    environment: "node",
    globals: true,
    include: ["tests/**/*.test.ts"]
  },
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url))
    }
  }
});
