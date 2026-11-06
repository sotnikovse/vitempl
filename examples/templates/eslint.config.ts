import tsParser from "@typescript-eslint/parser";
import vitempl from "@vitempl/eslint-plugin";
import vueParser from "vue-eslint-parser";
import { createEngine } from "./engine.ts";

// https://eslint.org/docs/latest/use/configure/
export default [
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, sourceType: "module" },
    },
    plugins: { vitempl },
    settings: { vitempl: { engine: createEngine() } },
    rules: { "vitempl/syntax": "error" },
  },
];
