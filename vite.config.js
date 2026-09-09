// vite.config.js
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  server: {
    port: 5173,
    proxy: {
      "/auth": {
        target: "https://ecommerce-website.adeebibrahim01.workers.dev",
        changeOrigin: true,
        secure: false,
      },
    },
  },
});