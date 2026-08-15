import { defineConfig, globalIgnores } from "eslint/config";
import { fixupConfigRules } from "@eslint/compat";
import { createRequire } from "node:module";
import Module from "node:module";

// typescript-eslint currently needs the TypeScript 6 JavaScript API even when
// the project compiler is TypeScript 7. Keep that compatibility API isolated
// to ESLint while `npm run typecheck` continues to use the latest compiler.
const require = createRequire(import.meta.url);
const typescript6 = require("typescript6");
const originalLoad = Module._load;

Module._load = function loadWithTypeScript6(request, parent, isMain) {
  if (request === "typescript") {
    return typescript6;
  }

  return originalLoad.call(this, request, parent, isMain);
};

const [{ default: nextVitals }, { default: nextTypeScript }] =
  await Promise.all([
    import("eslint-config-next/core-web-vitals"),
    import("eslint-config-next/typescript"),
  ]);

Module._load = originalLoad;

export default defineConfig([
  ...fixupConfigRules([...nextVitals, ...nextTypeScript]),
  {
    rules: {
      "@next/next/no-html-link-for-pages": "off",
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "coverage/**",
    "playwright-report/**",
    "test-results/**",
    "next-env.d.ts",
  ]),
]);
