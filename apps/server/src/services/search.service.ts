/** 搜索服务（08 §6）：tsvector 全文主路径 + trigram 子串兜底，PG 内置 simple 配置 */
import { eq, sql } from 'drizzle-orm'
import type { SearchResultItem } from '@linkbase/types'
import { pages } from '../db/index.ts'
import type { LinkbaseDb } from '../lib/deps.ts'

interface SearchRow {
  id: string
  title: string
  parent_id: string | null
  snippet: string | null
}

export async function searchPages(db: LinkbaseDb, wsId: string, query: string): Promise<SearchResultItem[]> {
  const q = query.trim()
  if (!q) return []

  const result = await db.execute(sql`
    select id, title, parent_id,
      ts_headline('simple', left(text, 20000), plainto_tsquery('simple', ${q}), 'MaxWords=24, MinWords=6, StartSel=<<, StopSel=>>') as snippet
    from pages
    where workspace_id = ${wsId} and not is_trash
      and (
        search_tsv @@ plainto_tsquery('simple', ${q})
        or title % ${q}
        or left(text, 20000) % ${q}
      )
    order by
      ts_rank(search_tsv, plainto_tsquery('simple', ${q})) desc nulls last,
      updated_at desc
    limit 20
  `)
  // drizzle 不同驱动 execute 返回形态不同（rows 包裹 / 直接数组）
  const raw = (result as { rows?: unknown }).rows ?? (result as unknown)
  const rows = (Array.isArray(raw) ? raw : []) as SearchRow[]

  // 面包屑：本空间全量 id→title/parent（MVP 量级可控）
  const all = await db
    .select({ id: pages.id, title: pages.title, parentId: pages.parentId })
    .from(pages)
    .where(eq(pages.workspaceId, wsId))
  const meta = new Map(all.map((r) => [r.id, r]))

  return rows.map((row) => {
    const breadcrumb: string[] = []
    let cursor = row.parent_id
    const seen = new Set<string>([row.id])
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const parent = meta.get(cursor)
      if (!parent) break
      breadcrumb.unshift(parent.title)
      cursor = parent.parentId
    }
    return {
      id: row.id,
      title: row.title,
      breadcrumb,
      snippet: row.snippet ?? undefined,
    }
  })
}
