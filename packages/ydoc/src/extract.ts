/**
 * 服务端元数据提取（05 §4）：Y.Doc（合并完成）→ yDocToProseMirrorJSON → 遍历 → { text, subpageIds }。
 * 零 DOM、零 React、零编辑器运行时：只依赖 yjs + y-prosemirror + @linkbase/editor/server 常量。
 * 标题不在提取范围（独立列，客户端直写，05 §5）。
 */
import * as Y from 'yjs'
import { yDocToProsemirrorJSON } from 'y-prosemirror'
import { NODE_MENTION, MENTION_ATTR, NODE_SUBPAGE, SUBPAGE_ATTR, Y_FRAGMENT_NAME } from '@linkbase/editor/server'
import { loadYDoc } from './updates.ts'

export interface PageMeta {
  /** 按文档序深度优先拼接的全部文本（08 §6 搜索用） */
  text: string
  /** subpage 节点的 pageId 序（文档序）；第一个指向同一子页的引用生效（08 §5） */
  subpageIds: string[]
  /** mention 节点的 userId 序（去重，P1-9 通知触发） */
  mentionIds: string[]
}

interface PmNode {
  type?: string
  text?: string
  attrs?: Record<string, unknown>
  content?: PmNode[]
}

function walk(
  node: PmNode,
  state: { text: string[]; seen: Set<string>; subpageIds: string[]; mentionSeen: Set<string>; mentionIds: string[] },
): void {
  const type = node.type
  if (type === 'text' && typeof node.text === 'string') {
    state.text.push(node.text)
    return
  }
  if (type === NODE_SUBPAGE) {
    const pageId = node.attrs?.[SUBPAGE_ATTR.pageId]
    if (typeof pageId === 'string' && pageId && !state.seen.has(pageId)) {
      state.seen.add(pageId)
      state.subpageIds.push(pageId)
    }
    return
  }
  if (type === NODE_MENTION) {
    const userId = node.attrs?.[MENTION_ATTR.userId]
    if (typeof userId === 'string' && userId && !state.mentionSeen.has(userId)) {
      state.mentionSeen.add(userId)
      state.mentionIds.push(userId)
    }
    return
  }
  if (Array.isArray(node.content)) {
    for (const child of node.content) walk(child, state)
  }
}

export function extractPageMeta(input: Y.Doc | Uint8Array): PageMeta {
  const doc = input instanceof Y.Doc ? input : loadYDoc(input)
  // yDocToProsemirrorJSON 不需要 schema；返回 doc 形 JSON（兼容数组形态）
  const json = yDocToProsemirrorJSON(doc, Y_FRAGMENT_NAME) as PmNode | PmNode[]
  const root: PmNode = Array.isArray(json) ? { type: 'doc', content: json } : json
  const state = {
    text: [] as string[],
    seen: new Set<string>(),
    subpageIds: [] as string[],
    mentionSeen: new Set<string>(),
    mentionIds: [] as string[],
  }
  walk(root, state)
  // 文本节点间补空格近似阅读序；段落间距由遍历顺序保证
  return { text: state.text.join(' '), subpageIds: state.subpageIds, mentionIds: state.mentionIds }
}
