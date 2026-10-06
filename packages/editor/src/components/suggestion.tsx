/**
 * @tiptap/suggestion 的 React 弹层渲染器（05 §6）：
 * mount 到 body 的固定定位弹层；位置用 @floating-ui/dom（offset/flip/shift，
 * 与 shadcn/Radix 浮层同源），锚点 = suggestion clientRect 的虚拟元素；
 * 键盘导航由弹层组件经 registerKeyDown 反注册回 suggestion。
 */
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import { computePosition, flip, offset, shift } from '@floating-ui/dom'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

export interface SuggestionPopupProps<P> {
  props: SuggestionProps<P>
  registerKeyDown: (fn: (event: KeyboardEvent) => boolean) => void
}

const POPUP_CLASS = 'linkbase-suggestion-popup'

/** 虚拟锚元素 + floating-ui 定位（贴底优先，越界 flip，视口边缘 shift） */
export function positionSuggestionPopup(
  popup: HTMLElement,
  clientRect: DOMRect | null,
): void {
  if (!clientRect) return
  const virtual = {
    getBoundingClientRect: () => clientRect,
    get contextElement() {
      return popup
    },
  }
  void computePosition(virtual, popup, {
    strategy: 'fixed',
    placement: 'bottom-start',
    middleware: [offset(8), flip(), shift({ padding: 12 })],
  }).then(({ x, y }) => {
    popup.style.left = `${x}px`
    popup.style.top = `${y}px`
  })
}

export function createSuggestionRenderer<P>(
  Component: (props: SuggestionPopupProps<P>) => ReactNode,
) {
  let root: Root | null = null
  let popup: HTMLDivElement | null = null
  let lastRect: DOMRect | null = null
  const keyDownRef: { current: (event: KeyboardEvent) => boolean } = { current: () => false }

  const reposition = () => {
    if (popup) positionSuggestionPopup(popup, lastRect)
  }

  return {
    onStart(props: SuggestionProps<P>) {
      popup = document.createElement('div')
      popup.className = POPUP_CLASS
      popup.style.position = 'fixed'
      popup.style.visibility = 'hidden'
      document.body.appendChild(popup)
      root = createRoot(popup)
      root.render(
        <Component
          props={props}
          registerKeyDown={(fn) => {
            keyDownRef.current = fn
          }}
        />,
      )
      lastRect = props.clientRect?.() ?? null
      reposition()
      popup.style.visibility = ''
      // 编辑器在滚动容器内：滚动/缩放时跟随锚点（弹层关闭即摘除）
      window.addEventListener('scroll', reposition, true)
      window.addEventListener('resize', reposition)
    },
    onUpdate(props: SuggestionProps<P>) {
      root?.render(
        <Component
          props={props}
          registerKeyDown={(fn) => {
            keyDownRef.current = fn
          }}
        />,
      )
      lastRect = props.clientRect?.() ?? null
      reposition()
    },
    onExit() {
      window.removeEventListener('scroll', reposition, true)
      window.removeEventListener('resize', reposition)
      root?.unmount()
      popup?.remove()
      root = null
      popup = null
      lastRect = null
      keyDownRef.current = () => false
    },
    onKeyDown({ event }: SuggestionKeyDownProps) {
      if (event.key === 'Escape') {
        keyDownRef.current(event)
        return true
      }
      return keyDownRef.current(event)
    },
  }
}

/** 键盘导航：↑↓ 移动 active、Enter 确认；在弹层组件渲染期调用一次完成注册 */
export function registerListKeyboardNav(
  register: (fn: (event: KeyboardEvent) => boolean) => void,
  options: {
    count: () => number
    getActive: () => number
    setActive: (index: number) => void
    onPick: (index: number) => void
  },
): void {
  register((event) => {
    const count = Math.max(options.count(), 1)
    if (event.key === 'ArrowDown') {
      options.setActive((options.getActive() + 1) % count)
      event.preventDefault()
      return true
    }
    if (event.key === 'ArrowUp') {
      options.setActive((options.getActive() - 1 + count) % count)
      event.preventDefault()
      return true
    }
    if (event.key === 'Enter') {
      options.onPick(options.getActive())
      event.preventDefault()
      return true
    }
    return false
  })
}
