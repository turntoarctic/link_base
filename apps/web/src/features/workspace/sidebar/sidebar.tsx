/**
 * 侧边栏（06 §5.4/§5.5）：空间切换、⌘K 搜索入口、收藏、页面树、标签、回收站、
 * 底部「＋ 新页面」与用户菜单（设置/主题/语言/退出）。240px，可折叠。
 */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import {
  Check,
  ChevronRight,
  FileText,
  LogOut,
  Menu as MenuIcon,
  Plus,
  Search,
  Settings as SettingsIcon,
  Star,
  Tags as TagsIcon,
  Trash2,
} from 'lucide-react'
import { authApi, pageApi, tagApi } from '@/lib/api'
import { clearTokens } from '@/lib/fetch'
import { changeLocale, type AppLocale } from '@/i18n'
import { useAuthStore } from '@/stores/auth'
import { useUiStore } from '@/stores/ui'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Avatar, Kbd, Separator } from '@/components/ui/primitives'
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
        'flex h-full shrink-0 flex-col overflow-hidden border-r border-(--sidebar-border) bg-(--sidebar) text-[13px] text-(--sidebar-foreground) transition-[width] duration-200 ease-out',
        collapsed ? 'w-0' : 'w-(--width-sidebar)',
      )}
    >
      {/* 空间切换（Notion 式顶栏） */}
      <div className="flex items-center gap-1 px-2 pt-2">
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex min-w-0 flex-1 items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent"
            >
              <span className="truncate font-medium">{workspaceName || 'Linkbase'}</span>
              <ChevronRight size={13} className="ml-auto shrink-0 rotate-90 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" className="w-[220px]">
            <DropdownMenuLabel>{t('common:workspace')}</DropdownMenuLabel>
            {workspaces.map((ws) => (
              <DropdownMenuItem key={ws.id} onSelect={() => navigate(`/${ws.id}`)}>
                <span className="w-3.5">
                  {ws.id === workspaceId && <Check size={13} className="text-(--primary)" />}
                </span>
                <span className="truncate">{ws.name}</span>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
        <button
          type="button"
          aria-label="toggle sidebar"
          className="rounded-md p-1.5 text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent) hover:text-(--sidebar-foreground)"
          onClick={toggleSidebar}
        >
          <MenuIcon size={15} />
        </button>
      </div>

      {/* ⌘K 搜索 */}
      <div className="px-2 pt-1.5">
        <button
          type="button"
          className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent)"
          onClick={() => openCommandPalette()}
        >
          <Search size={14} />
          <span className="flex-1 truncate text-left">{t('workspace:sidebar.searchPlaceholder')}</span>
          <Kbd>⌘K</Kbd>
        </button>
      </div>

      <div className="mt-1.5 min-h-0 flex-1 overflow-y-auto px-2 pb-2">
        {/* 收藏 */}
        <Section title={t('workspace:sidebar.favorites')} icon={<Star size={12} />}>
          {favorites.data?.length === 0 && (
            <div className="px-1.5 py-1 text-[12px] text-(--text-tertiary)">
              {t('workspace:sidebar.favoritesEmpty')}
            </div>
          )}
          {favorites.data?.map((page) => (
            <TreeLink key={page.id} workspaceId={workspaceId} pageId={page.id} title={page.title} icon={page.icon} />
          ))}
        </Section>

        {/* 页面树 */}
        <Section title={t('workspace:sidebar.pages')} icon={<FileText size={12} />}>
          <PageTree nodes={tree.data ?? []} />
        </Section>

        {/* 标签聚合 */}
        <button
          type="button"
          className="mt-1.5 flex w-full items-center gap-1 rounded-md px-1.5 py-1 text-[11px] font-medium text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent)"
          onClick={() => setTagsOpen((o) => !o)}
        >
          <ChevronRight size={11} className={cn('transition-transform duration-150', tagsOpen && 'rotate-90')} />
          <TagsIcon size={12} />
          {t('workspace:sidebar.tags')}
        </button>
        {tagsOpen && (
          <div className="mt-0.5 ml-3">
            {tags.data?.length === 0 && (
              <div className="px-1.5 py-1 text-[12px] text-(--text-tertiary)">{t('workspace:tags.empty')}</div>
            )}
            {tags.data?.map((tag) => (
              <Link
                key={tag.id}
                to={`/${workspaceId}/settings?tab=tags`}
                className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-(--sidebar-accent)"
              >
                <span
                  className="size-2 shrink-0 rounded-full"
                  style={{ background: `var(--tag-${tag.color}-bg)` }}
                />
                <span className="truncate">{tag.name}</span>
              </Link>
            ))}
          </div>
        )}

        {/* 回收站 */}
        <Link
          to={`/${workspaceId}/trash`}
          className="mt-1.5 flex items-center gap-1.5 rounded-md px-1.5 py-1 text-[11px] font-medium text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent)"
        >
          <Trash2 size={12} />
          {t('workspace:sidebar.trash')}
        </Link>
      </div>

      {/* 底部：新页面 + 用户菜单 */}
      <div className="px-2 pt-1.5 pb-2">
        <Separator className="mb-1.5" />
        <button
          type="button"
          className="flex w-full items-center gap-1.5 rounded-md px-1.5 py-1.5 transition-colors hover:bg-(--sidebar-accent)"
          onClick={() => createPage.mutate()}
        >
          <Plus size={14} className="text-(--muted-foreground)" />
          {t('workspace:sidebar.newPage')}
        </button>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              className="flex w-full items-center gap-2 rounded-md px-1.5 py-1.5 transition-colors hover:bg-sidebar-accent"
            >
              <Avatar fallback={user?.name ?? '?'} className="size-5 text-[10px]" />
              <span className="min-w-0 flex-1 truncate text-left">{user?.name}</span>
              <ChevronRight size={12} className="shrink-0 rotate-90 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="start" side="top" className="w-[230px]">
            <DropdownMenuItem
              onSelect={() => navigate(`/${workspaceId}/settings?tab=general`)}
            >
              <SettingsIcon />
              {t('common:settings')}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span className="text-(--muted-foreground)">{t('common:theme')}</span>
              <select
                className="h-6 cursor-pointer rounded border border-(--input) bg-(--popover) px-1 text-[12px]"
                value={theme}
                onChange={(e) => setTheme(e.target.value as 'light' | 'dark' | 'system')}
              >
                <option value="light">{t('common:themeLight')}</option>
                <option value="dark">{t('common:themeDark')}</option>
                <option value="system">{t('common:themeSystem')}</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span className="text-(--muted-foreground)">{t('common:language')}</span>
              <LanguageSwitcher
                onChange={(locale: AppLocale) => {
                  void changeLocale(locale)
                  void authApi.patchMe({ locale }).catch(() => {})
                }}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void authApi.logout(localStorage.getItem('linkbase.refreshToken') ?? '')
                clearTokens()
                setUser(null)
                navigate('/login')
              }}
            >
              <LogOut />
              {t('common:logout')}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      <CommandPalette workspaceId={workspaceId} />
    </aside>
  )
}

function Section({
  title,
  icon,
  children,
}: {
  title: string
  icon?: React.ReactNode
  children: React.ReactNode
}) {
  return (
    <div className="mt-1.5">
      <div className="flex items-center gap-1 px-1.5 py-1 text-[11px] font-medium text-(--muted-foreground)">
        {icon}
        {title}
      </div>
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
      className="flex items-center gap-1.5 rounded-md px-1.5 py-1 transition-colors hover:bg-(--sidebar-accent)"
    >
      {icon ? (
        <span className="shrink-0 text-[12px]">{icon}</span>
      ) : (
        <FileText size={13} className="shrink-0 text-(--muted-foreground)" />
      )}
      <span className="truncate">{title || t('untitled')}</span>
    </Link>
  )
}
