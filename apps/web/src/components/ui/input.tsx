import { forwardRef, type InputHTMLAttributes, type SelectHTMLAttributes } from 'react'
import { cn } from '@/lib/cn'

/** shadcn/ui 风格 Input */
export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, type = 'text', ...props }, ref) {
    return (
      <input
        ref={ref}
        type={type}
        className={cn(
          'flex h-8 w-full min-w-0 rounded-md border border-(--input) bg-(--background) px-2.5 text-[13.5px] text-(--foreground) shadow-xs transition-[color,border-color,box-shadow] outline-none',
          'placeholder:text-(--text-tertiary)',
          'focus-visible:border-(--ring) focus-visible:ring-2 focus-visible:ring-(--ring)/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'aria-invalid:border-(--destructive) aria-invalid:ring-(--destructive)/25',
          className,
        )}
        {...props}
      />
    )
  },
)

/**
 * 下拉选择（MVP 用原生 select 保证可靠性与键盘可达性，样式对齐 shadcn Select；
 * 需要 TreeItem/分组时再换 Base UI Select）
 */
export const Select = forwardRef<HTMLSelectElement, SelectHTMLAttributes<HTMLSelectElement>>(
  function Select({ className, ...props }, ref) {
    return (
      <select
        ref={ref}
        className={cn(
          'h-8 cursor-pointer appearance-none rounded-md border border-(--input) bg-(--background) px-2.5 pr-7 text-[13px] text-(--foreground) shadow-xs transition-[border-color,box-shadow] outline-none',
          'focus-visible:border-(--ring) focus-visible:ring-2 focus-visible:ring-(--ring)/25',
          'disabled:cursor-not-allowed disabled:opacity-50',
          "bg-[url('data:image/svg+xml;charset=utf-8,%3Csvg%20xmlns%3D%22http%3A%2F%2Fwww.w3.org%2F2000%2Fsvg%22%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2024%2024%22%20fill%3D%22none%22%20stroke%3D%22%23787774%22%20stroke-width%3D%222.5%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22%3E%3Cpath%20d%3D%22m6%209%206%206%206-6%22%2F%3E%3C%2Fsvg%3E')] bg-[position:right_0.5rem_center] bg-no-repeat",
          className,
        )}
        {...props}
      />
    )
  },
)
