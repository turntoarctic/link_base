/** Redis 固定窗口限流（07 §3）：INCR + EXPIRE；登录/注册更严；Redis 缺省走内存 KV */
import { createMiddleware } from 'hono/factory'
import type { AppEnv } from '../lib/context.ts'
import { errRateLimited } from '../lib/errors.ts'
import type { KV } from '../db/redis.ts'

export interface RateLimitOptions {
  prefix: string
  windowSec: number
  max: number
  /** 关闭时直接放行（RATE_LIMIT_ENABLED=false） */
  enabled?: boolean
}

export const rateLimit =
  (kv: KV, options: RateLimitOptions) =>
  // eslint-disable-next-line @typescript-eslint/no-invalid-void-type
  createMiddleware<AppEnv>(async (c, next) => {
    if (options.enabled === false) return next()
    const ip =
      c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
      c.req.header('x-real-ip') ??
      'local'
    const key = `rl:${options.prefix}:${ip}`
    const count = await kv.incr(key, options.windowSec)
    c.header('X-RateLimit-Limit', String(options.max))
    c.header('X-RateLimit-Remaining', String(Math.max(0, options.max - count)))
    if (count > options.max) {
      c.header('Retry-After', String(options.windowSec))
      throw errRateLimited(options.windowSec)
    }
    await next()
  })
