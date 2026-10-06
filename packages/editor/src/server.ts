/**
 * server 子路径（05 §2）：只导出 schema 常量，零 React/ProseMirror 运行时依赖。
 * 服务端（packages/ydoc、apps/server）只允许 import 本入口。
 */
export * from './schema.ts'
