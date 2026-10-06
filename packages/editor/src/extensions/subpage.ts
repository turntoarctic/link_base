/**
 * 子页面节点扩展（05 §2 / 02 §1.2）：页面树的载体。
 * P0 约束：subpage 节点只以顶层块插入（slash/命令路径保证），服务端按文档序提取 parent_id（05 §4）。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { SubpageView } from '../components/subpage-view.tsx'
import { NODE_SUBPAGE, SUBPAGE_ATTR } from '../schema.ts'

export interface SubpageOptions {
  onOpen?: (pageId: string) => void
}

export const Subpage = Node.create<SubpageOptions>({
  name: NODE_SUBPAGE,

  addOptions() {
    return { onOpen: undefined }
  },

  group: 'block',
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      [SUBPAGE_ATTR.pageId]: { default: null },
      [SUBPAGE_ATTR.title]: { default: '' },
    }
  },

  parseHTML() {
    return [{ tag: `div[data-type="${NODE_SUBPAGE}"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': NODE_SUBPAGE })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(SubpageView)
  },

  addCommands() {
    return {
      insertSubpage:
        (attrs: { [SUBPAGE_ATTR.pageId]: string; [SUBPAGE_ATTR.title]: string }) =>
        ({ commands }) =>
          commands.insertContent({ type: NODE_SUBPAGE, attrs }),
    }
  },
})
