/** /api/workspaces/:wsId/pages|trash|favorites|recents 与标签端点（10 §4/§7） */
import { Hono } from 'hono'
import { bodyLimit } from 'hono/body-limit'
import {
  createPageSchema,
  createTagSchema,
  patchPageSchema,
  patchTagSchema,
} from '@linkbase/contracts'
import type { AppEnv } from '../lib/context.ts'
import { validate } from '../lib/validate.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { createPagesService } from '../services/pages.service.ts'
import { createTagsService } from '../services/tags.service.ts'

export function pagesRouter(deps: ServerDeps): Hono<AppEnv> {
  const pages = createPagesService(deps.db)
  const tags = createTagsService(deps.db)

  return new Hono<AppEnv>()
    .use('/:wsId/*', requireAuth, requireMember)
    .get('/:wsId/pages', async (c) => c.json(await pages.tree(c.get('ws').id), 200))
    .get('/:wsId/templates', async (c) => c.json(await pages.listTemplates(c.get('ws').id), 200))
    .post(
      '/:wsId/pages',
      bodyLimit({
        maxSize: 1024 * 1024,
        onError: (c) =>
          c.json({ error: { code: 'LB_PAYLOAD_TOO_LARGE', message: 'payload too large' } }, 413),
      }),
      validate('json', createPageSchema),
      async (c) => {
        const page = await pages.create(c.get('ws').id, c.get('user').id, c.req.valid('json'))
        return c.json(page, 201)
      },
    )
    .get('/:wsId/pages/:pageId', async (c) =>
      c.json(await pages.getMeta(c.get('ws').id, c.req.param('pageId')), 200),
    )
    .patch('/:wsId/pages/:pageId', validate('json', patchPageSchema), async (c) => {
      await pages.patch(c.get('ws').id, c.req.param('pageId'), c.req.valid('json'))
      return c.body(null, 204)
    })
    .delete('/:wsId/pages/:pageId', async (c) => {
      const pageId = c.req.param('pageId')
      if (c.req.query('permanent') === 'true') {
        await pages.permanentDelete(c.get('ws').id, pageId)
      } else {
        await pages.trash(c.get('ws').id, pageId)
      }
      return c.body(null, 204)
    })
    .post('/:wsId/pages/:pageId/restore', async (c) => {
      await pages.restore(c.get('ws').id, c.req.param('pageId'))
      return c.body(null, 204)
    })
    .get('/:wsId/trash', async (c) => c.json(await pages.trashList(c.get('ws').id), 200))
    .put('/:wsId/pages/:pageId/favorite', async (c) => {
      await pages.addFavorite(c.get('ws').id, c.get('user').id, c.req.param('pageId'))
      return c.body(null, 204)
    })
    .delete('/:wsId/pages/:pageId/favorite', async (c) => {
      await pages.removeFavorite(c.get('user').id, c.req.param('pageId'))
      return c.body(null, 204)
    })
    .get('/:wsId/favorites', async (c) =>
      c.json(await pages.favoriteList(c.get('ws').id, c.get('user').id), 200),
    )
    .put('/:wsId/pages/:pageId/visit', async (c) => {
      await pages.recordVisit(c.get('ws').id, c.get('user').id, c.req.param('pageId'))
      return c.body(null, 204)
    })
    .get('/:wsId/recents', async (c) =>
      c.json(await pages.recentList(c.get('ws').id, c.get('user').id), 200),
    )
    // 标签（10 §7）
    .get('/:wsId/tags', async (c) => c.json(await tags.list(c.get('ws').id), 200))
    .post('/:wsId/tags', validate('json', createTagSchema), async (c) => {
      const tag = await tags.create(c.get('ws').id, c.req.valid('json'))
      return c.json(tag, 201)
    })
    .patch('/:wsId/tags/:tagId', validate('json', patchTagSchema), async (c) => {
      await tags.patch(c.get('ws').id, c.req.param('tagId'), c.req.valid('json'))
      return c.body(null, 204)
    })
    .delete('/:wsId/tags/:tagId', async (c) => {
      await tags.remove(c.get('ws').id, c.req.param('tagId'))
      return c.body(null, 204)
    })
    .get('/:wsId/pages/:pageId/tags', async (c) =>
      c.json(await pages.pageTagIds(c.get('ws').id, c.req.param('pageId')), 200),
    )
    .put('/:wsId/pages/:pageId/tags/:tagId', async (c) => {
      await pages.addPageTag(c.get('ws').id, c.req.param('pageId'), c.req.param('tagId'))
      return c.body(null, 204)
    })
    .delete('/:wsId/pages/:pageId/tags/:tagId', async (c) => {
      await pages.removePageTag(c.req.param('pageId'), c.req.param('tagId'))
      return c.body(null, 204)
    })
}
