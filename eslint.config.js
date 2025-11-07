// Minimal ESLint flat config for ESM Node project
import js from "@eslint/js";
import globals from "globals";

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
    },
  },
];
