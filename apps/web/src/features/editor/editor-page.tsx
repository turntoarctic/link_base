/**
 * 编辑器页（06 §2 唯一复杂页）：面包屑 + 标题（直写 PATCH，05 §5）+ 标签行 +
 * 页菜单（⋯）+ 编辑器。骨架加载（06 §5.5 禁止整页 spinner）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronRight, Copy, MoreHorizontal, Star, Trash2 } from 'lucide-react'
import { pageApi, tagApi } from '@/lib/api'
import { usePageDoc } from './use-page-doc'
import { EditorView } from './editor-view'
import { PageTagsRow } from './page-tags-row'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/primitives'
import { toast } from '@/components/ui/sonner'

export default function EditorPage() {
  const { workspaceId = '', pageId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation(['workspace', 'common'])

  const { status, ydoc } = usePageDoc(workspaceId, pageId)
  const meta = useQuery({
    queryKey: ['page', workspaceId, pageId],
    queryFn: () => pageApi.get(workspaceId, pageId),
  })
  const tree = useQuery({ queryKey: ['pages', workspaceId], queryFn: () => pageApi.tree(workspaceId) })
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
    const byId = new Map(tree.data.flatMap((n) => flattenTree(n)))
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

  const [title, setTitle] = useState<string | undefined>(undefined)
  useEffect(() => {
    if (meta.data && title === undefined) setTitle(meta.data.title)
  }, [meta.data, title])

  // 依赖路由参数：切换页面时重建，避免闭包打到旧页面（05 §5 标题直写）
  const patchTitle = useMemo(
    () =>
      debounce((value: string) => {
        void pageApi
          .patch(workspaceId, pageId, { title: value })
          .then(() => queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] }))
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
      {/* 顶部条：面包屑 + 页菜单（06 §5.4：无全局 header，右上仅 ⋯） */}
      <div className="mx-auto flex h-8 max-w-(--width-content-wide) items-center justify-end gap-1 text-[12px] text-(--muted-foreground)">
        <div className="flex min-w-0 flex-1 items-center gap-0.5">
          {breadcrumb.map((item) => (
            <span key={item.id} className="flex min-w-0 items-center gap-0.5">
              <button
                type="button"
                className="max-w-[160px] truncate rounded px-1 py-0.5 transition-colors hover:bg-(--muted) hover:text-(--foreground)"
                onClick={() => navigate(`/${workspaceId}/page/${item.id}`)}
              >
                {item.title || t('common:untitled')}
              </button>
              <ChevronRight size={11} className="shrink-0 opacity-60" />
            </span>
          ))}
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              aria-label={t('workspace:page.menu')}
              className="rounded-md p-1.5 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
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
            <DropdownMenuItem variant="destructive" onSelect={() => moveToTrash.mutate()}>
              <Trash2 />
              {t('workspace:page.moveToTrash')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

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
        {status === 'ready' && ydoc && (
          <EditorView key={pageId} wsId={workspaceId} pageId={pageId} ydoc={ydoc} />
        )}
      </div>
    </div>
  )
}

type TreeFlattenNode = { id: string; title: string; parentId: string | null }

function flattenTree(node: {
  id: string
  title: string
  parentId: string | null
  children: unknown[]
}): TreeFlattenNode[] {
  const out: TreeFlattenNode[] = [{ id: node.id, title: node.title, parentId: node.parentId }]
  for (const child of node.children as unknown as Parameters<typeof flattenTree>[0][]) {
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
