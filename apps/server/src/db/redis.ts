/**
 * KV 抽象（08 §3.5 Redis 键）：refresh / invite / ws-ticket / 限流计数。
 * 仅承载可重建数据（07 §6）。Redis 经 Bun 原生客户端；
 * REDIS_URL 未配置、或运行时连接失败（含首次使用时才发现）→ 降级进程内存 KV（仅单实例开发，告警）。
 */
import { env } from '../env.ts'
import { logger } from '../lib/logger.ts'

export interface KV {
  get(key: string): Promise<string | null>
  set(key: string, value: string, ttlSec?: number): Promise<void>
  del(key: string): Promise<void>
  /** 自增并保证首增时设置 TTL；返回新值 */
  incr(key: string, ttlSec: number): Promise<number>
  /** 探活（health 用）；不触发降级 */
  ping(): Promise<boolean>
  close(): Promise<void>
}

interface RedisLike {
  get(key: string): Promise<string | null>
  set(key: string, value: string): Promise<unknown>
  del(key: string): Promise<unknown>
  incr(key: string): Promise<number>
  expire(key: string, seconds: number): Promise<unknown>
  send(command: string, args?: string[]): Promise<unknown>
}

function createMemoryKV(): KV {
  const store = new Map<string, { value: string; expiresAt: number | null }>()
  return {
    async get(key) {
      const entry = store.get(key)
      if (!entry) return null
      if (entry.expiresAt !== null && entry.expiresAt < Date.now()) {
        store.delete(key)
        return null
      }
      return entry.value
    },
    async set(key, value, ttlSec) {
      store.set(key, { value, expiresAt: ttlSec ? Date.now() + ttlSec * 1000 : null })
    },
    async del(key) {
      store.delete(key)
    },
    async incr(key, ttlSec) {
      const current = Number((await this.get(key)) ?? 0)
      const next = current + 1
      if (current === 0) {
        store.set(key, { value: String(next), expiresAt: Date.now() + ttlSec * 1000 })
      } else {
        store.set(key, { value: String(next), expiresAt: store.get(key)?.expiresAt ?? null })
      }
      return next
    },
    async ping() {
      return true
    },
    async close() {
      store.clear()
    },
  }
}

function wrapRedis(redis: RedisLike): KV {
  return {
    async get(key) {
      return redis.get(key)
    },
    async set(key, value, ttlSec) {
      await redis.set(key, value)
      if (ttlSec) await redis.expire(key, ttlSec)
    },
    async del(key) {
      await redis.del(key)
    },
    async incr(key, ttlSec) {
      const next = await redis.incr(key)
      if (next === 1) await redis.expire(key, ttlSec)
      return next
    },
    async ping() {
      try {
        await redis.send('PING')
        return true
      } catch {
        return false
      }
    },
    async close() {
      // Bun.redis 默认客户端由运行时管理，无需显式关闭
    },
  }
}

/**
 * 带运行时降级的 KV：get/set/del/incr 任一次失败或超过 500ms 未返回（Bun redis
 * 连接重试最长可拖数十秒，不能让请求等它）即永久切换到内存 KV 并告警一次——
 * 会话/邀请/票据/限流全部可重建，重启后 Redis 恢复即回到 Redis。
 * ping 只报状态，不触发降级（health 展示 redis:false）。
 */
const DEGRADE_TIMEOUT_MS = 500

