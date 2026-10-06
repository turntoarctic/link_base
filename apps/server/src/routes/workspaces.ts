/** /api/workspaces/* 与 /api/invites/*（10 §3）：成员校验中间件统一挂载（03 §3） */
import { Hono } from 'hono'
import {
  createWorkspaceSchema,
  inviteSchema,
  patchMemberSchema,
  patchWorkspaceSchema,
  transferSchema,
} from '@linkbase/contracts'
import type { AppEnv } from '../lib/context.ts'
import { validate } from '../lib/validate.ts'
import { requireAuth } from '../middleware/auth.ts'
import { requireAdmin, requireMember, requireOwner } from '../middleware/workspace.ts'
import type { ServerDeps } from '../lib/deps.ts'
import { createWorkspacesService } from '../services/workspaces.service.ts'

export function workspacesRouter(deps: ServerDeps): Hono<AppEnv> {
  const svc = createWorkspacesService(deps.db, deps.sessions, deps.appOrigin)

  return new Hono<AppEnv>()
    .use('*', requireAuth)
    .post('/', validate('json', createWorkspaceSchema), async (c) => {
      const { name } = c.req.valid('json')
      const ws = await svc.create(c.get('user').id, name)
      return c.json(ws, 201)
    })
    .get('/', async (c) => {
      return c.json(await svc.listMine(c.get('user').id), 200)
    })
    .patch('/:wsId', requireMember, requireAdmin, validate('json', patchWorkspaceSchema), async (c) => {
      await svc.patch(c.req.param('wsId'), c.req.valid('json'))
      return c.json(await svc.get(c.req.param('wsId')), 200)
    })
    .get('/:wsId', requireMember, async (c) => {
      return c.json(await svc.get(c.req.param('wsId')), 200)
    })
    .get('/:wsId/members', requireMember, async (c) => {
      return c.json(await svc.members(c.req.param('wsId')), 200)
    })
    .post('/:wsId/invite', requireMember, requireAdmin, validate('json', inviteSchema), async (c) => {
      const result = await svc.invite(c.req.param('wsId'), c.get('user').id)
      return c.json(result, 201)
    })
    .patch(
      '/:wsId/members/:userId',
      requireMember,
      requireAdmin,
      validate('json', patchMemberSchema),
      async (c) => {
        await svc.patchMemberRole(
          c.req.param('wsId'),
          c.get('ws').role,
          c.req.param('userId'),
          c.req.valid('json').role,
        )
        return c.body(null, 204)
      },
    )
    .delete('/:wsId/members/:userId', requireMember, requireAdmin, async (c) => {
      await svc.removeMember(c.req.param('wsId'), c.req.param('userId'))
      return c.body(null, 204)
    })
    .post('/:wsId/transfer', requireMember, requireOwner, validate('json', transferSchema), async (c) => {
      await svc.transfer(c.req.param('wsId'), c.get('user').id, c.req.valid('json').toUserId)
      return c.body(null, 204)
    })
}

/** /api/invites/:token：信息公开，接受需登录（10 §3） */
export function invitesRouter(deps: ServerDeps): Hono<AppEnv> {
  const svc = createWorkspacesService(deps.db, deps.sessions, deps.appOrigin)
  return new Hono<AppEnv>()
    .get('/:token', async (c) => {
      const info = await svc.inviteInfo(c.req.param('token'))
      if (!info) return c.json({ error: { code: 'LB_NOT_FOUND', message: 'invite not found' } }, 404)
      return c.json(info, 200)
    })
    .post('/:token/accept', requireAuth, async (c) => {
      await svc.acceptInvite(c.req.param('token'), c.get('user').id)
      return c.body(null, 204)
    })
}
