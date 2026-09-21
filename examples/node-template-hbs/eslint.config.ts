import tsParser from "@typescript-eslint/parser";
import vitempl from "@vitempl/eslint-plugin";
import { handlebars } from "vitempl/handlebars";
import vueParser from "vue-eslint-parser";

// https://eslint.org/docs/latest/use/configure/
export default [
  {
    files: ["src/**/*.vue"],
    languageOptions: {
      parser: vueParser,
      parserOptions: { parser: tsParser, sourceType: "module" },
    },
    plugins: { vitempl },
    settings: { vitempl: { engine: handlebars() } },
    rules: { "vitempl/syntax": "error" },
  },
];
