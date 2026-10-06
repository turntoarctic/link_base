/** callout 节点 NodeView：图标选择 + 内容区（NodeViewContent） */
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { CALLOUT_ATTR, CALLOUT_ICONS, NODE_CALLOUT } from '../schema.ts'

export function CalloutView({ node, updateAttributes }: NodeViewProps) {
  const icon = node.attrs[CALLOUT_ATTR.icon] as string
  const color = node.attrs[CALLOUT_ATTR.color] as string

  const cycleIcon = () => {
    const index = CALLOUT_ICONS.indexOf(icon as (typeof CALLOUT_ICONS)[number])
    const next = CALLOUT_ICONS[(index + 1) % CALLOUT_ICONS.length] ?? CALLOUT_ICONS[0]!
    void updateAttributes({ [CALLOUT_ATTR.icon]: next })
  }

  return (
    <NodeViewWrapper data-type={NODE_CALLOUT} className="linkbase-callout" data-color={color}>
      <button
        type="button"
        className="linkbase-callout-icon"
        onClick={cycleIcon}
        contentEditable={false}
        aria-label="icon"
      >
        {icon}
      </button>
      <NodeViewContent className="linkbase-callout-content" />
    </NodeViewWrapper>
  )
}
