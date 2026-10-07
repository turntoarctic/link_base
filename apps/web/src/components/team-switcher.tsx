/**
 * 空间切换器（sidebar-07 TeamSwitcher 骨架接真实空间）：
 * BrandMark 徽标 + 空间名，下拉列出全部空间（当前高亮），底部「新建空间」弹命名对话框。
 */
import * as React from "react";
import { useNavigate } from "react-router";
import { useTranslation } from "react-i18next";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, ChevronsUpDown, Plus, Settings } from "lucide-react";
import { toast } from "sonner";
import { workspaceApi } from "@/lib/api";
import { BrandMark } from "@/components/brand-mark";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/components/ui/sidebar";

export function TeamSwitcher({
  workspaceId,
  workspaceName,
  workspaces,
}: {
  workspaceId: string;
  workspaceName: string;
  workspaces: Array<{ id: string; name: string }>;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("common");

  // 新建空间：先命名（对话框），再创建
  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");

  const createWorkspace = useMutation({
    mutationFn: () => workspaceApi.create(name.trim()),
    onSuccess: async (ws) => {
      setCreating(false);
      setName("");
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      navigate("/" + ws.id);
    },
    onError: () => toast.error(t("newWorkspaceFailed")),
  });

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              tooltip={workspaceName || "Linkbase"}
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
            >
              <span className="flex aspect-square size-8 shrink-0 items-center justify-center rounded-lg bg-(--secondary)">
                <BrandMark size={20} />
              </span>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">
                  {workspaceName || "Linkbase"}
                </span>
              </div>
              <ChevronsUpDown className="ml-auto size-4" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-(--radix-dropdown-menu-trigger-width) min-w-56 rounded-lg p-1.5"
            align="start"
          >
            <DropdownMenuLabel className="px-2 py-1.5 text-[11px] font-medium text-(--muted-foreground)">
              {t("workspace")}
            </DropdownMenuLabel>
            {workspaces.map((ws) => {
              const active = ws.id === workspaceId;
              return (
                <DropdownMenuItem
                  key={ws.id}
                  className={"gap-2 rounded-md px-2 " + (active ? "bg-(--sidebar-accent)" : "")}
                  onSelect={() => {
                    if (!active) navigate("/" + ws.id);
                  }}
                >
                  <span className="flex aspect-square size-6 shrink-0 items-center justify-center rounded bg-(--secondary)">
                    <BrandMark size={12} />
                  </span>
                  <span className="min-w-0 flex-1 truncate font-medium">
                    {ws.name}
                  </span>
                  {active && <Check className="size-4 shrink-0" />}
                </DropdownMenuItem>
              );
            })}
            <DropdownMenuSeparator className="my-1.5" />
            <DropdownMenuItem
              className="gap-2 rounded-md px-2 text-(--muted-foreground)"
              onSelect={() => {
                setName("");
                setCreating(true);
              }}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-dashed border-(--border)">
                <Plus size={12} />
              </span>
              {t("newWorkspace")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="gap-2 rounded-md px-2 text-(--muted-foreground)"
              onSelect={() => navigate("/" + workspaceId + "/manage")}
            >
              <span className="flex size-6 shrink-0 items-center justify-center rounded border border-(--border)">
                <Settings size={12} />
              </span>
              {t("manageWorkspace")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>

      {/* 新建空间：命名对话框 */}
      <Dialog open={creating} onOpenChange={setCreating}>
        <DialogContent className="max-w-sm rounded-lg">
          <DialogHeader>
            <DialogTitle>{t("newWorkspace")}</DialogTitle>
            <DialogDescription>{t("newWorkspaceHint")}</DialogDescription>
          </DialogHeader>
          <Input
            autoFocus
            placeholder={t("newWorkspaceNamePlaceholder")}
            value={name}
            maxLength={50}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && name.trim()) createWorkspace.mutate();
            }}
          />
          <DialogFooter>
            <Button variant="ghost" size="sm" onClick={() => setCreating(false)}>
              {t("cancel")}
            </Button>
            <Button
              size="sm"
              disabled={!name.trim() || createWorkspace.isPending}
              onClick={() => createWorkspace.mutate()}
            >
              {t("create")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </SidebarMenu>
  );
}
