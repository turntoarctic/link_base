/**
 * 块操作把手（Notion 化 T2）：左侧 gutter 悬停显示 +（下方插块）与 ⠿（拖拽重排/点击弹块菜单）。
 * 浮层是宿主容器内绝对定位元素，坐标由 JS 按 hover 块的 getBoundingClientRect 计算
 * （widget decoration 的静态位置随块内容浮动，锚点不可控——已废弃该方案）。
 * 拖动中落点用文档流内的零高指示线（widget，无绝对定位）。
 * 点击 vs 拖拽：按下记录起点，位移 ≤4px 视为点击 → 弹块菜单（block-menu）。
 */
import { Extension } from '@tiptap/core'
import { Plugin, PluginKey, TextSelection } from '@tiptap/pm/state'
import type { EditorView } from '@tiptap/pm/view'
import { Decoration, DecorationSet } from '@tiptap/pm/view'
import { blockIndexAt, insertPosAtIndex, moveTopLevelBlockTr, topLevelBlocks } from './block-utils.ts'
import { openBlockMenu } from '../components/block-menu.tsx'
import type { PopoverHandle } from '../components/popover.ts'

interface DragHandleState {
  dropIndex: number | null // 顶层插入位置（child index）
}

const pluginKey = new PluginKey<DragHandleState>('linkbaseDragHandle')

/** 点击 vs 拖拽的位移阈值（px） */
const CLICK_THRESHOLD = 4

/** gutter 浮层：+（下方插块）在上、⠿ 拖拽把手在下 */
function createGutterElement(doc: Document): { gutter: HTMLElement; grip: HTMLElement; add: HTMLElement } {
  const gutter = doc.createElement('div')
  gutter.className = 'linkbase-block-gutter'
  gutter.setAttribute('contenteditable', 'false')

  const add = doc.createElement('button')
  add.type = 'button'
  add.className = 'linkbase-block-add'
  add.title = ''
  add.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>'

  const grip = doc.createElement('div')
  grip.className = 'linkbase-drag-handle'
  grip.setAttribute('draggable', 'false')
  for (let i = 0; i < 3; i++) {
    const dot = doc.createElement('span')
    dot.className = 'linkbase-drag-handle-dot'
    grip.appendChild(dot)
  }

  gutter.appendChild(add)
  gutter.appendChild(grip)
  return { gutter, grip, add }
}

/** 在第 index 块下方插入空段落并聚焦（+ 按钮） */
function addBlockBelow(view: EditorView, index: number): void {
  const pos = insertPosAtIndex(view.state.doc, index + 1)
  const { tr } = view.state
  tr.insert(pos, view.state.schema.nodes.paragraph.create())
  tr.setSelection(TextSelection.near(tr.doc.resolve(pos + 1)))
  view.dispatch(tr)
  view.focus()
}

