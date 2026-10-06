/**
 * 工作空间壳（06 §2）：侧边栏 + 内容 Outlet；编辑器 Provider 层挂在这里（05 §3，
 * 切页不卸载 DocManager），workspace 上下文（当前空间 + 角色）供子树消费。
 */
import { useEffect } from 'react'
import { Outlet, useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { authApi } from '@/lib/api'
import { useAuthStore } from '@/stores/auth'
import { Sidebar } from './sidebar/sidebar'

export function WorkspaceLayout() {
  const { workspaceId = '' } = useParams()
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)

  const me = useQuery({ queryKey: ['me'], queryFn: authApi.me, staleTime: 60_000 })

  // 会话失效或非成员访问：回登录页
  useEffect(() => {
    if (me.isError) navigate('/login', { replace: true })
  }, [me.isError, navigate])

  // URL 空间不在我的空间列表（被移除/链接过期）→ 跳第一个
  useEffect(() => {
    if (!me.data) return
    if (me.data.workspaces.length > 0 && !me.data.workspaces.some((w) => w.id === workspaceId)) {
      navigate(`/${me.data.workspaces[0]!.id}`, { replace: true })
    }
  }, [me.data, workspaceId, navigate])

  useEffect(() => {
    if (me.data) setUser(me.data.user)
  }, [me.data, setUser])

  const workspace = me.data?.workspaces.find((w) => w.id === workspaceId)

  return (
    <div className="flex h-screen overflow-hidden bg-(--background) text-(--foreground)">
      <Sidebar
        workspaceId={workspaceId}
        workspaceName={workspace?.name ?? ''}
        workspaces={me.data?.workspaces ?? []}
      />
      <main className="min-w-0 flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  )
}
