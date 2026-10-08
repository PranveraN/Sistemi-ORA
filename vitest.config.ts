import { defineConfig } from "vitest/config";
import path from "path";

// Testet automatike (vetëm zhvillim). Testet e auditimit punojnë mbi një
// kopje të përkohshme të prisma/test-copy.db — kurrë mbi databazën reale.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/__tests__/**/*.test.ts"],
    environment: "node",
    testTimeout: 30000,
    hookTimeout: 60000,
    fileParallelism: false,
  },
});
