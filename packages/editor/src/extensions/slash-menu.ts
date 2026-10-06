/** slash 菜单扩展（05 §6）：@tiptap/suggestion 弹出菜单（shadcn 风格弹层） */
import { Extension } from '@tiptap/core'
import Suggestion, { type SuggestionKeyDownProps, type SuggestionProps } from '@tiptap/suggestion'
import { SlashPopup } from '../components/slash-popup.tsx'
import { createSuggestionRenderer } from '../components/suggestion.tsx'
import { buildSlashItems, filterSlashItems, type SlashItem } from './slash-items.ts'

export interface SlashMenuOptions {
  /** 「子页面」入口：宿主建页（POST /pages）后返回新页信息 */
  createSubpage?: () => Promise<{ pageId: string; title: string } | null>
  /** 「图片」入口：宿主打开系统文件选择框 */
  pickImage?: () => Promise<File | null>
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
