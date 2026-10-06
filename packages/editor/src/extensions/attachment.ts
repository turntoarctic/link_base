/**
 * 附件节点（P1-6 / T2.6）：任意文件上传后的卡片展示（图标 + 文件名 + 大小 + 下载）。
 * 存储复用 blobs（内容寻址，10 §5.3）；下载走 /blobs/:id（能力 URL）。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { AttachmentView } from '../components/attachment-view.tsx'
import { NODE_ATTACHMENT } from '../schema.ts'

export interface AttachmentAttrs {
  blobId: string
  name: string
  size: number
  mime: string
}

declare module '@tiptap/core' {
  interface Commands<ReturnType> {
    attachment: {
      /** 插入附件卡片（上传完成后调用） */
      insertAttachment: (attrs: AttachmentAttrs) => ReturnType
    }
  }
}

export const Attachment = Node.create({
  name: NODE_ATTACHMENT,

  group: 'block',
  atom: true,
  selectable: true,

  addAttributes() {
    return {
      blobId: { default: null },
      name: { default: '' },
      size: { default: 0 },
      mime: { default: 'application/octet-stream' },
    }
  },

  parseHTML() {
    return [{ tag: `div[data-type="${NODE_ATTACHMENT}"]` }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['div', mergeAttributes(HTMLAttributes, { 'data-type': NODE_ATTACHMENT })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(AttachmentView)
  },

  addCommands() {
    return {
      insertAttachment:
        (attrs: AttachmentAttrs) =>
        ({ commands }) =>
          commands.insertContent({ type: NODE_ATTACHMENT, attrs }),
    }
  },
})
