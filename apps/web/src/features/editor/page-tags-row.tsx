/** 页面标签行（06 §5.5：圆角胶囊 tag 色板，行内可增删；添加/新建经 Popover） */
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Plus, X } from 'lucide-react'
import { tagApi } from '@/lib/api'
import type { TagDto } from '@linkbase/types'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { cn } from '@/lib/cn'

const TAG_COLORS = [1, 2, 3, 4, 5, 6, 7, 8] as const

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
  const queryClient = useQueryClient()
  const [creating, setCreating] = useState(false)
  const [name, setName] = useState('')
  const [color, setColor] = useState<number>(6)
  const allTags = useQuery({ queryKey: ['tags', workspaceId], queryFn: () => tagApi.list(workspaceId) })

  const invalidateTags = () => {
    void queryClient.invalidateQueries({ queryKey: ['tags', workspaceId] })
  }
  const addTag = useMutation({
    mutationFn: (tagId: string) => tagApi.addTag(workspaceId, pageId, tagId),
    onSuccess: onChanged,
  })
  const removeTag = useMutation({
    mutationFn: (tagId: string) => tagApi.removeTag(workspaceId, pageId, tagId),
    onSuccess: onChanged,
  })
  const createTag = useMutation({
    mutationFn: async () => {
      const tag = await tagApi.create(workspaceId, { name: name.trim(), color })
      // 建成即打标：常见意图就是给当前页面加新标签
      await tagApi.addTag(workspaceId, pageId, tag.id)
      return tag
    },
    onSuccess: () => {
      setName('')
      setColor(6)
      setCreating(false)
      invalidateTags()
      onChanged()
    },
  })

  const candidates = (allTags.data ?? []).filter((tag) => !tags.some((existing) => existing.id === tag.id))

  const submitCreate = () => {
    if (name.trim()) createTag.mutate()
  }

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
        <PopoverContent className="max-h-[280px] w-[200px] overflow-y-auto p-1">
          {candidates.length === 0 && !creating && (
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

          {creating ? (
            <form
              className="flex flex-col gap-1.5 border-t border-(--border) px-1 pt-1.5 pb-1"
              onSubmit={(e) => {
                e.preventDefault()
                submitCreate()
              }}
            >
              <Input
                autoFocus
                value={name}
                maxLength={50}
                onChange={(e) => setName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Escape') setCreating(false)
                }}
                placeholder={t('tags.namePlaceholder')}
                className="h-7 w-full px-2 text-[13px]"
              />
              <div className="flex items-center gap-1">
                {TAG_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    aria-label={`color ${c}`}
                    onClick={() => setColor(c)}
                    className={cn(
                      'size-4 rounded-full transition-transform',
                      color === c && 'ring-2 ring-(--ring) ring-offset-1 ring-offset-(--popover)',
                    )}
                    style={{ background: `var(--tag-${c}-bg)` }}
                  />
                ))}
              </div>
              <div className="flex items-center justify-end gap-1">
                <Button
                  type="button"
                  variant="ghost"
                  size="xs"
                  className="h-7 px-2 text-[12px] text-(--muted-foreground)"
                  onClick={() => setCreating(false)}
                >
                  {t('common:cancel')}
                </Button>
                <Button
                  type="submit"
                  size="xs"
                  className="h-7 px-2 text-[12px]"
                  disabled={!name.trim() || createTag.isPending}
                >
                  {t('tags.create')}
                </Button>
              </div>
            </form>
          ) : (
            <button
              type="button"
              className="mt-0.5 flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px] text-(--muted-foreground) transition-colors hover:bg-(--muted)"
              onClick={() => setCreating(true)}
            >
              <Plus size={13} />
              {t('tags.newTag')}
            </button>
          )}
        </PopoverContent>
      </Popover>
    </div>
  )
}

function tagStyle(tag: TagDto): React.CSSProperties {
  return { background: `var(--tag-${tag.color}-bg)`, color: `var(--tag-${tag.color}-fg)`, borderColor: 'transparent' }
}
