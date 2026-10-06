/**
 * 路由表（06 §2）：/login /register /invite/:token 公开；/:workspaceId 工作空间壳
 * （编辑器 Provider 层挂壳上，切页不卸载）；语言不进 URL（13 §1）。
 */
import { lazy } from 'react'
import { Navigate, Outlet, RouterProvider, createBrowserRouter } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { getAccessToken } from '@/lib/fetch'
import { WorkspaceLayout } from '@/features/workspace/workspace-layout'

const LoginPage = lazy(() => import('@/features/auth/login-page'))
const RegisterPage = lazy(() => import('@/features/auth/register-page'))
const InvitePage = lazy(() => import('@/features/auth/invite-page'))
const WorkspaceIndexPage = lazy(() => import('@/features/workspace/workspace-index-page'))
const EditorPage = lazy(() => import('@/features/editor/editor-page'))
const TrashPage = lazy(() => import('@/features/trash/trash-page'))
const SettingsPage = lazy(() => import('@/features/settings/settings-page'))

/** 有会话 → 最近工作空间；无 → /login */
function RootRedirect() {
  const { data } = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: Infinity })
  if (!data) return null
  const ws = data.workspaces[0]
  return ws ? <Navigate to={`/${ws.id}`} replace /> : <Navigate to="/login" replace />
}

function RequireAuth() {
  if (!getAccessToken()) return <Navigate to="/login" replace />
  return <Outlet />
}

export const router = createBrowserRouter([
  { path: '/login', element: <LoginPage /> },
  { path: '/register', element: <RegisterPage /> },
  { path: '/invite/:token', element: <InvitePage /> },
  {
    element: <RequireAuth />,
    children: [
      {
        path: '/:workspaceId',
        element: <WorkspaceLayout />,
        children: [
          { index: true, element: <WorkspaceIndexPage /> },
          { path: 'page/:pageId', element: <EditorPage /> },
          { path: 'trash', element: <TrashPage /> },
          { path: 'settings/*', element: <SettingsPage /> },
        ],
      },
    ],
  },
  {
    path: '/',
    element: (
      <RequireAuth>
        <RootRedirect />
      </RequireAuth>
    ),
  },
  { path: '*', element: <Navigate to="/login" replace /> },
])

export function App() {
  return <RouterProvider router={router} />
}
