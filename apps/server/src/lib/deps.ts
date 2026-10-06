/** 服务层依赖（07 §1：service = (db, input) => Promise<output>） */
import type { createDb } from '@linkbase/database'
import type { KV, Sessions } from '../db/redis.ts'

export type LinkbaseDb = ReturnType<typeof createDb>

export interface ServerDeps {
  db: LinkbaseDb
  kv: KV
  sessions: Sessions
  /** 对外域名（邀请链接拼接，11 §3 APP_ORIGIN；缺省相对路径） */
  appOrigin: string
}
