import { fileURLToPath } from "node:url";
import { defineConfig } from "tsdown";

export default defineConfig({
  entry: "src/index.ts",
  dts: true,
  outExtensions: () => ({ js: ".js", dts: ".d.ts" }),
  alias: {
    vitempl: fileURLToPath(new URL("../vitempl/src/index.ts", import.meta.url)),
  },
});
