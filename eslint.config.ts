import js from "@eslint/js"
import nextCoreWebVitals from "eslint-config-next/core-web-vitals"
import nextTypeScript from "eslint-config-next/typescript"
// import pluginQuery from "@tanstack/eslint-plugin-query"
import eslintPluginPrettierRecommended from "eslint-plugin-prettier/recommended"
import { defineConfig, globalIgnores } from "eslint/config"

export default defineConfig([
  js.configs.recommended, // JS ファイル用の最低限の安全網
  ...nextCoreWebVitals, // React / Next 特有の最適化・警告
  ...nextTypeScript, // JS ルールを TS ルールに正しく置換 - no-unused-vars などの誤検知を根絶
  // ...pluginQuery.configs["flat/recommended"], // TanStack Query 用のルールセット
  eslintPluginPrettierRecommended, // Prettier のルールを ESLint に統合
  globalIgnores([
    // eslint-config-next の既定 ignore を明示管理
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    "public/label-studio/**",
  ]),
  {
    rules: {
      "@typescript-eslint/no-explicit-any": "warn", // any 型は段階的に是正する方針
    },
  },
])
