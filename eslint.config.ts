import js from "@eslint/js"
import type { Linter } from "eslint"
import nextConfig from "eslint-config-next"
import prettierConfig from "eslint-config-prettier"
import prettierPlugin from "eslint-plugin-prettier"

// any型の警告設定のための追加import（不要になったらこのブロックを削除）
import tsPlugin from "@typescript-eslint/eslint-plugin"
import tsParser from "@typescript-eslint/parser"

const config: Linter.Config[] = [
  js.configs.recommended,
  ...(Array.isArray(nextConfig) ? nextConfig : [nextConfig]),
  prettierConfig,
  {
    plugins: {
      prettier: prettierPlugin,
    },
    rules: {
      "prettier/prettier": "error",
      // TypeScriptが未定義変数のチェックを行うため、ESLint側のno-undefは無効化します。
      // これにより、TransferableなどのTypeScriptのlib定義に含まれるグローバル型の誤検知を防ぎます。
      "no-undef": "off",
      // TypeScriptが再宣言のチェックを行うため、ESLint側のno-redeclareは無効化します。
      // これにより、関数のオーバーロードが誤検知されるのを防ぎます。
      "no-redeclare": "off",
      // 未使用変数はエラーではなく警告として扱い、段階的に修正できるようにします。
      "no-unused-vars": "warn",
    },
  },
  // any型の警告設定（不要になったらこのブロックを削除）
  {
    plugins: {
      "@typescript-eslint": tsPlugin as any,
    },
    languageOptions: {
      parser: tsParser,
    },
    rules: {
      "@typescript-eslint/no-explicit-any": "warn",
    },
  },
]

export default config
