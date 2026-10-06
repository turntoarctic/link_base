/**
 * 页内查找替换面板（P1-7 / ⌘F）：EditorView 内渲染；⌘F（编辑器聚焦时）或 ⋯ 菜单打开。
 * 打开期间由 findReplace 插件高亮全部匹配，支持上一个/下一个/替换/全部替换。
 */
import { useEffect, useReducer, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown, ChevronUp, Replace, ReplaceAll, X } from 'lucide-react'
import { findReplaceKey, type Editor } from '@linkbase/editor'

/** ⋯ 菜单触发入口（与 openCommandPalette 同款事件模式） */
export function openFindReplace(): void {
  window.dispatchEvent(new CustomEvent('linkbase-find-replace'))
}

export function FindReplaceBar({ editor, onClose }: { editor: Editor; onClose: () => void }) {
  const { t } = useTranslation('editor')
  const [search, setSearch] = useState('')
  const [replace, setReplace] = useState('')
  const [, force] = useReducer((x: number) => x + 1, 0)

  // 匹配数随文档/搜索词变化刷新
  useEffect(() => {
    const onUpdate = () => force()
    editor.on('update', onUpdate)
    editor.on('selectionUpdate', onUpdate)
    editor.on('transaction', onUpdate)
    return () => {
      editor.off('update', onUpdate)
      editor.off('selectionUpdate', onUpdate)
      editor.off('transaction', onUpdate)
    }
  }, [editor])

  useEffect(() => {
    editor.commands.setSearch({ searchTerm: search, replaceTerm: replace })
    return () => {
      editor.commands.setSearch({ searchTerm: '' })
    }
  }, [editor, search, replace])

  const state = findReplaceKey.getState(editor.state)
  const count = state?.matches.length ?? 0
  const active = count > 0 ? Math.min((state?.active ?? 0), count - 1) + 1 : 0

  return (
    <div className="linkbase-find-bar" contentEditable={false}>
      <input
        autoFocus
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            if (e.shiftKey) editor.commands.findPrev()
            else editor.commands.findNext()
          }
          if (e.key === 'Escape') onClose()
        }}
        placeholder={t('findReplace.search')}
        className="linkbase-find-input"
      />
      <span className="linkbase-find-count">
        {count > 0 ? `${active}/${count}` : t('findReplace.noMatch')}
      </span>
      <button type="button" aria-label={t('findReplace.prev')} className="linkbase-find-btn" onClick={() => editor.commands.findPrev()}>
        <ChevronUp size={14} />
      </button>
      <button type="button" aria-label={t('findReplace.next')} className="linkbase-find-btn" onClick={() => editor.commands.findNext()}>
        <ChevronDown size={14} />
      </button>
      <input
        value={replace}
        onChange={(e) => setReplace(e.target.value)}
        placeholder={t('findReplace.replace')}
        className="linkbase-find-input w-[110px]"
      />
      <button
        type="button"
        aria-label={t('findReplace.replaceCurrent')}
        title={t('findReplace.replaceCurrent')}
        className="linkbase-find-btn"
        disabled={count === 0}
        onClick={() => editor.commands.replaceCurrent()}
      >
        <Replace size={14} />
      </button>
      <button
        type="button"
        className="linkbase-find-btn text-[11px]"
        disabled={count === 0}
        onClick={() => editor.commands.replaceAll()}
      >
        {t('findReplace.replaceAll')}
      </button>
      <button type="button" aria-label={t('common:close')} className="linkbase-find-btn" onClick={onClose}>
        <X size={14} />
      </button>
    </div>
  )
}
