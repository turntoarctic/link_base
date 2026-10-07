/**
 * 通用轻量弹层（Notion 化 T2）：块菜单 / 转为 / 颜色面板共用。
 * createRoot 到 body 上的 linkbase-suggestion-popup 容器（复用弹层 chrome 样式），
 * floating-ui 定位（同 suggestion 弹层参数），document 级键盘捕获 + 外点关闭 + 滚动跟随。
 * 与 tiptap suggestion 无耦合；调用方通过返回的 close 主动关闭。
 */
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'

export interface PopoverHandle {
  close: () => void
  reposition: () => void
}

export interface OpenPopoverOptions {
  /** 锚元素或矩形（把手/工具条按钮传 getBoundingClientRect 即可） */
  anchor: { getBoundingClientRect: () => DOMRect }
  render: (handle: PopoverHandle) => ReactNode
  /** document 级 keydown；返回 true 表示已消费（阻止默认与冒泡由调用方在事件上做） */
  onKeyDown?: (event: KeyboardEvent, handle: PopoverHandle) => boolean
  placement?: 'bottom-start' | 'bottom-end' | 'right-start'
  /** 关闭回调（如把手的菜单态复位） */
  onClose?: () => void
}

/** 同名弹层互斥：块菜单开着时再点把手先关旧的 */
let activePopovers: PopoverHandle[] = []

export function openPopover(options: OpenPopoverOptions): PopoverHandle {
  // 同锚点旧弹层先关（避免叠加）
  const popup = document.createElement('div')
  popup.className = 'linkbase-suggestion-popup'
  popup.style.position = 'fixed'
  popup.style.visibility = 'hidden'
  document.body.appendChild(popup)
  const root: Root = createRoot(popup)

  let closed = false
  const placement = options.placement ?? 'bottom-start'
  const reposition = () => {
    void computePosition(options.anchor, popup, {
      strategy: 'fixed',
      placement,
      middleware: [offset(6), flip(), shift({ padding: 12 })],
    }).then(({ x, y }) => {
      popup.style.left = x + 'px'
      popup.style.top = y + 'px'
    })
  }
  const handle: PopoverHandle = {
    close: () => {
      if (closed) return
      closed = true
      activePopovers = activePopovers.filter((h) => h !== handle)
      document.removeEventListener('keydown', onKey, true)
      document.removeEventListener('mousedown', onOutsideMousedown, true)
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      root.unmount()
      popup.remove()
      options.onClose?.()
    },
    reposition,
  }

  const onKey = (event: KeyboardEvent) => {
    if (closed) return
    const consumed = options.onKeyDown?.(event, handle) ?? false
    if (consumed) event.preventDefault()
  }

  const onOutsideMousedown = (event: MouseEvent) => {
    if (closed) return
    if (event.target instanceof Node && !popup.contains(event.target)) handle.close()
  }

  activePopovers.push(handle)
  // 已有弹层全部关闭（编辑器内同时只开一个编辑器弹层）
  for (const h of [...activePopovers]) if (h !== handle) h.close()

  root.render(options.render(handle))
  reposition()
  popup.style.visibility = ''
  document.addEventListener('keydown', onKey, true)
  document.addEventListener('mousedown', onOutsideMousedown, true)
  window.addEventListener('scroll', reposition, true)
  window.addEventListener('resize', reposition)
  return handle
}

/** 关闭当前所有编辑器弹层（把手重渲染等场景兜底） */
export function closeAllPopovers(): void {
  for (const h of [...activePopovers]) h.close()
}
