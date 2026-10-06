/** mermaidBlock NodeView（P1-7）：源码编辑 + mermaid SVG 渲染；mermaid 动态加载 */
import { useEffect, useId, useState } from 'react'
import { NodeViewContent, NodeViewWrapper, type NodeViewProps } from '@tiptap/react'

export function MermaidView({ node }: NodeViewProps) {
  const reactId = useId()
  const [svg, setSvg] = useState<string>('')
  const [error, setError] = useState<string | null>(null)
  const source = node.textContent

  useEffect(() => {
    let cancelled = false
    if (!source.trim()) {
      setSvg('')
      setError(null)
      return
    }
    void import('mermaid').then(async (mermaidModule) => {
      const mermaid = mermaidModule.default
      try {
        mermaid.initialize({ startOnLoad: false, securityLevel: 'strict' })
        const { svg: rendered } = await mermaid.render(`linkbase-mermaid-${reactId.replace(/[^a-zA-Z0-9]/g, '')}`, source)
        if (!cancelled) {
          setSvg(rendered)
          setError(null)
        }
      } catch (e) {
        if (!cancelled) {
          setSvg('')
          setError(String((e as Error).message ?? e).slice(0, 200))
        }
      }
    }).catch(() => {
      if (!cancelled) setError('mermaid load failed')
    })
    return () => {
      cancelled = true
    }
  }, [source, reactId])

  return (
    <NodeViewWrapper data-type="mermaidBlock" className="linkbase-mermaid-block">
      <div
        className="linkbase-mermaid-preview"
        data-error={error != null}
        // mermaid 输出为沙箱内 render 产物（securityLevel: strict）
        dangerouslySetInnerHTML={{ __html: error ? `<span class="linkbase-mermaid-error">${error}</span>` : svg }}
      />
      <NodeViewContent className="linkbase-mermaid-source" />
    </NodeViewWrapper>
  )
}
