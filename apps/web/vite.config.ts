import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'

export default defineConfig({
  // React Compiler 为 P1 评估项（06 §1）：届时按 @vitejs/plugin-react 实际选项接入，默认关闭
  cacheDir: 'node_modules/.vite2', // 原 .vite/deps 被僵死句柄锁定，换目录绕开（Windows 文件锁）
  plugins: [react(), tailwindcss()],
  resolve: { alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) } },
  optimizeDeps: {
    // 单实例红线（06 §1.1）：所有 @tiptap 包必须作为同一个预打包构建的显式条目——
    // 分散发现时 core 会被各条目分别内联，跨副本 instanceof 失配 →
    // StarterKit 在扩展解析时被整体丢弃 → schema 缺 doc 节点（已实测踩坑）
    include: [
      '@tiptap/core',
      '@tiptap/react',
      '@tiptap/react/menus',
      '@tiptap/pm',
      '@tiptap/starter-kit',
      '@tiptap/extensions',
      '@tiptap/extension-collaboration',
      '@tiptap/extension-code-block-lowlight',
      '@tiptap/extension-highlight',
      '@tiptap/extension-table',
      '@tiptap/suggestion',
    ],
  },
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: false },
      '/ws': { target: 'ws://localhost:3001', ws: true, changeOrigin: false }, // Phase 2（09）
    },
  },
})
