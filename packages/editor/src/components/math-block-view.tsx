/** mathBlock NodeView（P1-7）：源码编辑 + KaTeX 实时预览；katex 动态加载 */
import { useEffect, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export function MathBlockView({ node }: NodeViewProps) {
  const [html, setHtml] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const latex = node.textContent

  useEffect(() => {
    let cancelled = false
    void import('katex').then((katex) => {
        if (cancelled) return
        try {
          setHtml(katex.renderToString(latex || '\\ ', { throwOnError: false, displayMode: true }))
          setError(null)
        } catch (e) {
          setError(String((e as Error).message ?? e))
        }
      })
      .catch(() => setError('katex load failed'))
    return () => {
      cancelled = true
    }
  }, [latex])

  return (
    <NodeViewWrapper data-type="mathBlock" className="linkbase-math-block">
      <div className="linkbase-math-preview" data-error={error != null}>
        {error ? <span className="linkbase-math-error">{error}</span> : <span dangerouslySetInnerHTML={{ __html: html }} />}
      </div>
      <NodeViewContent className="linkbase-math-source" />
    </NodeViewWrapper>
  )
}
