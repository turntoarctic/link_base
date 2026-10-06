/**
 * 页面服务（10 §4 / 02）：树（子页文档序）、建页（含模板复制/子页附加）、
 * 标题直写、回收站（子树）、收藏、最近访问。
 */
import { and, asc, desc, eq, inArray } from 'drizzle-orm'
import type { CreatePageInput, PatchPageInput } from '@linkbase/contracts'
import type { PageMetaDto, PageTreeNode, TrashItem } from '@linkbase/types'
import { appendSubpageNode, extractPageMeta } from '@linkbase/ydoc'
import { favorites, pageTags, pageUpdates, pageVisits, pages, tags } from '../db/index.ts'
import { errNotFound } from '../lib/errors.ts'
import { uuidv7 } from '../lib/ids.ts'
import { logger } from '../lib/logger.ts'
import type { LinkbaseDb } from '../lib/deps.ts'
import { copyPageState, getPageState } from './docs.service.ts'

function toNode(row: typeof pages.$inferSelect): PageTreeNode {
  return {
    id: row.id,
    title: row.title,
    icon: row.icon,
    parentId: row.parentId,
    isTemplate: row.isTemplate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
    children: [],
  }
}

export function createPagesService(db: LinkbaseDb) {
  /** 顶层块文档序：有多个子页的父页按其 Y.Doc 内容序排列（02 §2 页面树 = 子页面节点序） */
  const sortChildrenByDocOrder = async (nodes: PageTreeNode[]): Promise<void> => {
    const parents = nodes.filter((n) => n.children.length > 1)
    for (const parent of parents) {
      try {
        const state = await getPageState(db, parent.id)
        if (!state) continue
        const order = extractPageMeta(state).subpageIds
        const indexOf = new Map(order.map((id, i) => [id, i]))
        parent.children.sort((a, b) => {
          const ia = indexOf.get(a.id)
          const ib = indexOf.get(b.id)
          if (ia == null && ib == null) return a.createdAt < b.createdAt ? -1 : 1
          if (ia == null) return 1
          if (ib == null) return -1
          return ia - ib
        })
      } catch (error) {
        logger.warn({ error, pageId: parent.id }, 'doc-order sort failed, fallback createdAt')
      }
    }
  }

  const svc = {
    async tree(wsId: string): Promise<PageTreeNode[]> {
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.workspaceId, wsId), eq(pages.isTrash, false)))
        .orderBy(asc(pages.createdAt))
      const byId = new Map<string, PageTreeNode>()
      const roots: PageTreeNode[] = []
      for (const row of rows) byId.set(row.id, toNode(row))
      for (const row of rows) {
        const node = byId.get(row.id)
        if (!node) continue
        const parent = row.parentId ? byId.get(row.parentId) : undefined
        if (parent) parent.children.push(node)
        else roots.push(node)
      }
      // 带多个孩子的父页按其 Y.Doc 内容序排列（子页面节点序 = 树序，02 §2）
      const multi: PageTreeNode[] = []
      const queue = [...roots]
      while (queue.length > 0) {
        const node = queue.shift()!
        if (node.children.length > 1) multi.push(node)
        queue.push(...node.children)
      }
      await sortChildrenByDocOrder(multi)
      return roots
    },

    /** 建页：模板复制（08 §4.4）或普通建行；parentId 时在父页追加 subpage 节点（08 §5） */
    async create(wsId: string, userId: string, input: CreatePageInput): Promise<PageMetaDto> {
      const pageId = uuidv7()

      await db.transaction(async (tx) => {
        await tx.insert(pages).values({
          id: pageId,
          workspaceId: wsId,
          title: input.title ?? '',
          icon: input.icon ?? null,
          createdBy: userId,
        })
        if (input.templateId) {
          // 模板必须存在且属于本空间
          const template = await tx
            .select({ id: pages.id })
            .from(pages)
            .where(
              and(
                eq(pages.id, input.templateId),
                eq(pages.workspaceId, wsId),
                eq(pages.isTemplate, true),
              ),
            )
            .limit(1)
          if (!template[0]) throw errNotFound('template not found')
        }
      })

      if (input.templateId) {
        const state = await copyPageState(db, input.templateId, pageId)
        if (!state) {
          await db.delete(pages).where(eq(pages.id, pageId))
          throw errNotFound('template has no content')
        }
      }

      if (input.parentId) {
        const parentRows = await db
          .select()
          .from(pages)
          .where(
            and(
              eq(pages.id, input.parentId),
              eq(pages.workspaceId, wsId),
              eq(pages.isTrash, false),
            ),
          )
          .limit(1)
        const parent = parentRows[0]
        if (!parent) throw errNotFound('parent page not found')
        const parentState = await getPageState(db, parent.id)
        const { update } = appendSubpageNode(parentState, pageId, input.title ?? '')
        await db.transaction(async (tx) => {
          await tx.insert(pageUpdates).values({ pageId: parent.id, blob: update, actor: userId })
          await tx.update(pages).set({ updatedAt: new Date() }).where(eq(pages.id, parent.id))
          await tx.update(pages).set({ parentId: parent.id }).where(eq(pages.id, pageId))
        })
      }

      return svc.getMeta(wsId, pageId)
    },

    async getMeta(wsId: string, pageId: string): Promise<PageMetaDto> {
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.id, pageId), eq(pages.workspaceId, wsId)))
        .limit(1)
      const row = rows[0]
      if (!row) throw errNotFound('page not found')
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        title: row.title,
        icon: row.icon,
        isTemplate: row.isTemplate,
        parentId: row.parentId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    },

    /** PATCH：title/icon 客户端直写（05 §5；parent_id/text 不接受客户端写） */
    async patch(wsId: string, pageId: string, input: PatchPageInput): Promise<void> {
      const result = await db
        .update(pages)
        .set({ ...input, updatedAt: new Date() })
        .where(and(eq(pages.id, pageId), eq(pages.workspaceId, wsId)))
      if (result.rowCount === 0) throw errNotFound('page not found')
    },

    /** 子树（含自身），按派生 parent 图 BFS */
    async subtreeIds(wsId: string, rootId: string): Promise<string[]> {
      const rows = await db
        .select({ id: pages.id, parentId: pages.parentId })
        .from(pages)
        .where(eq(pages.workspaceId, wsId))
      const childrenOf = new Map<string, string[]>()
      for (const row of rows) {
        if (!row.parentId) continue
        const list = childrenOf.get(row.parentId) ?? []
        list.push(row.id)
        childrenOf.set(row.parentId, list)
      }
      const result = [rootId]
      const queue = [rootId]
      while (queue.length > 0) {
        const current = queue.shift()!
        for (const child of childrenOf.get(current) ?? []) {
          result.push(child)
          queue.push(child)
        }
      }
      return result
    },

    /** 移入回收站（子树） */
    async trash(wsId: string, pageId: string): Promise<void> {
      const ids = await svc.subtreeIds(wsId, pageId)
      await db
        .update(pages)
        .set({ isTrash: true, deletedAt: new Date() })
        .where(and(eq(pages.workspaceId, wsId), inArray(pages.id, ids)))
    },

    /** 恢复（子树 + 祖先链，保证不成孤儿） */
    async restore(wsId: string, pageId: string): Promise<void> {
      const rows = await db
        .select({ id: pages.id, parentId: pages.parentId })
        .from(pages)
        .where(eq(pages.workspaceId, wsId))
      const parentOf = new Map(rows.map((r) => [r.id, r.parentId]))
      const ids = new Set(await svc.subtreeIds(wsId, pageId))
      let cursor = parentOf.get(pageId) ?? null
      const seen = new Set<string>([pageId])
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor)
        ids.add(cursor)
        cursor = parentOf.get(cursor) ?? null
      }
      await db
        .update(pages)
        .set({ isTrash: false, deletedAt: null })
        .where(and(eq(pages.workspaceId, wsId), inArray(pages.id, [...ids])))
    },

    /** 彻底删除（子树物理删；updates/snapshots/tags/favorites/visits 随级联）。
     * blob 孤儿回收引用计数见 08 §8 待细化，MVP 不做。 */
    async permanentDelete(wsId: string, pageId: string): Promise<void> {
      const ids = await svc.subtreeIds(wsId, pageId)
      await db.delete(pages).where(and(eq(pages.workspaceId, wsId), inArray(pages.id, ids)))
    },

    async trashList(wsId: string): Promise<TrashItem[]> {
      const rows = await db
        .select()
        .from(pages)
        .where(and(eq(pages.workspaceId, wsId), eq(pages.isTrash, true)))
        .orderBy(desc(pages.deletedAt))
      const all = await db
        .select({ id: pages.id, title: pages.title, parentId: pages.parentId })
        .from(pages)
        .where(eq(pages.workspaceId, wsId))
      const meta = new Map(all.map((r) => [r.id, r]))
      return rows.map((row) => {
        const path: string[] = []
        let cursor = row.parentId
        const seen = new Set<string>([row.id])
        while (cursor && !seen.has(cursor)) {
          seen.add(cursor)
          const parent = meta.get(cursor)
          if (!parent) break
          path.unshift(parent.title)
          cursor = parent.parentId
        }
        return {
          id: row.id,
          title: row.title,
          icon: row.icon,
          path,
          deletedAt: row.deletedAt?.toISOString() ?? null,
        }
      })
    },

    async addFavorite(wsId: string, userId: string, pageId: string): Promise<void> {
      await svc.getMeta(wsId, pageId)
      await db.insert(favorites).values({ userId, pageId }).onConflictDoNothing()
    },

    async removeFavorite(userId: string, pageId: string): Promise<void> {
      await db
        .delete(favorites)
        .where(and(eq(favorites.userId, userId), eq(favorites.pageId, pageId)))
    },

    async favoriteList(wsId: string, userId: string): Promise<PageMetaDto[]> {
      const rows = await db
        .select({ page: pages })
        .from(favorites)
        .innerJoin(pages, eq(pages.id, favorites.pageId))
        .where(and(eq(favorites.userId, userId), eq(pages.workspaceId, wsId), eq(pages.isTrash, false)))
        .orderBy(desc(favorites.createdAt))
      return rows.map((r) => svc.toMetaDto(r.page))
    },

    async recordVisit(wsId: string, userId: string, pageId: string): Promise<void> {
      await svc.getMeta(wsId, pageId)
      await db
        .insert(pageVisits)
        .values({ userId, pageId })
        .onConflictDoUpdate({
          target: [pageVisits.userId, pageVisits.pageId],
          set: { visitedAt: new Date() },
        })
    },

    async recentList(wsId: string, userId: string): Promise<PageMetaDto[]> {
      const rows = await db
        .select({ page: pages })
        .from(pageVisits)
        .innerJoin(pages, eq(pages.id, pageVisits.pageId))
        .where(and(eq(pageVisits.userId, userId), eq(pages.workspaceId, wsId), eq(pages.isTrash, false)))
        .orderBy(desc(pageVisits.visitedAt))
        .limit(20)
      return rows.map((r) => svc.toMetaDto(r.page))
    },

    /** 页面标签（10 §7） */
    async pageTagIds(wsId: string, pageId: string) {
      await svc.getMeta(wsId, pageId)
      return db
        .select({ id: tags.id, name: tags.name, color: tags.color })
        .from(pageTags)
        .innerJoin(tags, eq(tags.id, pageTags.tagId))
        .where(eq(pageTags.pageId, pageId))
    },

    async addPageTag(wsId: string, pageId: string, tagId: string): Promise<void> {
      await svc.getMeta(wsId, pageId)
      const tagRows = await db
        .select({ id: tags.id })
        .from(tags)
        .where(and(eq(tags.id, tagId), eq(tags.workspaceId, wsId)))
        .limit(1)
      if (!tagRows[0]) throw errNotFound('tag not found')
      await db.insert(pageTags).values({ pageId, tagId }).onConflictDoNothing()
    },

    async removePageTag(pageId: string, tagId: string): Promise<void> {
      await db.delete(pageTags).where(and(eq(pageTags.pageId, pageId), eq(pageTags.tagId, tagId)))
    },

    toMetaDto(row: typeof pages.$inferSelect): PageMetaDto {
      return {
        id: row.id,
        workspaceId: row.workspaceId,
        title: row.title,
        icon: row.icon,
        isTemplate: row.isTemplate,
        parentId: row.parentId,
        createdAt: row.createdAt.toISOString(),
        updatedAt: row.updatedAt.toISOString(),
      }
    },
  }
  return svc
}

export type PagesService = ReturnType<typeof createPagesService>