export const DragHandle = Extension.create({
  name: 'dragHandle',

  addProseMirrorPlugins() {
    const editor = this.editor
    let gutterEl: HTMLElement | null = null
    let gripEl: HTMLElement | null = null
    let addEl: HTMLElement | null = null
    let hoverIndex: number | null = null
    let dragIndex: number | null = null
    let dragMoved = false // 按下后是否超过点击阈值（区分点击弹菜单与真拖拽）
    let downX = 0
    let downY = 0
    let activeView: EditorView | null = null
    let hideTimer: ReturnType<typeof setTimeout> | null = null
    let menuHandle: PopoverHandle | null = null

    const cancelHide = () => {
      if (hideTimer != null) {
        clearTimeout(hideTimer)
        hideTimer = null
      }
    }

    const hideHandle = () => {
      cancelHide()
      hoverIndex = null
      gutterEl?.classList.remove('is-visible')
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

    /** gutter 定位到第 index 个顶层块首行左 gutter（相对宿主容器；元素由 plugin view 预建） */
    const placeGutter = (view: EditorView, index: number | null) => {
      const container = view.dom.parentElement
      if (!container || !gutterEl) return
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
      gutterEl.style.top = `${blockRect.top - containerRect.top - 2}px`
      gutterEl.style.left = `${blockRect.left - containerRect.left - 52}px`
      cancelHide()
      gutterEl.classList.add('is-visible')
    }

    const setDropIndex = (view: EditorView, dropIndex: number | null) => {
      view.dispatch(view.state.tr.setMeta(pluginKey, { dropIndex }))
    }

    const moveBlock = (view: EditorView, fromIndex: number, dropIndex: number) => {
      const tr = moveTopLevelBlockTr(view.state, fromIndex, dropIndex)
      if (tr) view.dispatch(tr)
    }

    const startDrag = (view: EditorView) => {
      if (hoverIndex == null) return
      dragIndex = hoverIndex
      dragMoved = false
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
                // 位移超阈值才算真拖拽，否则 mouseup 走块菜单
                if (Math.abs(event.clientX - downX) > CLICK_THRESHOLD || Math.abs(event.clientY - downY) > CLICK_THRESHOLD) {
                  dragMoved = true
                }
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
              // 悬停：计算所在顶层块并定位 gutter
              const coords = view.posAtCoords({ left: event.clientX, top: event.clientY })
              if (!coords) {
                hoverIndex = null
                hideHandle()
                return false
              }
              const blocks = topLevelBlocks(view.state.doc)
              const index = blockIndexAt(blocks, coords.pos)
              hoverIndex = index
              placeGutter(view, index)
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
          const openMenu = (view: EditorView) => {
            if (hoverIndex == null || !gripEl) return
            menuHandle?.close()
            menuHandle = openBlockMenu(editor, gripEl, hoverIndex)
          }

          const onGripMouseDown = (event: MouseEvent) => {
            if (dragIndex != null || hoverIndex == null) return
            // 菜单开着再点把手 = 收起
            if (menuHandle) {
              menuHandle.close()
              menuHandle = null
              return
            }
            event.preventDefault()
            event.stopPropagation()
            downX = event.clientX
            downY = event.clientY
            activeView = editorView
            startDrag(editorView)
          }

          const onAddMouseDown = (event: MouseEvent) => {
            if (hoverIndex == null) return
            event.preventDefault()
            event.stopPropagation()
            addBlockBelow(editorView, hoverIndex)
          }

          // gutter 元素在 view 建立时创建并绑定事件（mousemove 时才建会错过 mousedown 绑定）
          const container = editorView.dom.parentElement
          if (container instanceof HTMLElement) {
            if (getComputedStyle(container).position === 'static') {
              container.style.position = 'relative'
            }
            const { gutter, grip, add } = createGutterElement(editorView.dom.ownerDocument)
            gutterEl = gutter
            gripEl = grip
            addEl = add
            // 指针抵达把手即取消隐藏计时（离开编辑器后有 250ms 抵达窗口）
            gutter.addEventListener('mouseenter', cancelHide)
            container.appendChild(gutter)
            grip.addEventListener('mousedown', onGripMouseDown)
            add.addEventListener('mousedown', onAddMouseDown)
          }

          const onMouseUp = (event: MouseEvent) => {
            const view = activeView
            if (!view) return
            const s = pluginKey.getState(view.state)
            view.dom.classList.remove('linkbase-is-dragging')
            if (dragIndex != null) {
              if (!dragMoved) {
                // 原地松手 = 点击 → 弹块菜单（选区已由菜单内部对齐目标块）
                event.preventDefault()
                openMenu(view)
              } else if (s && s.dropIndex != null) {
                moveBlock(view, dragIndex, s.dropIndex)
                event.preventDefault()
              }
            }
            dragIndex = null
            dragMoved = false
            hoverIndex = null
            setDropIndex(view, null)
            hideHandle()
            activeView = null
          }
          // 文档滚动时把手跟随（块坐标变化）
          const onScroll = () => {
            if (dragIndex == null && hoverIndex != null) placeGutter(editorView, hoverIndex)
          }
          window.addEventListener('scroll', onScroll, true)
          window.addEventListener('resize', onScroll)
          document.addEventListener('mouseup', onMouseUp)
          return {
            destroy() {
              document.removeEventListener('mouseup', onMouseUp)
              window.removeEventListener('scroll', onScroll, true)
              window.removeEventListener('resize', onScroll)
              gutterEl?.removeEventListener('mouseenter', cancelHide)
              gripEl?.removeEventListener('mousedown', onGripMouseDown)
              addEl?.removeEventListener('mousedown', onAddMouseDown)
              gutterEl?.remove()
              gutterEl = null
              gripEl = null
              addEl = null
              cancelHide()
            },
          }
        },
      }),
    ]
  },
})
