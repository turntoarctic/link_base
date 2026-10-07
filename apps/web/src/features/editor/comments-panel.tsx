/**
 * 评论面板（P1-3 / T2.4）：串式列表（根 + 回复）+ 发送（页面级或带锚点的行内评论）+
 * 解决/重开/删除。行内锚点评论由 bubble 工具条发起（pendingAnchor 从选区捕获）。
 */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Check, MessageSquare, Send, Trash2, X } from 'lucide-react'
import { pageApi } from '@/lib/api'
import { toast } from '@/components/ui/sonner'
import type { CommentAnchor, CommentItem } from '@linkbase/types'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { cn } from '@/lib/cn'

interface CommentsPanelProps {
  wsId: string
  pageId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  /** bubble 工具条发起的行内锚点（发送后由宿主清空） */
  pendingAnchor: CommentAnchor | null
  onAnchorConsumed: () => void
}

export function CommentsPanel({ wsId, pageId, open, onOpenChange, pendingAnchor, onAnchorConsumed }: CommentsPanelProps) {
  const { t } = useTranslation('workspace')
  const queryClient = useQueryClient()
  const [draft, setDraft] = useState('')
  const [replyTo, setReplyTo] = useState<CommentItem | null>(null)

  const comments = useQuery({
    queryKey: ['comments', wsId, pageId],
    queryFn: () => pageApi.comments(wsId, pageId),
    enabled: open,
  })

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['comments', wsId, pageId] })
  }

  const send = useMutation({
    mutationFn: async () => {
      const body = draft.trim()
      if (!body) return
      if (replyTo) {
        await pageApi.replyComment(wsId, pageId, replyTo.id, body)
      } else {
        await pageApi.createComment(wsId, pageId, { body, anchor: pendingAnchor ?? undefined })
      }
    },
    onSuccess: () => {
      setDraft('')
      setReplyTo(null)
      setPendingAnchorConsumed()
      invalidate()
    },
    onError: () => toast.error(t('common:operationFailed')),
  })
  function setPendingAnchorConsumed() {
    if (pendingAnchor) onAnchorConsumed()
  }

  const resolve = useMutation({
    mutationFn: (input: { id: string; resolved: boolean }) =>
      pageApi.resolveComment(wsId, pageId, input.id, input.resolved),
    onSuccess: invalidate,
  })
  const remove = useMutation({
    mutationFn: (id: string) => pageApi.deleteComment(wsId, pageId, id),
    onSuccess: invalidate,
  })

  const all = comments.data ?? []
  const roots = all
    .filter((c) => c.parentId === null)
    .sort((a, b) => (a.createdAt < b.createdAt ? 1 : -1))
  const repliesOf = (id: string) =>
    all.filter((c) => c.parentId === id).sort((a, b) => (a.createdAt < b.createdAt ? -1 : 1))
  const unresolvedCount = all.filter((c) => !c.resolved && c.parentId === null).length

  const submit = () => {
    if (draft.trim()) send.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[560px] max-w-[520px] flex-col gap-0 rounded-lg p-0">
        <DialogHeader className="border-b border-(--border) px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <MessageSquare size={15} />
            {t('comments.title')}
            {unresolvedCount > 0 && (
              <Badge className="bg-(--warning)/15 px-2 py-0.5 text-[11px] text-(--warning)">
                {t('comments.unresolved', { count: unresolvedCount })}
              </Badge>
            )}
          </DialogTitle>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col">
          <div className="min-h-0 flex-1 overflow-y-auto p-4">
            {roots.length === 0 && !comments.isPending && (
              <div className="py-10 text-center text-[13px] text-(--muted-foreground)">{t('comments.empty')}</div>
            )}
            {roots.map((c) => (
              <div key={c.id} className="mb-4 rounded-lg border border-(--border) p-3">
                <div className="flex items-center gap-2 text-[12px] text-(--muted-foreground)">
                  <span className="font-medium text-(--foreground)">{c.authorName}</span>
                  <span>{new Date(c.createdAt).toLocaleString()}</span>
                  {c.anchor && (
                    <span className="truncate rounded bg-(--warning)/10 px-1.5 py-0.5 text-[11px] text-(--warning)">
                      {t('comments.onQuote', { quote: c.anchor.quote.slice(0, 16) })}
                    </span>
                  )}
                  <span className="ml-auto flex items-center gap-1">
                    {c.resolved && <span className="text-[11px] text-(--success)">{t('comments.resolved')}</span>}
                    <button
                      type="button"
                      aria-label={c.resolved ? t('comments.reopen') : t('comments.resolve')}
                      className="rounded p-1 transition-colors hover:bg-(--muted)"
                      onClick={() => resolve.mutate({ id: c.id, resolved: !c.resolved })}
                    >
                      <Check size={13} className={cn(c.resolved && 'text-(--success)')} />
                    </button>
                    <button
                      type="button"
                      aria-label={t('common:delete')}
                      className="rounded p-1 transition-colors hover:bg-(--muted)"
                      onClick={() => remove.mutate(c.id)}
                    >
                      <Trash2 size={13} />
                    </button>
                  </span>
                </div>
                <div className={cn('mt-1.5 text-[13.5px] leading-relaxed', c.resolved && 'opacity-50')}>{c.body}</div>

                {c.anchor && (
                  <div className="mt-2 border-l-2 border-(--warning) pl-2 text-[12px] text-(--muted-foreground)">
                    “{c.anchor.quote}”
                  </div>
                )}

                {repliesOf(c.id).map((r) => (
                  <div key={r.id} className="mt-2 ml-4 border-l-2 border-(--border) pl-3">
                    <div className="flex items-center gap-2 text-[11.5px] text-(--muted-foreground)">
                      <span className="font-medium text-(--foreground)">{r.authorName}</span>
                      <span>{new Date(r.createdAt).toLocaleString()}</span>
                      <button
                        type="button"
                        aria-label={t('common:delete')}
                        className="ml-auto rounded p-1 transition-colors hover:bg-(--muted)"
                        onClick={() => remove.mutate(r.id)}
                      >
                        <X size={12} />
                      </button>
                    </div>
                    <div className="text-[13px] leading-relaxed">{r.body}</div>
                  </div>
                ))}

                <button
                  type="button"
                  className="mt-2 ml-4 text-[12px] text-(--muted-foreground) transition-colors hover:text-(--foreground)"
                  onClick={() => setReplyTo(c)}
                >
                  {t('comments.reply')}
                </button>
              </div>
            ))}
          </div>

          {/* 发送区 */}
          <div className="border-t border-(--border) p-3">
            {replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-md bg-(--muted) px-2 py-1 text-[12px] text-(--muted-foreground)">
                <span className="truncate">
                  {t('comments.replyingTo', { author: replyTo.authorName, body: replyTo.body.slice(0, 20) })}
                </span>
                <button type="button" aria-label={t('common:cancel')} onClick={() => setReplyTo(null)}>
                  <X size={12} />
                </button>
              </div>
            )}
            {pendingAnchor && !replyTo && (
              <div className="mb-2 flex items-center justify-between rounded-md bg-(--warning)/10 px-2 py-1 text-[12px] text-(--warning)">
                <span className="truncate">{t('comments.inlineTarget', { quote: pendingAnchor.quote.slice(0, 24) })}</span>
                <button type="button" aria-label={t('common:cancel')} onClick={onAnchorConsumed}>
                  <X size={12} />
                </button>
              </div>
            )}
            <div className="flex items-end gap-2">
              <textarea
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit()
                }}
                rows={2}
                placeholder={t('comments.placeholder')}
                className="min-h-0 flex-1 resize-none rounded-md border border-(--input) bg-(--background) px-3 py-2 text-[13px] outline-none focus-visible:border-(--ring)"
              />
              <Button size="sm" disabled={!draft.trim() || send.isPending} onClick={submit}>
                <Send size={13} />
                {t('comments.send')}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}
