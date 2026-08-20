import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // vinext emits a static multi-route site; native anchors preserve direct
    // canonical navigation and native images retain explicit responsive sizing.
    rules: {
      "@next/next/no-html-link-for-pages": "off",
      "@next/next/no-img-element": "off",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Orphaned Cloudflare Worker / OpenAI Sites scaffolding. Not part of the
    // Vercel build; kept only until the directories are removed.
    "worker/**",
    "db/**",
    "drizzle/**",
    "examples/**",
    "dist/**",
    "vite.config.ts",
    "drizzle.config.ts",
    "worker-configuration.d.ts",
  ]),
]);

export default eslintConfig;
