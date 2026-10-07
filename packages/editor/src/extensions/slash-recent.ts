/**
 * slash 最近使用（Notion 化 T4）：localStorage 记录最近选中的命令 id（最多 5 个，头插去重）。
 * 纯函数 mergeRecentItems 便于单测；读写都带守卫（隐私模式/损坏数据不致命）。
 */
const STORAGE_KEY = 'linkbase-slash-recent-v1'
const MAX_RECENT = 5

/** 纯函数：把 id 头插进最近列表（去重、截断到 MAX_RECENT） */
export function mergeRecentItems(recent: string[], id: string): string[] {
  return [id, ...recent.filter((r) => r !== id)].slice(0, MAX_RECENT)
}

/** 读取最近使用 id 列表；不可用/损坏返回空 */
export function readRecentSlashItems(): string[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((x): x is string => typeof x === 'string').slice(0, MAX_RECENT)
  } catch {
    return []
  }
}

/** 记录一次选中 */
export function recordRecentSlashItem(id: string): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(mergeRecentItems(readRecentSlashItems(), id)))
  } catch {
    // 隐私模式/配额：忽略
  }
}
