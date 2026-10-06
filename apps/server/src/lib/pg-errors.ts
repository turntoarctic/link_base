/**
 * PG 错误识别：drizzle 把原始错误包进 cause 链（DrizzleQueryError → PostgresError）。
 * Bun 的 PostgresError 把 SQLSTATE 放在 errno（code 是 ERR_POSTGRES_SERVER_ERROR），
 * 两者都要查（后者兜底未来换驱动）。
 */
export function pgErrorChain(error: unknown): unknown[] {
  const chain: unknown[] = [error]
  let current = error
  while (current instanceof Error && current.cause) {
    current = current.cause
    chain.push(current)
  }
  return chain
}

/** 唯一约束冲突（SQLSTATE 23505） */
export function isUniqueViolation(error: unknown): boolean {
  return pgErrorChain(error).some((e) => {
    if (typeof e !== 'object' || e === null) return false
    const code = (e as { errno?: string }).errno ?? (e as { code?: string }).code
    return code === '23505'
  })
}
