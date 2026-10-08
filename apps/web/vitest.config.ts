import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/integration/global-setup.ts"],
    // Integration tests share a single SQLite file, so run files one at a time.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 120_000,
    env: {
      // Prisma resolves this relative to prisma/schema.prisma -> prisma/test.db
      DATABASE_URL: "file:./test.db",
    },
  },
});
