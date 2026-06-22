import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

// Proxy API + SSE to the Express backend during development.
export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    host: true, // listen on 0.0.0.0 so a phone on the same Wi-Fi can reach it
    proxy: {
      "/api": { target: "http://localhost:4000", changeOrigin: true },
      "/events": { target: "http://localhost:4000", changeOrigin: true, ws: false },
    },
  },
});
