/** /api/health（07 §9）：PG select 1 与 Redis ping，供 docker healthcheck */
import { Hono, type Env } from 'hono'
import { sql } from 'drizzle-orm'
import type { ServerDeps } from '../lib/deps.ts'

export function healthRouter(deps: ServerDeps): Hono<Env> {
  return new Hono<Env>().get('/', async (c) => {
    let dbOk = false
    let redisOk = false
    try {
      await deps.db.execute(sql`select 1`)
      dbOk = true
    } catch {
      dbOk = false
    }
    try {
      redisOk = await deps.kv.ping()
    } catch {
      redisOk = false
    }
    const ok = dbOk
    return c.json({ ok, db: dbOk, redis: redisOk }, ok ? 200 : 503)
  })
}
