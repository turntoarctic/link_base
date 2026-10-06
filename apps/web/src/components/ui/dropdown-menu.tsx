/**
 * shadcn/ui DropdownMenu（Base UI Menu 封装）。
 * 触发器：<DropdownMenuTrigger render={<Button variant="ghost" size="icon"/>} />;
 * 内容：<DropdownMenuContent align="end"> <DropdownMenuItem>…</DropdownMenuItem> </DropdownMenuContent>
 */
import type { ReactNode } from 'react'
import { Menu } from '@base-ui-components/react/menu'
import { cn } from '@/lib/cn'

export const DropdownMenu = Menu.Root
export const DropdownMenuTrigger = Menu.Trigger

export function DropdownMenuContent({
  children,
  className,
  align = 'start',
  side,
  sideOffset = 6,
}: {
  children: ReactNode
  className?: string
  align?: 'start' | 'center' | 'end'
  side?: 'top' | 'right' | 'bottom' | 'left'
  sideOffset?: number
}) {
  return (
    <Menu.Portal>
      <Menu.Positioner align={align} side={side} sideOffset={sideOffset} className="z-[180] outline-none">
        <Menu.Popup className={cn('ui-popup ui-menu min-w-[184px] p-1', className)}>{children}</Menu.Popup>
      </Menu.Positioner>
    </Menu.Portal>
  )
}

export function DropdownMenuItem({
  children,
  className,
  onSelect,
  danger,
  disabled,
}: {
  children: ReactNode
  className?: string
  onSelect?: () => void
  danger?: boolean
  disabled?: boolean
}) {
  return (
    <Menu.Item
      onClick={onSelect}
      disabled={disabled}
      className={cn(
        'flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-[13px] text-(--popover-foreground) outline-none transition-colors data-[highlighted]:bg-(--muted) data-[disabled]:pointer-events-none data-[disabled]:opacity-40 [&_svg]:size-3.5 [&_svg]:shrink-0 [&_svg]:text-(--muted-foreground)',
        danger && 'text-(--destructive) [&_svg]:text-(--destructive)',
        className,
      )}
    >
      {children}
    </Menu.Item>
  )
}

export function DropdownMenuLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div className={cn('px-2 py-1.5 text-[11px] font-medium text-(--text-tertiary)', className)}>
      {children}
    </div>
  )
}

export function DropdownMenuSeparator({ className }: { className?: string }) {
  return <Menu.Separator className={cn('-mx-1 my-1 h-px bg-(--border)', className)} />
}
