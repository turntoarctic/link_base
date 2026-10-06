/**
 * createEditor()：扩展装配 + 默认选项（05 §2）。
 * 内容真相是 Y.Doc，经 Collaboration（y-prosemirror）双向绑定；红线条目：
 * - undoRedo 必须关（协作撤销由 y-undo 提供）；
 * - codeBlock 用 starter-kit 之外的 lowlight 版本；
 * - 全部 UI 文案经 i18next（13 §5），本文件不内联文案。
 */
import { Editor } from '@tiptap/core'
import StarterKit from '@tiptap/starter-kit'
import { Collaboration } from '@tiptap/extension-collaboration'
import { CollaborationCaret } from '@tiptap/extension-collaboration-caret'
import { Placeholder } from '@tiptap/extensions'
import { Highlight } from '@tiptap/extension-highlight'
import { TableKit } from '@tiptap/extension-table'
import { Details, DetailsSummary, insertDetails } from './extensions/details.ts'
import { MathBlock } from './extensions/math-block.ts'
import { MermaidBlock } from './extensions/mermaid-block.ts'
import { SubpageList, configureSubpageListSource } from './extensions/subpage-list.ts'
import { FindReplace } from './extensions/find-replace.ts'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
import { TaskList, TaskItem } from '@tiptap/extension-list'
import { common, createLowlight } from 'lowlight'
import i18next from 'i18next'
import type * as Y from 'yjs'
import { ImageUpload, type ImageUploadOptions } from './extensions/image.ts'
import { Mention, type MentionUser } from './extensions/mention.ts'
import { Subpage } from './extensions/subpage.ts'
import { Callout } from './extensions/callout.ts'
import { SlashMenu, type SlashMenuOptions } from './extensions/slash-menu.ts'
import { MarkdownPaste } from './extensions/markdown.ts'
import { DragHandle } from './extensions/drag-handle.ts'
import { TaskListInputRule } from './extensions/task-input-rule.ts'
import { CommentsHighlight, refreshComments, type CommentAnchorSpec } from './extensions/comments.ts'
import { Attachment, type AttachmentAttrs } from './extensions/attachment.ts'

export type { ImageUploadOptions }

export interface EditorKitOptions {
  /** 页面 Y.Doc（内容真相，05 §3） */
  ydoc: Y.Doc
  /** 图片上传桥接（10 §5.3，宿主注入） */
  uploadImage: (file: File) => Promise<{ url: string }>
  /** 子页面卡片点击导航（宿主注入） */
  onSubpageOpen?: (pageId: string) => void
  /** slash「子页面」建页流程（宿主注入） */
  createSubpage?: SlashMenuOptions['createSubpage']
  /** slash「图片」文件选择（宿主注入） */
  pickImage?: () => Promise<File | null>
  /** slash「附件」：选择任意文件并上传，返回卡片属性（宿主注入） */
  pickAttachment?: () => Promise<AttachmentAttrs | null>
  /** @ 提及候选（工作空间成员；getter 供异步加载） */
  members?: () => MentionUser[]
  /** awareness 实例（T2.2 协作光标）：WS relay 未连接时缺省，不装 caret */
  awareness?: { awareness: unknown }
  /** 本端协作身份（T2.2）：name 显示在光标标签，color 由宿主按用户稳定分配 */
  collaborationUser?: { name: string; color: string }
  /** 评论锚点数据源（T2.4，随评论变化由宿主 refreshComments 触发重算） */
  getCommentAnchors?: () => CommentAnchorSpec[]
  /** 点击正文中的评论高亮（宿主打开面板定位） */
  onCommentAnchorClick?: (id: string) => void
  /** 子页列表块数据源（T2.7，宿主桥接 API） */
  subpageListSource?: Parameters<typeof configureSubpageListSource>[0]
  /** 当前页面 id（子页列表块插入时取值） */
  currentPageId?: () => string | null
}

const lowlight = createLowlight(common)

