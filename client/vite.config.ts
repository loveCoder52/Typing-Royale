import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig(({ mode }) => {
  // Reads .env, .env.development, .env.production etc. (no VITE_ prefix needed here)
  const env = loadEnv(mode, process.cwd(), "");
  const backend = env.BACKEND_URL || "http://127.0.0.1:3000";

  const socketProxy = {
    "/socket.io": {
      target: backend,
      changeOrigin: true,
      ws: true,
    },
  };

  return {
    plugins: [react()],

    // Used ONLY by `npm run dev`
    server: {
      host: "0.0.0.0",
      port: 5173,
      strictPort: true,
      proxy: socketProxy,
    },

    // Used ONLY by `npm run preview` (to test the production build locally)
    preview: {
      host: "0.0.0.0",
      port: 4173,
      proxy: socketProxy,
    },
  };
});