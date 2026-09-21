import { defineConfig } from "vite";
import vitempl from "vitempl";
import { handlebars } from "vitempl/handlebars";

// https://vite.dev/config/
export default defineConfig({
  plugins: [vitempl({ engine: handlebars() })],
  build: {
    outDir: "dist/public",
  },
});
