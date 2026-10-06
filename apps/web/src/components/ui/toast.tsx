/**
 * Toast（06 §1.1-5 的调用面：toast.add({ title, type }) + 挂 <Toaster/>）。
 * MVP 自有实现（模块级 store + useSyncExternalStore），样式对齐 shadcn/sonner；
 * 后续如引 Base UI Toast，仅需替换本文件内部实现，调用方不动。
 */
import { useSyncExternalStore } from 'react'
import { CheckCircle2, Info, X, XCircle } from 'lucide-react'
import { cn } from '@/lib/cn'

export type ToastType = 'default' | 'success' | 'error'

export interface ToastItem {
  id: number
  title: string
  description?: string
  type?: ToastType
}

let toasts: ToastItem[] = []
let nextId = 1
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function dismiss(id: number) {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

export const toast = {
  add(item: Omit<ToastItem, 'id'>): number {
    const id = nextId++
    toasts = [...toasts, { ...item, id }]
    emit()
    const ttl = item.type === 'error' ? 6000 : 3600
    setTimeout(() => dismiss(id), ttl)
    return id
  },
  dismiss,
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

const ICONS = {
  default: <Info size={15} className="text-(--muted-foreground)" />,
  success: <CheckCircle2 size={15} className="text-(--success)" />,
  error: <XCircle size={15} className="text-(--destructive)" />,
} as const

export function Toaster() {
  const items = useSyncExternalStore(
    subscribe,
    () => toasts,
    () => toasts,
  )

  return (
    <div
      aria-live="polite"
      className="pointer-events-none fixed bottom-4 left-1/2 z-[400] flex w-[360px] max-w-[calc(100vw-32px)] -translate-x-1/2 flex-col gap-2"
    >
      {items.map((item) => (
        <div
          key={item.id}
          className={cn(
            'ui-toast pointer-events-auto flex items-start gap-2.5 rounded-lg border border-(--border) bg-(--popover) p-3 text-(--popover-foreground) shadow-(--shadow-pop)',
          )}
        >
          <span className="mt-0.5">{ICONS[item.type ?? 'default']}</span>
          <div className="min-w-0 flex-1">
            <div className="text-[13px] leading-snug">{item.title}</div>
            {item.description && (
              <div className="mt-0.5 text-[12px] leading-snug text-(--muted-foreground)">{item.description}</div>
            )}
          </div>
          <button
            type="button"
            aria-label="close"
            className="rounded p-0.5 text-(--muted-foreground) transition-colors hover:bg-(--muted)"
            onClick={() => dismiss(item.id)}
          >
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}
