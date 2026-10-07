/**
 * 工作空间侧边栏（sidebar-07 块骨架 + 真实功能）：
 * TeamSwitcher 头部（空间切换）/ ⌘K 搜索 / 回收站 / 通知铃 / 收藏 / 页面树 / 标签；
 * 底部 NavUser（用户菜单含空间列表）；collapsible="icon" 折叠到图标栏 + SidebarRail。
 */
import * as React from "react";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import {
  Bell,
  ChevronRight,
  FileText,
  Plus,
  Search,
  Star,
  Tags as TagsIcon,
  Trash2,
} from "lucide-react";
import { pageApi, tagApi } from "@/lib/api";
import { useAuthStore } from "@/stores/auth";
import { NavUser } from "@/components/nav-user";
import { TeamSwitcher } from "@/components/team-switcher";
import {
  CommandPalette,
  openCommandPalette,
} from "@/features/search/command-palette";
import { PageTree } from "@/features/workspace/sidebar/page-tree";
import { Kbd } from "@/components/ui/primitives";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarGroupLabel,
} from "@/components/ui/sidebar";

type Workspaces = Array<{ id: string; name: string; role: string }>;

export function AppSidebar({
  workspaceId,
  workspaceName,
  workspaces,
  ...props
}: {
  workspaceId: string;
  workspaceName: string;
  workspaces: Workspaces;
} & React.ComponentProps<typeof Sidebar>) {
  const { t } = useTranslation(["workspace", "common"]);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { pageId: activePageId } = useParams();
  const user = useAuthStore((s) => s.user);

  // 页面树组开合：默认跟随「是否定位到某文档」（定位=展开）；用户手动开合优先，
  // 切换目标文档时重置回自动（保证从标签页等入口跳进文档时组是展开的）
  const [pagesOpenOverride, setPagesOpenOverride] = React.useState<
    boolean | null
  >(null);
  useEffect(() => setPagesOpenOverride(null), [activePageId]);
  const pagesOpen = pagesOpenOverride ?? activePageId != null;

  const tree = useQuery({
    queryKey: ["pages", workspaceId],
    queryFn: () => pageApi.tree(workspaceId),
  });
  const favorites = useQuery({
    queryKey: ["favorites", workspaceId],
    queryFn: () => pageApi.favorites(workspaceId),
  });
  const tags = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => tagApi.list(workspaceId),
  });
  const templates = useQuery({
    queryKey: ["templates", workspaceId],
    queryFn: () => pageApi.templates(workspaceId),
    staleTime: 300_000,
  });
  const templatesData = templates.data;

  const createPage = useMutation({
    mutationFn: (input: { templateId?: string | null } | undefined) =>
      pageApi.create(
        workspaceId,
        input?.templateId ? { templateId: input.templateId } : {},
      ),
    onSuccess: (page) => {
      void queryClient.invalidateQueries({ queryKey: ["pages", workspaceId] });
      navigate(`/${workspaceId}/page/${page.id}`);
    },
  });

  return (
    <Sidebar collapsible="icon" {...props}>
      <SidebarHeader>
        <TeamSwitcher
          workspaceId={workspaceId}
          workspaceName={workspaceName}
          workspaces={workspaces}
        />
      </SidebarHeader>
      <SidebarContent className="overflow-hidden!">
        {/* ⌘K 搜索 */}
        <SidebarGroup>
          <SidebarGroupContent>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  tooltip={t("workspace:sidebar.searchPlaceholder")}
                  onClick={() => openCommandPalette()}
                >
                  <Search />
                  <span className="truncate">
                    {t("workspace:sidebar.searchPlaceholder")}
                  </span>
                  <Kbd className="ml-auto group-data-[collapsible=icon]:hidden">
                    ⌘K
                  </Kbd>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={t("workspace:sidebar.trash")}
                >
                  <Link to={"/" + workspaceId + "/trash"}>
                    <Trash2 />
                    <span>{t("workspace:sidebar.trash")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
              <SidebarMenuItem>
                <SidebarMenuButton
                  asChild
                  tooltip={t("workspace:sidebar.tags")}
                >
                  <Link to={"/" + workspaceId + "/tags"}>
                    <TagsIcon />
                    <span>{t("workspace:sidebar.tags")}</span>
                  </Link>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* 页面树：默认折叠；标题行=触发器（箭头+图标+标题+＋），＋ 已 stopPropagation */}
        <Collapsible
          open={pagesOpen}
          onOpenChange={setPagesOpenOverride}
          className="group/collapsible min-h-0 flex-1"
        >
          <SidebarGroup className="group/pages min-h-0 group-data-[collapsible=icon]:hidden">
            <SidebarGroupLabel asChild>
              <CollapsibleTrigger className="group/label flex h-7 w-full cursor-pointer items-center gap-1 rounded-md pr-1 pl-0.5 transition-colors hover:bg-(--sidebar-accent)">
                <ChevronRight
                  size={12}
                  className="shrink-0 text-(--muted-foreground) transition-transform duration-150 group-data-[state=open]/collapsible:rotate-90"
                />
                <FileText size={13} className="shrink-0" />
                <span className="min-w-0 flex-1 truncate text-left text-[12px] font-medium text-(--muted-foreground)">
                  {t("workspace:sidebar.pages")}
                </span>
                <button
                  type="button"
                  title={t("workspace:sidebar.newPage")}
                  onClick={(e) => {
                    e.stopPropagation();
                    createPage.mutate({ templateId: null });
                  }}
                  className="z-10 flex size-5 shrink-0 items-center justify-center rounded-md text-(--muted-foreground) transition-colors hover:bg-(--sidebar-accent) hover:text-(--sidebar-foreground)"
                >
                  <Plus size={13} />
                  <span className="sr-only">
                    {t("workspace:sidebar.newPage")}
                  </span>
                </button>
              </CollapsibleTrigger>
            </SidebarGroupLabel>
            <CollapsibleContent>
              <SidebarGroupContent className="min-h-0 overflow-y-auto">
                <PageTree nodes={tree.data ?? []} />
              </SidebarGroupContent>
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>
      </SidebarContent>

      <SidebarFooter>
        <NavUser
          user={{
            name: user?.name ?? "",
            email: user?.email ?? "",
            avatarUrl: user?.avatarUrl ?? null,
          }}
          workspaceId={workspaceId}
          workspaces={workspaces}
          onSwitchWorkspace={(id) => navigate("/" + id)}
        />
      </SidebarFooter>

      {/* ⌘K 命令面板（行为照旧） */}
      <CommandPalette workspaceId={workspaceId} />
    </Sidebar>
  );
}
