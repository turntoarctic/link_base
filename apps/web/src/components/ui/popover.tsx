/** shadcn/ui Popover（Base UI Popover 封装）：标签选择器等轻浮层 */
import type { ReactNode } from 'react'
import { Popover as BasePopover } from '@base-ui-components/react/popover'
import { cn } from '@/lib/cn'

export const Popover = BasePopover.Root
export const PopoverTrigger = BasePopover.Trigger
export const PopoverClose = BasePopover.Close

export function PopoverContent({
  children,
  className,
  align = 'start',
  sideOffset = 6,
}: {
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  sideOffset?: number
}) {
  return (
    <BasePopover.Portal>
      <BasePopover.Positioner align={align} sideOffset={sideOffset} className="z-[180] outline-none">
        <BasePopover.Popup className={cn('ui-popup ui-menu p-1', className)}>{children}</BasePopover.Popup>
      </BasePopover.Positioner>
    </BasePopover.Portal>
  )
}
