/**
 * 评论服务（P1-3 / T2.4）：页面级 + 行内（文本引用锚点）+ 回复串 + 解决/删除。
 * 04 P1-3 的「锚点存 nodeId」细化为文本引用锚点（quote+前后文）：编辑器块无稳定 id，
 * 引用锚定对块拆分/合并的鲁棒性更好；解析定位在客户端高亮扩展完成。
 */
import { and, asc, eq } from 'drizzle-orm'
import type { CommentAnchor, CommentItem } from '@linkbase/types'
import { comments, users } from '../db/index.ts'
import { uuidv7 } from '../lib/ids.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

function toItem(row: typeof comments.$inferSelect, authorName: string): CommentItem {
  return {
    id: row.id,
    pageId: row.pageId,
    parentId: row.parentId,
    authorId: row.author,
    authorName,
    anchor: (row.anchor as CommentAnchor | null) ?? null,
    body: row.body,
    resolved: row.resolved,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  }
}

/** 页面全部评论（根 + 回复扁平返回，客户端按 parentId 组装串；新→旧倒序展示由前端排序） */
export async function listComments(db: LinkbaseDb, pageId: string): Promise<CommentItem[]> {
  const rows = await db
    .select({ c: comments, authorName: users.name })
    .from(comments)
    .innerJoin(users, eq(users.id, comments.author))
    .where(eq(comments.pageId, pageId))
    .orderBy(asc(comments.createdAt))
  return rows.map((r) => toItem(r.c, r.authorName))
}

export async function createComment(
  db: LinkbaseDb,
  input: {
    wsId: string
    pageId: string
    authorId: string
    body: string
    anchor?: CommentAnchor | null
    parentId?: string | null
  },
): Promise<CommentItem> {
  const id = uuidv7()
  const rows = await db
    .insert(comments)
    .values({
      id,
      workspaceId: input.wsId,
      pageId: input.pageId,
      parentId: input.parentId ?? null,
      author: input.authorId,
      anchor: input.anchor ?? null,
      body: input.body,
    })
    .returning()
  const authorName = await resolveAuthorName(db, input.authorId)
  return toItem(rows[0]!, authorName)
}

async function resolveAuthorName(db: LinkbaseDb, authorId: string): Promise<string> {
  const rows = await db.select({ name: users.name }).from(users).where(eq(users.id, authorId)).limit(1)
  return rows[0]?.name ?? ''
}

/** 须属于指定页面（路由已验成员身份，这里防跨页操作他人评论 id） */
async function pageComment(db: LinkbaseDb, pageId: string, commentId: string) {
  const rows = await db
    .select()
    .from(comments)
    .where(and(eq(comments.id, commentId), eq(comments.pageId, pageId)))
    .limit(1)
  if (!rows[0]) throw new Error('comment not found')
  return rows[0]
}

export async function setResolved(
  db: LinkbaseDb,
  pageId: string,
  commentId: string,
  resolved: boolean,
): Promise<void> {
  await pageComment(db, pageId, commentId)
  await db
    .update(comments)
    .set({ resolved, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
}

export async function deleteComment(db: LinkbaseDb, pageId: string, commentId: string): Promise<void> {
  await pageComment(db, pageId, commentId)
  await db.delete(comments).where(eq(comments.id, commentId)) // 回复随级联
}

export async function updateBody(
  db: LinkbaseDb,
  pageId: string,
  commentId: string,
  body: string,
): Promise<void> {
  await pageComment(db, pageId, commentId)
  await db.update(comments).set({ body, updatedAt: new Date() }).where(eq(comments.id, commentId))
}
