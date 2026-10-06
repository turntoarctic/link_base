/** shadcn/ui Tooltip（Base UI Tooltip 封装）：侧边栏折叠按钮等悬停提示 */
import type { ReactNode } from 'react'
import { Tooltip as BaseTooltip } from '@base-ui-components/react/tooltip'
import { cn } from '@/lib/cn'

export function TooltipProvider({ children }: { children: ReactNode }) {
  return <BaseTooltip.Provider>{children}</BaseTooltip.Provider>
}

export const Tooltip = BaseTooltip.Root
export const TooltipTrigger = BaseTooltip.Trigger

export function TooltipContent({
  children,
  className,
  sideOffset = 6,
}: {
  children: ReactNode
  className?: string
  sideOffset?: number
}) {
  return (
    <BaseTooltip.Portal>
      <BaseTooltip.Positioner sideOffset={sideOffset} className="z-[200] outline-none">
        <BaseTooltip.Popup
          className={cn(
            'ui-tooltip rounded-md bg-(--foreground) px-2 py-1 text-[12px] text-(--background) shadow-(--shadow-pop)',
            className,
          )}
        >
          {children}
        </BaseTooltip.Popup>
      </BaseTooltip.Positioner>
    </BaseTooltip.Portal>
  )
}
