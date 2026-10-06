/** shadcn/ui 官方 toast 方案（sonner 封装）：主题跟随 ui store；调用面 toast.success/toast.error */
import { Toaster as Sonner, type ToasterProps } from 'sonner'
import { useUiStore } from '@/stores/ui'

export function Toaster(props: ToasterProps) {
  const theme = useUiStore((s) => s.theme)
  return (
    <Sonner
      theme={theme}
      className="toaster group"
      position="bottom-center"
      style={
        {
          '--normal-bg': 'var(--popover)',
          '--normal-text': 'var(--popover-foreground)',
          '--normal-border': 'var(--border)',
          '--border-radius': 'var(--radius-md)',
        } as React.CSSProperties
      }
      {...props}
    />
  )
}

export { toast } from 'sonner'
