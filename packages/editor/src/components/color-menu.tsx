/**
 * 颜色面板（Notion 化 T3）：文字颜色（Color mark）+ 背景颜色（multicolor Highlight mark）。
 * 9 阶 Notion 色板；色值是内容数据（随 Y.Doc 存储），先例 = 原 HIGHLIGHT_COLORS。
 */
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { openPopover, type PopoverHandle } from './popover.ts'

/** Notion 9 阶：default 之外的 8 色 + 默认 */
export const TEXT_COLORS = [
  { value: '', key: 'default' },
  { value: '#c232ac', key: 'purple' },
  { value: '#e5484d', key: 'red' },
  { value: '#e5762d', key: 'orange' },
  { value: '#debe13', key: 'yellow' },
  { value: '#2f9e77', key: 'green' },
  { value: '#3b82d0', key: 'blue' },
  { value: '#b08de0', key: 'lavender' },
  { value: '#8d8d8d', key: 'gray' },
] as const

export const BG_COLORS = [
  { value: '', key: 'default' },
  { value: '#fbe4e6', key: 'red' },
  { value: '#fdecc8', key: 'orange' },
  { value: '#fff3c2', key: 'yellow' },
  { value: '#dbeddb', key: 'green' },
  { value: '#ddebf1', key: 'blue' },
  { value: '#e8deee', key: 'purple' },
  { value: '#f1f0ef', key: 'gray' },
  { value: '#f5ebeb', key: 'brown' },
] as const

function ColorSwatches({
  label,
  defaultLabel,
  swatches,
  isApplied,
  apply,
  clear,
}: {
  label: string
  defaultLabel: string
  swatches: ReadonlyArray<{ value: string; key: string }>
  isApplied: (value: string) => boolean
  apply: (value: string) => void
  clear: () => void
}) {
  return (
    <div className="linkbase-color-group">
      <div className="linkbase-color-group-label">{label}</div>
      <div className="linkbase-tb-swatches">
        {swatches.map((s) => {
          const isDefault = s.value === ''
          return (
            <button
              key={s.key}
              type="button"
              className="linkbase-tb-swatch"
              title={isDefault ? defaultLabel : s.key}
              data-active={isApplied(s.value)}
              onMouseDown={(e) => {
                e.preventDefault()
                if (isDefault) clear()
                else apply(s.value)
              }}
            >
              <span className="linkbase-tb-swatch-color" style={{ background: isDefault ? 'transparent' : s.value }} data-default={isDefault || undefined} />
            </button>
          )
        })}
      </div>
    </div>
  )
}

function ColorMenuContent({ editor }: { editor: Editor }) {
  const { t } = useTranslation('editor')
  const activeColor = (editor.getAttributes('textStyle').color as string | undefined) ?? ''
  const activeHighlight = (editor.getAttributes('highlight').color as string | undefined) ?? ''
  return (
    <div className="linkbase-menu linkbase-color-menu" role="menu" aria-label={t('toolbar.color.text')}>
      <ColorSwatches
        label={t('toolbar.color.text')}
        defaultLabel={t('toolbar.color.default')}
        swatches={TEXT_COLORS}
        isApplied={(v) => v === activeColor}
        apply={(v) => editor.chain().focus().setColor(v).run()}
        clear={() => editor.chain().focus().unsetColor().run()}
      />
      <ColorSwatches
        label={t('toolbar.color.background')}
        defaultLabel={t('toolbar.color.default')}
        swatches={BG_COLORS}
        isApplied={(v) => v === activeHighlight}
        apply={(v) => editor.chain().focus().setHighlight({ color: v }).run()}
        clear={() => editor.chain().focus().unsetHighlight().run()}
      />
    </div>
  )
}

/** 从工具条按钮打开颜色面板（选区收起自动关闭由工具条 shouldShow 联动） */
export function openColorMenu(editor: Editor, anchor: HTMLElement): PopoverHandle {
  return openPopover({
    anchor,
    placement: 'bottom-end',
    onKeyDown: (event, handle) => {
      if (event.key === 'Escape') {
        handle.close()
        return true
      }
      return false
    },
    render: (handle) => {
      // 选区收起（气泡隐藏时）面板连带关闭
      const onSel = () => {
        if (editor.state.selection.empty) handle.close()
      }
      editor.on('selectionUpdate', onSel)
      editor.once('destroy', () => editor.off('selectionUpdate', onSel))
      return <ColorMenuContent editor={editor} />
    },
  })
}
