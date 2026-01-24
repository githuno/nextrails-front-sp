/// <reference types="vitest/globals" />

import react from "@vitejs/plugin-react"
import { preview } from "@vitest/browser-preview"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  assetsInclude: ["**/*.wasm", "**/*.data"],
  test: {
    environment: "happy-dom",
    // setupFiles: ["./vitest.setup.ts"],
    include: ["src/**/*.{test,spec}.{js,jsx,ts,tsx}"],
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
    },
    browser: {
      enabled: true,
      headless: false,
      provider: preview(),
      instances: [{ browser: "chromium" }],
    },
  },
  optimizeDeps: {
    include: [
      "zod",
      "idb",
      "jsqr",
      "drizzle-orm",
      "drizzle-orm/pglite",
      "drizzle-orm/pg-core",
      "next/navigation",
      "react",
      "react-dom",
    ],
    exclude: ["@electric-sql/pglite"],
  },
  resolve: {
    alias: {
      "@": __dirname + "/src",
    },
  },
  define: {
    IS_REACT_ACT_ENVIRONMENT: "true",
  },
})
