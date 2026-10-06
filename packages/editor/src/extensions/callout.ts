/** Callout 块扩展（05 §2.1 P0）：图标 + 色底 + 富文本内容 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { CalloutView } from '../components/callout-view.tsx'
import { CALLOUT_ATTR, NODE_CALLOUT } from '../schema.ts'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    callout: {
      /** 插入 Callout 块 */
      insertCallout: () => ReturnType
    }
  }
}

export const Callout = Node.create({
  name: NODE_CALLOUT,

  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      [CALLOUT_ATTR.icon]: { default: '💡' },
      [CALLOUT_ATTR.color]: { default: 'gray' },
    }
  },

  parseHTML() {
    return [{ tag: `div[data-type="${NODE_CALLOUT}"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': NODE_CALLOUT })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(CalloutView)
  },

  addCommands() {
    return {
      insertCallout:
        () =>
        ({ commands }) =>
          commands.insertContent({
            type: NODE_CALLOUT,
            attrs: { [CALLOUT_ATTR.icon]: '💡', [CALLOUT_ATTR.color]: 'gray' },
            content: [{ type: 'paragraph' }],
          }),
    }
  },
})
