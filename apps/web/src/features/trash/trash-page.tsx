/** 回收站页（P0-6）：列表（标题/路径/删除时间/操作），恢复、彻底删除（Dialog 二次确认） */
import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { RotateCcw, Trash2 } from 'lucide-react'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { EmptyState, Skeleton } from '@/components/ui/primitives'
import { toast } from '@/components/ui/sonner'

export default function TrashPage() {
  const { workspaceId = '' } = useParams()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation(['workspace', 'common'])
  const [confirmId, setConfirmId] = useState<string | null>(null)

  const trash = useQuery({
    queryKey: ['trash', workspaceId],
    queryFn: () => pageApi.trashList(workspaceId),
  })

  const restore = useMutation({
    mutationFn: (pageId: string) => pageApi.restore(workspaceId, pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
      toast.success(t('workspace:toast.restored'))
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  const permanent = useMutation({
    mutationFn: (pageId: string) => pageApi.permanentDelete(workspaceId, pageId),
    onSuccess: () => {
      setConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
      toast.success(t('workspace:toast.deletedPermanently'))
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  const confirmItem = (trash.data ?? []).find((item) => item.id === confirmId)

  return (
    <div className="mx-auto max-w-(--width-content-wide) px-8 py-8">
      <div className="mb-6 flex items-center gap-2.5">
        <span className="flex size-8 items-center justify-center rounded-lg bg-(--muted) text-(--muted-foreground)">
          <Trash2 size={15} />
        </span>
        <h1 className="text-[22px] font-bold tracking-tight">{t('trash.title')}</h1>
      </div>

      {trash.isPending && (
        <div className="flex flex-col gap-2.5">
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-full" />
          <Skeleton className="h-11 w-2/3" />
        </div>
      )}

      {trash.data?.length === 0 && <EmptyState icon={<Trash2 size={18} />} title={t('trash.empty')} />}

      {trash.data && trash.data.length > 0 && (
        <div className="overflow-hidden rounded-lg border border-(--border)">
          <table className="w-full border-collapse text-[13.5px]">
            <thead>
              <tr className="border-b border-(--border) bg-(--secondary) text-left text-[12px] text-(--muted-foreground)">
                <th className="px-4 py-2.5 font-medium">{t('trash.columnTitle')}</th>
                <th className="px-4 py-2.5 font-medium">{t('trash.columnPath')}</th>
                <th className="px-4 py-2.5 font-medium">{t('trash.columnDeletedAt')}</th>
                <th className="px-4 py-2.5 font-medium">{t('trash.columnActions')}</th>
              </tr>
            </thead>
            <tbody>
              {trash.data.map((item, index) => (
                <tr
                  key={item.id}
                  className={
                    'transition-colors hover:bg-(--muted)/50 ' +
                    (index < trash.data!.length - 1 ? 'border-b border-(--border)' : '')
                  }
                >
                  <td className="max-w-[280px] truncate px-4 py-2.5">
                    {item.icon ? `${item.icon} ` : ''}
                    {item.title || t('common:untitled', { ns: 'common' })}
                  </td>
                  <td className="max-w-[240px] truncate px-4 py-2.5 text-(--muted-foreground)">
                    {item.path.join(' / ')}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap text-(--muted-foreground)">
                    {item.deletedAt
                      ? new Intl.DateTimeFormat(i18n.language, {
                          dateStyle: 'medium',
                          timeStyle: 'short',
                        }).format(new Date(item.deletedAt))
                      : '—'}
                  </td>
                  <td className="px-4 py-2.5 whitespace-nowrap">
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-(--primary) hover:text-(--primary)"
                      onClick={() => restore.mutate(item.id)}
                    >
                      <RotateCcw size={12} />
                      {t('common:restore')}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-destructive hover:text-destructive"
                      onClick={() => setConfirmId(item.id)}
                    >
                      <Trash2 size={12} />
                      {t('trash.deletePermanently')}
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={confirmId !== null} onOpenChange={(open) => !open && setConfirmId(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('trash.confirmTitle', { title: confirmItem?.title ?? '' })}</DialogTitle>
            <DialogDescription>{t('trash.confirmBody')}</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="secondary" onClick={() => setConfirmId(null)}>
              {t('common:cancel')}
            </Button>
            <Button
              variant="destructive"
              disabled={permanent.isPending}
              onClick={() => confirmId && permanent.mutate(confirmId)}
            >
              {t('trash.deletePermanently')}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
