import path from "node:path";
import { fileURLToPath } from "node:url";
import Module from "node:module";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const appNodeModules = path.join(__dirname, "node_modules");

process.env.APP_NAME = process.env.APP_NAME || "edutrack";
process.env.PORT = process.env.PORT || "5002";
process.env.FRONTEND_ROOT = process.env.FRONTEND_ROOT || path.join(__dirname, "public");

process.env.NODE_PATH = [appNodeModules, process.env.NODE_PATH].filter(Boolean).join(path.delimiter);
Module._initPaths();

await import("../../backend/server.js");
