/**
 * 空间管理页（/:workspaceId/manage）：列出「我创建的」（role=owner）全部空间，
 * 逐个重命名 / 删除（确认后删除，FK 级联清成员与页面；删除当前空间由壳层自动跳转）。
 * 非本人创建的空间不在此列（只有 owner 能删/改）。
 */
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { authApi, workspaceApi } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoading } from "@/app/route-loading";

export default function WorkspaceManagePage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation(["workspace", "common"]);

  const me = useQuery({ queryKey: ["me"], queryFn: authApi.me, staleTime: 60_000 });
  const owned = (me.data?.workspaces ?? []).filter((w) => w.role === "owner");

  if (me.isPending) return <RouteLoading />;

  return (
    <div className="mx-auto w-full max-w-(--width-content) px-6 py-8">
      <div className="mb-5">
        <h1 className="text-xl font-bold">{t("common:manageWorkspace")}</h1>
        <p className="mt-1 text-[13px] text-(--text-tertiary)">
          {t("workspace:settings.manageIntro")}
        </p>
      </div>

      <div className="overflow-hidden rounded-xl border border-(--border) bg-(--card) shadow-xs">
        {owned.length === 0 && (
          <div className="px-4 py-10 text-center text-[13px] text-(--text-tertiary)">
            {t("workspace:settings.manageEmpty")}
          </div>
        )}
        {owned.map((ws) => (
          <ManageRow key={ws.id} workspaceId={ws.id} name={ws.name} />
        ))}
      </div>
    </div>
  );
}

function ManageRow({ workspaceId, name }: { workspaceId: string; name: string }) {
  const { t } = useTranslation(["workspace", "common"]);
  const navigate = useNavigate();
  const { workspaceId: currentWsId = "" } = useParams();
  const queryClient = useQueryClient();
  const [value, setValue] = useState(name);

  useEffect(() => setValue(name), [name]);

  const invalidate = async () => {
    await queryClient.invalidateQueries({ queryKey: ["me"] });
    void queryClient.invalidateQueries({ queryKey: ["ws", workspaceId] });
  };

  const rename = useMutation({
    mutationFn: () => workspaceApi.patch(workspaceId, { name: value.trim() }),
    onSuccess: () => {
      void invalidate();
    },
    onError: () => toast.error(t("common:operationFailed")),
  });

  const remove = useMutation({
    mutationFn: () => workspaceApi.remove(workspaceId),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["me"] });
      // 删除当前空间：壳层 effect 会自动跳第一个剩余空间；删的是别的空间则原地不动。
      // 若删光了所有空间，跳根路由交给无空间兜底页。
      if (workspaceId === currentWsId) {
        const me = await authApi.me().catch(() => null);
        const rest = me?.workspaces ?? [];
        if (rest.length === 0) navigate("/", { replace: true });
      }
    },
    onError: () => toast.error(t("common:operationFailed")),
  });

  const dirty = value.trim() !== "" && value.trim() !== name;

  return (
    <div className="flex h-14 items-center gap-2 border-b border-(--border) px-4 last:border-b-0">
      <span className="flex aspect-square size-6 shrink-0 items-center justify-center rounded bg-(--secondary)">
        <span className="text-[10px] font-bold text-(--muted-foreground)">
          {name.slice(0, 1).toUpperCase()}
        </span>
      </span>
      <Input
        className="h-8 max-w-[280px]"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && dirty) rename.mutate();
        }}
      />
      <Button
        size="sm"
        variant="secondary"
        disabled={!dirty || rename.isPending}
        onClick={() => rename.mutate()}
      >
        {t("workspace:settings.saveName")}
      </Button>
      <div className="flex-1" />
      <Button
        size="sm"
        variant="destructive"
        disabled={remove.isPending}
        onClick={() => {
          if (window.confirm(t("workspace:settings.deleteConfirm", { name }))) {
            remove.mutate();
          }
        }}
      >
        {t("workspace:settings.deleteWorkspace")}
      </Button>
    </div>
  );
}
