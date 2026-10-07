/**
 * 块类型注册表（Notion 化 T2）：「转为」共享数据源——气泡工具条下拉与块菜单二级面板共用。
 * 文案复用 slash.item.* i18n 键；图标与 slash-items 保持同款。
 * 转换语义：列表/引用/代码用 toggle（同型再点 = 退出）；callout/details 走单事务包裹/解包。
 */
import type { Editor } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import { Code2, Heading1, Heading2, Heading3, Lightbulb, List, ListOrdered, ListTodo, Quote, ChevronsDownUp, Type } from 'lucide-react'

export interface BlockTypeEntry {
  /** 复用 slash.item.<id> 文案键 */
  id: string
  icon: LucideIcon
  isActive: (editor: Editor) => boolean
  convert: (editor: Editor) => void
}

export const BLOCK_TYPES: BlockTypeEntry[] = [
  {
    id: 'paragraph',
    icon: Type,
    isActive: (editor) => editor.isActive('paragraph'),
    // clearNodes 归一为段落：标题/引用/代码/列表一并退出
    convert: (editor) => editor.chain().focus().clearNodes().run(),
  },
  { id: 'heading1', icon: Heading1, isActive: (editor) => editor.isActive('heading', { level: 1 }), convert: (editor) => editor.chain().focus().setHeading({ level: 1 }).run() },
  { id: 'heading2', icon: Heading2, isActive: (editor) => editor.isActive('heading', { level: 2 }), convert: (editor) => editor.chain().focus().setHeading({ level: 2 }).run() },
  { id: 'heading3', icon: Heading3, isActive: (editor) => editor.isActive('heading', { level: 3 }), convert: (editor) => editor.chain().focus().setHeading({ level: 3 }).run() },
  { id: 'bulletList', icon: List, isActive: (editor) => editor.isActive('bulletList'), convert: (editor) => editor.chain().focus().toggleBulletList().run() },
  { id: 'orderedList', icon: ListOrdered, isActive: (editor) => editor.isActive('orderedList'), convert: (editor) => editor.chain().focus().toggleOrderedList().run() },
  { id: 'taskList', icon: ListTodo, isActive: (editor) => editor.isActive('taskItem'), convert: (editor) => editor.chain().focus().toggleTaskList().run() },
  { id: 'blockquote', icon: Quote, isActive: (editor) => editor.isActive('blockquote'), convert: (editor) => editor.chain().focus().toggleBlockquote().run() },
  { id: 'codeBlock', icon: Code2, isActive: (editor) => editor.isActive('codeBlock'), convert: (editor) => editor.chain().focus().toggleCodeBlock().run() },
  { id: 'callout', icon: Lightbulb, isActive: (editor) => editor.isActive('callout'), convert: (editor) => editor.commands.wrapTopLevelBlockIn('callout') },
  { id: 'details', icon: ChevronsDownUp, isActive: (editor) => editor.isActive('details'), convert: (editor) => editor.commands.wrapTopLevelBlockIn('details') },
]

/** 当前顶层块对应的类型项（paragraph 作为兜底放最后判定：列表/引用内 isActive('paragraph') 也为真） */
export function activeBlockType(editor: Editor): BlockTypeEntry | undefined {
  const hit = BLOCK_TYPES.find((t) => t.id !== 'paragraph' && t.isActive(editor))
  if (hit) return hit
  return BLOCK_TYPES.find((t) => t.id === 'paragraph')
}

/** 转为指定块类型；顶层是 callout/details 而目标不是它时先解包（单事务），再套目标转换 */
export function turnInto(editor: Editor, id: string): void {
  const target = BLOCK_TYPES.find((t) => t.id === id)
  if (!target) return
  if (target.isActive(editor)) return
  const wrapperNames = new Set(['callout', 'details'])
  // 顶层节点在深度 1（深度 0 是 doc）；光标已在 doc 层时无顶层块
  const { $from } = editor.state.selection
  const topName = $from.depth >= 1 ? $from.node(1).type.name : ''
  if (wrapperNames.has(topName) && id !== 'callout' && id !== 'details') {
    editor.commands.unwrapTopLevelBlock()
  }
  target.convert(editor)
}
