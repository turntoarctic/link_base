/**
 * 「转为」二级面板（Notion 化 T2）：块菜单与气泡工具条共用。
 * 列出 BLOCK_TYPES，当前类型打勾；选中即转换并关闭弹层。
 */
import { useTranslation } from 'react-i18next'
import { Check } from 'lucide-react'
import type { Editor } from '@tiptap/core'
import { BLOCK_TYPES, activeBlockType } from '../extensions/block-types.ts'
import { openPopover, type PopoverHandle } from './popover.ts'

export function TurnIntoMenuContent({
  editor,
  onPick,
}: {
  editor: Editor
  onPick: () => void
}) {
  const { t } = useTranslation('editor')
  const current = activeBlockType(editor)
  return (
    <div className="linkbase-menu" role="menu" aria-label={t('toolbar.turnInto')}>
      <div className="linkbase-menu-list">
        {BLOCK_TYPES.map((entry) => {
          const Icon = entry.icon
          const active = current?.id === entry.id
          return (
            <button
              key={entry.id}
              type="button"
              role="menuitem"
              className="linkbase-menu-item"
              data-active={active}
              onMouseDown={(e) => {
                e.preventDefault()
                entry.convert(editor)
                onPick()
              }}
            >
              <span className="linkbase-menu-item-icon">
                <Icon size={16} />
              </span>
              <span>{t(`slash.item.${entry.id}`)}</span>
              {active && (
                <span className="linkbase-menu-item-check">
                  <Check size={14} />
                </span>
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

/** 从锚元素打开「转为」弹层（把手块菜单与气泡工具条共用） */
export function openTurnIntoMenu(editor: Editor, anchor: { getBoundingClientRect: () => DOMRect }, onClose?: () => void): PopoverHandle {
  return openPopover({
    anchor,
    placement: 'bottom-start',
    onClose,
    onKeyDown: (event, handle) => {
      if (event.key === 'Escape') {
        handle.close()
        return true
      }
      return false
    },
    render: (handle) => {
      // 选区收起（气泡隐藏时）面板连带关闭；块菜单场景选区为 NodeSelection 非空，不受影响
      const onSel = () => {
        if (editor.state.selection.empty) handle.close()
      }
      editor.on('selectionUpdate', onSel)
      editor.once('destroy', () => editor.off('selectionUpdate', onSel))
      return <TurnIntoMenuContent editor={editor} onPick={() => handle.close()} />
    },
  })
}
