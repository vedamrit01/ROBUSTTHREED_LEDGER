import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { fileURLToPath } from "node:url";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const api = env.VITE_API_URL?.trim();
  if (mode === "production" && api && !/^https:\/\/[^\s]+$/.test(api)) {
    throw new Error("VITE_API_URL must be an HTTPS API origin, without /api.");
  }
  return {
    plugins: [react()],
    base: env.VITE_BASE_PATH || "/",
    resolve: { alias: { "@": fileURLToPath(new URL(".", import.meta.url)) } },
    server: { proxy: { "/api": "http://127.0.0.1:3001" } },
    build: { outDir: "dist" },
  };
});
