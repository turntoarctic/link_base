/**
 * 选中浮动工具条（05 §6）：@tiptap/react BubbleMenu（v3 位于 /menus 子路径）+ shadcn 风格。
 * 块类型转换、粗斜删/行内代码/高亮、链接；表格选中时切换为表格操作组（行列增删/表头）。
 * 评论入口为 P1 预留位（04 P1-3）。
 */
import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { BubbleMenu } from '@tiptap/react/menus'
import type { Editor } from '@tiptap/core'
import {
  Bold,
  Code,
  Highlighter,
  Italic,
  Link2,
  MessageSquarePlus,
  Strikethrough,
} from 'lucide-react'

const HIGHLIGHT_COLORS = ['#fef3c7', '#dbeafe', '#dcfce7', '#fee2e2', '#f3e8ff']

export function EditorBubbleToolbar({ editor }: { editor: Editor }) {
  const { t } = useTranslation('editor')
  const [linkMode, setLinkMode] = useState(false)
  const [linkUrl, setLinkUrl] = useState('')

  const inTable = editor.isActive('table')

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

  return (
    <BubbleMenu
      editor={editor}
      options={{ placement: 'top', offset: 10 }}
      shouldShow={({ editor: e, from, to }) => {
        if (inTable) return false
        if (e.isEmpty) return false
        return from !== to
      }}
    >
      <div className="linkbase-tb" role="toolbar">
        {linkMode ? (
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
        ) : (
          <>
            <select
              className="linkbase-tb-select"
              value={
                editor.isActive('heading', { level: 1 })
                  ? 'h1'
                  : editor.isActive('heading', { level: 2 })
                    ? 'h2'
                    : editor.isActive('heading', { level: 3 })
                      ? 'h3'
                      : editor.isActive('blockquote')
                        ? 'quote'
                        : editor.isActive('codeBlock')
                          ? 'code'
                          : 'p'
              }
              onChange={(e) => {
                const v = e.target.value
                const cmds = editor.chain().focus()
                if (v === 'p') cmds.setNode('paragraph').run()
                else if (v === 'h1') cmds.setHeading({ level: 1 }).run()
                else if (v === 'h2') cmds.setHeading({ level: 2 }).run()
                else if (v === 'h3') cmds.setHeading({ level: 3 }).run()
                else if (v === 'quote') cmds.setNode('blockquote').run()
                else if (v === 'code') cmds.setNode('codeBlock').run()
              }}
            >
              <option value="p">{t('toolbar.block.paragraph')}</option>
              <option value="h1">{t('toolbar.block.heading1')}</option>
              <option value="h2">{t('toolbar.block.heading2')}</option>
              <option value="h3">{t('toolbar.block.heading3')}</option>
              <option value="quote">{t('toolbar.block.quote')}</option>
              <option value="code">{t('toolbar.block.code')}</option>
            </select>
            <button type="button" className={btn(editor.isActive('bold'))} onClick={() => editor.chain().focus().toggleBold().run()} title={t('toolbar.bold')}>
              <Bold size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('italic'))} onClick={() => editor.chain().focus().toggleItalic().run()} title={t('toolbar.italic')}>
              <Italic size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('strike'))} onClick={() => editor.chain().focus().toggleStrike().run()} title={t('toolbar.strike')}>
              <Strikethrough size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('code'))} onClick={() => editor.chain().focus().toggleCode().run()} title={t('toolbar.code')}>
              <Code size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('highlight'))} onClick={() => editor.chain().focus().toggleHighlight().run()} title={t('toolbar.highlight')}>
              <Highlighter size={15} />
            </button>
            <button type="button" className={btn(editor.isActive('link'))} onClick={() => setLinkMode(true)} title={t('toolbar.link')}>
              <Link2 size={15} />
            </button>
            <button type="button" className={btn(false)} title={t('toolbar.comment')} disabled>
              <MessageSquarePlus size={15} />
            </button>
          </>
        )}
      </div>
      {inTable && (
        <div className="linkbase-tb" role="toolbar">
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addRowAfter().run()}>
            {t('toolbar.table.addRow')}
          </button>
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteRow().run()}>
            {t('toolbar.table.deleteRow')}
          </button>
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().addColumnAfter().run()}>
            {t('toolbar.table.addColumn')}
          </button>
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteColumn().run()}>
            {t('toolbar.table.deleteColumn')}
          </button>
          <button type="button" className={btn(editor.isActive('tableHeader'))} onClick={() => editor.chain().focus().toggleHeaderRow().run()}>
            {t('toolbar.table.headerRow')}
          </button>
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().deleteTable().run()}>
            {t('toolbar.table.deleteTable')}
          </button>
        </div>
      )}
      {editor.isActive('highlight') && (
        <div className="linkbase-tb" role="toolbar">
          {HIGHLIGHT_COLORS.map((color) => (
            <button
              key={color}
              type="button"
              className="linkbase-tb-swatch"
              style={{ background: color }}
              onClick={() => editor.chain().focus().setHighlight({ color }).run()}
              aria-label={`highlight ${color}`}
            />
          ))}
          <button type="button" className={btn(false)} onClick={() => editor.chain().focus().unsetHighlight().run()}>
            {t('toolbar.highlightOff')}
          </button>
        </div>
      )}
    </BubbleMenu>
  )
}
