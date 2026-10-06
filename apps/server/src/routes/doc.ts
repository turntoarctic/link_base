/** Y.Doc 二进制端点（10 §5.2）：pull 带 state vector 差分；push octet-stream ≤512KB。
 * 版本历史（08 §4.5，T2.3）：手动保存 / 时间线 / 版本正文 / 恢复（写 reason=restore 快照）。 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import { z } from 'zod'
import type { AppEnv } from '../lib/context.ts'
import { errNotFound, errPayloadTooLarge } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import { validate } from '../lib/validate.ts'
import type { ServerDeps } from '../lib/deps.ts'
import {
  MAX_UPDATE_BYTES,
  exportPageMarkdown,
  getVersionText,
  importPageMarkdown,
  listBacklinks,
  listVersions,
  pullDoc,
  pushDoc,
  restoreVersion,
  saveVersion,
} from '../services/docs.service.ts'
import { applyServerUpdate } from '../ws/rooms.ts'

const importSchema = z.object({
  title: z.string().max(200).optional(),
  markdown: z.string().min(1).max(200_000),
})

export function docRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    // Markdown 导入导出（05 §7 / T2.5）：先于 :pageId 参数路由注册
    .use('/:wsId/pages/import', requireAuth, requireMember)
    .post(
      '/:wsId/pages/import',
      validate('json', importSchema),
      async (c) => {
        const { title, markdown } = c.req.valid('json')
        const page = await importPageMarkdown(deps.db, c.get('ws').id, c.get('user').id, { title, markdown })
        return c.json(page, 201)
      },
    )
    .use('/:wsId/pages/:pageId/export', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/export', async (c) => {
      const pageId = c.req.param('pageId')
      const { title, markdown } = await exportPageMarkdown(deps.db, pageId)
      const filename = encodeURIComponent(`${title || 'page'}.md`)
      return c.body(markdown, 200, {
        'content-type': 'text/markdown; charset=utf-8',
        'content-disposition': `attachment; filename="page-${pageId.slice(0, 8)}.md"; filename*=UTF-8''${filename}`,
      })
    })
    .use('/:wsId/pages/:pageId/doc', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/doc', async (c) => {
      const stateParam = c.req.query('state')
      const diff = await pullDoc(deps.db, c.req.param('pageId'), stateParam ?? null)
      return c.body(new Uint8Array(diff) as unknown as ArrayBuffer, 200, {
        'content-type': 'application/octet-stream',
        'cache-control': 'no-store',
      })
    })
    .post(
      '/:wsId/pages/:pageId/doc',
      bodyLimit({
        maxSize: MAX_UPDATE_BYTES,
        onError: () => {
          throw errPayloadTooLarge(MAX_UPDATE_BYTES)
        },
      }),
      async (c) => {
        const bytes = new Uint8Array(await c.req.arrayBuffer())
        await pushDoc(deps.db, c.req.param('pageId'), c.get('user').id, bytes)
        return c.body(null, 204)
      },
    )
    // 反向链接（Phase 3）
    .use('/:wsId/pages/:pageId/backlinks', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/backlinks', async (c) => {
      const backlinks = await listBacklinks(deps.db, c.get('ws').id, c.req.param('pageId'))
      return c.json(backlinks, 200)
    })
    // 版本历史（T2.3）：中间件挂在同一 :pageId 形状上
    .use('/:wsId/pages/:pageId/versions', requireAuth, requireMember)
    .use('/:wsId/pages/:pageId/versions/:version', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/versions', async (c) => {
      const versions = await listVersions(deps.db, c.req.param('pageId'))
      return c.json(versions, 200)
    })
    .post('/:wsId/pages/:pageId/versions', async (c) => {
      const version = await saveVersion(deps.db, c.req.param('pageId'))
      return c.json({ version }, 201)
    })
    .get('/:wsId/pages/:pageId/versions/:version', async (c) => {
      const version = Number(c.req.param('version'))
      if (!Number.isInteger(version) || version <= 0) throw errNotFound('version not found')
      const text = await getVersionText(deps.db, c.req.param('pageId'), version)
      return c.json({ text }, 200)
    })
    .post('/:wsId/pages/:pageId/versions/:version/restore', async (c) => {
      const version = Number(c.req.param('version'))
      if (!Number.isInteger(version) || version <= 0) throw errNotFound('version not found')
      const wsId = c.req.param('wsId')
      const pageId = c.req.param('pageId')
      await restoreVersion(deps.db, wsId, pageId, version, c.get('user').id, (update) => {
        // 在线客户端即时合入（CRDT 合并，不丢并发编辑）；落库已由 restoreVersion 负责
        applyServerUpdate(wsId, pageId, update)
      })
      return c.body(null, 204)
    })
}
