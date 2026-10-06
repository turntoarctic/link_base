/**
 * Base 视图数据助手（T2.8 P2）：筛选/排序/看板分组的纯函数（便于单测）。
 * 行快照 = { id, title, pageId, cells }；与 Y.Map 解耦。
 */
import type { BaseColumn } from './extensions/base.ts'

export interface RowSnapshot {
  id: string
  title: string
  pageId: string | null
  cells: Record<string, unknown>
}

export interface ViewOptions {
  filter: string
  sortBy: string | null
  sortDir: 'asc' | 'desc'
}

function valueOf(row: RowSnapshot, colId: string): string {
  return colId === 'title' ? row.title : String(row.cells[colId] ?? '')
}

function rawValue(row: RowSnapshot, colId: string): unknown {
  return colId === 'title' ? row.title : row.cells[colId]
}

/** 筛选（标题 + 全部单元格文本包含匹配，大小写不敏感）+ 排序（数值/布尔按值，其余按 zh 字典序） */
export function applyFilterSort(
  rows: RowSnapshot[],
  columns: BaseColumn[],
  opts: ViewOptions,
): RowSnapshot[] {
  let out = rows
  const f = opts.filter.trim().toLowerCase()
  if (f) {
    out = out.filter((r) =>
      `${r.title} ${Object.values(r.cells).map((v) => String(v ?? '')).join(' ')}`.toLowerCase().includes(f),
    )
  }
  if (opts.sortBy) {
    const col = columns.find((c) => c.id === opts.sortBy)
    const dir = opts.sortDir === 'desc' ? -1 : 1
    out = [...out].sort((a, b) => {
      // 布尔/数值列按原始值比较（字符串化的 'false' 是真值，会全排序成相等）
      const av = rawValue(a, opts.sortBy!)
      const bv = rawValue(b, opts.sortBy!)
      if (col?.type === 'number') {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir
      }
      if (col?.type === 'checkbox') {
        return (Number(Boolean(av)) - Number(Boolean(bv))) * dir
      }
      return String(av ?? '').localeCompare(String(bv ?? ''), 'zh') * dir
    })
  }
  return out
}
