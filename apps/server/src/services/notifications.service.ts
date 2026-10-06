/**
 * 站内通知服务（P1-9 / T2.9）：提及（派生时触发，同页同用户未读去重）+ 评论/回复（创建时触发）。
 * 邮件通道为 P2（04 P1-9）。
 */
import { and, desc, eq, sql } from 'drizzle-orm'
import type { LinkbaseDb as _L } from '../lib/deps.ts'
type TxLike = Parameters<Parameters<_L['transaction']>[0]>[0]
import type { NotificationItem } from '@linkbase/types'
import { notifications, pages, users, workspaceMembers } from '../db/index.ts'
import { uuidv7 } from '../lib/ids.ts'
import type { LinkbaseDb } from '../lib/deps.ts'



export async function listMine(db: LinkbaseDb, userId: string): Promise<NotificationItem[]> {
  const rows = await db
    .select({
      n: notifications,
      actorName: users.name,
      pageTitle: pages.title,
    })
    .from(notifications)
    .innerJoin(users, eq(users.id, notifications.actor))
    .innerJoin(pages, eq(pages.id, notifications.pageId))
    .where(eq(notifications.recipient, userId))
    .orderBy(desc(notifications.createdAt))
    .limit(50)
  return rows.map((r) => ({
    id: r.n.id,
    type: r.n.type,
    actorName: r.actorName,
    pageId: r.n.pageId,
    pageTitle: r.pageTitle,
    excerpt: r.n.excerpt,
    read: r.n.read,
    createdAt: r.n.createdAt.toISOString(),
  }))
}

export async function unreadCount(db: LinkbaseDb, userId: string): Promise<number> {
  const rows = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(notifications)
    .where(and(eq(notifications.recipient, userId), eq(notifications.read, false)))
  return rows[0]?.count ?? 0
}

export async function markRead(db: LinkbaseDb, userId: string, notificationId: string): Promise<void> {
  await db
    .update(notifications)
    .set({ read: true })
    .where(and(eq(notifications.id, notificationId), eq(notifications.recipient, userId)))
}

export async function markAllRead(db: LinkbaseDb, userId: string): Promise<void> {
  await db.update(notifications).set({ read: true }).where(eq(notifications.recipient, userId))
}

/** 触发：提及（deriveMetaInTx 内调用）。同页同用户未读提及去重（部分唯一索引兜底）；
 * 收件人必须仍是空间成员；忽略操作者本人。 */
export async function notifyMentionsInTx(
  tx: TxLike,
  input: { wsId: string; pageId: string; actorId: string; userIds: string[]; excerpt: string },
): Promise<void> {
  for (const userId of input.userIds) {
    if (userId === input.actorId) continue
    const member = await tx
      .select({ userId: workspaceMembers.userId })
      .from(workspaceMembers)
      .where(and(eq(workspaceMembers.workspaceId, input.wsId), eq(workspaceMembers.userId, userId)))
      .limit(1)
    if (!member[0]) continue
    // 同页同用户存在未读提及则跳过（部分唯一索引同步兜底）
    const existing = await tx
      .select({ id: notifications.id })
      .from(notifications)
      .where(
        and(
          eq(notifications.workspaceId, input.wsId),
          eq(notifications.pageId, input.pageId),
          eq(notifications.recipient, userId),
          eq(notifications.type, 'mention'),
          eq(notifications.read, false),
        ),
      )
      .limit(1)
    if (existing[0]) continue
    await tx.insert(notifications).values({
      id: uuidv7(),
      workspaceId: input.wsId,
      recipient: userId,
      actor: input.actorId,
      type: 'mention',
      pageId: input.pageId,
      excerpt: input.excerpt.slice(0, 200),
    })
  }
}

/** 触发：评论/回复创建。收件人 = 页面创建者（评论）+ 根评论作者（回复），均排除自己与作者本人。 */
export async function notifyComment(
  db: LinkbaseDb,
  input: {
    wsId: string
    pageId: string
    actorId: string
    type: 'comment' | 'reply'
    commentId: string
    rootCommentAuthor?: string | null
    excerpt: string
  },
): Promise<void> {
  const pageRows = await db
    .select({ createdBy: pages.createdBy })
    .from(pages)
    .where(eq(pages.id, input.pageId))
    .limit(1)
  const recipients = new Set<string>()
  if (pageRows[0]) recipients.add(pageRows[0].createdBy)
  if (input.type === 'reply' && input.rootCommentAuthor) recipients.add(input.rootCommentAuthor)
  recipients.delete(input.actorId)

  for (const recipient of recipients) {
    await db.insert(notifications).values({
      id: uuidv7(),
      workspaceId: input.wsId,
      recipient,
      actor: input.actorId,
      type: input.type,
      pageId: input.pageId,
      commentId: input.commentId,
      excerpt: input.excerpt.slice(0, 200),
    })
  }
}
