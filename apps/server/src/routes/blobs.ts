/** Blob 附件端点（10 §5.3）：上传 multipart ≤25MB；GET 内容寻址（能力 URL）；DELETE 管理用 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../lib/context.ts'
import { errNotFound, errPayloadTooLarge } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { MAX_BLOB_BYTES, createBlobsService } from '../services/blobs.service.ts'

export function blobsRouter(deps: ServerDeps): Hono<AppEnv> {
  const blobs = createBlobsService(deps.db)

  return new Hono<AppEnv>()
    .use('/workspaces/:wsId/blobs', requireAuth, requireMember)
    .post(
      '/workspaces/:wsId/blobs',
      bodyLimit({
        maxSize: MAX_BLOB_BYTES,
        onError: (c) => {
          throw errPayloadTooLarge(MAX_BLOB_BYTES)
        },
      }),
      async (c) => {
        const form = await c.req.parseBody()
        const file = form['file']
        if (!(file instanceof File)) throw errNotFound('file field required')
        const bytes = new Uint8Array(await file.arrayBuffer())
        const created = await blobs.create(c.get('ws').id, c.get('user').id, {
          mime: file.type || 'application/octet-stream',
          bytes,
        })
        return c.json(created, 201)
      },
    )
    // GET /blobs/:id 无鉴权：id 为 128bit 内容寻址（不可猜测），<img> 无法携带 Bearer；
    // 更严格的签名 URL 随 P2 公开分享一并设计（03 §6）
    .get('/blobs/:id', async (c) => {
      const found = await blobs.get(c.req.param('id'))
      if (!found) return c.json({ error: { code: 'LB_NOT_FOUND', message: 'blob not found' } }, 404)
      return c.body(new Uint8Array(found.bytes) as unknown as ArrayBuffer, 200, {
        'content-type': found.mime,
        'cache-control': 'public, max-age=31536000, immutable',
      })
    })
    .delete('/blobs/:id', requireAuth, async (c) => {
      await blobs.remove(c.req.param('id'))
      return c.body(null, 204)
    })
}
