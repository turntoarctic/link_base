import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  // React Compiler 为 P1 评估项（06 §1）：届时按 @vitejs/plugin-react 实际选项接入，默认关闭
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: false },
      '/ws': { target: 'ws://localhost:3001', ws: true, changeOrigin: false }, // Phase 2（09）
    },
  },
})

