/** 工作空间索引页（06 §2）：第一个顶级页面，无页面时给新建引导 */
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'

export default function WorkspaceIndexPage() {
  const { workspaceId = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('workspace')

  const tree = useQuery({ queryKey: ['pages', workspaceId], queryFn: () => pageApi.tree(workspaceId) })

  if (!tree.data) return null
  const first = tree.data[0]
  if (first) {
    navigate(`/${workspaceId}/page/${first.id}`, { replace: true })
    return null
  }
  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-(--muted-foreground)">
      <div className="text-[15px]">{t('common:empty')}</div>
      <Button
        onClick={() => {
          void pageApi.create(workspaceId, {}).then((page) => {
            navigate(`/${workspaceId}/page/${page.id}`, { replace: true })
          })
        }}
      >
        {t('sidebar.newPage')}
      </Button>
    </div>
  )
}
