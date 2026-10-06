/**
 * ⌘K 命令面板（P0-11）：快速跳页 / 搜索 / 新建三合一（06 §5.5：居中 640px 浮层）。
 * 输入即搜（标题+正文），↑↓ 选择，⏎ 打开，⏎ 新建名为关键词的页面（无结果置顶）。
 */
import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useNavigate } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CornerDownLeft, FileText, Plus, Search } from 'lucide-react'
import { pageApi, searchApi } from '@/lib/api'
import { Kbd } from '@/components/ui/primitives'

let opener: (() => void) | null = null

/** 侧边栏搜索按钮等外部入口 */
export function openCommandPalette(): void {
  opener?.()
}

export function CommandPalette({ workspaceId }: { workspaceId: string }) {
  const { t } = useTranslation('workspace')
  const navigate = useNavigate()
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    opener = () => setOpen(true)
    return () => {
      opener = null
    }
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault()
        setOpen((o) => !o)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  useEffect(() => {
    if (open) {
      setQuery('')
      setActive(0)
      setTimeout(() => inputRef.current?.focus(), 0)
    }
  }, [open])

  // 输入即搜（150ms 去抖）
  const [debounced, setDebounced] = useState('')
  useEffect(() => {
    const timer = setTimeout(() => setDebounced(query), 150)
    return () => clearTimeout(timer)
  }, [query])

  const results = useQuery({
    queryKey: ['search', workspaceId, debounced],
    queryFn: ({ signal }) => searchApi.search(workspaceId, debounced, signal),
    enabled: open && debounced.trim().length > 0,
  })

  const items: Array<
    | { kind: 'page'; id: string; title: string; breadcrumb: string[] }
    | { kind: 'create'; title: string }
  > = []
  if (debounced.trim()) {
    for (const item of results.data ?? []) {
      items.push({ kind: 'page', id: item.id, title: item.title, breadcrumb: item.breadcrumb })
    }
  }
  if (items.length === 0 && debounced.trim()) {
    items.push({ kind: 'create', title: debounced.trim() })
  }

  const choose = (index: number) => {
    const item = items[index]
    if (!item) return
    setOpen(false)
    if (item.kind === 'page') {
      navigate(`/${workspaceId}/page/${item.id}`)
      return
    }
    void pageApi.create(workspaceId, { title: item.title }).then((page) => {
      navigate(`/${workspaceId}/page/${page.id}`)
    })
  }

  if (!open) return null

  return createPortal(
    <div
      className="fixed inset-0 z-[300] flex items-start justify-center bg-black/30 pt-[14vh]"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) setOpen(false)
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        className="w-[640px] max-w-[calc(100vw-32px)] overflow-hidden rounded-lg border border-(--border) bg-(--popover) text-(--popover-foreground) shadow-(--shadow-modal)"
      >
        <div className="flex items-center gap-2.5 border-b border-(--border) px-4">
          <Search size={15} className="shrink-0 text-(--muted-foreground)" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setActive(0)
            }}
            placeholder={t('search.placeholder')}
            className="h-12 flex-1 border-0 bg-transparent text-[15px] outline-none placeholder:text-(--text-tertiary)"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') {
                e.preventDefault()
                setActive((i) => (i + 1) % Math.max(items.length, 1))
              } else if (e.key === 'ArrowUp') {
                e.preventDefault()
                setActive((i) => (i - 1 + Math.max(items.length, 1)) % Math.max(items.length, 1))
              } else if (e.key === 'Enter') {
                e.preventDefault()
                choose(active)
              } else if (e.key === 'Escape') {
                setOpen(false)
              }
            }}
          />
          <Kbd>esc</Kbd>
        </div>

        <div className="max-h-[320px] overflow-y-auto p-1.5">
          {items.length === 0 && !debounced.trim() && (
            <div className="px-3 py-8 text-center text-[13px] text-(--muted-foreground)">
              {t('search.placeholder')}
            </div>
          )}
          {items.length === 0 && debounced.trim() && results.isPending && (
            <div className="px-3 py-8 text-center text-[13px] text-(--muted-foreground)">…</div>
          )}
          {items.map((item, index) => (
            <button
              key={item.kind === 'page' ? item.id : `create:${item.title}`}
              type="button"
              className={
                'flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[14px] transition-colors ' +
                (index === active ? 'bg-(--muted)' : '')
              }
              onMouseEnter={() => setActive(index)}
              onClick={() => choose(index)}
            >
              {item.kind === 'page' ? (
                <>
                  <FileText size={15} className="shrink-0 text-(--muted-foreground)" />
                  <span className="min-w-0 flex-1 truncate">
                    {item.title || t('common:untitled', { ns: 'common' })}
                  </span>
                  {item.breadcrumb.length > 0 && (
                    <span className="max-w-[200px] shrink-0 truncate text-[12px] text-(--text-tertiary)">
                      {item.breadcrumb.join(' / ')}
                    </span>
                  )}
                </>
              ) : (
                <>
                  <Plus size={15} className="shrink-0 text-(--primary)" />
                  <span className="text-(--primary)">{t('search.newPage', { title: item.title })}</span>
                </>
              )}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-4 border-t border-(--border) px-4 py-2 text-[11px] text-(--text-tertiary)">
          <span className="flex items-center gap-1">
            <Kbd>↑</Kbd>
            <Kbd>↓</Kbd>
          </span>
          <span className="flex items-center gap-1">
            <Kbd>
              <CornerDownLeft size={10} />
            </Kbd>
            {t('search.hint')}
          </span>
        </div>
      </div>
    </div>,
    document.body,
  )
}
