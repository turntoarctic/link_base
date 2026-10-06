/** subpageList NodeView（P1-7）：拉取并展示子页清单，点击跳转；支持手动刷新 */
import { useCallback, useEffect, useState } from 'react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { useTranslation } from 'react-i18next'
import { ChevronRight, RefreshCw } from 'lucide-react'
import { getSubpageListSource } from '../extensions/subpage-list.ts'

export function SubpageListView({ node }: NodeViewProps) {
  const { t } = useTranslation('editor')
  const pageId = String((node.attrs as { pageId?: string }).pageId ?? '')
  const [items, setItems] = useState<Array<{ id: string; title: string }>>([])
  const [loading, setLoading] = useState(false)

  const refresh = useCallback(() => {
    const source = getSubpageListSource()
    if (!source || !pageId) return
    setLoading(true)
    void source
      .fetchChildren(pageId)
      .then((list) => setItems(list))
      .catch(() => setItems([]))
      .finally(() => setLoading(false))
  }, [pageId])

  useEffect(() => {
    refresh()
  }, [refresh])

  return (
    <NodeViewWrapper data-type="subpageList" className="linkbase-subpage-list">
      <div className="linkbase-subpage-list-head">
        <span className="linkbase-subpage-list-title">{t('subpageList.title')}</span>
        <button
          type="button"
          aria-label="refresh"
          className="linkbase-subpage-list-refresh"
          onClick={refresh}
          contentEditable={false}
        >
          <RefreshCw size={12} className={loading ? 'animate-spin' : ''} />
        </button>
      </div>
      {items.length === 0 && !loading && (
        <div className="linkbase-subpage-list-empty">{t('subpageList.empty')}</div>
      )}
      {items.map((item) => {
        const source = getSubpageListSource()
        return (
          <button
            key={item.id}
            type="button"
            className="linkbase-subpage-list-item"
            contentEditable={false}
            onClick={() => source?.onOpen(item.id)}
          >
            <span className="truncate">{item.title || t('subpageList.untitled')}</span>
            <ChevronRight size={13} />
          </button>
        )
      })}
    </NodeViewWrapper>
  )
}
