/**
 * 认证服务（07 §5 / 10 §2）：注册（零仪式：自动建空间+快速开始页）、登录、
 * refresh 旋转、登出、me。密码 Argon2id；Refresh 不透明 token 存 Redis。
 */
import { and, eq, isNull } from 'drizzle-orm'
import type {
  AuthSuccess,
  LoginInput,
  PatchUserInput,
  RegisterInput,
} from '@linkbase/contracts'
import type { UserRole } from '@linkbase/types'
import { buildQuickStartState, extractPageMeta } from '@linkbase/ydoc'
import { pageSnapshots, pages, users, workspaceMembers, workspaces } from '../db/index.ts'
import { errEmailTaken, errTokenInvalid, errUnauthorized } from '../lib/errors.ts'
import { randomToken, uuidv7 } from '../lib/ids.ts'
import { signAccessToken } from '../middleware/auth.ts'
import type { LinkbaseDb } from '../lib/deps.ts'
import type { Sessions } from '../db/redis.ts'

const QUICK_START_TITLE = '欢迎使用 Linkbase'

async function issueTokens(
  sessions: Sessions,
  userId: string,
  workspaceId?: string,
): Promise<{ accessToken: string; refreshToken: string }> {
  const accessToken = await signAccessToken(userId, workspaceId)
  const refreshToken = randomToken()
  await sessions.putRefresh(refreshToken, { userId, workspaceId })
  return { accessToken, refreshToken }
}

export function createAuthService(db: LinkbaseDb, sessions: Sessions) {
  return {
    /** 注册：事务内建 用户+空间+成员+快速开始页（含首快照与文本派生），02 §1.1 */
    async register(input: RegisterInput): Promise<AuthSuccess> {
      const email = input.email.toLowerCase()
      const existing = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.email, email))
        .limit(1)
      if (existing.length > 0) throw errEmailTaken()

      const userId = uuidv7()
      const wsId = uuidv7()
      const pageId = uuidv7()
      const passwordHash = await Bun.password.hash(input.password, { algorithm: 'argon2id' })
      const state = buildQuickStartState('zh-CN')

      await db.transaction(async (tx) => {
        await tx.insert(users).values({ id: userId, email, passwordHash, name: input.name })
        await tx.insert(workspaces).values({ id: wsId, name: `${input.name} 的工作空间`, createdBy: userId })
        await tx.insert(workspaceMembers).values({ workspaceId: wsId, userId, role: 'owner' })
        await tx.insert(pages).values({
          id: pageId,
          workspaceId: wsId,
          title: QUICK_START_TITLE,
          createdBy: userId,
        })
        await tx.insert(pageSnapshots).values({ pageId, version: 1, blob: state, reason: 'auto' })
        await tx
          .update(pages)
          .set({ text: extractPageMeta(state).text })
          .where(eq(pages.id, pageId))
      })

      const tokens = await issueTokens(sessions, userId, wsId)
      return {
        user: { id: userId, email, name: input.name, avatarUrl: null, locale: null },
        ...tokens,
        workspace: { id: wsId, name: `${input.name} 的工作空间`, role: 'owner', welcomePageId: pageId },
      }
    },

    async login(input: LoginInput): Promise<Omit<AuthSuccess, 'workspace'>> {
      const email = input.email.toLowerCase()
      const rows = await db.select().from(users).where(eq(users.email, email)).limit(1)
      const user = rows[0]
      if (!user || user.deletedAt) throw errUnauthorized('invalid email or password')
      const ok = await Bun.password.verify(input.password, user.passwordHash)
      if (!ok) throw errUnauthorized('invalid email or password')

      const membership = await db
        .select({ workspaceId: workspaceMembers.workspaceId })
        .from(workspaceMembers)
        .where(eq(workspaceMembers.userId, user.id))
        .limit(1)
      const tokens = await issueTokens(sessions, user.id, membership[0]?.workspaceId)
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          locale: (user.locale as AuthSuccess['user']['locale']) ?? null,
        },
        ...tokens,
      }
    },

    /** refresh 旋转：旧 token 取出即焚，发新对（07 §5） */
    async refresh(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
      const session = await sessions.takeRefresh(refreshToken)
      if (!session) throw errTokenInvalid()
      return issueTokens(sessions, session.userId, session.workspaceId)
    },

    async logout(refreshToken: string): Promise<void> {
      await sessions.delRefresh(refreshToken)
    },

    async me(userId: string): Promise<{
      user: AuthSuccess['user']
      workspaces: Array<{ id: string; name: string; role: UserRole }>
    }> {
      const rows = await db
        .select()
        .from(users)
        .where(and(eq(users.id, userId), isNull(users.deletedAt)))
        .limit(1)
      const user = rows[0]
      if (!user) throw errUnauthorized()
      const memberships = await db
        .select({ id: workspaces.id, name: workspaces.name, role: workspaceMembers.role })
        .from(workspaceMembers)
        .innerJoin(workspaces, eq(workspaces.id, workspaceMembers.workspaceId))
        .where(eq(workspaceMembers.userId, userId))
      return {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          avatarUrl: user.avatarUrl,
          locale: (user.locale as AuthSuccess['user']['locale']) ?? null,
        },
        workspaces: memberships.map((m) => ({ id: m.id, name: m.name, role: m.role as UserRole })),
      }
    },

    /** PATCH /users/me（10 §2.1）：locale 跨端语言偏好 */
    async patchMe(userId: string, input: PatchUserInput): Promise<AuthSuccess['user']> {
      await db
        .update(users)
        .set({ ...input, updatedAt: new Date() })
        .where(eq(users.id, userId))
      const rows = await db.select().from(users).where(eq(users.id, userId)).limit(1)
      const user = rows[0]
      if (!user) throw errUnauthorized()
      return {
        id: user.id,
        email: user.email,
        name: user.name,
        avatarUrl: user.avatarUrl,
        locale: (user.locale as AuthSuccess['user']['locale']) ?? null,
      }
    },
  }
}

export type AuthService = ReturnType<typeof createAuthService>
