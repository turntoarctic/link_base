/** Y.Doc 二进制端点（10 §5.2）：pull 带 state vector 差分；push octet-stream ≤512KB */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import type { AppEnv } from '../lib/context.ts'
import { errPayloadTooLarge } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { MAX_UPDATE_BYTES, pullDoc, pushDoc } from '../services/docs.service.ts'

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
}
