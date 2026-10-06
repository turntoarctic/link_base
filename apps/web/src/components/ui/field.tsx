/** shadcn/ui Field（Base UI Field 封装）：表单标签/描述/错误与控件自动关联 */
import type { ReactNode } from 'react'
import { Field as BaseField } from '@base-ui-components/react/field'
import { cn } from '@/lib/cn'

export const Field = BaseField.Root

export function FieldLabel({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseField.Label
      className={cn('block text-[13px] font-medium text-(--foreground)', className)}
    >
      {children}
    </BaseField.Label>
  )
}

export function FieldDescription({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <BaseField.Description className={cn('mt-1 text-[12px] text-(--muted-foreground)', className)}>
      {children}
    </BaseField.Description>
  )
}

export function FieldError({ className }: { className?: string }) {
  return (
    <BaseField.Error className={cn('mt-1 text-[12px] text-(--destructive)', className)} />
  )
}
