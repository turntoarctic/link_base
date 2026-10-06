/** subpage 节点 NodeView（02 §1.2）：子页面卡片，点击打开（经宿主注入的 onOpen） */
import { useTranslation } from 'react-i18next'
import { FileText, SquareArrowOutUpRight } from 'lucide-react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NODE_SUBPAGE, SUBPAGE_ATTR } from '../schema.ts'

export function SubpageView({ node, editor }: NodeViewProps) {
  const { t } = useTranslation('editor')
  const pageId = node.attrs[SUBPAGE_ATTR.pageId] as string | null
  const title = (node.attrs[SUBPAGE_ATTR.title] as string) || t('subpage.untitled')

  const open = () => {
    if (!pageId) return
    const ext = editor.extensionManager.extensions.find((e) => e.name === NODE_SUBPAGE)
    const onOpen = (ext?.options as { onOpen?: (pageId: string) => void } | undefined)?.onOpen
    onOpen?.(pageId)
  }

  return (
    <NodeViewWrapper data-type={NODE_SUBPAGE} className="linkbase-subpage-wrapper">
      <button type="button" className="linkbase-subpage-card" onClick={open} contentEditable={false}>
        <FileText size={16} />
        <span className="linkbase-subpage-title">{title}</span>
        <SquareArrowOutUpRight size={14} className="linkbase-subpage-arrow" />
      </button>
    </NodeViewWrapper>
  )
}
