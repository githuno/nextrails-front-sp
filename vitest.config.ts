/// <reference types="vitest/globals" />

import react from "@vitejs/plugin-react"
import { preview } from "@vitest/browser-preview"
import { defineConfig } from "vitest/config"

export default defineConfig({
  plugins: [react()],
  test: {
    environment: "happy-dom", // happy-domがインストール済みなのでこちらを使用
    // setupFiles: ['./src/tests/setup.ts'],
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
  resolve: {
    alias: {
      "@": __dirname + "/src",
    },
  },
})
