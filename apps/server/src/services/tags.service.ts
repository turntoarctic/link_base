/** 标签服务（10 §7）：CRUD + 页面打标 */
import { and, asc, desc, eq } from 'drizzle-orm'
import type { TagDto } from '@linkbase/types'
import { pageTags, pages, tags } from '../db/index.ts'
import { errNotFound, errTagExists } from '../lib/errors.ts'
import { uuidv7 } from '../lib/ids.ts'
import type { LinkbaseDb } from '../lib/deps.ts'
import { isUniqueViolation } from '../lib/pg-errors.ts'

export function createTagsService(db: LinkbaseDb) {
  return {
    async list(wsId: string): Promise<TagDto[]> {
      const rows = await db
        .select()
        .from(tags)
        .where(eq(tags.workspaceId, wsId))
        .orderBy(asc(tags.createdAt))
      return rows.map((r) => ({ id: r.id, name: r.name, color: r.color }))
    },

    async create(wsId: string, input: { name: string; color: number }): Promise<TagDto> {
      const id = uuidv7()
      try {
        await db.insert(tags).values({ id, workspaceId: wsId, name: input.name, color: input.color })
      } catch (error) {
        if (isUniqueViolation(error)) {
          throw errTagExists()
        }
        throw error
      }
      return { id, name: input.name, color: input.color }
    },

    async patch(wsId: string, tagId: string, input: { name?: string; color?: number }): Promise<void> {
      // drizzle 0.45：不带 returning 的 update 结果类型为 never，用 returning 判命中
      const rows = await db
        .update(tags)
        .set(input)
        .where(and(eq(tags.id, tagId), eq(tags.workspaceId, wsId)))
        .returning({ id: tags.id })
      if (rows.length === 0) throw errNotFound('tag not found')
    },

    /** 按标签列页面（标签页视图）：排除回收站，最近更新在前 */
    async pagesByTag(
      wsId: string,
      tagId: string,
    ): Promise<Array<{ id: string; title: string; icon: string | null; updatedAt: string }>> {
      const rows = await db
        .select({ id: pages.id, title: pages.title, icon: pages.icon, updatedAt: pages.updatedAt })
        .from(pageTags)
        .innerJoin(pages, eq(pages.id, pageTags.pageId))
        .innerJoin(tags, eq(tags.id, pageTags.tagId))
        .where(and(eq(tags.workspaceId, wsId), eq(pageTags.tagId, tagId), eq(pages.isTrash, false)))
        .orderBy(desc(pages.updatedAt))
      return rows.map((r) => ({ ...r, updatedAt: r.updatedAt.toISOString() }))
    },

    /** 删除标签（page_tags 级联清） */
    async remove(wsId: string, tagId: string): Promise<void> {
      await db.delete(tags).where(and(eq(tags.id, tagId), eq(tags.workspaceId, wsId)))
    },
  }
}
