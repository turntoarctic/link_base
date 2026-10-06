/** image 节点 NodeView（05 §6）：上传中占位 / 失败重试 / 正常展示 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import { NODE_IMAGE } from '../schema.ts'

export function ImageView({ node, updateAttributes, editor }: NodeViewProps) {
  const { t } = useTranslation('editor')
  const { src, alt, uploading, error } = node.attrs as {
    src: string
    alt: string | null
    uploading: boolean
    error: boolean
  }
  const [retrying, setRetrying] = useState(false)

  useEffect(() => {
    setRetrying(false)
  }, [src])

  const retry = () => {
    // 重试：从本地占位 src 重新走宿主上传桥
    const file = fetchAsFile(src, alt ?? 'image').catch(() => null)
    void file.then((f) => {
      if (!f) return
      setRetrying(true)
      void (editor.commands as unknown as { uploadImage: (file: File) => boolean }).uploadImage(f)
    })
  }

  return (
    <NodeViewWrapper data-type={NODE_IMAGE} className="linkbase-image-wrapper">
      {uploading || retrying ? (
        <div className="linkbase-image-placeholder" aria-busy="true">
          <div className="linkbase-image-skeleton" />
          <span>{t('image.uploading')}</span>
        </div>
      ) : error ? (
        <div className="linkbase-image-error">
          <span>{t('image.failed')}</span>
          <button type="button" onClick={retry}>
            {t('image.retry')}
          </button>
        </div>
      ) : (
        <img src={src} alt={alt ?? ''} draggable={false} />
      )}
    </NodeViewWrapper>
  )
}

async function fetchAsFile(url: string, name: string): Promise<File | null> {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    return new File([blob], name, { type: blob.type })
  } catch {
    return null
  }
}
