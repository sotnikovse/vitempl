import { defineConfig } from "vite";
import vitempl from "vitempl";
import { createEngine, engineName } from "./engine.ts";

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    vitempl({
      engine: createEngine(),
      outDir: `dist/${engineName}/templates`,
    }),
  ],
  build: {
    outDir: `dist/${engineName}/public`,
  },
});
