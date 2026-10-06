/** 页面标签行（06 §5.5：圆角胶囊 tag 色板，行内可增删） */
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { X } from 'lucide-react'
import { tagApi } from '@/lib/api'
import type { TagDto } from '@linkbase/types'
import { Menu } from '@/components/ui/menu'
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

  return (
    <div className="mb-2 flex flex-wrap items-center gap-1.5 text-[12px]">
      {tags.map((tag) => (
        <span
          key={tag.id}
          className="inline-flex items-center gap-1 rounded-full px-2 py-0.5"
          style={{
            background: `var(--tag-${tag.color}-bg)`,
            color: `var(--tag-${tag.color}-fg)`,
          }}
        >
          {tag.name}
          <button
            type="button"
            aria-label={t('common:delete')}
            onClick={() => removeTag.mutate(tag.id)}
            className="opacity-60 hover:opacity-100"
          >
            <X size={11} />
          </button>
        </span>
      ))}

      <Menu
        align="start"
        className="w-[200px] max-h-[240px] overflow-y-auto"
        trigger={(_open, toggle) => (
          <button
            type="button"
            className="rounded-full px-2 py-0.5 text-(--muted-foreground) hover:bg-(--muted)"
            onClick={toggle}
          >
            + {t('page.addTag')}
          </button>
        )}
      >
        {(close) => (
          <>
            {(allTags.data ?? [])
              .filter((tag) => !tags.some((existing) => existing.id === tag.id))
              .map((tag) => (
                <button
                  key={tag.id}
                  type="button"
                  className={cn(
                    'flex w-full items-center gap-2 rounded px-2 py-1.5 text-left text-[13px] hover:bg-(--muted)',
                  )}
                  onClick={() => {
                    close()
                    addTag.mutate(tag.id)
                  }}
                >
                  <span
                    className="inline-block h-2.5 w-2.5 rounded-full"
                    style={{ background: `var(--tag-${tag.color}-bg)` }}
                  />
                  {tag.name}
                </button>
              ))}
            {(allTags.data ?? []).length === 0 && (
              <div className="px-2 py-1.5 text-[12px] text-(--muted-foreground)">{t('tags.empty')}</div>
            )}
          </>
        )}
      </Menu>
    </div>
  )
}