/** 扩展装配清单（05 §2）：供 useEditor({ extensions }) 使用（React 路径必须传 options 而非实例） */
export function buildEditorKit(options: EditorKitOptions) {
  if (options.subpageListSource) configureSubpageListSource(options.subpageListSource)
  return [
    StarterKit.configure({
      // 协作模式撤销栈由 y-undo 提供
      undoRedo: false,
      // 代码块换用 lowlight 高亮版本
      codeBlock: false,
      link: {
        openOnClick: false,
        autolink: true,
        HTMLAttributes: { rel: 'noopener noreferrer nofollow', target: '_blank' },
      },
    }),
    CodeBlockLowlight.configure({ lowlight, defaultLanguage: 'plaintext' }),
    // 待办列表（05 §2.1 P0）：starter-kit 只含 bullet/ordered，task 需显式装配
    TaskList,
    TaskItem.configure({ nested: true }),
    TaskListInputRule,
    Highlight.configure({ multicolor: true }),
    // 表格进阶（P1-7）：列宽拖拽 + 合并/拆分单元格（工具条按钮）
    TableKit.configure({ table: { resizable: true } }),
    Placeholder.configure({
      showOnlyWhenEditable: true,
      // 动态取词，语言切换即时生效（13 §6 不刷新页面）
      placeholder: () => i18next.t('editor:placeholder'),
    }),
    Collaboration.configure({ document: options.ydoc }),
    // 协作光标（T2.2，09 §6）：需要 awareness + 本端身份；自绘光标样式走 linkbase-caret
    ...(options.awareness && options.collaborationUser
      ? [
          CollaborationCaret.configure({
            provider: options.awareness,
            user: options.collaborationUser,
            render: (user: { name: string; color: string }) => {
              const cursor = document.createElement('span')
              cursor.classList.add('linkbase-caret')
              cursor.style.borderColor = user.color
              const label = document.createElement('div')
              label.classList.add('linkbase-caret-label')
              label.style.backgroundColor = user.color
              label.textContent = user.name
              cursor.appendChild(label)
              return cursor
            },
          }),
        ]
      : []),
    ImageUpload.configure({ upload: options.uploadImage }),
    Mention.configure({ users: options.members ?? (() => []) }),
    Subpage.configure({ onOpen: options.onSubpageOpen }),
    Callout,
    SlashMenu.configure({
      createSubpage: options.createSubpage,
      pickImage: options.pickImage,
      pickAttachment: options.pickAttachment,
      currentPageId: options.currentPageId,
    }),
    Attachment,
    DragHandle,
    MarkdownPaste,
    // 折叠块/公式/图/子页列表（P1-7）
    Details,
    DetailsSummary,
    insertDetails,
    MathBlock,
    MermaidBlock,
    SubpageList,
    FindReplace,
    CommentsHighlight.configure({
      getAnchors: options.getCommentAnchors ?? (() => []),
      onAnchorClick: options.onCommentAnchorClick,
    }),
  ]
}

/** headless 直建实例（服务端测试/脚本用）；React 组件一律走 buildEditorKit + useEditor */
export function createEditor(options: EditorKitOptions): Editor {
  return new Editor({ extensions: buildEditorKit(options) })
}

export { EditorBubbleToolbar } from './components/toolbar.tsx'
export { CodeBlockLangPicker } from './components/code-lang.tsx'
// web 一律经本包使用编辑器 React 绑定，禁止直接 import @tiptap/*（保证单实例，06 §1.1）
export { useEditor, EditorContent } from '@tiptap/react'
export type { Editor } from '@tiptap/core'
export { createSuggestionRenderer } from './components/suggestion.tsx'
export { positionSuggestionPopup } from './components/suggestion.tsx'
export { ImageUpload as ImageUploadExtension } from './extensions/image.ts'
export { Mention as MentionExtension, type MentionUser } from './extensions/mention.ts'
export { Subpage as SubpageExtension } from './extensions/subpage.ts'
export { Callout as CalloutExtension } from './extensions/callout.ts'
export { SlashMenu as SlashMenuExtension } from './extensions/slash-menu.ts'
export { DragHandle as DragHandleExtension } from './extensions/drag-handle.ts'
export { MarkdownPaste as MarkdownPasteExtension, markdownToPmJson, looksLikeMarkdown } from './extensions/markdown.ts'
export { CommentsHighlight as CommentsHighlightExtension, refreshComments, type CommentAnchorSpec } from './extensions/comments.ts'
export { Attachment as AttachmentExtension, type AttachmentAttrs } from './extensions/attachment.ts'
export { Details as DetailsExtension, DetailsSummary as DetailsSummaryExtension, insertDetails as InsertDetailsExtension } from './extensions/details.ts'
export { MathBlock as MathBlockExtension } from './extensions/math-block.ts'
export { MermaidBlock as MermaidBlockExtension } from './extensions/mermaid-block.ts'
export { SubpageList as SubpageListExtension, configureSubpageListSource, type SubpageListSource } from './extensions/subpage-list.ts'
export { FindReplace as FindReplaceExtension, findReplaceKey } from './extensions/find-replace.ts'
