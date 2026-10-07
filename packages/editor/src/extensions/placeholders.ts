/**
 * 分类型占位符（Notion 化 T5）：空标题/待办/引用/标注各显示对应提示；
 * 普通空段落不提示（避免满屏占位），仅空文档首段显示「输入 / 获取命令」。
 * 纯函数便于单测（headless Editor 在 bun 不可建，解析走显式参数）。
 */
import i18next from 'i18next'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'

export interface PlaceholderContext {
  node: ProsemirrorNode
  /** 节点在文档中的起始位置（Placeholder 回调原样传入） */
  pos: number
  /** 当前文档（用于空文档判定与祖先链解析）；缺省时从 editor 取 */
  doc?: ProsemirrorNode
  /** Placeholder 回调传入的编辑器（doc 缺省来源） */
  editor?: { state: { doc: ProsemirrorNode } }
}

/** 空文档 = 仅一个空段落 */
export function isEmptyDoc(doc: ProsemirrorNode): boolean {
  if (doc.childCount !== 1) return false
  const first = doc.firstChild
  return !!first && first.type.name === 'paragraph' && first.content.size === 0
}

/** 从位置解析祖先链里最近的可提示容器类型（无 = ''） */
function ancestorHintType(doc: ProsemirrorNode, pos: number): string {
  const $pos = doc.resolve(Math.max(0, Math.min(pos, doc.content.size)))
  for (let d = $pos.depth; d > 0; d--) {
    const name = $pos.node(d).type.name
    if (name === 'taskItem' || name === 'blockquote' || name === 'callout') return name
  }
  return ''
}

/** Placeholder 扩展的 placeholder 回调主体（文案走 i18next editor 命名空间）。
 * 兼容两种调用：直接传 doc（测试），或经 Placeholder 的 {editor, node, pos}（运行时） */
export function placeholderForNode({ node, pos, doc, editor }: PlaceholderContext): string {
  const docNode = doc ?? editor?.state.doc
  if (!docNode) return ''
  const t = (key: string) => i18next.t(`editor:placeholder.${key}`)
  switch (node.type.name) {
    case 'heading':
      return t(`heading${node.attrs.level ?? 1}`)
    case 'detailsSummary':
      return t('toggle')
    case 'paragraph': {
      const hint = ancestorHintType(docNode, pos)
      if (hint === 'taskItem') return t('task')
      if (hint === 'blockquote') return t('quote')
      if (hint === 'callout') return t('callout')
      if (isEmptyDoc(docNode)) return t('docEmpty')
      return ''
    }
    default:
      // 代码块等文本块与叶子节点不提示
      return ''
  }
}
