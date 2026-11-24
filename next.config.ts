import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // PGlite ships WebAssembly and data files that must be loaded from node_modules.
  serverExternalPackages: ["@electric-sql/pglite"],
  // Migrations are read from ./drizzle at runtime (src/lib/db/index.ts), which
  // file tracing can't see, so ship them with every server function.
  outputFileTracingIncludes: {
    "/**": ["./drizzle/**/*"],
  },
  experimental: {
    agentUpgrade: "security",
  },
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
