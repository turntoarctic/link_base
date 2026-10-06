/**
 * 代码块语言选择器（05 §6 表格工具条同款思路）：光标位于 codeBlock 内时，
 * 在块的右上角浮现语言下拉（lowlight common 语言集），切换即重高亮。
 */
import { useEffect, useState } from 'react'
import { createPortal } from 'react-dom'
import { useTranslation } from 'react-i18next'
import type { Editor } from '@tiptap/core'
import { common } from 'lowlight'

const LANGUAGES = ['plaintext', ...Object.keys(common).filter((l) => l !== 'plaintext').sort()]

interface PickerState {
  top: number
  left: number
  language: string
}

/** 找到选区所在 codeBlock 的文档位置；不在代码块内返回 null */
function codeBlockPos(editor: Editor): number | null {
  const $from = editor.state.selection.$from
  for (let depth = $from.depth; depth > 0; depth--) {
    if ($from.node(depth).type.name === 'codeBlock') return $from.before(depth)
  }
  return null
}

export function CodeBlockLangPicker({ editor }: { editor: Editor }) {
  const { t } = useTranslation('editor')
  const [state, setState] = useState<PickerState | null>(null)

  useEffect(() => {
    const update = () => {
      if (editor.isDestroyed) {
        setState(null)
        return
      }
      const pos = codeBlockPos(editor)
      if (pos == null) {
        setState(null)
        return
      }
      const dom = editor.view.nodeDOM(pos) as HTMLElement | null
      if (!dom) {
        setState(null)
        return
      }
      const rect = dom.getBoundingClientRect()
      setState({
        // 块上方浮现；贴近视口顶部时退到块内右上角
        top: rect.top < 48 ? rect.top + 6 : rect.top - 30,
        left: rect.right - 132,
        language: (editor.state.doc.nodeAt(pos)?.attrs.language as string) ?? 'plaintext',
      })
    }
    editor.on('selectionUpdate', update)
    editor.on('transaction', update)
    editor.on('focus', update)
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      editor.off('selectionUpdate', update)
      editor.off('transaction', update)
      editor.off('focus', update)
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [editor])

  if (!state) return null
  return createPortal(
    <select
      className="linkbase-code-lang"
      style={{ position: 'fixed', top: state.top, left: state.left }}
      value={state.language}
      aria-label={t('codeBlock.language')}
      onChange={(e) => editor.chain().focus().updateAttributes('codeBlock', { language: e.target.value }).run()}
    >
      {LANGUAGES.map((lang) => (
        <option key={lang} value={lang}>
          {lang}
        </option>
      ))}
    </select>,
    document.body,
  )
}
