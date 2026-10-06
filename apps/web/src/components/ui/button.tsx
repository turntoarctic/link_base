import { forwardRef, type ButtonHTMLAttributes } from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/cn'

/** shadcn/ui Button（Base UI preset 兼容：可直接作为 render={<Button/>} 的目标） */
export const buttonVariants = cva(
  "inline-flex shrink-0 items-center justify-center gap-1.5 whitespace-nowrap rounded-md text-[13px] font-medium transition-[color,background-color,border-color,box-shadow,opacity] duration-150 outline-none focus-visible:ring-2 focus-visible:ring-(--ring)/40 disabled:pointer-events-none disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0",
  {
    variants: {
      variant: {
        default: 'bg-(--primary) text-(--primary-foreground) shadow-xs hover:bg-(--primary)/90',
        secondary: 'bg-(--secondary) text-(--secondary-foreground) hover:bg-(--accent)',
        outline: 'border border-(--input) bg-(--background) shadow-xs hover:bg-(--muted)',
        ghost: 'hover:bg-(--muted) hover:text-(--foreground)',
        destructive: 'bg-(--destructive) text-white shadow-xs hover:bg-(--destructive)/90',
        link: 'text-(--primary) underline-offset-4 hover:underline',
      },
      size: {
        default: 'h-8 px-3',
        sm: 'h-7 px-2.5 text-[12.5px]',
        lg: 'h-9 px-4 text-sm',
        icon: 'size-7 p-0',
        'icon-sm': 'size-6 p-0',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, ...props },
  ref,
) {
  return <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
})
