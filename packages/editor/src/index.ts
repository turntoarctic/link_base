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
import { Placeholder } from '@tiptap/extensions'
import { Highlight } from '@tiptap/extension-highlight'
import { TableKit } from '@tiptap/extension-table'
import { CodeBlockLowlight } from '@tiptap/extension-code-block-lowlight'
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
  /** @ 提及候选（工作空间成员；getter 供异步加载） */
  members?: () => MentionUser[]
}

const lowlight = createLowlight(common)

export function createEditor(options: EditorKitOptions): Editor {
  return new Editor({
    extensions: [
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
      Highlight.configure({ multicolor: true }),
      TableKit.configure({ table: { resizable: false } }),
      Placeholder.configure({
        showOnlyWhenEditable: true,
        // 动态取词，语言切换即时生效（13 §6 不刷新页面）
        placeholder: () => i18next.t('editor:placeholder'),
      }),
      Collaboration.configure({ document: options.ydoc }),
      ImageUpload.configure({ upload: options.uploadImage }),
      Mention.configure({ users: options.members ?? (() => []) }),
      Subpage.configure({ onOpen: options.onSubpageOpen }),
      Callout,
      SlashMenu.configure({
        createSubpage: options.createSubpage,
        pickImage: options.pickImage,
      }),
      DragHandle,
      MarkdownPaste,
    ],
  })
}

export { EditorBubbleToolbar } from './components/toolbar.tsx'
export { createSuggestionRenderer } from './components/suggestion.tsx'
export { ImageUpload as ImageUploadExtension } from './extensions/image.ts'
export { Mention as MentionExtension, type MentionUser } from './extensions/mention.ts'
export { Subpage as SubpageExtension } from './extensions/subpage.ts'
export { Callout as CalloutExtension } from './extensions/callout.ts'
export { SlashMenu as SlashMenuExtension } from './extensions/slash-menu.ts'
export { DragHandle as DragHandleExtension } from './extensions/drag-handle.ts'
export { MarkdownPaste as MarkdownPasteExtension, markdownToPmJson, looksLikeMarkdown } from './extensions/markdown.ts'
