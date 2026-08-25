import { defineConfig } from "vite"
import { resolve } from "node:path"

const apiTarget = process.env.ARCANA_API_TARGET || "http://127.0.0.1:8010"

export default defineConfig({
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, "index.html"),
        result: resolve(__dirname, "result.html"),
        account: resolve(__dirname, "account.html"),
        cards: resolve(__dirname, "cards.html"),
      },
    },
  },
  server: {
    proxy: {
      "/api": apiTarget,
    },
  },
})
