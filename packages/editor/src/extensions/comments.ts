/**
 * 评论高亮扩展（P1-3 / T2.4）：文本引用锚点 → inline 高亮装饰。
 * 锚点 = { quote, prefix, suffix }：在全文索引中搜索 quote，多个命中时按前后文匹配度择优；
 * 跨块命中按文本节点分段绘制。宿主在评论数据变化后调 refreshComments() 重算。
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Editor } from '@tiptap/core'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

export interface CommentAnchorSpec {
  id: string
  quote: string
  prefix: string
  suffix: string
}

export interface CommentsOptions {
  getAnchors: () => CommentAnchorSpec[]
  onAnchorClick?: (id: string) => void
}

const pluginKey = new PluginKey<DecorationSet>('linkbaseComments')

interface TextChunk {
  start: number // 全文拼接串中的偏移
  pos: number // 文本节点起始 PM 位置
  text: string
}

function buildIndex(doc: ProsemirrorNode): { full: string; chunks: TextChunk[] } {
  let full = ''
  const chunks: TextChunk[] = []
  doc.descendants((node, pos) => {
    if (node.isText && node.text) {
      chunks.push({ start: full.length, pos, text: node.text })
      full += node.text
    }
    return true
  })
  return { full, chunks }
}

function indexToPos(chunks: TextChunk[], idx: number): number {
  for (let i = chunks.length - 1; i >= 0; i--) {
    const c = chunks[i]!
    if (idx >= c.start) return c.pos + (idx - c.start)
  }
  return 1
}

/** quote 出现位置择优：prefix 尾部匹配越长越优 */
function pickOccurrence(full: string, anchor: CommentAnchorSpec): number {
  let best = -1
  let bestScore = -1
  let idx = full.indexOf(anchor.quote)
  while (idx !== -1) {
    let score = 0
    if (anchor.prefix) {
      const s = Math.max(0, idx - anchor.prefix.length)
      const ctx = full.slice(s, idx)
      const n = Math.min(ctx.length, anchor.prefix.length)
      let m = 0
      while (m < n && ctx[ctx.length - 1 - m] === anchor.prefix[anchor.prefix.length - 1 - m]) m++
      score = m
    }
    if (score > bestScore) {
      bestScore = score
      best = idx
    }
    idx = full.indexOf(anchor.quote, idx + 1)
  }
  return best
}

function buildDecorations(doc: ProsemirrorNode, getAnchors: () => CommentAnchorSpec[]): DecorationSet {
  const anchors = getAnchors()
  if (anchors.length === 0) return DecorationSet.empty
  const { full, chunks } = buildIndex(doc)
  const decorations: Decoration[] = []
  for (const anchor of anchors) {
    if (!anchor.quote.trim()) continue
    const best = pickOccurrence(full, anchor)
    if (best === -1) continue
    const end = best + anchor.quote.length
    // 跨文本节点分段绘制（inline 装饰不可跨块）
    for (const c of chunks) {
      const cEnd = c.start + c.text.length
      if (cEnd <= best || c.start >= end) continue
      const fromIdx = Math.max(best, c.start)
      const toIdx = Math.min(end, cEnd)
      decorations.push(
        Decoration.inline(
          indexToPos(chunks, fromIdx),
          indexToPos(chunks, toIdx),
          { class: 'linkbase-comment-highlight', 'data-comment-id': anchor.id },
        ),
      )
    }
  }
  return decorations.length > 0 ? DecorationSet.create(doc, decorations) : DecorationSet.empty
}

export const CommentsHighlight = Extension.create<CommentsOptions>({
  name: 'commentsHighlight',

  addOptions() {
    return { getAnchors: () => [], onAnchorClick: undefined }
  },

  addProseMirrorPlugins() {
    const options = this.options
    return [
      new Plugin<DecorationSet>({
        key: pluginKey,
        state: {
          init: (_, state) => buildDecorations(state.doc, options.getAnchors),
          apply: (tr, old) => {
            if (tr.docChanged || tr.getMeta(pluginKey)) {
              return buildDecorations(tr.doc, options.getAnchors)
            }
            return old
          },
        },
        props: {
          decorations(state) {
            return pluginKey.getState(state)
          },
          handleClick: (view, _pos, event) => {
            const target = event.target as HTMLElement | null
            const id = target?.closest?.('[data-comment-id]')?.getAttribute('data-comment-id')
            if (id) options.onAnchorClick?.(id)
            return false
          },
        },
      }),
    ]
  },
})

/** 评论数据变化后触发装饰重算（宿主在 invalidate 后调用） */
export function refreshComments(editor: Editor): void {
  if (!editor.isDestroyed) {
    editor.view.dispatch(editor.state.tr.setMeta(pluginKey, {}))
  }
}
