/**
 * 版本历史面板（08 §4.5 / T2.3）：时间线（快照即版本）+ 正文预览 + 一键恢复。
 * 恢复 = 目标快照作为新 update 合入（CRDT，不丢并发编辑）并写 reason=restore 快照。
 */
import { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { History, RotateCcw, Save } from 'lucide-react'
import { pageApi } from '@/lib/api'
import type { VersionItem } from '@linkbase/types'
import { refreshPageDoc } from './doc-manager'
import { Badge } from '@/components/ui/badge'
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

const REASON_TONE: Record<string, string> = {
  manual: 'bg-(--tag-2-bg) text-(--tag-2-fg)',
  restore: 'bg-(--tag-3-bg) text-(--tag-3-fg)',
  auto: 'bg-(--muted) text-(--muted-foreground)',
  copy: 'bg-(--muted) text-(--muted-foreground)',
}

export function VersionsPanel({
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
  const [selected, setSelected] = useState<VersionItem | null>(null)

  const versions = useQuery({
    queryKey: ['versions', wsId, pageId],
    queryFn: () => pageApi.versions(wsId, pageId),
    enabled: open,
  })

  const preview = useQuery({
    queryKey: ['versionText', wsId, pageId, selected?.version],
    queryFn: () => pageApi.versionText(wsId, pageId, selected!.version),
    enabled: open && selected != null,
  })

  const save = useMutation({
    mutationFn: () => pageApi.saveVersion(wsId, pageId),
    onSuccess: ({ version }) => {
      toast.success(t('versions.saved', { version }))
      void queryClient.invalidateQueries({ queryKey: ['versions', wsId, pageId] })
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  const restore = useMutation({
    mutationFn: async (version: number) => {
      await pageApi.restoreVersion(wsId, pageId, version)
      // 未连 WS 的客户端靠重拉差分拿到恢复内容；WS 在线者已即时合入
      await refreshPageDoc(wsId, pageId).catch(() => {})
    },
    onSuccess: (_void, version) => {
      toast.success(t('versions.restored', { version }))
      onOpenChange(false)
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  // 每次打开默认选最新版本
  useEffect(() => {
    if (open) setSelected(versions.data?.[0] ?? null)
  }, [open, versions.data])

  const list = versions.data ?? []

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[560px] max-w-[760px] flex-col gap-0 rounded-lg p-0">
        <DialogHeader className="border-b border-(--border) px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <History size={15} />
            {t('versions.title')}
          </DialogTitle>
          <DialogDescription className="text-[12px]">{t('versions.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1">
          {/* 时间线 */}
          <div className="w-[260px] shrink-0 overflow-y-auto border-r border-(--border) p-2">
            <Button
              variant="secondary"
              size="sm"
              className="mb-2 w-full"
              disabled={save.isPending}
              onClick={() => save.mutate()}
            >
              <Save size={13} />
              {t('versions.saveNow')}
            </Button>
            {versions.isPending && (
              <div className="px-2 py-3 text-[12px] text-(--muted-foreground)">{t('common:loading')}</div>
            )}
            {!versions.isPending && list.length === 0 && (
              <div className="px-2 py-3 text-[12px] text-(--muted-foreground)">{t('versions.empty')}</div>
            )}
            {list.map((item) => (
              <button
                key={item.version}
                type="button"
                className={cn(
                  'mb-0.5 w-full rounded-md px-2.5 py-2 text-left transition-colors hover:bg-(--muted)',
                  selected?.version === item.version && 'bg-(--accent)',
                )}
                onClick={() => setSelected(item)}
              >
                <div className="flex items-center gap-2">
                  <span className="text-[12.5px] font-medium">v{item.version}</span>
                  <Badge
                    className={cn(
                      'px-1.5 py-0.5 text-[10px]',
                      REASON_TONE[item.reason] ?? REASON_TONE.auto,
                    )}
                  >
                    {t(`versions.reason.${item.reason}`)}
                  </Badge>
                  <span className="ml-auto text-[11px] text-(--muted-foreground)">
                    {new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }).format(
                      new Date(item.createdAt),
                    )}
                  </span>
                </div>
                <div className="mt-0.5 line-clamp-2 text-[11.5px] leading-snug text-(--muted-foreground)">
                  {item.excerpt || t('common:empty')}
                </div>
              </button>
            ))}
          </div>

          {/* 正文预览 */}
          <div className="flex min-w-0 flex-1 flex-col">
            <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4">
              {selected == null && (
                <div className="py-10 text-center text-[13px] text-(--muted-foreground)">{t('versions.pickOne')}</div>
              )}
              {selected != null && (
                <>
                  <div className="mb-3 text-[12px] text-(--muted-foreground)">
                    v{selected.version} · {t(`versions.reason.${selected.reason}`)}
                  </div>
                  <div className="text-[13.5px] leading-relaxed whitespace-pre-wrap break-words">
                    {preview.data?.text || t('common:empty')}
                  </div>
                </>
              )}
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-(--border) px-5 py-3">
              <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                {t('common:close')}
              </Button>
              <Button
                size="sm"
                disabled={selected == null || restore.isPending}
                onClick={() => selected && restore.mutate(selected.version)}
              >
                <RotateCcw size={13} />
                {t('versions.restore')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
