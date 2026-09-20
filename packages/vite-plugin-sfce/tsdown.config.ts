import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  dts: true,
  // package.json экспортирует dist/index.js, поэтому фиксируем расширения
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
});
