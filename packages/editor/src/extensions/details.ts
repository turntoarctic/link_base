/**
 * 折叠块（P1-7，05 §2.1）：details > summary + 内容块；summary 点击折叠/展开由浏览器原生处理。
 * Y 存储：details/summary 元素（attrs.open 为 UI 态，随 Y 同步）；Markdown 导出为 HTML 块，
 * 导入暂不支持（marked html token 不解析 HTML 结构，见 91）。
 */
import { Node, mergeAttributes } from '@tiptap/core'

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    details: {
      /** 插入折叠块（默认 summary + 空段落） */
      insertDetails: (attrs?: { summary?: string }) => ReturnType
    }
  }
}

export const Details = Node.create({
  name: 'details',
  group: 'block',
  content: 'summary block+',
  defining: true,
  isolating: true,

  addAttributes() {
    return {
      // 折叠态为纯 UI：不写入 Y（open 频繁切换会刷 update）
      open: {
        default: true,
        parseHTML: (element) => element.hasAttribute('open'),
        renderHTML: () => ({}),
      },
    }
  },

  parseHTML() {
    return [{ tag: 'details' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['details', mergeAttributes(HTMLAttributes), 0]
  },
})

export const DetailsSummary = Node.create({
  name: 'detailsSummary',
  content: 'inline*',
  group: 'block',
  defining: true,

  parseHTML() {
    return [{ tag: 'summary' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['summary', mergeAttributes(HTMLAttributes), 0]
  },
})

export const insertDetails = Node.create({
  name: 'detailsInsert',

  addCommands() {
    return {
      insertDetails:
        (attrs?: { summary?: string }) =>
        ({ chain }) =>
          chain()
            .insertContent({
              type: 'details',
              attrs: { open: true },
              content: [
                { type: 'detailsSummary', content: attrs?.summary ? [{ type: 'text', text: attrs.summary }] : [] },
                { type: 'paragraph' },
              ],
            })
            .run(),
    }
  },
})
