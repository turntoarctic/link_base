/**
 * 标签页（/:workspaceId/tags）：上方标签区（新增[名+8色板] / 删除[X 悬停浮现] / 点选过滤），
 * 下方为选中标签的文档列表（最近更新在前，点击进入页面）。
 * 样式：语义 token + 标签 8 色板；选中 = ring，悬停 = 底色，不缩放（UI.md 交互红线）。
 */
import { useState } from "react";
import { useNavigate, useParams } from "react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslation } from "react-i18next";
import { ChevronRight, FileText, Plus, X } from "lucide-react";
import { pageApi, tagApi } from "@/lib/api";
import type { TagDto } from "@linkbase/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { RouteLoading } from "@/app/route-loading";

const COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const;

function tagStyle(color: number) {
  return {
    background: `var(--tag-${color}-bg)`,
    color: `var(--tag-${color}-fg)`,
  };
}

export default function TagsPage() {
  const { workspaceId = "" } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { t } = useTranslation("workspace");

  const tags = useQuery({
    queryKey: ["tags", workspaceId],
    queryFn: () => tagApi.list(workspaceId),
  });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const activeTagId = selectedId ?? tags.data?.[0]?.id ?? null;
  const docs = useQuery({
    queryKey: ["tag-pages", workspaceId, activeTagId],
    queryFn: () => tagApi.pagesByTag(workspaceId, activeTagId!),
    enabled: !!activeTagId,
  });

  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [color, setColor] = useState<number>(6);

  const invalidateAll = () => {
    void queryClient.invalidateQueries({ queryKey: ["tags", workspaceId] });
    void queryClient.invalidateQueries({ queryKey: ["tag-pages", workspaceId] });
  };

  const create = useMutation({
    mutationFn: () => tagApi.create(workspaceId, { name: name.trim(), color }),
    onSuccess: (tag) => {
      setName("");
      setAdding(false);
      setColor(6);
      invalidateAll();
      setSelectedId(tag.id);
    },
  });

  const remove = useMutation({
    mutationFn: (tag: TagDto) => {
      if (
        !window.confirm(t("tags.deleteConfirm", { name: tag.name }))
      ) {
        return Promise.reject(new Error("cancelled"));
      }
      return tagApi.remove(workspaceId, tag.id);
    },
    onSuccess: invalidateAll,
  });

  const activeTag = tags.data?.find((tag) => tag.id === activeTagId);

  return (
    <div className="mx-auto w-full max-w-(--width-content) px-6 py-8">
      {/* 页头：标题 + 计数 */}
      <div className="mb-5">
        <h1 className="flex items-center gap-2 text-xl font-bold">
          {t("tags.title")}
          <span className="rounded-full bg-(--secondary) px-2 py-0.5 text-[12px] font-medium text-(--muted-foreground)">
            {tags.data?.length ?? 0}
          </span>
        </h1>
        <p className="mt-1 text-[13px] text-(--text-tertiary)">
          {t("tags.selectHint")}
        </p>
      </div>

      {/* 上：标签区 */}
      <section className="mb-6 rounded-xl border border-(--border) bg-(--card) p-4 shadow-xs">
        <div className="mb-3 flex flex-wrap items-center gap-2">
          {tags.data?.map((tag) => (
            <span
              key={tag.id}
              className="group/tag inline-flex h-8 max-w-full items-center gap-1.5 rounded-full pl-3 pr-1.5 text-[13px] font-medium transition-shadow"
              style={{
                ...tagStyle(tag.color),
                boxShadow:
                  tag.id === activeTagId
                    ? "0 0 0 2px var(--primary)"
                    : undefined,
              }}
            >
              <button
                type="button"
                className="truncate"
                onClick={() => setSelectedId(tag.id)}
              >
                {tag.name}
              </button>
              <button
                type="button"
                aria-label={t("tags.title")}
                className="flex size-4 items-center justify-center rounded-full opacity-0 transition-opacity hover:bg-black/10 group-hover/tag:opacity-70 focus-visible:opacity-70"
                onClick={() => remove.mutate(tag)}
              >
                <X size={12} />
              </button>
            </span>
          ))}
          {tags.data?.length === 0 && (
            <span className="text-[13px] text-(--text-tertiary)">
              {t("tags.empty")}
            </span>
          )}
        </div>

        {adding ? (
          <div className="flex flex-wrap items-center gap-2 rounded-lg bg-(--secondary) p-2.5">
            <Input
              autoFocus
              className="h-8 w-48 bg-background"
              placeholder={t("tags.namePlaceholder")}
              value={name}
              onChange={(e) => setName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && name.trim()) create.mutate();
                if (e.key === "Escape") setAdding(false);
              }}
            />
            <div className="flex items-center gap-1.5">
              {COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  aria-label={String(c)}
                  className="flex size-6 items-center justify-center rounded-full transition-shadow"
                  style={tagStyle(c)}
                  onClick={() => setColor(c)}
                >
                  {c === color && (
                    <span className="size-3.5 rounded-full border-2 border-white/80" />
                  )}
                </button>
              ))}
            </div>
            <div className="ml-auto flex items-center gap-1.5">
              <Button
                size="sm"
                disabled={!name.trim()}
                onClick={() => create.mutate()}
              >
                {t("tags.create")}
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setAdding(false)}>
                {t("cancel")}
              </Button>
            </div>
          </div>
        ) : (
          <Button size="sm" variant="outline" onClick={() => setAdding(true)}>
            <Plus size={14} />
            {t("tags.newTag")}
          </Button>
        )}
      </section>

      {/* 下：选中标签的文档 */}
      <section>
        <div className="mb-2 flex items-baseline gap-2">
          <h2 className="text-[13px] font-semibold text-(--foreground)">
            {activeTag ? activeTag.name : t("tags.docs")}
          </h2>
          <span className="text-[12px] text-(--text-tertiary)">
            {t("tags.docs")}
            {docs?.data ? ` · ${docs.data.length}` : ""}
          </span>
        </div>
        <div className="overflow-hidden rounded-xl border border-(--border) bg-(--card) shadow-xs">
          {docs?.isPending && <RouteLoading />}
          {docs?.data?.length === 0 && (
            <div className="px-4 py-10 text-center text-[13px] text-(--text-tertiary)">
              {t("tags.docsEmpty")}
            </div>
          )}
          {docs?.data?.map((doc) => (
            <button
              key={doc.id}
              type="button"
              className="group/doc flex h-11 w-full items-center gap-2.5 border-b border-(--border) px-4 text-left transition-colors last:border-b-0 hover:bg-(--accent)"
              onClick={() => navigate(`/${workspaceId}/page/${doc.id}`)}
            >
              {doc.icon ? (
                <span className="shrink-0 text-[14px]">{doc.icon}</span>
              ) : (
                <FileText
                  size={14}
                  className="shrink-0 text-(--muted-foreground)"
                />
              )}
              <span className="min-w-0 flex-1 truncate text-[13px]">
                {doc.title || t("untitled", { ns: "common" })}
              </span>
              <span className="shrink-0 text-[11px] text-(--text-tertiary)">
                {new Date(doc.updatedAt).toLocaleDateString()}
              </span>
              <ChevronRight
                size={14}
                className="shrink-0 text-(--muted-foreground) opacity-0 transition-opacity group-hover/doc:opacity-100"
              />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
