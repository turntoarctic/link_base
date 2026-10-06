/**
 * 块拖拽手柄扩展（05 §6 P0 最小版）：左侧手柄悬停显示，按住拖动顶层块重排。
 * 实现用鼠标事件（非 HTML5 DnD），拖动中在落点渲染指示线，松手 dispatch 一次 move 事务。
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface DragHandleState {
  hoverIndex: number | null
  dragIndex: number | null
  dropIndex: number | null // 顶层插入位置（child index）
}

const pluginKey = new PluginKey<DragHandleState>('linkbaseDragHandle')

interface TopBlock {
  index: number
  pos: number
  size: number
}

function topLevelBlocks(view: EditorView): TopBlock[] {
  const blocks: TopBlock[] = []
  let pos = 1
  view.state.doc.forEach((node, _offset, index) => {
    blocks.push({ index, pos, size: node.nodeSize })
    pos += node.nodeSize
  })
  return blocks
}

function blockIndexAt(blocks: TopBlock[], pos: number): number | null {
  for (const b of blocks) {
    if (pos >= b.pos - 1 && pos < b.pos - 1 + b.size) return b.index
  }
  return blocks.length > 0 ? blocks.length - 1 : null
}

/** 目标 doc 中第 index 个顶层块的起始插入位置；index 越界 = 文档末尾 */
function insertPosAtIndex(doc: EditorView['state']['doc'], index: number): number {
  let pos = 1
  const count = doc.childCount
  if (index >= count) return doc.content.size
  for (let i = 0; i < index && i < count; i++) {
    pos += doc.child(i).nodeSize
  }
  return pos
}

const createHandleElement = (doc: Document): HTMLElement => {
  const el = doc.createElement('div')
  el.className = 'linkbase-drag-handle'
  el.setAttribute('contenteditable', 'false')
  el.setAttribute('draggable', 'false')
  for (let i = 0; i < 3; i++) {
    const dot = doc.createElement('span')
    dot.className = 'linkbase-drag-handle-dot'
    el.appendChild(dot)
  }
  return el
}

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    let activeView: EditorView | null = null

    const setState = (view: EditorView, patch: Partial<DragHandleState>) => {
      const current = pluginKey.getState(view.state) as DragHandleState
      view.dispatch(view.state.tr.setMeta(pluginKey, { ...current, ...patch }))
    }

    const moveBlock = (view: EditorView, fromIndex: number, dropIndex: number) => {
      const blocks = topLevelBlocks(view.state)
      const block = blocks[fromIndex]
      if (!block) return
      if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return
      const { tr } = view.state
      tr.delete(block.pos, block.pos + block.size)
      const toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex
      tr.insert(insertPosAtIndex(tr.doc, toIndex), view.state.doc.child(fromIndex))
      view.dispatch(tr)
    }

    return [
      new Plugin<DragHandleState>({
        key: pluginKey,
        state: {
          init: () => ({ hoverIndex: null, dragIndex: null, dropIndex: null }),
          apply(tr, value) {
            if (tr.getMeta(pluginKey)) return tr.getMeta(pluginKey) as DragHandleState
            if (tr.docChanged) return { hoverIndex: null, dragIndex: null, dropIndex: null }
            return value
          },
        },
        props: {
          decorations(state) {
            const s = pluginKey.getState(state)
            if (!s) return DecorationSet.empty
            const widgets: Decoration[] = []
            const blocks = topLevelBlocks(state as unknown as EditorView['state'])
            if (s.dragIndex != null && s.dropIndex != null) {
              const pos = insertPosAtIndex(state.doc, s.dropIndex)
              const indicator = document.createElement('div')
              indicator.className = 'linkbase-drop-indicator'
              widgets.push(Decoration.widget(pos, indicator, { side: 1, ignoreSelection: true }))
            } else if (s.hoverIndex != null) {
              const block = blocks[s.hoverIndex]
              if (block) {
                widgets.push(
                  Decoration.widget(block.pos, createHandleElement(document), {
                    side: -10,
                    ignoreSelection: true,
                  }),
                )
              }
            }
            return widgets.length ? DecorationSet.create(state.doc, widgets) : DecorationSet.empty
          },
          handleDOMEvents: {
            mousemove: (view, event) => {
              const s = pluginKey.getState(view.state) as DragHandleState
              if (s.dragIndex != null) {
                event.preventDefault()
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
                if (coords) {
                  const blocks = topLevelBlocks(view)
                  let index = blockIndexAt(blocks, coords.pos)
                  if (index != null) {
                    const rect = view.coordsAtPos(Math.min(coords.pos, view.state.doc.content.size - 1))
                    if (rect && event.clientY > (rect.top + rect.bottom) / 2) index += 1
                    if (index !== s.dropIndex) setState(view, { dropIndex: index })
                  }
                }
                return true
              }
              // 悬停：只在编辑器顶层块之间移动时更新
              const target = event.target as HTMLElement | null
              if (target?.closest?.('.linkbase-drag-handle')) return false
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!coords) return false
              const blocks = topLevelBlocks(view)
              const index = blockIndexAt(blocks, coords.pos)
              if (index !== s.hoverIndex) setState(view, { hoverIndex: index })
              return false
            },
            mouseleave: (view) => {
              const s = pluginKey.getState(view.state) as DragHandleState
              if (s.dragIndex == null && s.hoverIndex != null) setState(view, { hoverIndex: null })
              return false
            },
            mousedown: (view, event) => {
              const target = event.target as HTMLElement | null
              const handle = target?.closest?.('.linkbase-drag-handle')
              if (!handle) return false
              const s = pluginKey.getState(view.state) as DragHandleState
              if (s.hoverIndex == null) return false
              event.preventDefault()
              activeView = view
              setState(view, { dragIndex: s.hoverIndex, dropIndex: null })
              view.dom.classList.add('linkbase-is-dragging')
              return true
            },
          },
        },
        view(editorView) {
          const onMouseUp = (event: MouseEvent) => {
            const view = activeView
            if (!view) return
            const s = pluginKey.getState(view.state) as DragHandleState
            view.dom.classList.remove('linkbase-is-dragging')
            if (s.dragIndex != null && s.dropIndex != null) {
              // 落点坐标取 mouseup 位置（moveBlock 用 plugin state 里的 dropIndex）
              moveBlock(view, s.dragIndex, s.dropIndex)
              event.preventDefault()
            }
            setState(view, { hoverIndex: null, dragIndex: null, dropIndex: null })
            activeView = null
          }
          document.addEventListener('mouseup', onMouseUp)
          return {
            destroy() {
              document.removeEventListener('mouseup', onMouseUp)
            },
          }
        },
      }),
    ]
  },
})
