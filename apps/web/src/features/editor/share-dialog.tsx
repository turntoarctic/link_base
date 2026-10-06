/** 公开分享对话框（Phase 3）：开关 + 复制只读链接；未开启时隐藏链接 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Copy } from 'lucide-react'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'
import { cn } from '@/lib/cn'

export function ShareDialog({
  wsId,
  pageId,
  open,
  onOpenChange,
}: {
  wsId: string
  pageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('workspace')
  const queryClient = useQueryClient()
  const [copied, setCopied] = useState(false)

  const state = useQuery({
    queryKey: ['share', wsId, pageId],
    queryFn: () => pageApi.shareState(wsId, pageId),
    enabled: open,
  })

  const toggle = useMutation({
    mutationFn: (enabled: boolean) => pageApi.setShare(wsId, pageId, enabled),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['share', wsId, pageId] })
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  const enabled = state.data?.enabled ?? false
  const slug = state.data?.slug ?? null
  const link = slug ? `${location.origin}/share/${slug}` : ''

  const copy = () => {
    void navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 1500)
      })
      .catch(() => toast.error(t('common:operationFailed')))
  }

  // 对话框关闭时清 copied 态
  useEffect(() => {
    if (!open) setCopied(false)
  }, [open])

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-[440px]">
        <DialogHeader>
          <DialogTitle className="text-[15px]">{t('share.title')}</DialogTitle>
          <DialogDescription className="text-[12px]">{t('share.subtitle')}</DialogDescription>
        </DialogHeader>

        <button
          type="button"
          role="switch"
          aria-checked={enabled}
          className="flex w-full items-center justify-between rounded-lg border border-(--border) px-4 py-3 transition-colors hover:bg-(--muted)"
          onClick={() => toggle.mutate(!enabled)}
        >
          <span className="text-[13.5px]">{t('share.enable')}</span>
          <span
            className={cn(
              'relative inline-flex h-5 w-9 items-center rounded-full transition-colors',
              enabled ? 'bg-(--primary)' : 'bg-(--muted)',
            )}
          >
            <span
              className={cn(
                'inline-flex size-4 rounded-full bg-white transition-transform',
                enabled ? 'translate-x-4' : 'translate-x-0.5',
              )}
            />
          </span>
        </button>

        {enabled && slug && (
          <div className="flex items-center gap-2">
            <input
              readOnly
              value={link}
              className="h-8 flex-1 rounded-md border border-(--input) bg-(--muted) px-2.5 text-[12px] text-(--muted-foreground) outline-none"
            />
            <Button variant="secondary" size="sm" onClick={copy}>
              <Copy size={13} />
              {copied ? t('common:copied') : t('share.copy')}
            </Button>
          </div>
        )}

        <p className="text-[11.5px] leading-relaxed text-(--muted-foreground)">{t('share.hint')}</p>

        <div className="flex justify-end">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common:close')}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
