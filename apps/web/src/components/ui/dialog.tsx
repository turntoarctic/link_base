/**
 * shadcn/ui Dialog（Base UI Dialog 封装）。
 * Base UI 语法（06 §1.1-5）：触发器用 render={<Button/>}；动画走 data-starting-style/data-ending-style（index.css）。
 */
import type { ReactNode } from 'react'
import { Dialog as BaseDialog } from '@base-ui-components/react/dialog'
import { X } from 'lucide-react'
import { cn } from '@/lib/cn'

export const Dialog = BaseDialog.Root
export const DialogTrigger = BaseDialog.Trigger
export const DialogClose = BaseDialog.Close

export function DialogContent({
  children,
  className,
  showClose = true,
}: {
  children: ReactNode
  className?: string
  showClose?: boolean
}) {
  return (
    <BaseDialog.Portal>
      <BaseDialog.Backdrop className="ui-backdrop" />
      <BaseDialog.Popup className={cn('ui-popup ui-dialog', className)}>
        {children}
        {showClose && (
          <BaseDialog.Close
            aria-label="close"
            className="absolute top-3.5 right-3.5 rounded-md p-1 text-(--muted-foreground) transition-colors hover:bg-(--muted) hover:text-(--foreground)"
          >
            <X size={16} />
          </BaseDialog.Close>
        )}
      </BaseDialog.Popup>
    </BaseDialog.Portal>
  )
}

export function DialogHeader({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mb-4 flex flex-col gap-1', className)}>{children}</div>
}

export function DialogFooter({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('mt-5 flex justify-end gap-2', className)}>{children}</div>
}

export function DialogTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <BaseDialog.Title className={cn('text-[15px] leading-none font-semibold', className)}>{children}</BaseDialog.Title>
}

export function DialogDescription({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <BaseDialog.Description className={cn('text-[13px] leading-relaxed text-(--muted-foreground)', className)}>
      {children}
    </BaseDialog.Description>
  )
}
