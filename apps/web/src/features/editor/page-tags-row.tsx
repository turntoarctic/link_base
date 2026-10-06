/** 页面标签行（06 §5.5：圆角胶囊 tag 色板，行内可增删；添加经 Popover） */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { tagApi } from '@/lib/api'
import type { TagDto } from '@linkbase/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

export function PageTagsRow({
  workspaceId,
  pageId,
  tags,
  onChanged,
}: {
  workspaceId: string
  pageId: string
  tags: TagDto[]
  onChanged: () => void
}) {
  const { t } = useTranslation('workspace')
  const allTags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => tagApi.list(workspaceId) })

  const addTag = useMutation({
    mutationFn: (tagId: string) => tagApi.addTag(workspaceId, pageId, tagId),
    onSuccess: onChanged,
  })
  const removeTag = useMutation({
    mutationFn: (tagId: string) => tagApi.removeTag(workspaceId, pageId, tagId),
    onSuccess: onChanged,
  })

  const candidates = (allTags.data ?? []).filter((tag) => !tags.some((existing) => existing.id === tag.id))

  return (
    <div className="mb-4 flex flex-wrap items-center gap-1.5">
      {tags.map((tag) => (
        <Badge key={tag.id} className="gap-0.5 pr-1" style={tagStyle(tag)}>
          {tag.name}
          <button
            type="button"
            aria-label={t('common:delete')}
            onClick={() => removeTag.mutate(tag.id)}
            className="rounded-full p-0.5 opacity-60 transition-opacity hover:opacity-100"
          >
            <X size={11} />
          </button>
        </Badge>
      ))}

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="text-muted-foreground inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[12px] font-medium transition-colors hover:bg-muted"
          >
            <Plus size={12} />
            {t('page.addTag')}
          </button>
        </PopoverTrigger>
        <PopoverContent className="max-h-[240px] w-[200px] overflow-y-auto p-1">
          {candidates.length === 0 && (
            <div className="px-2 py-3 text-center text-[12px] text-(--muted-foreground)">
              {t('tags.empty')}
            </div>
          )}
          {candidates.map((tag) => (
            <button
              key={tag.id}
              type="button"
              className={cn(
                'flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] transition-colors hover:bg-(--muted)',
              )}
              onClick={() => addTag.mutate(tag.id)}
            >
              <span
                className="size-2.5 shrink-0 rounded-full"
                style={{ background: `var(--tag-${tag.color}-bg)` }}
              />
              {tag.name}
            </button>
          ))}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function tagStyle(tag: TagDto): React.CSSProperties {
  return { background: `var(--tag-${tag.color}-bg)`, color: `var(--tag-${tag.color}-fg)`, borderColor: 'transparent' }
}
