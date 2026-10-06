/**
 * 节点/属性命名常量（05 §2）。
 * server-safe：本文件零依赖，服务端经 `@linkbase/editor/server` 消费（07 §1 分层约束），
 * 客户端与服务端共享同一套命名，保证 Y.Doc 内容提取（05 §4）不错位。
 */

/** y-prosemirror / Tiptap Collaboration 默认 XmlFragment 名 */
export const Y_FRAGMENT_NAME = 'default'

/* ------------------------------- 自研节点 ------------------------------- */

/** 子页面节点（页面树的载体，02 §1.2） */
export const NODE_SUBPAGE = 'subpage'
export const SUBPAGE_ATTR = {
  pageId: 'pageId',
  title: 'title',
} as const

/** Callout 块 */
export const NODE_CALLOUT = 'callout'
export const CALLOUT_ATTR = {
  icon: 'icon',
  color: 'color',
} as const
export const CALLOUT_ICONS = ['💡', '📌', '⚠️', '✅', '🔥', 'ℹ️'] as const

/** @ 提及（用户） */
export const NODE_MENTION = 'mention'
export const MENTION_ATTR = {
  userId: 'userId',
  label: 'label',
} as const

/** 图片节点 */
export const NODE_IMAGE = 'image'

/* ------------------------------- attrs 形状 ------------------------------- */

export interface SubpageAttrs {
  [SUBPAGE_ATTR.pageId]: string
  [SUBPAGE_ATTR.title]: string
}

export interface CalloutAttrs {
  [CALLOUT_ATTR.icon]: string
  [CALLOUT_ATTR.color]: string
}

export interface MentionAttrs {
  [MENTION_ATTR.userId]: string
  [MENTION_ATTR.label]: string
}
