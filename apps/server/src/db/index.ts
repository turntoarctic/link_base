/** drizzle 实例（07 §2）：Bun.SQL 原生驱动，内置连接池 */
import { createDb } from '@linkbase/database'
import { env } from '../env.ts'

export const db = createDb(env.DATABASE_URL)
export * from '@linkbase/database'
