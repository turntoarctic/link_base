/**
 * 块级数学公式（P1-7，KaTeX）：节点内容 = LaTeX 源码（可编辑），NodeView 渲染 katex 预览。
 * katex 动态加载（05 §7 预算：主 chunk 不背公式渲染）。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MathBlockView } from '../components/math-block-view.tsx'

export const MathBlock = Node.create({
  name: 'mathBlock',
  group: 'block',
  content: 'text*',
  code: true,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'pre[data-type="mathBlock"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-type': 'mathBlock', 'data-latex': node.textContent }),
      ['code', 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MathBlockView)
  },
})
