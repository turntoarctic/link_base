/**
 * 编辑器页（06 §2 唯一复杂页）：面包屑 + 标题（直写 PATCH，05 §5）+ 标签行 +
 * 页菜单（⋯）+ 编辑器。骨架加载（06 §5.5 禁止整页 spinner）。
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronRight, MoreHorizontal, Trash2, Link2, Star } from 'lucide-react'
import { pageApi, tagApi } from '@/lib/api'
import { usePageDoc } from './use-page-doc'
import { EditorView } from './editor-view'
import { Menu, MenuItem } from '@/components/ui/menu'
import { PageTagsRow } from './page-tags-row'

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
    patchTitle.current(value)
  }

  const moveToTrash = useMutation({
    mutationFn: () => pageApi.trash(workspaceId, pageId),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
      navigate(`/${workspaceId}`, { replace: true })
    },
  })

  // 收藏（P0-8）
  const favorites = useQuery({
    queryKey: ['favorites', workspaceId],
    queryFn: () => pageApi.favorites(workspaceId),
  })
  const isFavorite = favorites.data?.some((f) => f.id === pageId) ?? false
  const toggleFavorite = useMutation({
    mutationFn: () => (isFavorite ? pageApi.unfavorite(workspaceId, pageId) : pageApi.favorite(workspaceId, pageId)),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['favorites', workspaceId] })
    },
  })

  const wide = false // 宽块跟随 P1（05 §2.1 表格进阶时启用）
  void wide

  return (
    <div className="min-h-full px-6 py-4">
      {/* 面包屑 */}
      <div className="mx-auto flex h-6 max-w-(--width-content-wide) items-center justify-end gap-1 text-[12px] text-(--muted-foreground)">
        <div className="flex min-w-0 flex-1 items-center gap-1">
          {breadcrumb.map((item) => (
            <span key={item.id} className="flex min-w-0 items-center gap-1">
              <button
                type="button"
                className="truncate hover:text-(--foreground)"
                onClick={() => navigate(`/${workspaceId}/page/${item.id}`)}
              >
                {item.title || t('common:untitled')}
              </button>
              <ChevronRight size={11} className="shrink-0" />
            </span>
          ))}
        </div>

        {/* 页菜单 ⋯（06 §5.4） */}
        <Menu
          align="end"
          trigger={(_open, toggle) => (
            <button
              type="button"
              aria-label={t('workspace:page.menu')}
              className="rounded p-1 hover:bg-(--muted)"
              onClick={toggle}
            >
              <MoreHorizontal size={15} />
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onSelect={() => {
                  close()
                  toggleFavorite.mutate()
                }}
              >
                <Star size={13} className={isFavorite ? 'fill-current' : ''} />
                {isFavorite ? t('workspace:page.unfavorite') : t('workspace:page.favorite')}
              </MenuItem>
              <MenuItem
                onSelect={() => {
                  close()
                  void navigator.clipboard
                    .writeText(`${location.origin}/${workspaceId}/page/${pageId}`)
                    .catch(() => {})
                }}
              >
                <Link2 size={13} /> {t('workspace:page.copyLink')}
              </MenuItem>
              <MenuItem
                danger
                onSelect={() => {
                  close()
                  moveToTrash.mutate()
                }}
              >
                <Trash2 size={13} /> {t('workspace:page.moveToTrash')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      {/* 标题（独立输入框，非编辑器节点，05 §5） */}
      <div className="mx-auto w-(--width-content) max-w-full">
        <input
          className="w-full border-0 bg-transparent text-[32px] font-semibold leading-tight text-(--foreground) outline-none placeholder:text-(--text-tertiary)"
          value={title ?? ''}
          placeholder={t('common:untitled')}
          onChange={(e) => onTitleChange(e.target.value)}
        />

        {/* 标签行 */}
        <PageTagsRow
          workspaceId={workspaceId}
          pageId={pageId}
          tags={pageTags.data ?? []}
          onChanged={() => {
            void queryClient.invalidateQueries({ queryKey: ['pageTags', workspaceId, pageId] })
          }}
        />
      </div>

      {/* 编辑器 */}
      <div className={`linkbase-editor-content${wide ? ' wide' : ''}`}>
        {status === 'loading' && (
          <div className="animate-pulse" aria-busy="true">
            <div className="mb-4 h-8 w-2/3 rounded bg-(--muted)" />
            <div className="mb-3 h-4 w-full rounded bg-(--muted)" />
            <div className="mb-3 h-4 w-5/6 rounded bg-(--muted)" />
            <div className="h-4 w-3/4 rounded bg-(--muted)" />
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
  children: Array<{ id: string; title: string; parentId: string | null; children: never[] } | never>
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
