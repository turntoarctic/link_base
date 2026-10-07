/** 工作空间服务（10 §3）：CRUD、成员、邀请（Redis 7d）、角色、转让 */
import { and, eq, sql } from 'drizzle-orm'
import type { UserRole } from '@linkbase/types'
import { users, workspaceMembers, workspaces } from '../db/index.ts'
import { errForbidden, errNotFound } from '../lib/errors.ts'
import { randomToken, uuidv7 } from '../lib/ids.ts'
import { type Sessions } from '../db/redis.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

export function createWorkspacesService(db: LinkbaseDb, sessions: Sessions, appOrigin: string) {
  const svc = {
    async create(userId: string, name: string): Promise<{ id: string; name: string }> {
      const id = uuidv7()
      await db.transaction(async (tx) => {
        await tx.insert(workspaces).values({ id, name, createdBy: userId })
        await tx.insert(workspaceMembers).values({ workspaceId: id, userId, role: 'owner' })
      })
      return { id, name }
    },

    async listMine(userId: string): Promise<Array<{ id: string; name: string; role: UserRole }>> {
      const rows = await db
        .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
      return rows.map((r) => ({ id: r.id, name: r.name, role: r.role as UserRole }))
    },

    async get(wsId: string): Promise<{ id: string; name: string; avatarUrl: string | null; memberCount: number }> {
      const rows = await db.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1)
      const ws = rows[0]
      if (!ws) throw errNotFound('workspace not found')
      const counts = await db
        .select({ count: sql<number>`count(*)::int` })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.workspaceId, wsId))
      return { id: ws.id, name: ws.name, avatarUrl: ws.avatarUrl, memberCount: counts[0]?.count ?? 0 }
    },

    /** 删除空间（仅 owner；FK 级联清成员/页面/文档派生） */
    async remove(wsId: string): Promise<void> {
      await db.delete(workspaces).where(eq(workspaces.id, wsId))
    },

    async patch(wsId: string, input: { name?: string; avatarUrl?: string | null }): Promise<void> {
      await db.update(workspaces).set(input).where(eq(workspaces.id, wsId))
    },

    async members(wsId: string) {
      return db
        .select({
          userId: users.id,
          name: users.name,
          email: users.email,
          avatarUrl: users.avatarUrl,
          role: workspaceMembers.role,
        })
        .from(workspaceMembers)
        .innerJoin(users, eq(users.id, workspaceMembers.userId))
        .where(eq(workspaceMembers.workspaceId, wsId))
    },

    /** 邀请：token 入 Redis 7d（03 §5） */
    async invite(wsId: string, inviterId: string): Promise<{ inviteUrl: string; expiresAt: string }> {
      const wsRows = await db.select().from(workspaces).where(eq(workspaces.id, wsId)).limit(1)
      if (!wsRows[0]) throw errNotFound('workspace not found')
      const inviterRows = await db.select({ name: users.name }).from(users).where(eq(users.id, inviterId)).limit(1)
      const token = randomToken(24)
      await sessions.putInvite(token, {
        workspaceId: wsId,
        workspaceName: wsRows[0].name,
        inviterName: inviterRows[0]?.name ?? '',
      })
      const origin = appOrigin.replace(/\/$/, '')
      return {
        inviteUrl: `${origin}/invite/${token}`,
        expiresAt: new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString(),
      }
    },

    async inviteInfo(token: string): Promise<{ workspaceName: string; inviterName: string; expiresAt: string } | null> {
      return sessions.peekInvite(token)
    },

    /** 登录后接受邀请 → 加入为 member（10 §3） */
    async acceptInvite(token: string, userId: string): Promise<void> {
      const payload = await sessions.consumeInvite(token)
      if (!payload) throw errNotFound('invite not found or expired')
      const existing = await db
        .select({ role: workspaceMembers.role })
        .from(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, payload.workspaceId), eq(workspaceMembers.userId, userId)))
        .limit(1)
      if (existing.length === 0) {
        await db
          .insert(workspaceMembers)
          .values({ workspaceId: payload.workspaceId, userId, role: 'member' })
      }
    },

    /** 改角色：不可作用于 owner（03 §2：除非先转让）；升 owner 走 transfer */
    async patchMemberRole(wsId: string, actorRole: UserRole, targetUserId: string, role: UserRole): Promise<void> {
      const target = await memberRole(db, wsId, targetUserId)
      if (!target) throw errNotFound('member not found')
      if (target === 'owner') throw errForbidden('cannot modify owner role')
      if (role === 'owner') throw errForbidden('use transfer to assign owner')
      void actorRole
      await db
        .update(workspaceMembers)
        .set({ role })
        .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, targetUserId)))
    },

    /** 移除成员：不能移除 owner */
    async removeMember(wsId: string, targetUserId: string): Promise<void> {
      const target = await memberRole(db, wsId, targetUserId)
      if (!target) throw errNotFound('member not found')
      if (target === 'owner') throw errForbidden('cannot remove owner')
      await db
        .delete(workspaceMembers)
        .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, targetUserId)))
    },

    /** 转让 owner（owner 专属）：对方升 owner，自己降 admin */
    async transfer(wsId: string, fromUserId: string, toUserId: string): Promise<void> {
      const target = await memberRole(db, wsId, toUserId)
      if (!target) throw errNotFound('member not found')
      await db.transaction(async (tx) => {
        await tx
          .update(workspaceMembers)
          .set({ role: 'owner' })
          .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, toUserId)))
        await tx
          .update(workspaceMembers)
          .set({ role: 'admin' })
          .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, fromUserId)))
      })
    },
  }
  return svc
}

async function memberRole(db: LinkbaseDb, wsId: string, userId: string): Promise<UserRole | null> {
  const rows = await db
    .select({ role: workspaceMembers.role })
    .from(workspaceMembers)
    .where(and(eq(workspaceMembers.workspaceId, wsId), eq(workspaceMembers.userId, userId)))
    .limit(1)
  return (rows[0]?.role as UserRole | undefined) ?? null
}
