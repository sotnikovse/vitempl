import { defineConfig } from "tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/engines/handlebars.ts",
    "src/engines/askama.ts",
    "src/engines/jinja.ts",
  ],
  dts: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
