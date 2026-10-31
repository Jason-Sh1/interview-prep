import path from "node:path";
import { defineConfig } from "vitest/config";

// Run in a non-UTC zone (unless one is set) so database time zone bugs show up
// on UTC machines like CI too. Test workers inherit this.
process.env.TZ ||= "America/New_York";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
      "server-only": path.resolve(__dirname, "tests/server-only-stub.ts"),
    },
  },
  test: { include: ["tests/**/*.test.ts"], testTimeout: 60_000 },
});
