import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** shadcn/ui Card */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'rounded-lg border border-(--border) bg-(--card) text-(--card-foreground) shadow-xs',
        className,
      )}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[15px] leading-none font-semibold tracking-tight', className)}>{children}</div>
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('text-[13px] text-(--muted-foreground)', className)}>{children}</div>
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div className={cn('flex items-center p-5 pt-0', className)} {...props} />
}
