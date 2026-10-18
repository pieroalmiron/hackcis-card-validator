import { defineConfig } from "vite";
import { fileURLToPath } from "node:url";

export default defineConfig({
  build: {
    lib: {
      entry: fileURLToPath(new URL("./src/index.ts", import.meta.url)),
      formats: ["es"],
      fileName: "index",
    },
    // tesseract.js lo resuelve el proyecto que consume el SDK.
    rollupOptions: { external: ["tesseract.js"] },
    sourcemap: true,
  },
});