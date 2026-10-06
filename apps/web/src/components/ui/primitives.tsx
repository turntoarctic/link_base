import type { ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** 头像：图片优先，缺省显示首字母色块 */
export function Avatar({
  src,
  fallback,
  className,
}: {
  src?: string | null
  fallback: string
  className?: string
}) {
  const initial = fallback.slice(0, 1).toUpperCase()
  return (
    <span
      className={cn(
        'relative inline-flex size-7 shrink-0 select-none items-center justify-center overflow-hidden rounded-full bg-(--primary) text-[11px] font-medium text-white',
        className,
      )}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        <span aria-hidden>{initial}</span>
      )}
    </span>
  )
}

/** 骨架占位（06 §5.5：禁止整页 spinner，用灰块） */
export function Skeleton({ className }: { className?: string }) {
  return <div className={cn('animate-pulse rounded-md bg-(--muted)', className)} />
}

export function Separator({
  className,
  vertical,
}: {
  className?: string
  vertical?: boolean
}) {
  return (
    <div
      role="separator"
      className={cn('bg-(--border)', vertical ? 'w-px self-stretch' : 'h-px w-full', className)}
    />
  )
}

/** 键位提示 */
export function Kbd({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <kbd
      className={cn(
        'inline-flex h-5 min-w-5 items-center justify-center rounded border border-(--border) bg-(--secondary) px-1 font-sans text-[11px] font-medium text-(--muted-foreground)',
        className,
      )}
    >
      {children}
    </kbd>
  )
}

/** 空状态（图标 + 文案，Notion 式留白） */
export function EmptyState({
  icon,
  title,
  description,
  className,
}: {
  icon?: ReactNode
  title: string
  description?: string
  className?: string
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center gap-2 py-16 text-center', className)}>
      {icon && (
        <div className="mb-1 flex size-11 items-center justify-center rounded-full bg-(--muted) text-(--muted-foreground)">
          {icon}
        </div>
      )}
      <div className="text-[14px] font-medium">{title}</div>
      {description && <div className="max-w-[320px] text-[13px] text-(--muted-foreground)">{description}</div>}
    </div>
  )
}
