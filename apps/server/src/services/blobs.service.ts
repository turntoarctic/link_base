/** 附件服务（10 §5.3）：内容寻址（sha256 前 32 hex），MVP 库内 bytea（08 §7） */
import { eq } from 'drizzle-orm'
import { blobs } from '../db/index.ts'
import { errNotFound, errPayloadTooLarge } from '../lib/errors.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

export const MAX_BLOB_BYTES = 25 * 1024 * 1024

export function createBlobsService(db: LinkbaseDb) {
  return {
    async create(
      wsId: string,
      userId: string,
      file: { mime: string; bytes: Uint8Array },
    ): Promise<{ id: string; mime: string; size: number }> {
      if (file.bytes.byteLength > MAX_BLOB_BYTES) throw errPayloadTooLarge(MAX_BLOB_BYTES)
      const digest = await crypto.subtle.digest('sha-256', file.bytes as unknown as ArrayBuffer)
      const hex = Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('')
      const id = hex.slice(0, 32)
      const existing = await db.select({ id: blobs.id }).from(blobs).where(eq(blobs.id, id)).limit(1)
      if (!existing[0]) {
        await db.insert(blobs).values({
          id,
          workspaceId: wsId,
          mime: file.mime || 'application/octet-stream',
          size: file.bytes.byteLength,
          data: file.bytes,
          createdBy: userId,
        })
      }
      return { id, mime: file.mime, size: file.bytes.byteLength }
    },

    /** GET /blobs/:id：内容寻址 id 即能力 URL（不可猜测），MVP 不做签名（P2 公开分享时定） */
    async get(id: string): Promise<{ mime: string; bytes: Uint8Array } | null> {
      const rows = await db.select().from(blobs).where(eq(blobs.id, id)).limit(1)
      const row = rows[0]
      if (!row) return null
      return { mime: row.mime, bytes: row.data }
    },

    /** DELETE：引用计数待细化（08 §8），MVP 直接删（清理任务代劳孤儿回收） */
    async remove(id: string): Promise<void> {
      await db.delete(blobs).where(eq(blobs.id, id))
    },
  }
}
