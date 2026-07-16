import tailwindcss from "@tailwindcss/vite"
import react from "@vitejs/plugin-react"
import path from "path"
import { defineConfig } from "vite"

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules")) {
            if (/[/]react[/]|[/]react-dom[/]|[/]react-router-dom[/]/.test(id)) {
              return "vendor-react"
            }
            if (/[/]lucide-react[/]|[/]sonner[/]|[/]cmdk[/]/.test(id)) {
              return "vendor-ui"
            }
            if (
              /[/]recharts[/]|[/]date-fns[/]|[/]react-day-picker[/]/.test(id)
            ) {
              return "vendor-data"
            }
            if (/[/]react-hook-form[/]|[/]zod[/]|[/]axios[/]/.test(id)) {
              return "vendor-form"
            }
          }
        },
        entryFileNames: "js/[name].[hash].js",
        chunkFileNames: "js/[name].[hash].js",
        assetFileNames: (assetInfo) => {
          const name = assetInfo.name ?? ""
          if (/\.(gif|jpe?g|png|svg|webp)$/.test(name))
            return "images/[name].[hash][extname]"
          if (/\.css$/.test(name)) return "css/[name].[hash][extname]"
          return "assets/[name].[hash][extname]"
        },
      },
    },
  },
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:3000",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ""),
      },
    },
  },
})
