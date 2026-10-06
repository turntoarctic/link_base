/** slash 菜单项定义（05 §6）：文案在渲染期经 i18next editor 命名空间解析（13 §5） */
import type { ChainedCommands, Editor, Range } from '@tiptap/core'
import type { LucideIcon } from 'lucide-react'
import {
  ChevronsDownUp,
  Database,
  Code2,
  FilePlus2,
  FunctionSquare,
  GitBranch,
  ListTree,
  Paperclip,
  Heading1,
  Heading2,
  Heading3,
  Image as ImageIcon,
  Lightbulb,
  List,
  ListOrdered,
  ListTodo,
  Minus,
  Quote,
  Square,
  Table,
  Type,
} from 'lucide-react'
import type { SlashMenuOptions } from './slash-menu.ts'

export interface SlashItem {
  id: string
  group: 'text' | 'media' | 'advanced'
  icon: LucideIcon
  keywords: string[]
  action: (args: { editor: Editor; range: Range }) => void
}

const chain = (editor: Editor, range: Range): ChainedCommands => editor.chain().focus().deleteRange(range)

export function buildSlashItems(options: SlashMenuOptions): SlashItem[] {
  return [
    {
      id: 'paragraph',
      group: 'text',
      icon: Type,
      keywords: ['text', 'plain', 'paragraph', '文本', '正文'],
      action: ({ editor, range }) => chain(editor, range).setNode('paragraph').run(),
    },
    { id: 'heading1', group: 'text', icon: Heading1, keywords: ['h1', 'title', '标题'], action: ({ editor, range }) => chain(editor, range).setHeading({ level: 1 }).run() },
    { id: 'heading2', group: 'text', icon: Heading2, keywords: ['h2', '标题'], action: ({ editor, range }) => chain(editor, range).setHeading({ level: 2 }).run() },
    { id: 'heading3', group: 'text', icon: Heading3, keywords: ['h3', '标题'], action: ({ editor, range }) => chain(editor, range).setHeading({ level: 3 }).run() },
    { id: 'bulletList', group: 'text', icon: List, keywords: ['ul', 'list', '无序', '列表'], action: ({ editor, range }) => chain(editor, range).toggleBulletList().run() },
    { id: 'orderedList', group: 'text', icon: ListOrdered, keywords: ['ol', 'list', '有序', '列表'], action: ({ editor, range }) => chain(editor, range).toggleOrderedList().run() },
    { id: 'taskList', group: 'text', icon: ListTodo, keywords: ['todo', 'checklist', '待办', '任务'], action: ({ editor, range }) => chain(editor, range).toggleTaskList().run() },
    { id: 'blockquote', group: 'text', icon: Quote, keywords: ['quote', '引用'], action: ({ editor, range }) => chain(editor, range).toggleBlockquote().run() },
    { id: 'codeBlock', group: 'advanced', icon: Code2, keywords: ['code', '代码', 'fence'], action: ({ editor, range }) => chain(editor, range).toggleCodeBlock().run() },
    {
      id: 'divider',
      group: 'advanced',
      icon: Minus,
      keywords: ['hr', 'divider', '分割线'],
      action: ({ editor, range }) => chain(editor, range).setHorizontalRule().run(),
    },
    {
      id: 'table',
      group: 'advanced',
      icon: Table,
      keywords: ['table', '表格'],
      action: ({ editor, range }) => chain(editor, range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run(),
    },
    {
      id: 'callout',
      group: 'advanced',
      icon: Lightbulb,
      keywords: ['callout', '提示', '标注'],
      action: ({ editor, range }) => chain(editor, range).insertCallout().run(),
    },
    {
      id: 'image',
      group: 'media',
      icon: ImageIcon,
      keywords: ['image', 'pic', '图片', '上传'],
      action: async ({ editor, range }) => {
        chain(editor, range).run()
        const file = (await options.pickImage?.()) ?? null
        if (file) editor.commands.uploadImage(file)
      },
    },
    {
      id: 'details',
      group: 'advanced',
      icon: ChevronsDownUp,
      keywords: ['details', 'fold', 'collapse', '折叠', '折叠块'],
      action: ({ editor, range }) => chain(editor, range).insertDetails({ summary: '' }).run(),
    },
    {
      id: 'math',
      group: 'advanced',
      icon: FunctionSquare,
      keywords: ['math', 'katex', 'latex', '公式'],
      action: ({ editor, range }) => chain(editor, range).insertContent({ type: 'mathBlock', content: [{ type: 'text', text: 'E = mc^2' }] }).run(),
    },
    {
      id: 'mermaid',
      group: 'advanced',
      icon: GitBranch,
      keywords: ['mermaid', 'diagram', '流程图', '图'],
      action: ({ editor, range }) => chain(editor, range).insertContent({ type: 'mermaidBlock', content: [{ type: 'text', text: 'graph TD\n  A --> B' }] }).run(),
    },
    {
      id: 'base',
      group: 'advanced',
      icon: Database,
      keywords: ['base', 'database', 'table', 'board', '数据库', '表格', '看板'],
      action: ({ editor, range }) => chain(editor, range).insertBaseBlock().run(),
    },
    {
      id: 'subpageList',
      group: 'media',
      icon: ListTree,
      keywords: ['subpage list', 'children', '子页列表', '子页面列表'],
      action: ({ editor, range }) =>
        chain(editor, range).insertSubpageList({ pageId: options.currentPageId?.() ?? null }).run(),
    },
    {
      id: 'attachment',
      group: 'media',
      icon: Paperclip,
      keywords: ['attachment', 'file', '附件', '文件'],
      action: async ({ editor, range }) => {
        chain(editor, range).run()
        const uploaded = (await options.pickAttachment?.()) ?? null
        if (uploaded) {
          editor.chain().focus().insertAttachment({ blobId: uploaded.blobId, name: uploaded.name, size: uploaded.size, mime: uploaded.mime }).run()
        }
      },
    },
    {
      id: 'subpage',
      group: 'media',
      icon: FilePlus2,
      keywords: ['subpage', 'page', '子页面', '新建页面'],
      action: async ({ editor, range }) => {
        chain(editor, range).run()
        const page = (await options.createSubpage?.()) ?? null
        // 卡片在光标处插入（内容由客户端写入 Y.Doc；parent_id 已由建行直写）
        if (page) editor.chain().focus().insertSubpage({ pageId: page.pageId, title: page.title }).run()
      },
    },
    {
      id: 'mention',
      group: 'media',
      icon: Square,
      keywords: ['mention', 'user', '提及'],
      action: ({ editor }) => {
        // 提及由 @ 字符触发，这里只是占位引导
        editor.chain().focus().insertContent('@').run()
      },
    },
  ]
}

export function filterSlashItems(items: SlashItem[], query: string): SlashItem[] {
  const q = query.trim().toLowerCase()
  if (!q) return items
  return items.filter(
    (item) => item.id.includes(q) || item.keywords.some((k) => k.toLowerCase().includes(q)),
  )
}
