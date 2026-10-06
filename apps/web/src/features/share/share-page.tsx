/** 公开只读分享页（Phase 3 /share/:slug）：拉取合并态 update → 只读编辑器渲染；无登录态 */
import { useEffect, useState } from 'react'
import { useParams } from 'react-router'
import { useTranslation } from 'react-i18next'
import * as Y from 'yjs'
import { buildEditorKit, EditorContent, useEditor } from '@linkbase/editor'
import { Skeleton } from '@/components/ui/primitives'

export default function SharePage() {
  const { slug = '' } = useParams()
  const { t } = useTranslation('workspace')
  const [status, setStatus] = useState<'loading' | 'ready' | 'error'>('loading')
  const [sharedDoc, setSharedDoc] = useState<Y.Doc | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        // 公开端点：无 Bearer（能力 URL 语义）
        const res = await fetch(`/api/share/${encodeURIComponent(slug)}`)
        if (!res.ok) throw new Error(String(res.status))
        const ydoc = new Y.Doc()
        Y.applyUpdate(ydoc, new Uint8Array(await res.arrayBuffer()))
        if (!cancelled) {
          setSharedDoc(ydoc)
          setStatus('ready')
        }
      } catch {
        if (!cancelled) setStatus('error')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [slug])

  const editor = useEditor({
    editable: false,
    extensions: sharedDoc
      ? buildEditorKit({ ydoc: sharedDoc, uploadImage: async () => ({ url: '' }) })
      : [],
  }, [sharedDoc])

  return (
    <div className="min-h-screen bg-(--background) text-(--foreground)">
      <div className="mx-auto max-w-(--width-content) px-6 py-10">
        <div className="mb-6 text-[12px] text-(--muted-foreground)">Linkbase · {t('share.readOnly')}</div>
        {status === 'loading' && (
          <div className="flex flex-col gap-3" aria-busy="true">
            <Skeleton className="h-8 w-2/3" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-20 text-center text-[14px] text-(--muted-foreground)">{t('share.notFound')}</div>
        )}
        {status === 'ready' && editor && (
          <div className="linkbase-editor-content">
            <EditorContent editor={editor} />
          </div>
        )}
      </div>
    </div>
  )
}
