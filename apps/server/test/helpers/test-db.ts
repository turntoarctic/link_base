/**
 * 测试共享工具：DB 连接池回收（bun test 多文件并行各建池，不关闭会耗尽 PG max_connections）。
 */
type AnyDb = { $client?: { close?: () => Promise<void> } }

const pending: AnyDb[] = []
let closing = false

export function trackDb<T extends AnyDb>(db: T): T {
  pending.push(db)
  return db
}

export async function closeTrackedDbs(): Promise<void> {
  if (closing) return
  closing = true
  for (const db of pending) {
    try {
      await db.$client?.close?.()
    } catch {
      // 连接已断等场景忽略
    }
  }
  pending.length = 0
  closing = false
}
