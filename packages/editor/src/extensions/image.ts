/**
 * 图片扩展（05 §6）：粘贴/拖拽/命令上传 → BlobSource（10 §5.3）→ image 节点。
 * 上传中占位（uploading attr）、失败可重试（error attr），由 ImageView NodeView 渲染。
 */
import { Node, mergeAttributes } from '@tiptap/core'
import type { EditorView } from '@tiptap/pm/view'
import { Plugin } from '@tiptap/pm/state'
import { ReactNodeViewRenderer } from '@tiptap/react'
import { ImageView } from '../components/image-view.tsx'
import { NODE_IMAGE } from '../schema.ts'

export interface ImageUploadOptions {
  /** 上传桥接：宿主应用提供（POST /workspaces/:wsId/blobs），返回可直接访问的 URL */
  upload: (file: File) => Promise<{ url: string }>
  maxFileSize: number
}

const isImageFile = (file: File): boolean => file.type.startsWith('image/')

/**
 * 插入上传占位节点并异步上传，回填 URL / 标记失败。
 * 统一从 ProseMirror view 操作（命令与 DOM 事件两条入口共用）。
 */
function uploadFiles(
  view: EditorView,
  options: ImageUploadOptions,
  files: FileList | File[],
  pos?: number,
): boolean {
  const images = Array.from(files).filter(isImageFile)
  if (images.length === 0) return false
  const nodeType = view.state.schema.nodes[NODE_IMAGE]
  if (!nodeType) return false

  let cursor = pos ?? view.state.selection.from
  for (const file of images) {
    const objectUrl = URL.createObjectURL(file)
    view.dispatch(view.state.tr.insert(cursor, nodeType.create({ src: objectUrl, uploading: true })))

    const patch = (attrs: Record<string, unknown>) => {
      view.state.doc.descendants((node, nodePos) => {
        if (node.type.name === NODE_IMAGE && node.attrs.src === objectUrl) {
          view.dispatch(view.state.tr.setNodeMarkup(nodePos, undefined, { ...node.attrs, ...attrs }))
          return false
        }
        return true
      })
    }

    void (async () => {
      try {
        if (file.size > options.maxFileSize) throw new Error(`file too large: ${file.size}`)
        const { url } = await options.upload(file)
        patch({ src: url, uploading: false, error: false })
        setTimeout(() => URL.revokeObjectURL(objectUrl), 1_000)
      } catch {
        patch({ uploading: false, error: true }) // 保留 objectUrl 供重试
      }
    })()

    cursor += 1
  }
  return true
}

export const ImageUpload = Node.create<ImageUploadOptions>({
  name: NODE_IMAGE,

  addOptions() {
    return {
      upload: async () => {
        throw new Error('image upload not configured')
      },
      maxFileSize: 25 * 1024 * 1024,
    }
  },

  inline: false,
  group: 'block',
  draggable: true,
  atom: true,

  addAttributes() {
    return {
      src: { default: null },
      alt: { default: null },
      title: { default: null },
      uploading: { default: false, rendered: false },
      error: { default: false, rendered: false },
    }
  },

  parseHTML() {
    return [{ tag: 'img[src]' }]
  },

  renderHTML({ HTMLAttributes }) {
    return ['img', mergeAttributes(HTMLAttributes, { 'data-type': NODE_IMAGE })]
  },

  addNodeView() {
    return ReactNodeViewRenderer(ImageView)
  },

  addCommands() {
    return {
      uploadImage:
        (file: File) =>
        ({ view, state }) =>
          uploadFiles(view, this.options, [file], state.selection.from),
    }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin({
        props: {
          handlePaste: (view, event) => {
            const files = event.clipboardData?.files
            if (!files || files.length === 0) return false
            return uploadFiles(view, options, files)
          },
          handleDrop: (view, event, _slice, moved) => {
            if (moved) return false
            const files = event.dataTransfer?.files
            if (!files || files.length === 0) return false
            const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
            return uploadFiles(view, options, files, coords?.pos)
          },
        },
      }),
    ]
  },
})
