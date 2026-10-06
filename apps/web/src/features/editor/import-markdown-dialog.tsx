/**
 * 导入 Markdown 对话框（05 §7 / T2.5）：粘贴或选择 .md 文件 → 服务端解析建页 → 跳转。
 */
import { useRef, useState } from 'react'
import { useNavigate } from 'react-router'
import { useMutation } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { FileUp } from 'lucide-react'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { toast } from '@/components/ui/sonner'

export function ImportMarkdownDialog({
  wsId,
  open,
  onOpenChange,
}: {
  wsId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const { t } = useTranslation('workspace')
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const [title, setTitle] = useState('')
  const [markdown, setMarkdown] = useState('')

  const importMut = useMutation({
    mutationFn: () => pageApi.importMarkdown(wsId, { title: title.trim() || undefined, markdown }),
    onSuccess: (page) => {
      toast.success(t('import.done', { title: page.title }))
      onOpenChange(false)
      navigate(`/${wsId}/page/${page.id}`)
    },
    onError: () => toast.error(t('common:operationFailed')),
  })

  const pickFile = async (file: File | undefined) => {
    if (!file) return
    setMarkdown(await file.text())
    if (!title.trim()) setTitle(file.name.replace(/\.md$/i, ''))
  }

  const submit = () => {
    if (markdown.trim()) importMut.mutate()
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex h-[520px] max-w-[640px] flex-col gap-0 p-0">
        <DialogHeader className="border-b border-(--border) px-5 py-4">
          <DialogTitle className="flex items-center gap-2 text-[15px]">
            <FileUp size={15} />
            {t('import.title')}
          </DialogTitle>
          <DialogDescription className="text-[12px]">{t('import.subtitle')}</DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="flex items-center gap-2">
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={t('import.titlePlaceholder')}
              className="h-8 flex-1 rounded-md border border-(--input) bg-(--background) px-2.5 text-[13px] outline-none focus-visible:border-(--ring)"
            />
            <Button variant="secondary" size="sm" onClick={() => fileRef.current?.click()}>
              {t('import.pickFile')}
            </Button>
            <input
              ref={fileRef}
              type="file"
              accept=".md,.markdown,.txt"
              className="hidden"
              onChange={(e) => void pickFile(e.target.files?.[0])}
            />
          </div>
          <textarea
            value={markdown}
            onChange={(e) => setMarkdown(e.target.value)}
            placeholder={t('import.pastePlaceholder')}
            className="min-h-0 flex-1 resize-none rounded-md border border-(--input) bg-(--background) p-3 font-mono text-[12.5px] leading-relaxed outline-none focus-visible:border-(--ring)"
          />
        </div>

        <DialogFooter className="border-t border-(--border) px-5 py-3">
          <Button variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
            {t('common:cancel')}
          </Button>
          <Button size="sm" disabled={!markdown.trim() || importMut.isPending} onClick={submit}>
            {t('import.create')}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
