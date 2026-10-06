/**
 * 侧边栏（06 §5.4/§5.5）：空间切换、⌘K 搜索入口、收藏、页面树、标签、回收站、
 * 底部「＋ 新页面」与用户菜单（设置/主题/语言/退出）。240px，可折叠。
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  ChevronRight,
  FileText,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Tags as TagsIcon,
  Trash2,
} from 'lucide-react'
import { authApi, pageApi, tagApi } from '@/lib/api'
import { clearTokens } from '@/lib/fetch'
import { changeLocale, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import { Menu, MenuItem } from '@/components/ui/menu'
import { LanguageSwitcher } from '@/components/language-switcher'
import { CommandPalette, openCommandPalette } from '@/features/search/command-palette'
import { PageTree } from './page-tree'
import { cn } from '@/lib/cn'

export function Sidebar({
  workspaceId,
  workspaceName,
  workspaces,
}: {
  workspaceId: string
  workspaceName: string
  workspaces: Array<{ id: string; name: string; role: string }>
}) {
  const { t } = useTranslation(['workspace', 'common'])
  const navigate = useNavigate()
  const queryClient = useQueryClient()
  const user = useAuthStore((s) => s.user)
  const setUser = useAuthStore((s) => s.setUser)
  const collapsed = useUiStore((s) => s.sidebarCollapsed)
  const toggleSidebar = useUiStore((s) => s.toggleSidebar)
  const theme = useUiStore((s) => s.theme)
  const setTheme = useUiStore((s) => s.setTheme)
  const [tagsOpen, setTagsOpen] = useState(true)

  const tree = useQuery({ queryKey: ['pages', workspaceId], queryFn: () => pageApi.tree(workspaceId) })
  const favorites = useQuery({
    queryKey: ['favorites', workspaceId],
    queryFn: () => pageApi.favorites(workspaceId),
  })
  const tags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => tagApi.list(workspaceId) })

  const createPage = useMutation({
    mutationFn: () => pageApi.create(workspaceId, {}),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: ['pages', workspaceId] })
      navigate(`/${workspaceId}/page/${page.id}`)
    },
  })

  return (
    <aside
      className={cn(
        'flex h-full shrink-0 flex-col border-r border-(--sidebar-border) bg-(--sidebar) text-[13px] text-(--sidebar-foreground) transition-[width] duration-200',
        collapsed ? 'w-0 overflow-hidden' : 'w-(--width-sidebar)',
      )}
    >
      {/* 空间切换 */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <Menu
          align="start"
          className="w-[220px]"
          trigger={(_open, toggle) => (
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded px-1.5 py-1.5 hover:bg-(--sidebar-accent)"
              onClick={toggle}
            >
              <span className="truncate font-medium">{workspaceName || 'Linkbase'}</span>
              <ChevronRight size={13} className="rotate-90 text-(--muted-foreground)" />
            </button>
          )}
        >
          {(close) => (
            <>
              {workspaces.map((ws) => (
                <MenuItem
                  key={ws.id}
                  onSelect={() => {
                    close()
                    navigate(`/${ws.id}`)
                  }}
                >
                  {ws.id === workspaceId ? '● ' : '○ '}
                  {ws.name}
                </MenuItem>
              ))}
            </>
          )}
        </Menu>
        <button
          type="button"
          aria-label="toggle sidebar"
          className="rounded p-1 text-(--muted-foreground) hover:bg-(--sidebar-accent)"
          onClick={toggleSidebar}
        >
          <MenuIcon size={15} />
        </button>
      </div>

      {/* ⌘K 搜索 */}
      <div className="px-2 pt-1">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded px-1.5 py-1.5 text-(--muted-foreground) hover:bg-(--sidebar-accent)"
          onClick={() => openCommandPalette()}
        >
          <Search size={14} />
          <span className="flex-1 truncate text-left">{t('workspace:sidebar.searchPlaceholder')}</span>
        </button>
      </div>

      <div className="mt-1 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* 收藏 */}
        <Section title={t('workspace:sidebar.favorites')}>
          {favorites.data && favorites.data.length === 0 && (
            <div className="px-1.5 py-1 text-[12px] text-(--text-tertiary)">
              {t('workspace:sidebar.favoritesEmpty')}
            </div>
          )}
          {favorites.data?.map((page) => (
            <TreeLink key={page.id} workspaceId={workspaceId} pageId={page.id} title={page.title} icon={page.icon} />
          ))}
        </Section>

        {/* 页面树 */}
        <Section title={t('workspace:sidebar.pages')}>
          <PageTree nodes={tree.data ?? []} />
        </Section>

        {/* 标签聚合 */}
        <button
          type="button"
          className="mt-1 flex w-full items-center gap-1 rounded px-1.5 py-1 font-medium text-(--muted-foreground) hover:bg-(--sidebar-accent)"
          onClick={() => setTagsOpen((o) => !o)}
        >
          <ChevronRight size={12} className={cn('transition-transform', tagsOpen && 'rotate-90')} />
          <TagsIcon size={13} />
          {t('workspace:sidebar.tags')}
        </button>
        {tagsOpen && (
          <div className="ml-3">
            {tags.data && tags.data.length === 0 && (
              <div className="px-1.5 py-1 text-[12px] text-(--text-tertiary)">{t('workspace:tags.empty')}</div>
            )}
            {tags.data?.map((tag) => (
              <Link
                key={tag.id}
                to={`/${workspaceId}/settings/tags`}
                className="block rounded px-1.5 py-1 hover:bg-(--sidebar-accent)"
              >
                <span
                  className="mr-1.5 inline-block h-2 w-2 rounded-full align-middle"
                  style={{ background: `var(--tag-${tag.color}-bg)` }}
                />
                {tag.name}
              </Link>
            ))}
          </div>
        )}

        {/* 回收站 */}
        <div className="mt-1">
          <Link
            to={`/${workspaceId}/trash`}
            className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-(--sidebar-accent)"
          >
            <Trash2 size={13} className="text-(--muted-foreground)" />
            {t('workspace:sidebar.trash')}
          </Link>
        </div>
      </div>

      {/* 底部：新页面 + 用户菜单 */}
      <div className="border-t border-(--sidebar-border) px-2 py-2">
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 hover:bg-(--sidebar-accent)"
          onClick={() => createPage.mutate()}
        >
          <Plus size={14} />
          {t('workspace:sidebar.newPage')}
        </button>
        <Menu
          align="start"
          className="w-[220px]"
          trigger={(_open, toggle) => (
            <button
              type="button"
              className="flex w-full items-center gap-1.5 rounded px-1.5 py-1.5 hover:bg-(--sidebar-accent)"
              onClick={toggle}
            >
              <span className="flex h-5 w-5 items-center justify-center rounded-full bg-(--primary) text-[10px] text-white">
                {(user?.name ?? '?').slice(0, 1).toUpperCase()}
              </span>
              <span className="truncate">{user?.name}</span>
            </button>
          )}
        >
          {(close) => (
            <>
              <MenuItem
                onSelect={() => {
                  close()
                  navigate(`/${workspaceId}/settings/general`)
                }}
              >
                <SettingsIcon size={13} /> {t('common:settings')}
              </MenuItem>
              <div className="flex items-center justify-between px-2 py-1 text-[12px]">
                <span className="text-(--muted-foreground)">{t('common:theme')}</span>
                <select
                  className="rounded border border-(--input) bg-(--popover) px-1 py-0.5"
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
                >
                  <option value="light">{t('common:themeLight')}</option>
                  <option value="dark">{t('common:themeDark')}</option>
                  <option value="system">{t('common:themeSystem')}</option>
                </select>
              </div>
              <div className="px-2 py-1.5">
                <LanguageSwitcher
                  onChange={(locale: AppLocale) => {
                    void changeLocale(locale)
                    void authApi.patchMe({ locale }).catch(() => {})
                  }}
                />
              </div>
              <MenuItem
                danger
                onSelect={() => {
                  void authApi.logout(localStorage.getItem('linkbase.refreshToken') ?? '')
                  clearTokens()
                  setUser(null)
                  navigate('/login')
                }}
              >
                <LogOut size={13} /> {t('common:logout')}
              </MenuItem>
            </>
          )}
        </Menu>
      </div>

      <CommandPalette workspaceId={workspaceId} />
    </aside>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mt-1">
      <div className="px-1.5 py-1 font-medium text-(--muted-foreground)">{title}</div>
      {children}
    </div>
  )
}

function TreeLink({
  workspaceId,
  pageId,
  title,
  icon,
}: {
  workspaceId: string
  pageId: string
  title: string
  icon: string | null
}) {
  const { t } = useTranslation('common')
  return (
    <Link
      to={`/${workspaceId}/page/${pageId}`}
      className="flex items-center gap-1.5 rounded px-1.5 py-1 hover:bg-(--sidebar-accent)"
    >
      <FileText size={13} className="shrink-0 text-(--muted-foreground)" />
      <span className="truncate">{title || t('untitled')}</span>
    </Link>
  )
}
