/**
 * 侧栏底部用户菜单（sidebar-07 nav-user 骨架填充真实会话）：
 * 工作空间切换 / 设置入口 / 主题切换 / 语言切换 / 退出登录（逻辑接 stores/auth + api）。
 */
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import {
  Check,
  ChevronsUpDown,
  LogOut,
  Settings as SettingsIcon,
} from "lucide-react";
import { authApi } from "@/lib/api";
import { clearTokens } from "@/lib/fetch";
import { changeLocale, type AppLocale } from "@/i18n";
import { useAuthStore } from "@/stores/auth";
import { useUiStore } from "@/stores/ui";
import { LanguageSwitcher } from "@/components/language-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";

export function NavUser({
  user,
  workspaceId,
  workspaces = [],
  onSwitchWorkspace,
}: {
  user: { name: string; email: string; avatarUrl: string | null };
  workspaceId: string;
  workspaces?: Array<{ id: string; name: string }>;
  onSwitchWorkspace?: (workspaceId: string) => void;
}) {
  const { isMobile } = useSidebar();
  const navigate = useNavigate();
  const { t } = useTranslation("common");
  const setUser = useAuthStore((s) => s.setUser);
  const theme = useUiStore((s) => s.theme);
  const setTheme = useUiStore((s) => s.setTheme);
  const initial = user.name ? user.name.slice(0, 1).toUpperCase() : "?";

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <Avatar className="size-8 rounded-lg">
                {user.avatarUrl && (
                  <AvatarImage src={user.avatarUrl} alt={user.name} />
                )}
                <AvatarFallback className="rounded-lg bg-(--primary) text-[11px] text-white">
                  {initial}
                </AvatarFallback>
              </Avatar>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{user.name}</span>
                <span className="truncate text-xs text-(--muted-foreground)">
                  {user.email}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg"
            side={isMobile ? "bottom" : "right"}
            align="end"
            sideOffset={4}
          >
            <DropdownMenuLabel className="p-0 font-normal">
              <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                <Avatar className="size-8 rounded-lg">
                  {user.avatarUrl && (
                    <AvatarImage src={user.avatarUrl} alt={user.name} />
                  )}
                  <AvatarFallback className="rounded-lg bg-(--primary) text-[11px] text-white">
                    {initial}
                  </AvatarFallback>
                </Avatar>
                <div className="grid flex-1 text-left text-sm leading-tight">
                  <span className="truncate font-medium">{user.name}</span>
                  <span className="truncate text-xs text-(--muted-foreground)">
                    {user.email}
                  </span>
                </div>
              </div>
            </DropdownMenuLabel>

            <DropdownMenuSeparator />
            <DropdownMenuItem
              onSelect={() =>
                navigate("/" + workspaceId + "/settings?tab=general")
              }
            >
              <SettingsIcon />
              {t("settings")}
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span className="text-(--muted-foreground)">{t("theme")}</span>
              <select
                className="h-6 cursor-pointer rounded border border-(--input) bg-(--popover) px-1 text-[12px]"
                value={theme}
                onChange={(e) =>
                  setTheme(e.target.value as "light" | "dark" | "system")
                }
              >
                <option value="light">{t("themeLight")}</option>
                <option value="dark">{t("themeDark")}</option>
                <option value="system">{t("themeSystem")}</option>
              </select>
            </div>
            <div className="flex items-center justify-between px-2 py-1.5 text-[12px]">
              <span className="text-(--muted-foreground)">{t("language")}</span>
              <LanguageSwitcher
                onChange={(locale: AppLocale) => {
                  void changeLocale(locale);
                  void authApi.patchMe({ locale }).catch(() => {});
                }}
              />
            </div>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                void authApi.logout(
                  localStorage.getItem("linkbase.refreshToken") ?? "",
                );
                clearTokens();
                setUser(null);
                navigate("/login");
              }}
            >
              <LogOut />
              {t("logout")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
