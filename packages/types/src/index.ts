/**
 * 共享 TS 类型（视图模型层）。
 * 请求/响应的 Zod schema 与推导类型见 @linkbase/contracts（10 §8：不手写双份 DTO）。
 * 本包只放纯结构类型，零运行时依赖，前后端通用。
 */

export type UserRole = 'owner' | 'admin' | 'member'

export type Locale = 'zh-CN' | 'en'

/** GET /workspaces/:wsId/pages 的树节点（10 §4） */
export interface PageTreeNode {
  id: string
  title: string
  icon: string | null
  parentId: string | null
  isTemplate: boolean
  updatedAt: string
  createdAt: string
  children: PageTreeNode[]
}

/** GET /workspaces/:wsId/trash 的条目（path 为祖先标题链，含自身） */
export interface TrashItem {
  id: string
  title: string
  icon: string | null
  /** 直接父页 id（null = 顶层）；恢复/彻底删时客户端同步父页文档里的子页卡片 */
  parentId: string | null
  path: string[]
  deletedAt: string | null
}

/** 版本历史条目（08 §4.5：快照即版本，新→旧） */
export interface VersionItem {
  version: number
  /** auto | manual | restore | copy */
  reason: string
  createdAt: string
  /** 正文前 120 字，列表预览 */
  excerpt: string
}

/** GET /workspaces/:wsId/search 的结果（10 §7） */
export interface SearchResultItem {
  id: string
  title: string
  breadcrumb: string[]
  snippet?: string
}

export interface TagDto {
  id: string
  name: string
  color: number
}

export interface MemberDto {
  userId: string
  name: string
  email: string
  avatarUrl: string | null
  role: UserRole
}

export interface PageMetaDto {
  id: string
  workspaceId: string
  title: string
  icon: string | null
  isTemplate: boolean
  parentId: string | null
  createdAt: string
  updatedAt: string
}

/** 标签色板 1–8，对应 06 §5.1 的 --tag-N-bg/fg（08 §3.5） */
export const TAG_COLOR_COUNT = 8