function createFailoverKV(redisKv: KV, memoryKv: KV): KV {
  let degraded = false
  const degrade = (op: string, error: unknown) => {
    if (degraded) return
    degraded = true
    logger.warn({ error, op }, '[kv] Redis unavailable, degrading to in-memory KV (dev only; restart server to re-enable Redis)')
  }
  /** 与超时赛跑：Redis 慢/挂都快速落到内存分支 */
  const withDeadline = <T>(promise: Promise<T>): Promise<T> =>
    Promise.race([
      promise,
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error(`kv op exceeded ${DEGRADE_TIMEOUT_MS}ms`)), DEGRADE_TIMEOUT_MS),
      ),
    ])

  return {
    async get(key) {
      if (degraded) return memoryKv.get(key)
      try {
        return await withDeadline(redisKv.get(key))
      } catch (error) {
        degrade('get', error)
        return memoryKv.get(key)
      }
    },
    async set(key, value, ttlSec) {
      if (degraded) return memoryKv.set(key, value, ttlSec)
      try {
        await withDeadline(redisKv.set(key, value, ttlSec))
      } catch (error) {
        degrade('set', error)
        await memoryKv.set(key, value, ttlSec)
      }
    },
    async del(key) {
      if (degraded) return memoryKv.del(key)
      try {
        await withDeadline(redisKv.del(key))
      } catch (error) {
        degrade('del', error)
        await memoryKv.del(key)
      }
    },
    async incr(key, ttlSec) {
      if (degraded) return memoryKv.incr(key, ttlSec)
      try {
        return await withDeadline(redisKv.incr(key, ttlSec))
      } catch (error) {
        degrade('incr', error)
        return memoryKv.incr(key, ttlSec)
      }
    },
    async ping() {
      return redisKv.ping()
    },
    async close() {
      await redisKv.close()
      await memoryKv.close()
    },
  }
}

export function createKV(url: string | undefined = env.REDIS_URL): KV {
  const memoryKv = createMemoryKV()
  const bun = (globalThis as { Bun?: { redis?: RedisLike } }).Bun
  if (url && bun?.redis) {
    try {
      // Bun.redis 默认客户端读取 REDIS_URL 环境变量；显式指定时走 with 绑定
      const client = url === Bun.env.REDIS_URL ? bun.redis : bun.redis.with(url)
      return createFailoverKV(wrapRedis(client as unknown as RedisLike), memoryKv)
    } catch (error) {
      logger.warn({ error }, '[kv] Bun.redis 初始化失败，使用内存 KV')
    }
  }
  if (!url) {
    logger.warn('[kv] REDIS_URL 未设置，使用进程内存 KV（仅单实例开发；会话/邀请重启即失效）')
  }
  return memoryKv
}

/* ------------------------------- 业务键封装 ------------------------------- */

export interface RefreshSession {
  userId: string
  workspaceId?: string
}

export interface InvitePayload {
  workspaceId: string
  workspaceName: string
  inviterName: string
  expiresAt: string
}

const REFRESH_TTL = 7 * 24 * 3600
const INVITE_TTL = 7 * 24 * 3600
export const REFRESH_TTL_SEC = REFRESH_TTL
export const INVITE_TTL_SEC = INVITE_TTL

export const refreshKey = (token: string) => `refresh:${token}`
export const inviteKey = (token: string) => `invite:${token}`

export function createSessions(kv: KV) {
  return {
    async putRefresh(token: string, session: RefreshSession): Promise<void> {
      await kv.set(refreshKey(token), JSON.stringify(session), REFRESH_TTL)
    },
    async takeRefresh(token: string): Promise<RefreshSession | null> {
      const raw = await kv.get(refreshKey(token))
      if (!raw) return null
      await kv.del(refreshKey(token)) // 旋转即焚（07 §5）
      try {
        return JSON.parse(raw) as RefreshSession
      } catch {
        return null
      }
    },
    async peekRefresh(token: string): Promise<RefreshSession | null> {
      const raw = await kv.get(refreshKey(token))
      if (!raw) return null
      try {
        return JSON.parse(raw) as RefreshSession
      } catch {
        return null
      }
    },
    async delRefresh(token: string): Promise<void> {
      await kv.del(refreshKey(token))
    },
    async putInvite(token: string, payload: Omit<InvitePayload, 'expiresAt'>): Promise<void> {
      const full: InvitePayload = {
        ...payload,
        expiresAt: new Date(Date.now() + INVITE_TTL * 1000).toISOString(),
      }
      await kv.set(inviteKey(token), JSON.stringify(full), INVITE_TTL)
    },
    async peekInvite(token: string): Promise<InvitePayload | null> {
      const raw = await kv.get(inviteKey(token))
      if (!raw) return null
      try {
        return JSON.parse(raw) as InvitePayload
      } catch {
        return null
      }
    },
    async consumeInvite(token: string): Promise<InvitePayload | null> {
      const payload = await this.peekInvite(token)
      if (payload) await kv.del(inviteKey(token))
      return payload
    },
  }
}

export type Sessions = ReturnType<typeof createSessions>
