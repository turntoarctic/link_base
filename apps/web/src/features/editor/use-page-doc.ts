/** usePageDoc（05 §3.1）：打开页面 Y.Doc 的 React 绑定；文档状态不进 React state（06 §3 红线），
 * 这里只持有 Y.Doc 实例引用与加载状态。 */
import { useEffect, useState } from 'react'
import type * as Y from 'yjs'
import { openPageDoc } from './doc-manager'

export type PageDocStatus = 'loading' | 'ready' | 'error'

export function usePageDoc(wsId: string, pageId: string): {
  status: PageDocStatus
  ydoc: Y.Doc | null
} {
  const [state, setState] = useState<{ status: PageDocStatus; ydoc: Y.Doc | null }>({
    status: 'loading',
    ydoc: null,
  })

  useEffect(() => {
    let cancelled = false
    setState({ status: 'loading', ydoc: null })
    openPageDoc(wsId, pageId)
      .then(({ ydoc }) => {
        if (!cancelled) setState({ status: 'ready', ydoc })
      })
      .catch(() => {
        if (!cancelled) setState({ status: 'error', ydoc: null })
      })
    return () => {
      cancelled = true
    }
  }, [wsId, pageId])

  return state
}
