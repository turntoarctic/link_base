/**
 * 块拖拽手柄扩展（05 §6 P0 最小版）：左侧手柄悬停显示，按住拖动顶层块重排。
 * 手柄是宿主容器内的绝对定位浮层，坐标由 JS 按 hover 块的 getBoundingClientRect 计算
 * （widget decoration 的静态位置随块内容浮动，锚点不可控——已废弃该方案）。
 * 拖动中落点用文档流内的零高指示线（widget，无绝对定位）。
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey } from '@tiptap/pm/state'
import type { Node as ProsemirrorNode } from '@tiptap/pm/model'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'

interface DragHandleState {
  dropIndex: number | null // 顶层插入位置（child index）
}

const pluginKey = new PluginKey<DragHandleState>('linkbaseDragHandle')

interface TopBlock {
  index: number
  pos: number
  size: number
}

function topLevelBlocks(doc: ProsemirrorNode): TopBlock[] {
  const blocks: TopBlock[] = []
  let pos = 1
  doc.forEach((node, _offset, index) => {
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

/** 目标 doc 中第 index 个顶层块的节点起始位置；index 越界 = 文档末尾。
 * 注意：TopBlock.pos 是内容起点（节点起点 = pos-1），这里统一换算成节点起点。 */
function insertPosAtIndex(doc: ProsemirrorNode, index: number): number {
  const count = doc.childCount
  if (index >= count) return doc.content.size
  let pos = 0
  for (let i = 0; i < index && i < count; i++) {
    pos += doc.child(i).nodeSize
  }
  return pos
}

