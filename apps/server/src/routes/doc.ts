/** Y.Doc 二进制端点（10 §5.2）：pull 带 state vector 差分；push octet-stream ≤512KB。
 * 版本历史（08 §4.5，T2.3）：手动保存 / 时间线 / 版本正文 / 恢复（写 reason=restore 快照）。 */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../lib/context.ts'
import { errNotFound, errPayloadTooLarge } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import type { ServerDeps } from '../lib/deps.ts'
import {
  MAX_UPDATE_BYTES,
  getVersionText,
  listVersions,
  pullDoc,
  pushDoc,
  restoreVersion,
  saveVersion,
} from '../services/docs.service.ts'
import { applyServerUpdate } from '../ws/rooms.ts'

export function docRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
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
