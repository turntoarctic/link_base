/**
 * 路由表（06 §2）：/login /register /invite/:token 公开；/:workspaceId 工作空间壳
 * （编辑器 Provider 层挂壳上，切页不卸载）；语言不进 URL（13 §1）。
 *
 * 用声明式路由（BrowserRouter + Routes）：v6/v7/v8 全系稳定 API，
 * 避免 data-router 的 RouterProvider DOM 入口差异；lazy 页面统一有 Suspense 加载态，
 * 组件崩溃有 ErrorBoundary 兜底——任何一处失败都不再是白屏。
 */
import { Component, lazy, Suspense, type ReactNode } from 'react'
import { BrowserRouter, Navigate, Outlet, Route, Routes } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import i18next from 'i18next'
import { authApi } from '@/lib/api'
import { getAccessToken } from '@/lib/fetch'
import { RouteLoading } from '@/app/route-loading'
import { WorkspaceLayout } from '@/features/workspace/workspace-layout'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const RegisterPage = lazy(() => import('@/features/auth/register-page'))
const InvitePage = lazy(() => import('@/features/auth/invite-page'))
const WorkspaceIndexPage = lazy(() => import('@/features/workspace/workspace-index-page'))
const EditorPage = lazy(() => import('@/features/editor/editor-page'))
const TrashPage = lazy(() => import('@/features/trash/trash-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))
const SharePage = lazy(() => import('@/features/share/share-page'))

/** 全局错误兜底：任何路由组件崩溃都给出可见信息 + 重载，不白屏 */
class RouteErrorBoundary extends Component<{ children: ReactNode }, { error: Error | null }> {
  state = { error: null as Error | null }

  static getDerivedStateFromError(error: Error) {
    return { error }
  }

  render() {
    if (this.state.error) {
      return (
        <div className="flex min-h-screen flex-col items-center justify-center gap-3 px-4 py-10 text-center">
          {/* 错误兜底早于 React 树，直用 i18next 单例取文案 */}
          <div className="text-[15px] font-medium">{i18next.t('common:pageError')}</div>
          <div className="max-w-[480px] font-mono text-[12px] break-all text-muted-foreground">
            {this.state.error.message}
          </div>
          {/* 开发期保留堆栈定位；P1 收起为详情折叠 */}
          <pre className="max-h-[300px] max-w-[720px] overflow-auto rounded-md bg-(--secondary) p-3 text-left font-mono text-[11px] whitespace-pre-wrap text-(--muted-foreground)">
            {this.state.error.stack?.slice(0, 2500) ?? '(no stack)'}
          </pre>
          <button
            type="button"
            className="h-8 rounded-md bg-(--primary) px-3 text-[13px] text-white"
            onClick={() => location.reload()}
          >
            {i18next.t('common:reload')}
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

/** 有会话 → 最近工作空间；无会话/查询失败/空间列表为空 → /login（判定统一收口，不卡 null） */
function RootRedirect() {
  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: Infinity, retry: 1 })
  if (me.isPending) return <RouteLoading />
  const firstWs = me.data?.workspaces[0]
  if (me.isError || !firstWs) return <Navigate to="/login" replace />
  return <Navigate to={`/${firstWs.id}`} replace />
}

function RequireAuth() {
  if (!getAccessToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

export function App() {
  return (
    <BrowserRouter>
      <RouteErrorBoundary>
        <Suspense fallback={<RouteLoading />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
            <Route path="/invite/:token" element={<InvitePage />} />
        <Route path="/share/:slug" element={<SharePage />} />
            <Route element={<RequireAuth />}>
              <Route path="/:workspaceId" element={<WorkspaceLayout />}>
                <Route index element={<WorkspaceIndexPage />} />
                <Route path="page/:pageId" element={<EditorPage />} />
                <Route path="trash" element={<TrashPage />} />
                <Route path="settings/*" element={<SettingsPage />} />
              </Route>
            </Route>
            <Route path="/" element={<RootRedirect />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </Suspense>
      </RouteErrorBoundary>
    </BrowserRouter>
  )
}
