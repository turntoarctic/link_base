/** attachment 节点 NodeView（P1-6 / T2.6）：文件卡片（类型图标 + 名称 + 大小 + 下载） */
import { useTranslation } from 'react-i18next'
import { Download, FileArchive, FileAudio, FileCode, FileImage, FileSpreadsheet, FileText, FileVideo, Paperclip } from 'lucide-react'
import { NodeViewWrapper, type NodeViewProps } from '@tiptap/react'
import type { LucideIcon } from 'lucide-react'
import { NODE_ATTACHMENT } from '../schema.ts'

function iconFor(mime: string): LucideIcon {
  if (mime.startsWith('image/')) return FileImage
  if (mime.startsWith('video/')) return FileVideo
  if (mime.startsWith('audio/')) return FileAudio
  if (mime === 'application/pdf') return FileText
  if (/^(text\/|application\/(json|xml|javascript))/.test(mime)) return FileCode
  if (/^(application\/(zip|gzip|x-7z-compressed|x-rar-compressed)|application\/x-tar)/.test(mime)) return FileArchive
  if (/^application\/vnd\.(openxmlformats|ms-excel|ms-powerpoint|oasis)/.test(mime)) return FileSpreadsheet
  return Paperclip
}

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`
}

export function AttachmentView({ node }: NodeViewProps) {
  const { t } = useTranslation('editor')
  const { blobId, name, size, mime } = node.attrs as {
    blobId: string
    name: string
    size: number
    mime: string
  }
  const Icon = iconFor(mime)

  return (
    <NodeViewWrapper data-type={NODE_ATTACHMENT} className="linkbase-attachment-wrapper">
      <a
        className="linkbase-attachment-card"
        href={`/blobs/${blobId}`}
        download={name}
        contentEditable={false}
        title={t('attachment.download', { name })}
      >
        <span className="linkbase-attachment-icon">
          <Icon size={18} />
        </span>
        <span className="linkbase-attachment-meta">
          <span className="linkbase-attachment-name">{name || t('attachment.untitled')}</span>
          <span className="linkbase-attachment-size">{formatSize(Number(size) || 0)}</span>
        </span>
        <span className="linkbase-attachment-download">
          <Download size={15} />
        </span>
      </a>
    </NodeViewWrapper>
  )
}
