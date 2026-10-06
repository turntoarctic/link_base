/** slash 菜单扩展（05 §6）：@tiptap/suggestion 弹出菜单（shadcn 风格弹层） */
import { Extension } from '@tiptap/core'
import { PluginKey } from '@tiptap/pm/state'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { SlashPopup } from '../components/slash-popup.tsx'
import { createSuggestionRenderer } from '../components/suggestion.tsx'
import { buildSlashItems, filterSlashItems, type SlashItem } from './slash-items.ts'

export interface SlashMenuOptions {
  /** 「子页面」入口：宿主建行（POST {parentId} 直写 parent_id）并返回新页信息，卡片由 action 在光标处插入 */
  createSubpage?: () => Promise<{ pageId: string; title: string } | null>
  /** 「图片」入口：宿主打开系统文件选择框 */
  pickImage?: () => Promise<File | null>
  /** 「附件」入口：宿主选择任意文件并上传到 blobs */
  pickAttachment?: () => Promise<{ blobId: string; name: string; size: number; mime: string } | null>
  /** 当前页面 id（子页列表块插入时用） */
  currentPageId?: () => string | null
}

const renderer = createSuggestionRenderer<SlashItem>(SlashPopup)

export const SlashMenu = Extension.create<SlashMenuOptions>({
  name: 'slashMenu',

  addOptions() {
    return {}
  },

  addProseMirrorPlugins() {
    const options = this.options
    const allItems = buildSlashItems(options)
    return [
      Suggestion<SlashItem>({
        // 独立 key：与 Mention 的 suggestion 插件区分（同名 key 会被 ProseMirror 拒绝）
        pluginKey: new PluginKey('slashMenuSuggestion'),
        editor: this.editor,
        char: '/',
        allowSpaces: true,
        items: ({ query }) => filterSlashItems(allItems, query),
        command: ({ editor, range, props }) => {
          void props.action({ editor, range })
        },
        render: () => ({
          onStart: (props: SuggestionProps<SlashItem>) => renderer.onStart(props),
          onUpdate: (props: SuggestionProps<SlashItem>) => renderer.onUpdate(props),
          onExit: () => renderer.onExit(),
          onKeyDown: (props: SuggestionKeyDownProps) => renderer.onKeyDown(props),
        }),
      }),
    ]
  },
})
