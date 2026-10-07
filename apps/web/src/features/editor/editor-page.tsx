/**
 * 编辑器页（06 §2 唯一复杂页）：面包屑 + 标题（直写 PATCH，05 §5）+ 标签行 +
 * 页菜单（⋯）+ 编辑器。骨架加载（06 §5.5 禁止整页 spinner）。
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronRight, CloudOff, Copy, Download, FileUp, History, Link2, MessageSquare, MoreHorizontal, Search, Star, Trash2 } from 'lucide-react'
import { pageApi, tagApi } from '@/lib/api'
import type { CommentAnchor, PageTreeNode } from '@linkbase/types'
import { updateSubpageTitle } from './doc-manager'
import { useDocPushFailed } from './use-doc-sync'
import { useAwarenessUsers } from './use-awareness-users'
import { usePageDoc } from './use-page-doc'
import { EditorView } from './editor-view'
import { PageTagsRow } from './page-tags-row'
import { VersionsPanel } from './versions-panel'
import { CommentsPanel } from './comments-panel'
import { ImportMarkdownDialog } from './import-markdown-dialog'
import { openFindReplace } from './find-replace-bar'
import { ShareDialog } from './share-dialog'
import { Badge } from '@/components/ui/badge'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { AvatarGroup, Avatar, AvatarFallback } from '@/components/ui/avatar'
import { toast } from '@/components/ui/sonner'

export default function EditorPage() {
  const { workspaceId = '', pageId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const pushFailed = useDocPushFailed(pageId)
  const onlineUsers = useAwarenessUsers(pageId)
  const { t } = useTranslation(['workspace', 'common'])

  const { status, ydoc } = usePageDoc(workspaceId, pageId)
  const meta = useQuery({
    queryKey: ['page', workspaceId, pageId],
    queryFn: () => pageApi.get(workspaceId, pageId),
  })
  const tree = useQuery({ queryKey: ['pages', workspaceId], queryFn: () => pageApi.tree(workspaceId) })
  // 评论数据始终拉取（高亮装饰需要锚点；量级为单页评论数，可忽略）
  const comments = useQuery({
    queryKey: ['comments', workspaceId, pageId],
    queryFn: () => pageApi.comments(workspaceId, pageId),
  })
  // 反向链接（Phase 3）：derive 异步同步，30s 轮询兜底
  const backlinks = useQuery({
    queryKey: ['backlinks', workspaceId, pageId],
    queryFn: () => pageApi.backlinks(workspaceId, pageId),
    refetchInterval: 30_000,
  })
  const commentAnchors = (comments.data ?? [])
    .filter((c) => c.anchor && !c.resolved)
    .map((c) => ({ id: c.id, quote: c.anchor!.quote, prefix: c.anchor!.prefix, suffix: c.anchor!.suffix }))
  const pageTags = useQuery({
    queryKey: ['pageTags', workspaceId, pageId],
    queryFn: () => tagApi.pageTags(workspaceId, pageId),
  })

  // 访问记录（P1 recents 数据源，进入即记）
  useEffect(() => {
    void pageApi.visit(workspaceId, pageId).catch(() => {})
  }, [workspaceId, pageId])

  // 面包屑：树里找父链
  const breadcrumb: Array<{ id: string; title: string }> = []
  if (tree.data) {
    const byId = new Map(
      tree.data.flatMap((n) => flattenTree(n)).map((n) => [n.id, n] as const),
    )
    let cursor: string | null = meta.data?.parentId ?? null
    const seen = new Set<string>([pageId])
    while (cursor && !seen.has(cursor)) {
      seen.add(cursor)
      const node = byId.get(cursor)
      if (!node) break
      breadcrumb.unshift({ id: node.id, title: node.title })
      cursor = node.parentId
    }
  }

  const [versionsOpen, setVersionsOpen] = useState(false)
  const [commentsOpen, setCommentsOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [shareOpen, setShareOpen] = useState(false)
  const [pendingAnchor, setPendingAnchor] = useState<CommentAnchor | null>(null)
  const [title, setTitle] = useState<string | undefined>(undefined)
  // 组件在 /page/:pageId 下切页不重挂载：切页必须重置标题，否则残留上个页面的
  // 标题（显示错误，且继续输入会把旧标题 PATCH 到新页面）
  useEffect(() => {
    setTitle(undefined)
  }, [pageId])
  useEffect(() => {
    if (meta.data && title === undefined) setTitle(meta.data.title)
  }, [meta.data, title])

  // 依赖路由参数：切换页面时重建，避免闭包打到旧页面（05 §5 标题直写）
  // 成功后同步父页文档里的子页卡片标题（title 真相在 pages 列，卡片 attr 随动）
  const metaRef = useRef(meta.data)
  metaRef.current = meta.data
  const patchTitle = useMemo(
    () =>
      debounce((value: string) => {
        void pageApi
          .patch(workspaceId, pageId, { title: value })
          .then(() => {
            void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
            const parentId = metaRef.current?.parentId
            if (parentId) {
              void updateSubpageTitle(workspaceId, parentId, pageId, value).catch(() => {})
            }
          })
          .catch(() => {})
      }, 500),
    [workspaceId, pageId, queryClient],
  )

  const onTitleChange = (value: string) => {
    setTitle(value)
    patchTitle(value)
  }

  const moveToTrash = useMutation({
    mutationFn: () => pageApi.trash(workspaceId, pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
      toast.success(t('workspace:page.movedToTrash'))
      navigate(`/${workspaceId}`, { replace: true })
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  // 收藏（P0-8）
  const favorites = useQuery({
    queryKey: ['favorites', workspaceId],
    queryFn: () => pageApi.favorites(workspaceId),
  })
  const isFavorite = favorites.data?.some((f) => f.id === pageId) ?? false
  const toggleFavorite = useMutation({
    mutationFn: () =>
      isFavorite ? pageApi.unfavorite(workspaceId, pageId) : pageApi.favorite(workspaceId, pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites', workspaceId] })
    },
  })

  return (
    <div className="min-h-full px-6 py-3">
      {/* 顶部条：面包屑 + 页菜单（06 §5.4：无全局 header，右上仅 ⋯）；
          移动端左上角为侧栏抽屉触发器，面包屑避让 */}
      <div className="mx-auto flex h-8 max-w-(--width-content-wide) items-center justify-end gap-1 text-[12px] text-(--muted-foreground) pl-10">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {breadcrumb.map((item) => (
            <span key={item.id} className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                className="max-w-[160px] truncate rounded-md px-1.5 py-0.5 transition-colors hover:bg-(--accent) hover:text-(--foreground)"
                onClick={() => navigate(`/${workspaceId}/page/${item.id}`)}
              >
                {item.title || t('common:untitled')}
              </button>
              <ChevronRight size={11} className="shrink-0 text-(--text-tertiary)" />
            </span>
          ))}
          {pushFailed && (
            <Badge
              title={t('common:syncOffline')}
              className="ml-1 gap-1 bg-(--muted) px-2 py-0.5 text-[11px] text-(--muted-foreground)"
            >
              <CloudOff size={11} />
              {t('common:syncOffline')}
            </Badge>
          )}
        </div>

        {/* 评论入口（未解决计数）+ 在线协作成员（T2.2，09 §6）+ ⋯ 页菜单 */}
        <button
          type="button"
          aria-label={t('workspace:comments.title')}
          title={t('workspace:comments.title')}
          className="relative mr-1 rounded-full p-1.5 text-(--muted-foreground) transition-colors hover:bg-(--accent) hover:text-(--foreground)"
          onClick={() => setCommentsOpen(true)}
        >
          <MessageSquare size={15} />
          {comments.data && comments.data.some((c) => !c.resolved) && (
            <span className="absolute -top-0.5 -right-0.5 flex size-3.5 items-center justify-center rounded-full bg-(--primary) text-[9px] font-bold text-(--primary-foreground)">
              {comments.data.filter((c) => !c.resolved).length}
            </span>
          )}
        </button>

        {/* 在线协作成员（T2.2，09 §6）+ ⋯ 页菜单 */}
        <AvatarGroup className="shrink-0 items-center -space-x-1 pr-1">
          {onlineUsers.map((u) => (
            <Avatar key={u.clientID} title={u.name} className="size-5">
              <AvatarFallback
                className="text-[10px] font-semibold text-white"
                style={{ background: u.color }}
              >
                {u.name.slice(0, 1).toUpperCase()}
              </AvatarFallback>
            </Avatar>
          ))}
        </AvatarGroup>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('workspace:page.menu')}
              className="rounded-full p-1.5 text-(--muted-foreground) transition-colors hover:bg-(--accent) hover:text-(--foreground)"
            >
              <MoreHorizontal size={16} />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="min-w-[176px]">
            <DropdownMenuItem onSelect={() => toggleFavorite.mutate()}>
              <Star className={isFavorite ? 'fill-current' : ''} />
              {isFavorite ? t('workspace:page.unfavorite') : t('workspace:page.favorite')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void navigator.clipboard
                  .writeText(`${location.origin}/${workspaceId}/page/${pageId}`)
                  .then(() => toast.success(t('workspace:toast.linkCopied')))
                  .catch(() => {})
              }}
            >
              <Copy />
              {t('workspace:page.copyLink')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setVersionsOpen(true)}>
              <History />
              {t('workspace:versions.menu')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => openFindReplace()}>
              <Search size={14} className="mr-0" />
              {t('workspace:findReplace.menu')}
            </DropdownMenuItem>
            <DropdownMenuItem
              onSelect={() => {
                void pageApi
                  .exportMarkdown(workspaceId, pageId)
                  .then((markdown) => {
                    const blob = new Blob([markdown], { type: 'text/markdown;charset=utf-8' })
                    const a = document.createElement('a')
                    a.href = URL.createObjectURL(blob)
                    a.download = `${(meta.data?.title || 'page').replace(/[\\/:*?"<>|]/g, '_')}.md`
                    a.click()
                    URL.revokeObjectURL(a.href)
                  })
                  .catch(() => toast.error(t('common:operationFailed')))
              }}
            >
              <Download />
              {t('workspace:export.md')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setImportOpen(true)}>
              <FileUp />
              {t('workspace:import.menu')}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => setShareOpen(true)}>
              {t('workspace:share.menu')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => moveToTrash.mutate()}>
              <Trash2 />
              {t('workspace:page.moveToTrash')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <VersionsPanel wsId={workspaceId} pageId={pageId} open={versionsOpen} onOpenChange={setVersionsOpen} />
      <CommentsPanel
        wsId={workspaceId}
        pageId={pageId}
        open={commentsOpen}
        onOpenChange={setCommentsOpen}
        pendingAnchor={pendingAnchor}
        onAnchorConsumed={() => setPendingAnchor(null)}
      />
      <ImportMarkdownDialog wsId={workspaceId} open={importOpen} onOpenChange={setImportOpen} />
      <ShareDialog wsId={workspaceId} pageId={pageId} open={shareOpen} onOpenChange={setShareOpen} />

      {/* 标题（独立输入框，非编辑器节点，05 §5） */}
      <div className="mx-auto w-(--width-content) max-w-full pt-6">
        {status === 'loading' ? (
          <Skeleton className="mb-5 h-9 w-2/3" />
        ) : (
          <input
            className="mb-1 w-full border-0 bg-transparent text-[32px] font-bold leading-[1.2] tracking-tight text-(--foreground) outline-none placeholder:text-(--text-tertiary)"
            value={title ?? ''}
            placeholder={t('common:untitled')}
            onChange={(e) => onTitleChange(e.target.value)}
          />
        )}

        {/* 标签行 */}
        {status !== 'loading' && (
          <PageTagsRow
            workspaceId={workspaceId}
            pageId={pageId}
            tags={pageTags.data ?? []}
            onChanged={() => {
              void queryClient.invalidateQueries({ queryKey: ['pageTags', workspaceId, pageId] })
            }}
          />
        )}
      </div>

      {/* 编辑器 */}
      <div className="linkbase-editor-content">
        {status === 'loading' && (
          <div className="flex flex-col gap-3.5" aria-busy="true">
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-5/6" />
            <Skeleton className="h-4 w-3/4" />
            <Skeleton className="mt-3 h-24 w-full rounded-lg" />
          </div>
        )}
        {status === 'error' && (
          <div className="py-20 text-center text-[14px] text-(--muted-foreground)">
            {t('workspace:errors.loadFailed')}
          </div>
        )}
        {/* 反向链接（Phase 3）：底部清单 */}
        {status === 'ready' && (backlinks.data?.length ?? 0) > 0 && (
          <div className="linkbase-backlinks mt-10 border-t border-(--border) pt-4" contentEditable={false}>
            <div className="mb-2 flex items-center gap-1.5 text-[12px] font-medium text-(--muted-foreground)">
              <Link2 size={12} />
              {t('workspace:backlinks.title', { count: backlinks.data!.length })}
            </div>
            <div className="flex flex-col">
              {backlinks.data!.map((b) => (
                <button
                  key={b.id}
                  type="button"
                  className="w-fit rounded px-1 py-0.5 text-left text-[13px] text-(--primary) transition-colors hover:bg-(--muted)"
                  onClick={() => navigate(`/${workspaceId}/page/${b.id}`)}
                >
                  {b.title || t('common:untitled')}
                </button>
              ))}
            </div>
          </div>
        )}

        {status === 'ready' && ydoc && (
          <EditorView
            key={pageId}
            wsId={workspaceId}
            pageId={pageId}
            ydoc={ydoc}
            commentAnchors={commentAnchors}
            onCommentAnchorClick={() => setCommentsOpen(true)}
            onInlineComment={(anchor) => {
              setPendingAnchor(anchor)
              setCommentsOpen(true)
            }}
          />
        )}
      </div>
    </div>
  )
}

type TreeFlattenNode = { id: string; title: string; parentId: string | null }

function flattenTree(node: PageTreeNode): TreeFlattenNode[] {
  const out: TreeFlattenNode[] = [{ id: node.id, title: node.title, parentId: node.parentId }]
  for (const child of node.children) {
    out.push(...flattenTree(child))
  }
  return out
}

function debounce<A extends unknown[]>(fn: (...args: A) => void, ms: number): (...args: A) => void {
  let timer: ReturnType<typeof setTimeout> | null = null
  return (...args: A) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), ms)
  }
}
