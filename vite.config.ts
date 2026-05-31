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

const eduTrackPortalHtml = `<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>EduTrack</title>
    <style>
      html, body { width: 100%; height: 100%; margin: 0; overflow: hidden; background: #081324; }
      iframe { display: block; width: 100%; height: 100%; border: 0; }
    </style>
  </head>
  <body>
    <iframe title="EduTrack" src="/edutrack/index.html" allow="clipboard-read; clipboard-write"></iframe>
  </body>
</html>`;

function eduTrackPortalPlugin(): Plugin {
  const serveEduTrackPortal = (
    req: { url?: string; headers: { host?: string } },
    res: {
      statusCode: number;
      setHeader(name: string, value: string): void;
      end(body?: string): void;
    },
    next: () => void,
  ) => {
    const url = new URL(req.url || "/", `http://${req.headers.host || "127.0.0.1"}`);
    if (url.pathname === "/portal/edutrack" || url.pathname === "/portal/edutrack/") {
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.setHeader("Cache-Control", "no-store");
      res.end(eduTrackPortalHtml);
      return;
    }
    next();
  };

  return {
    name: "loyola-edutrack-portal-route",
    configureServer(server) {
      server.middlewares.use(serveEduTrackPortal);
    },
    configurePreviewServer(server) {
      server.middlewares.use(serveEduTrackPortal);
    },
  };
}

export default defineConfig({
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    eduTrackPortalPlugin(),
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
    outDir: "backend/public",
    emptyOutDir: true,
    chunkSizeWarningLimit: 1200,
    rollupOptions: {
      output: {
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
