// Minimal ESLint flat config for ESM Node project
import js from "@eslint/js";
import globals from "globals";
import importPlugin from "eslint-plugin-import";

export default [
  {
    ignores: [
      "output/**",
      "archives/**",
      "logs/**",
      ".baselines/**",
      "node_modules/**",
    ],
  },
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: 2023,
      sourceType: "module",
      globals: {
        ...globals.node,
      },
    },
    linterOptions: {
      reportUnusedDisableDirectives: true,
    },
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
      "no-console": "off",
      "no-empty": ["error", { allowEmptyCatch: true }],
      "no-useless-escape": "off",
    },
  },
  {
    plugins: {
      import: importPlugin,
    },
    rules: {
      "import/no-cycle": "error",
      "no-duplicate-imports": "error",
    },
  },
  {
    files: ["reports/**/*.js"],
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
  },
  {
    files: ["tests/**/*.spec.js", "tests/**/*.test.js"],
    languageOptions: {
      globals: {
        ...globals.node,
        ...globals.jest,
      },
    },
  },
  {
    files: ["dashboard/src/**/*.{ts,tsx,js,jsx}"],
    plugins: {
      import: importPlugin,
    },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            {
              group: ["../api/*", "../../api/*"],
              message: "Import from src/api via the index barrel (../api)",
            },
            {
              group: ["node:fs*", "fs"],
              message: "Dashboard layer is read-only; call service APIs instead.",
            },
          ],
        },
      ],
    },
  },
  {
    files: ["dashboard/src/**/*.{ts,tsx,js,jsx}"],
    excludedFiles: ["dashboard/src/api/**/*"],
    rules: {
      "no-restricted-globals": [
        "error",
        {
          name: "fetch",
          message: "Use apiFetch/apiJson from src/api to talk to the service layer.",
        },
      ],
    },
  },
];
