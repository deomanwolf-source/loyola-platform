import path from "node:path";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

function openEditorPlugin(): Plugin {
  return {
    name: "loyola-open-editor",
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url?.startsWith("/__-loyola-open-editor")) {
          const url = new URL(req.url, `http://${req.headers.host}`);
          const file = url.searchParams.get("file");
          if (file) {
            import("node:child_process").then(({ exec }) => {
              exec(`code -g "${path.resolve(__dirname, file)}"`);
            });
            res.end("OK");
            return;
          }
        }
        next();
      });
    },
  };
}

export default defineConfig({
  publicDir: false,
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    react(),
    openEditorPlugin(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
    dedupe: ["react", "react-dom", "react/jsx-runtime", "react/jsx-dev-runtime"],
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    outDir: "public",
    emptyOutDir: false,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
        // Content-hashed filenames so each deploy produces fresh URLs. Without a
        // hash, a browser could keep a cached old `index.js` while fetching a new
        // lazy chunk (e.g. AdminPortal), and the mismatched module boundary would
        // render an undefined component (React error #130) after a deploy.
        entryFileNames: "assets/[name]-[hash].js",
        chunkFileNames: "assets/[name]-[hash].js",
        assetFileNames: "assets/[name]-[hash].[ext]",
        manualChunks(id) {
          // Split grapesjs (visual builder) into its own chunk, only loaded when editor opens
          if (id.includes("node_modules/grapesjs")) return "vendor-grapesjs";
          if (
            id.includes("node_modules/grapesjs-preset-webpage") ||
            id.includes("node_modules/grapesjs-blocks-basic")
          )
            return "vendor-grapesjs-plugins";
          // Split react-easy-crop (staff photo cropper) into its own chunk
          if (id.includes("node_modules/react-easy-crop")) return "vendor-easy-crop";
          // Split lucide into its own chunk to avoid duplication
          if (id.includes("node_modules/lucide-react")) return "vendor-lucide";
        },
      },
    },
  },
});
