/** 工作空间成员校验（03 §3）：每次请求查一次成员表，不缓存；非成员 403 */
import { and, eq } from 'drizzle-orm'
import { createMiddleware } from 'hono/factory'
import type { UserRole } from '@linkbase/types'
import type { AppEnv } from '../lib/context.ts'
import { errForbidden } from '../lib/errors.ts'
import { db, workspaceMembers } from '../db/index.ts'

export const requireMember = createMiddleware<AppEnv>(async (c, next) => {
  const wsId = c.req.param('wsId')
  const userId = c.get('user').id
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId)))
    .limit(1)
  const role = rows[0]?.role as UserRole | undefined
  if (!role) throw errForbidden('not a workspace member')
  c.set('ws', { id: wsId, role })
  await next()
})

/** 角色门槛：owner/admin 通行（03 §2 权限矩阵） */
export const requireAdmin = createMiddleware<AppEnv>(async (c, next) => {
  const { role } = c.get('ws')
  if (role !== 'owner' && role !== 'admin') throw errForbidden('owner/admin required')
  await next()
})

/** 仅 owner */
export const requireOwner = createMiddleware<AppEnv>(async (c, next) => {
  if (c.get('ws').role !== 'owner') throw errForbidden('owner required')
  await next()
})
