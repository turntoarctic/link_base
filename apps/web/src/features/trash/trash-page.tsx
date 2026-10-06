/** 回收站页（P0-6）：列表（标题/路径/删除时间/操作），恢复、彻底删除（二次确认） */
import { useState } from 'react'
import { useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { Modal } from '@/components/ui/modal'

export default function TrashPage() {
  const { workspaceId = '' } = useParams()
  const queryClient = useQueryClient()
  const { t, i18n } = useTranslation('workspace')
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
    },
  })

  const permanent = useMutation({
    mutationFn: (pageId: string) => pageApi.permanentDelete(workspaceId, pageId),
    onSuccess: () => {
      setConfirmId(null)
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
    },
  })

  const confirmItem = (trash.data ?? []).find((item) => item.id === confirmId)

  return (
    <div className="mx-auto max-w-(--width-content-wide) px-6 py-8">
      <h1 className="mb-6 text-[22px] font-semibold">{t('trash.title')}</h1>

      {trash.data && trash.data.length === 0 && (
        <div className="py-20 text-center text-[14px] text-(--muted-foreground)">{t('trash.empty')}</div>
      )}

      {trash.data && trash.data.length > 0 && (
        <table className="w-full border-collapse text-[14px]">
          <thead>
            <tr className="border-b border-(--border) text-left text-[12px] text-(--muted-foreground)">
              <th className="py-2 pr-3 font-medium">{t('trash.columnTitle')}</th>
              <th className="py-2 pr-3 font-medium">{t('trash.columnPath')}</th>
              <th className="py-2 pr-3 font-medium">{t('trash.columnDeletedAt')}</th>
              <th className="py-2 font-medium">{t('trash.columnActions')}</th>
            </tr>
          </thead>
          <tbody>
            {(trash.data ?? []).map((item) => (
              <tr key={item.id} className="border-b border-(--border)">
                <td className="max-w-[280px] truncate py-2.5 pr-3">
                  {item.icon ? `${item.icon} ` : ''}
                  {item.title || t('common:untitled', { ns: 'common' })}
                </td>
                <td className="max-w-[240px] truncate py-2.5 pr-3 text-(--muted-foreground)">
                  {item.path.join(' / ')}
                </td>
                <td className="py-2.5 pr-3 text-(--muted-foreground)">
                  {item.deletedAt
                    ? new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeStyle: 'short' }).format(
                        new Date(item.deletedAt),
                      )
                    : '—'}
                </td>
                <td className="py-2.5">
                  <Button variant="link" size="sm" onClick={() => restore.mutate(item.id)}>
                    {t('common:restore')}
                  </Button>
                  <Button variant="link" size="sm" className="text-(--destructive)" onClick={() => setConfirmId(item.id)}>
                    {t('trash.deletePermanently')}
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}

      <Modal
        open={confirmId !== null}
        onClose={() => setConfirmId(null)}
        title={t('trash.confirmTitle', { title: confirmItem?.title ?? '' })}
      >
        <p className="text-[14px] text-(--muted-foreground)">{t('trash.confirmBody')}</p>
        <div className="mt-4 flex justify-end gap-2">
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
        </div>
      </Modal>
    </div>
  )
}
