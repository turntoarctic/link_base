/**
 * 工作空间壳（06 §2）：shadcn sidebar（sidebar-08 块）+ 内容 Outlet；编辑器 Provider 层挂在
 * 这里（05 §3，切页不卸载 DocManager），workspace 上下文（当前空间 + 角色）供子树消费。
 */
import { useEffect, type CSSProperties } from "react";
import { Outlet, useNavigate, useParams } from "react-router";
import { useQuery } from "@tanstack/react-query";
import { authApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { AppSidebar } from "@/components/app-sidebar";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";

export function WorkspaceLayout() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const setUser = useAuthStore((s) => s.setUser);

  const me = useQuery({
    queryKey: ["me"],
    queryFn: authApi.me,
    staleTime: 60_000,
  });

  // 会话失效或非成员访问：回登录页
  useEffect(() => {
    if (me.isError) navigate("/login", { replace: true });
  }, [me.isError, navigate]);

  // URL 空间不在我的空间列表（被移除/链接过期）→ 跳第一个
  useEffect(() => {
    if (!me.data) return;
    if (
      me.data.workspaces.length > 0 &&
      !me.data.workspaces.some((w) => w.id === workspaceId)
    ) {
      navigate("/" + me.data.workspaces[0]!.id, { replace: true });
    }
  }, [me.data, workspaceId, navigate]);

  useEffect(() => {
    if (me.data) setUser(me.data.user);
  }, [me.data, setUser]);

  // 编辑器内 ⌘B 是加粗快捷键：在 document 层截停冒泡的 mod+b，
  // 避免 sidebar 原语（window 层监听）把它当作「折叠侧栏」
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "b") {
        const el = e.target instanceof Element ? e.target : null;
        if (el?.closest('[contenteditable="true"], input, textarea')) {
          e.stopPropagation();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, []);

  const workspace = me.data?.workspaces.find((w) => w.id === workspaceId);

  return (
    <SidebarProvider
      className="h-svh overflow-hidden"
      style={{ "--sidebar-width": "15rem" } as CSSProperties}
    >
      <AppSidebar
        workspaceId={workspaceId}
        workspaceName={workspace?.name ?? ""}
        workspaces={me.data?.workspaces ?? []}
      />
      <SidebarInset className="relative min-w-0 overflow-hidden">
        {/* 内容区折叠开关（sidebar-07 官方位：页头左上） */}
        <SidebarTrigger className="absolute top-2 left-2 z-30 size-7 rounded-md border border-(--border) bg-(--popover) shadow-sm hover:bg-(--accent)" />
        <div className="min-h-0 flex-1 overflow-y-auto">
          <Outlet />
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
