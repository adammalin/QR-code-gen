import { defineConfig } from "vite";

export default defineConfig({
  // Relative paths keep the build portable on a GitHub Pages project route.
  base: "./",
  build: {
    target: "es2022",
  },
});
