/** 通知中心（P1-9 / T2.9）：铃铛未读徽标 + 下拉面板（点击已读并跳页 / 全部已读），60s 轮询 */
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { Bell, CheckCheck, MessageSquare, AtSign } from 'lucide-react'
import { notificationApi } from '@/lib/api'
import { cn } from '@/lib/cn'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

export function NotificationBell() {
  const { t } = useTranslation('workspace')
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const { workspaceId = '' } = useParams()

  const notifications = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationApi.list(),
    refetchInterval: 60_000,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['notifications'] })
  }

  const markRead = useMutation({
    mutationFn: (id: string) => notificationApi.markRead(id),
    onSuccess: invalidate,
  })
  const markAllRead = useMutation({
    mutationFn: () => notificationApi.markAllRead(),
    onSuccess: invalidate,
  })

  const items = notifications.data ?? []
  const unread = items.filter((n) => !n.read).length

  const open = (item: (typeof items)[number]) => {
    if (!item.read) markRead.mutate(item.id)
    navigate(`/${workspaceId}/page/${item.pageId}`)
  }

  const label = (item: (typeof items)[number]) => {
    if (item.type === 'mention') return t('notifications.typeMention', { actor: item.actorName })
    if (item.type === 'reply') return t('notifications.typeReply', { actor: item.actorName })
    return t('notifications.typeComment', { actor: item.actorName })
  }

  return (
    <DropdownMenuWithBell
      trigger={
        <button
          type="button"
          aria-label={t('notifications.title')}
          title={t('notifications.title')}
          className="relative rounded-md p-1.5 text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent) hover:text-(--sidebar-foreground)"
        >
          <Bell size={14} />
          {unread > 0 && (
            <span className="absolute -top-0.5 -right-0.5 flex h-3.5 min-w-3.5 items-center justify-center rounded-full bg-(--warning) px-0.5 text-[9px] font-bold text-white">
              {unread > 9 ? '9+' : unread}
            </span>
          )}
        </button>
      }
      content={
        <div className="flex max-h-[380px] w-[320px] flex-col">
          <div className="flex items-center justify-between px-3 py-2 text-[12px] font-medium text-(--muted-foreground)">
            {t('notifications.title')}
            {unread > 0 && (
              <button
                type="button"
                className="flex items-center gap-1 rounded px-1.5 py-0.5 transition-colors hover:bg-(--muted)"
                onClick={() => markAllRead.mutate()}
              >
                <CheckCheck size={12} />
                {t('notifications.markAllRead')}
              </button>
            )}
          </div>
          <div className="overflow-y-auto">
            {items.length === 0 && (
              <div className="px-3 py-6 text-center text-[12.5px] text-(--muted-foreground)">
                {t('notifications.empty')}
              </div>
            )}
            {items.map((item) => (
              <button
                key={item.id}
                type="button"
                className={cn(
                  'flex w-full items-start gap-2 px-3 py-2 text-left transition-colors hover:bg-(--muted)',
                  !item.read && 'bg-(--accent)',
                )}
                onClick={() => open(item)}
              >
                {item.type === 'mention' ? (
                  <AtSign size={14} className="mt-0.5 shrink-0 text-(--warning)" />
                ) : (
                  <MessageSquare size={14} className="mt-0.5 shrink-0 text-(--muted-foreground)" />
                )}
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[12.5px] text-(--foreground)">{label(item)}</span>
                  <span className="block truncate text-[11.5px] text-(--muted-foreground)">
                    {item.pageTitle || item.excerpt}
                  </span>
                </span>
                {!item.read && <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-(--warning)" />}
              </button>
            ))}
          </div>
        </div>
      }
    />
  )
}

function DropdownMenuWithBell({
  trigger,
  content,
}: {
  trigger: React.ReactNode
  content: React.ReactNode
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger>
      <DropdownMenuContent align="start" side="bottom" className="p-0">
        {content}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
