/**
 * 侧边栏页面树（06 §5.5 / P0-4）：树展示、展开收起、hover ⋯ 菜单（子页/重命名/移到回收站/复制链接）、
 * 拖拽换序换父（subpage 节点在父页文档间搬移，08 §5 派生对齐）。
 */
import { useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ChevronRight, FileText, MoreHorizontal, Plus } from 'lucide-react'
import { pageApi } from '@/lib/api'
import type { PageTreeNode } from '@linkbase/types'
import { moveSubpageNode } from '@/features/editor/doc-manager'
import { Menu, MenuItem } from '@/components/ui/menu'
import { cn } from '@/lib/cn'

type DropHint = { pageId: string; position: 'child' | 'before' | 'after' } | null

export function PageTree({ nodes }: { nodes: PageTreeNode[] }) {
  const { workspaceId = '' } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const { t } = useTranslation(['workspace', 'common'])
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set())
  const [dragId, setDragId] = useState<string | null>(null)
  const [dropHint, setDropHint] = useState<DropHint>(null)

  const parentOf = useMemo(() => {
    const map = new Map<string, string | null>()
    const walk = (list: PageTreeNode[], parent: string | null) => {
      for (const node of list) {
        map.set(node.id, parent)
        walk(node.children, node.id)
      }
    }
    walk(nodes, null)
    return map
  }, [nodes])

  const titleOf = useMemo(() => {
    const map = new Map<string, string>()
    const walk = (list: PageTreeNode[]) => {
      for (const node of list) {
        map.set(node.id, node.title)
        walk(node.children)
      }
    }
    walk(nodes)
    return map
  }, [nodes])

  const invalidate = () => {
    void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
  }

  const createPage = useMutation({
    mutationFn: async (input: { parentId?: string | null }) => {
      const page = await pageApi.create(workspaceId, input.parentId ? { parentId: input.parentId } : {})
      return page
    },
    onSuccess: (page) => {
      invalidate()
      navigate(`/${workspaceId}/page/${page.id}`)
    },
  })

  const trash = useMutation({
    mutationFn: (pageId: string) => pageApi.trash(workspaceId, pageId),
    onSuccess: () => {
      invalidate()
      void queryClient.invalidateQueries({ queryKey: ['trash', workspaceId] })
    },
  })

  const toggle = (pageId: string) => {
    setCollapsed((prev) => {
      const next = new Set(prev)
      if (next.has(pageId)) next.delete(pageId)
      else next.add(pageId)
      return next
    })
  }

  const onDrop = async (targetId: string) => {
    const sourceId = dragId
    setDragId(null)
    const hint = dropHint
    setDropHint(null)
    if (!sourceId || !hint || sourceId === targetId) return
    // 不允许把页面拖进自己的子树（服务端派生会形成环）
    if (hint.position === 'child') {
      let cursor: string | null = targetId
      const seen = new Set<string>([sourceId])
      while (cursor && !seen.has(cursor)) {
        seen.add(cursor)
        cursor = parentOf.get(cursor) ?? null
      }
      if (cursor === sourceId) return
    }
    const newParentId =
      hint.position === 'child' ? targetId : (parentOf.get(targetId) ?? null)
    const beforePageId = hint.position === 'child' ? null : targetId
    await moveSubpageNode({
      wsId: workspaceId,
      pageId: sourceId,
      title: titleOf.get(sourceId) ?? '',
      currentParentId: parentOf.get(sourceId) ?? null,
      newParentId,
      beforePageId,
    })
    invalidate()
  }

  const renderNode = (node: PageTreeNode, depth: number): React.ReactNode => {
    const hasChildren = node.children.length > 0
    const isCollapsed = collapsed.has(node.id)
    const hint = dropHint?.pageId === node.id ? dropHint.position : null

    return (
      <div key={node.id}>
        <div
          className={cn(
            'group relative flex h-7 items-center gap-0.5 rounded pr-1 hover:bg-(--sidebar-accent)',
            hint === 'child' && 'ring-2 ring-(--sidebar-ring) ring-inset',
          )}
          style={{ paddingLeft: depth * 14 + 4 }}
          draggable
          onDragStart={(e) => {
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/linkbase-page', node.id)
            setDragId(node.id)
          }}
          onDragEnd={() => {
            setDragId(null)
            setDropHint(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.dataTransfer.dropEffect = 'move'
            const rect = e.currentTarget.getBoundingClientRect()
            const ratio = (e.clientY - rect.top) / rect.height
            const position = ratio < 0.25 ? 'before' : ratio > 0.75 ? 'after' : 'child'
            setDropHint({ pageId: node.id, position })
          }}
          onDragLeave={() => setDropHint(null)}
          onDrop={(e) => {
            e.preventDefault()
            void onDrop(node.id)
          }}
        >
          <button
            type="button"
            aria-label="toggle"
            className={cn('rounded p-0.5 text-(--muted-foreground)', !hasChildren && 'invisible')}
            onClick={() => toggle(node.id)}
          >
            <ChevronRight size={12} className={cn('transition-transform', !isCollapsed && 'rotate-90')} />
          </button>
          <button
            type="button"
            className="flex min-w-0 flex-1 items-center gap-1.5 text-left"
            onClick={() => navigate(`/${workspaceId}/page/${node.id}`)}
          >
            {node.icon ? (
              <span className="shrink-0 text-[13px]">{node.icon}</span>
            ) : (
              <FileText size={13} className="shrink-0 text-(--muted-foreground)" />
            )}
            <span className={cn('truncate', dragId === node.id && 'opacity-40')}>
              {node.title || t('common:untitled')}
            </span>
          </button>

          <span className="ml-auto flex items-center opacity-0 transition-opacity group-hover:opacity-100">
            <button
              type="button"
              aria-label={t('workspace:tree.addChild')}
              className="rounded p-0.5 text-(--muted-foreground) hover:bg-(--accent)"
              onClick={() => createPage.mutate({ parentId: node.id })}
            >
              <Plus size={12} />
            </button>
            <Menu
              align="end"
              trigger={(_open, toggleMenu) => (
                <button
                  type="button"
                  aria-label={t('workspace:sidebar.nodeMenu')}
                  className="rounded p-0.5 text-(--muted-foreground) hover:bg-(--accent)"
                  onClick={toggleMenu}
                >
                  <MoreHorizontal size={12} />
                </button>
              )}
            >
              {(close) => (
                <>
                  <MenuItem
                    onSelect={() => {
                      close()
                      createPage.mutate({ parentId: node.id })
                    }}
                  >
                    {t('workspace:tree.addChild')}
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      close()
                      const title = window.prompt(t('workspace:sidebar.renameTitle'), node.title)
                      if (title !== null) {
                        void pageApi
                          .patch(workspaceId, node.id, { title })
                          .then(invalidate)
                      }
                    }}
                  >
                    {t('workspace:tree.rename')}
                  </MenuItem>
                  <MenuItem
                    onSelect={() => {
                      close()
                      void navigator.clipboard
                        .writeText(`${location.origin}/${workspaceId}/page/${node.id}`)
                        .catch(() => {})
                    }}
                  >
                    {t('workspace:tree.copyLink')}
                  </MenuItem>
                  <MenuItem
                    danger
                    onSelect={() => {
                      close()
                      trash.mutate(node.id)
                    }}
                  >
                    {t('workspace:tree.moveToTrash')}
                  </MenuItem>
                </>
              )}
            </Menu>
          </span>

          {(hint === 'before' || hint === 'after') && (
            <span
              className="pointer-events-none absolute right-0 left-4 h-0.5 bg-(--primary)"
              style={hint === 'before' ? { top: -1 } : { bottom: -1 }}
            />
          )}
        </div>

        {hasChildren && !isCollapsed && (
          <div>{node.children.map((child) => renderNode(child, depth + 1))}</div>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-4">
      {nodes.length === 0 && (
        <div className="px-1.5 py-1 text-[12px] text-(--text-tertiary)">{t('common:empty')}</div>
      )}
      {nodes.map((node) => renderNode(node, 0))}
    </div>
  )
}
