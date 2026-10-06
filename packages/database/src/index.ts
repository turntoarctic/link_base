import { drizzle } from 'drizzle-orm/bun-sql'
import { SQL } from 'bun'
import * as schema from './schema.ts'

/** Bun.SQL 原生驱动（07 §1：drizzle-orm/bun-sql，内置连接池） */
export const createDb = (url: string) => drizzle(new SQL(url), { schema })

export * from './schema.ts'
