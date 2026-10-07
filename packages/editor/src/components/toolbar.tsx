/**
 * 选中浮动工具条（05 §6 / Notion 化 T3）：@tiptap/react BubbleMenu（v3 位于 /menus 子路径）。
 * 单行 Notion 式布局：[表格操作 icon 组（表内）] | 转为下拉 | B I U S 代码 链接 | 颜色 A | 评论。
 * 红线：BubbleMenu 的 options/shouldShow 必须模块级常量（引用稳定）——tiptap v3 在 props
 * 引用变化时会 dispatch updateOptions 事务，配合上层 transaction 订阅 = 无限渲染循环（已踩坑）。
 * 下拉状态全部在 children 内部，不改 BubbleMenu props。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import {
  Baseline,
  Bold,
  ChevronDown,
  Code,
  Combine,
  ExternalLink,
  Italic,
  Link2,
  Link2Off,
  MessageSquarePlus,
  PaintBucket,
  Rows3,
  Columns3,
  SquareSplitHorizontal,
  Strikethrough,
  Table2,
  Trash,
  Underline as UnderlineIcon,
} from 'lucide-react'
import { activeBlockType } from '../extensions/block-types.ts'
import { openTurnIntoMenu } from './turn-into-menu.tsx'
import { openColorMenu } from './color-menu.tsx'

// 引用稳定（防 updateOptions 事务循环，见文件头红线）
const BUBBLE_OPTIONS = { placement: 'top', offset: 10 } as const
const shouldShowBubble = ({ editor: e, from, to }: { editor: { isEmpty: boolean }; from: number; to: number }) => {
  if (e.isEmpty) return false
  return from !== to
}

export function EditorBubbleToolbar({ editor, onComment }: { editor: Editor; onComment?: () => void }) {
  const { t } = useTranslation('editor')
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const inTable = editor.isActive('table')
  const activeHref = editor.getAttributes('link').href as string | undefined
  const blockType = activeBlockType(editor)
  const BlockIcon = blockType?.icon

  const btn = (active: boolean) => `linkbase-tb-btn${active ? ' is-active' : ''}`

  const applyLink = () => {
    if (!linkUrl) {
      editor.chain().focus().unsetLink().run()
    } else {
      editor
        .chain()
        .focus()
        .extendMarkRange('link')
        .setLink({ href: linkUrl.startsWith('http') ? linkUrl : `https://${linkUrl}` })
        .run()
    }
    setLinkMode(false)
    setLinkUrl('')
  }

  const openTurnInto = (e: React.MouseEvent<HTMLButtonElement>) => {
    openTurnIntoMenu(editor, e.currentTarget)
  }
  const openColors = (e: React.MouseEvent<HTMLButtonElement>) => {
    openColorMenu(editor, e.currentTarget)
  }

  return (
    <BubbleMenu editor={editor} options={BUBBLE_OPTIONS} shouldShow={shouldShowBubble}>
      <div className="linkbase-tb" role="toolbar">
        {inTable && (
          <>
            <button type="button" className={btn(false)} title={t('toolbar.table.addRow')} onClick={() => editor.chain().focus().addRowAfter().run()}>
              <Rows3 size={15} />
            </button>
            <button type="button" className={btn(false)} title={t('toolbar.table.deleteRow')} onClick={() => editor.chain().focus().deleteRow().run()}>
              <Trash size={15} />
            </button>
            <button type="button" className={btn(false)} title={t('toolbar.table.addColumn')} onClick={() => editor.chain().focus().addColumnAfter().run()}>
              <Columns3 size={15} />
            </button>
            <button type="button" className={btn(false)} title={t('toolbar.table.deleteColumn')} onClick={() => editor.chain().focus().deleteColumn().run()}>
              <Trash size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('tableHeader'))} title={t('toolbar.table.headerRow')} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
              <Table2 size={15} />
            </button>
            <button type="button" className={btn(false)} disabled={!editor.can().mergeCells()} title={t('table.mergeCells')} onClick={() => editor.chain().focus().mergeCells().run()}>
              <Combine size={15} />
            </button>
            <button type="button" className={btn(false)} disabled={!editor.can().splitCell()} title={t('table.splitCell')} onClick={() => editor.chain().focus().splitCell().run()}>
              <SquareSplitHorizontal size={15} />
            </button>
            <button type="button" className={btn(false)} title={t('toolbar.table.deleteTable')} onClick={() => editor.chain().focus().deleteTable().run()}>
              <Trash size={15} />
            </button>
            <span className="linkbase-tb-sep" />
          </>
        )}

        {/* 转为：块类型下拉（icon 显示当前类型） */}
        {BlockIcon && (
          <button type="button" className={btn(false)} title={t('toolbar.turnInto')} onClick={openTurnInto}>
            <BlockIcon size={15} />
            <ChevronDown size={12} />
          </button>
        )}
        <span className="linkbase-tb-sep" />

        <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title={t('toolbar.bold')}>
          <Bold size={15} />
        </button>
        <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title={t('toolbar.italic')}>
          <Italic size={15} />
        </button>
        <button type="button" className={btn(editor.isActive('underline'))} onClick={() => editor.chain().focus().toggleUnderline().run()} title={t('toolbar.underline')}>
          <UnderlineIcon size={15} />
        </button>
        <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} title={t('toolbar.strike')}>
          <Strikethrough size={15} />
        </button>
        <button type="button" className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()} title={t('toolbar.code')}>
          <Code size={15} />
        </button>
        <button type="button" className={btn(editor.isActive('link'))} onClick={() => setLinkMode(true)} title={t('toolbar.link')}>
          <Link2 size={15} />
        </button>
        {editor.isActive('link') && activeHref && (
          <>
            <button
              type="button"
              className={btn(false)}
              title={t('toolbar.linkOpen')}
              onClick={() => window.open(activeHref, '_blank', 'noopener,noreferrer')}
            >
              <ExternalLink size={15} />
            </button>
            <button
              type="button"
              className={btn(false)}
              title={t('toolbar.linkRemove')}
              onClick={() => editor.chain().focus().extendMarkRange('link').unsetLink().run()}
            >
              <Link2Off size={15} />
            </button>
          </>
        )}
        <span className="linkbase-tb-sep" />

        <button type="button" className={btn(false)} title={t('toolbar.color.text')} onClick={openColors}>
          <Baseline size={15} />
          <PaintBucket size={11} className="linkbase-tb-color-strip" />
        </button>
        <span className="linkbase-tb-sep" />

        <button type="button" className={btn(false)} title={t('toolbar.comment')} onClick={() => onComment?.()}>
          <MessageSquarePlus size={15} />
        </button>
      </div>
      {linkMode && (
        <div className="linkbase-tb linkbase-tb-link-row" role="toolbar">
          <form
            className="linkbase-tb-link"
            onSubmit={(e) => {
              e.preventDefault()
              applyLink()
            }}
          >
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              placeholder={t('toolbar.linkPlaceholder')}
              onKeyDown={(e) => {
                if (e.key === 'Escape') setLinkMode(false)
              }}
            />
            <button type="submit" className={btn(false)}>
              {t('toolbar.linkApply')}
            </button>
          </form>
        </div>
      )}
    </BubbleMenu>
  )
}
