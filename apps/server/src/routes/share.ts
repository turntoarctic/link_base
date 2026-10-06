/**
 * 公开分享（Phase 3 立项第一项，03 §6 留位兑现）：
 * POST share { enabled } → 开启生成随机 slug（能力 URL /share/:slug，无鉴权只读）；
 * GET /share/:slug → 合并态 update 字节（octet-stream），客户端只读渲染。
 * slug 随机 32 hex（不可枚举）；关闭即失效（slug 保留复用，重开同 slug）。
 */
import { Hono } from 'hono'
import { eq, and } from 'drizzle-orm'
import type { AppEnv } from '../lib/context.ts'
import { errNotFound } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import { validate } from '../lib/validate.ts'
import { z } from 'zod'
import type { ServerDeps } from '../lib/deps.ts'
import { getPageState } from '../services/docs.service.ts'
import { pages } from '../db/index.ts'
import { randomToken } from '../lib/ids.ts'

const shareSchema = z.object({ enabled: z.boolean() })

export function shareRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    // 管理：成员可开关本空间页面的分享
    .use('/:wsId/pages/:pageId/share', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/share', async (c) => {
      const rows = await deps.db
        .select({ enabled: pages.shareEnabled, slug: pages.shareSlug })
        .from(pages)
        .where(and(eq(pages.id, c.req.param('pageId')), eq(pages.workspaceId, c.get('ws').id)))
        .limit(1)
      if (!rows[0]) throw errNotFound('page not found')
      return c.json({ enabled: rows[0].enabled, slug: rows[0].slug }, 200)
    })
    .post(
      '/:wsId/pages/:pageId/share',
      validate('json', shareSchema),
      async (c) => {
        const pageId = c.req.param('pageId')
        const { enabled } = c.req.valid('json')
        const owned = await deps.db
          .select({ slug: pages.shareSlug })
          .from(pages)
          .where(and(eq(pages.id, pageId), eq(pages.workspaceId, c.get('ws').id), eq(pages.isTrash, false)))
          .limit(1)
        if (!owned[0]) throw errNotFound('page not found')
        if (!enabled) {
          await deps.db.update(pages).set({ shareEnabled: false }).where(eq(pages.id, pageId))
          return c.body(null, 204)
        }
        let slug = owned[0].slug
        if (!slug) {
          slug = randomToken()
          await deps.db.update(pages).set({ shareEnabled: true, shareSlug: slug }).where(eq(pages.id, pageId))
        } else {
          await deps.db.update(pages).set({ shareEnabled: true }).where(eq(pages.id, pageId))
        }
        return c.json({ slug }, 200)
      },
    )
}

/** 公开只读端点（无鉴权；走全局限流）：合并态 update 字节 */
export function publicShareRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .get('/share/:slug', async (c) => {
      const slug = c.req.param('slug')
      const rows = await deps.db
        .select({ id: pages.id })
        .from(pages)
        .where(and(eq(pages.shareSlug, slug), eq(pages.shareEnabled, true), eq(pages.isTrash, false)))
        .limit(1)
      if (!rows[0]) throw errNotFound('share not found')
      const state = await getPageState(deps.db, rows[0].id)
      if (!state) throw errNotFound('share not found')
      return c.body(new Uint8Array(state) as unknown as ArrayBuffer, 200, {
        'content-type': 'application/octet-stream',
        'cache-control': 'no-store',
      })
    })
}
