import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";
import boundaries from "eslint-plugin-boundaries";

// Livelli del backend (src/server): le dipendenze vanno solo verso l'interno.
// core non conosce né Next né Supabase; Next compare solo in platform e in src/app.
const serverBoundaries = {
  files: ["src/**/*.{ts,tsx}"],
  plugins: { boundaries },
  settings: {
    "import/resolver": { typescript: { alwaysTryTypes: true } },
    "boundaries/elements": [
      { type: "core", pattern: "src/server/core" },
      { type: "adapters", pattern: "src/server/adapters" },
      { type: "http", pattern: "src/server/http" },
      { type: "platform", pattern: "src/server/platform" },
      { type: "config", pattern: "src/server/config" },
      { type: "composition", pattern: "src/server/app" },
      { type: "next", pattern: "src/app" },
      { type: "next", pattern: "src/lib" },
    ],
  },
  rules: {
    "boundaries/dependencies": [
      2,
      {
        default: "allow",
        policies: [
          {
            from: { element: { type: "core" } },
            disallow: {
              to: {
                element: {
                  types: {
                    anyOf: [
                      "adapters",
                      "http",
                      "platform",
                      "config",
                      "composition",
                      "next",
                    ],
                  },
                },
              },
            },
          },
          {
            from: {
              element: { types: { anyOf: ["adapters", "http", "config"] } },
            },
            disallow: {
              to: {
                element: {
                  types: { anyOf: ["platform", "composition", "next"] },
                },
              },
            },
          },
          {
            from: { element: { type: "http" } },
            disallow: { to: { element: { type: "adapters" } } },
          },
        ],
      },
    ],
  },
};

// Librerie esterne: il nucleo usa solo zod e neverthrow; Next resta fuori dal backend.
const restrictImports = (files, patterns) => ({
  files,
  ignores: ["**/*.test.ts"],
  rules: { "no-restricted-imports": ["error", { patterns }] },
});

const coreImports = restrictImports(
  ["src/server/core/**"],
  [
    {
      regex: "^(?!zod$|neverthrow$|\\.)",
      message:
        "Il nucleo può importare solo zod, neverthrow e file del nucleo.",
    },
  ],
);

const noNextInServer = restrictImports(
  ["src/server/**"],
  [
    {
      regex: "^next(/|$)",
      message: "Next è ammesso solo in src/server/platform.",
    },
  ],
);

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  serverBoundaries,
  noNextInServer,
  {
    files: ["src/server/platform/**"],
    rules: { "no-restricted-imports": "off" },
  },
  coreImports,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
