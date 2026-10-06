/**
 * @tiptap/suggestion 的 React 弹层渲染器（05 §6）：
 * mount 到 body 的固定定位弹层，位置跟随 clientRect（贴底优先，越界翻转），
 * 键盘导航由弹层组件经 registerKeyDown 反注册回 suggestion。
 */
import type { ReactNode } from 'react'
import { createRoot, type Root } from 'react-dom/client'
import type { SuggestionKeyDownProps, SuggestionProps } from '@tiptap/suggestion'

export interface SuggestionPopupProps<P> {
  props: SuggestionProps<P>
  registerKeyDown: (fn: (event: KeyboardEvent) => boolean) => void
}

const POPUP_CLASS = 'linkbase-suggestion-popup'

export function createSuggestionRenderer<P>(
  Component: (props: SuggestionPopupProps<P>) => ReactNode,
) {
  let root: Root | null = null
  let popup: HTMLDivElement | null = null
  const keyDownRef: { current: (event: KeyboardEvent) => boolean } = { current: () => false }

  const position = (props: SuggestionProps<P>) => {
    if (!popup) return
    const rect = props.clientRect?.()
    if (!rect) return
    const viewportHeight = window.innerHeight
    const popupHeight = popup.offsetHeight || 320
    const below = rect.bottom + 8
    const fitsBelow = below + Math.min(popupHeight, 320) < viewportHeight
    popup.style.left = `${Math.min(rect.left, window.innerWidth - popup.offsetWidth - 12)}px`
    popup.style.top = `${fitsBelow ? below : Math.max(8, rect.top - 8)}px`
    popup.style.transform = fitsBelow ? 'translateY(0)' : 'translateY(-100%)'
  }

  return {
    onStart(props: SuggestionProps<P>) {
      popup = document.createElement('div')
      popup.className = POPUP_CLASS
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
      position(props)
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
      position(props)
    },
    onExit() {
      root?.unmount()
      popup?.remove()
      root = null
      popup = null
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
