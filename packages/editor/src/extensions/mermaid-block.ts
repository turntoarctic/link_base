/**
 * Mermaid 图（P1-7）：节点内容 = mermaid 源码，NodeView 动态加载 mermaid 渲染 SVG。
 * mermaid 体积大（2MB+），动态 import 保证主 chunk 预算（06 §7）。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { MermaidView } from '../components/mermaid-view.tsx'

export const MermaidBlock = Node.create({
  name: 'mermaidBlock',
  group: 'block',
  content: 'text*',
  code: true,
  defining: true,
  isolating: true,

  parseHTML() {
    return [{ tag: 'pre[data-type="mermaidBlock"]' }]
  },

  renderHTML({ HTMLAttributes, node }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, { 'data-type': 'mermaidBlock', 'data-mermaid': node.textContent }),
      ['code', 0],
    ]
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidView)
  },
})
