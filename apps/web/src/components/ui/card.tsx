import type { HTMLAttributes, ReactNode } from 'react'
import { cn } from '@/lib/cn'

/** shadcn/ui Card */
export function Card({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card"
      className={cn('bg-card text-card-foreground flex flex-col rounded-xl border shadow-sm', className)}
      {...props}
    />
  )
}

export function CardHeader({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-header" className={cn('flex flex-col gap-1.5 p-5', className)} {...props} />
}

export function CardTitle({ children, className }: { children: ReactNode; className?: string }) {
  return (
    <div data-slot="card-title" className={cn('text-[15px] leading-none font-semibold tracking-tight', className)}>
      {children}
    </div>
  )
}

export function CardDescription({ children, className }: { children: ReactNode; className?: string }) {
  return <div data-slot="card-description" className={cn('text-muted-foreground text-[13px]', className)}>{children}</div>
}

export function CardContent({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-content" className={cn('p-5 pt-0', className)} {...props} />
}

export function CardFooter({ className, ...props }: HTMLAttributes<HTMLDivElement>) {
  return <div data-slot="card-footer" className={cn('flex items-center p-5 pt-0', className)} {...props} />
}
