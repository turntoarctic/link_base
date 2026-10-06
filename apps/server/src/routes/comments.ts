/** 评论端点（P1-3 / T2.4，10 §7 同构）：列表 / 新建（页面级或行内锚点）/ 回复 / 解决 / 编辑 / 删除 */
import { Hono } from 'hono'
import { z } from 'zod'
import type { AppEnv } from '../lib/context.ts'
import { errNotFound } from '../lib/errors.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireMember } from '../middleware/workspace.ts'
import { validate } from '../lib/validate.ts'
import type { ServerDeps } from '../lib/deps.ts'
import {
  createComment,
  deleteComment,
  listComments,
  setResolved,
  updateBody,
} from '../services/comments.service.ts'

const anchorSchema = z.object({
  quote: z.string().min(1).max(500),
  prefix: z.string().max(80).default(''),
  suffix: z.string().max(80).default(''),
})

const createSchema = z.object({
  body: z.string().min(1).max(2000).trim(),
  anchor: anchorSchema.optional(),
})

const replySchema = z.object({ body: z.string().min(1).max(2000).trim() })
const resolveSchema = z.object({ resolved: z.boolean() })
const editSchema = z.object({ body: z.string().min(1).max(2000).trim() })

export function commentsRouter(deps: ServerDeps): Hono<AppEnv> {
  return new Hono<AppEnv>()
    .use('/:wsId/pages/:pageId/comments', requireAuth, requireMember)
    .use('/:wsId/pages/:pageId/comments/:commentId', requireAuth, requireMember)
    .get('/:wsId/pages/:pageId/comments', async (c) => {
      return c.json(await listComments(deps.db, c.req.param('pageId')), 200)
    })
    .post(
      '/:wsId/pages/:pageId/comments',
      validate('json', createSchema),
      async (c) => {
        const { body, anchor } = c.req.valid('json')
        const item = await createComment(deps.db, {
          wsId: c.get('ws').id,
          pageId: c.req.param('pageId'),
          authorId: c.get('user').id,
          body,
          anchor: anchor ?? null,
        })
        return c.json(item, 201)
      },
    )
    .post(
      '/:wsId/pages/:pageId/comments/:commentId/replies',
      validate('json', replySchema),
      async (c) => {
        const pageId = c.req.param('pageId')
        const commentId = c.req.param('commentId')
        // 回复目标必须存在且属于本页
        const items = await listComments(deps.db, pageId)
        if (!items.some((i) => i.id === commentId)) throw errNotFound('comment not found')
        const { body } = c.req.valid('json')
        const item = await createComment(deps.db, {
          wsId: c.get('ws').id,
          pageId,
          authorId: c.get('user').id,
          body,
          parentId: commentId,
        })
        return c.json(item, 201)
      },
    )
    .post(
      '/:wsId/pages/:pageId/comments/:commentId/resolve',
      validate('json', resolveSchema),
      async (c) => {
        const { resolved } = c.req.valid('json')
        await setResolved(deps.db, c.req.param('pageId'), c.req.param('commentId'), resolved)
        return c.body(null, 204)
      },
    )
    .patch(
      '/:wsId/pages/:pageId/comments/:commentId',
      validate('json', editSchema),
      async (c) => {
        const { body } = c.req.valid('json')
        await updateBody(deps.db, c.req.param('pageId'), c.req.param('commentId'), body)
        return c.body(null, 204)
      },
    )
    .delete('/:wsId/pages/:pageId/comments/:commentId', async (c) => {
      await deleteComment(deps.db, c.req.param('pageId'), c.req.param('commentId'))
      return c.body(null, 204)
    })
}