function createHandleElement(doc: Document): HTMLElement {
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
    let handleEl: HTMLElement | null = null
    let hoverIndex: number | null = null
    let dragIndex: number | null = null
    let activeView: EditorView | null = null
    let hideTimer: ReturnType<typeof setTimeout> | null = null

    const cancelHide = () => {
      if (hideTimer != null) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const hideHandle = () => {
      cancelHide()
      hoverIndex = null
      handleEl?.classList.remove('is-visible')
    }

    /** 离开编辑器不立即隐藏：指针正移向 gutter 里的把手，给 250ms 抵达窗口。
     * hoverIndex 必须保留——按下把手时靠它知道拖哪个块，清早了拖拽无从开始。 */
    const scheduleHide = () => {
      cancelHide()
      hideTimer = setTimeout(() => {
        hideTimer = null
        if (dragIndex == null) hideHandle()
      }, 250)
    }

    /** 把手定位到第 index 个顶层块首行左 gutter（相对宿主容器；元素由 plugin view 预建） */
    const placeHandle = (view: EditorView, index: number | null) => {
      const container = view.dom.parentElement
      if (!container || !handleEl) return
      if (index == null) {
        hideHandle()
        return
      }
      const block = topLevelBlocks(view.state.doc)[index]
      // nodeDOM 要传「块前」位置（block.pos 是块内容起始，会命中块内首个文本节点）
      const blockDom = block ? (view.nodeDOM(block.pos - 1) as Node | null) : null
      if (!block || !(blockDom instanceof HTMLElement)) {
        hideHandle()
        return
      }
      const blockRect = blockDom.getBoundingClientRect()
      const containerRect = container.getBoundingClientRect()
      handleEl.style.top = `${blockRect.top - containerRect.top + 2}px`
      handleEl.style.left = `${blockRect.left - containerRect.left - 30}px`
      cancelHide()
      handleEl.classList.add('is-visible')
    }

    const setDropIndex = (view: EditorView, dropIndex: number | null) => {
      view.dispatch(view.state.tr.setMeta(pluginKey, { dropIndex }))
    }

    const moveBlock = (view: EditorView, fromIndex: number, dropIndex: number) => {
      const block = topLevelBlocks(view.state.doc)[fromIndex]
      if (!block) return
      if (dropIndex === fromIndex || dropIndex === fromIndex + 1) return
      const moved = view.state.doc.child(fromIndex)
      const { tr } = view.state
      const nodeStart = block.pos - 1 // TopBlock.pos 为内容起点，节点跨度是 [pos-1, pos-1+size)
      tr.delete(nodeStart, nodeStart + block.size)
      const toIndex = dropIndex > fromIndex ? dropIndex - 1 : dropIndex
      tr.insert(insertPosAtIndex(tr.doc, toIndex), moved)
      view.dispatch(tr)
    }

    const startDrag = (view: EditorView) => {
      if (hoverIndex == null) return
      dragIndex = hoverIndex
      setDropIndex(view, null)
      view.dom.classList.add('linkbase-is-dragging')
    }

    return [
      new Plugin<DragHandleState>({
        key: pluginKey,
        state: {
          init: () => ({ dropIndex: null }),
          apply(tr, value) {
            if (tr.getMeta(pluginKey)) return tr.getMeta(pluginKey) as DragHandleState
            if (tr.docChanged) return { dropIndex: null }
            return value
          },
        },
        props: {
          decorations(state) {
            const s = pluginKey.getState(state)
            if (!s || s.dropIndex == null) return DecorationSet.empty
            const pos = insertPosAtIndex(state.doc, s.dropIndex)
            // 文档流内零高块：恰好渲染在插入边界，无绝对定位锚点问题
            const el = document.createElement('div')
            el.className = 'linkbase-drop-indicator'
            return DecorationSet.create(state.doc, [Decoration.widget(pos, el, { side: 1, ignoreSelection: true })])
          },
          handleDOMEvents: {
            mousemove: (view, event) => {
              if (dragIndex != null) {
                event.preventDefault()
                const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
                if (coords) {
                  const blocks = topLevelBlocks(view.state.doc)
                  let index = blockIndexAt(blocks, coords.pos)
                  if (index != null) {
                    const rect = view.coordsAtPos(Math.min(coords.pos, view.state.doc.content.size - 1))
                    if (rect && event.clientY > (rect.top + rect.bottom) / 2) index += 1
                    const current = pluginKey.getState(view.state)
                    if (current && index !== current.dropIndex) setDropIndex(view, index)
                  }
                }
                return true
              }
              // 悬停：计算所在顶层块并定位把手
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!coords) {
                hoverIndex = null
                hideHandle()
                return false
              }
              const blocks = topLevelBlocks(view.state.doc)
              const index = blockIndexAt(blocks, coords.pos)
              hoverIndex = index
              placeHandle(view, index)
              return false
            },
            mouseleave: () => {
              // 只延迟隐藏，不清 hoverIndex：按下把手要靠它确定拖拽起点
              if (dragIndex == null) scheduleHide()
              return false
            },
          },
        },
        view(editorView) {
          const onMouseDown = (event: MouseEvent) => {
            if (dragIndex != null || hoverIndex == null) return
            event.preventDefault()
            event.stopPropagation()
            activeView = editorView
            startDrag(editorView)
          }

          // 把手元素在 view 建立时创建并绑定事件（mousemove 时才建会错过 mousedown 绑定）
          const container = editorView.dom.parentElement
          if (container instanceof HTMLElement) {
            if (getComputedStyle(container).position === 'static') {
              container.style.position = 'relative'
            }
            handleEl = createHandleElement(editorView.dom.ownerDocument)
            // 指针抵达把手即取消隐藏计时（离开编辑器后有 250ms 抵达窗口）
            handleEl.addEventListener('mouseenter', cancelHide)
            container.appendChild(handleEl)
            handleEl.addEventListener('mousedown', onMouseDown)
          }

          const onMouseUp = (event: MouseEvent) => {
            const view = activeView
            if (!view) return
            const s = pluginKey.getState(view.state)
            view.dom.classList.remove('linkbase-is-dragging')
            if (dragIndex != null && s && s.dropIndex != null) {
              moveBlock(view, dragIndex, s.dropIndex)
              event.preventDefault()
            }
            dragIndex = null
            hoverIndex = null
            setDropIndex(view, null)
            hideHandle()
            activeView = null
          }
          // 文档滚动时把手跟随（块坐标变化）
          const onScroll = () => {
            if (dragIndex == null && hoverIndex != null) placeHandle(editorView, hoverIndex)
          }
          window.addEventListener('scroll', onScroll, true)
          window.addEventListener('resize', onScroll)
          document.addEventListener('mouseup', onMouseUp)
          return {
            destroy() {
              document.removeEventListener('mouseup', onMouseUp)
              window.removeEventListener('scroll', onScroll, true)
              window.removeEventListener('resize', onScroll)
              handleEl?.removeEventListener('mouseenter', cancelHide)
              handleEl?.removeEventListener('mousedown', onMouseDown)
              handleEl?.remove()
              handleEl = null
              cancelHide()
            },
          }
        },
      }),
    ]
  },
})
