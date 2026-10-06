/** 工作空间索引页（06 §2）：跳第一个顶级页面，无页面时给新建引导 */
import { useEffect } from 'react'
import { useNavigate, useParams } from 'react-router'
import { useMutation, useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { pageApi } from '@/lib/api'
import { Button } from '@/components/ui/button'
import { RouteLoading } from '@/app/route-loading'

export default function WorkspaceIndexPage() {
  const { workspaceId = '' } = useParams()
  const navigate = useNavigate()
  const { t } = useTranslation('workspace')

  const tree = useQuery({ queryKey: ['pages', workspaceId], queryFn: () => pageApi.tree(workspaceId) })

  // 导航一律放 effect（渲染期 navigate 是 React 反模式）
  const first = tree.data?.[0]
  useEffect(() => {
    if (first) navigate(`/${workspaceId}/page/${first.id}`, { replace: true })
  }, [first, workspaceId, navigate])

  if (tree.isPending) return <RouteLoading />
  if (tree.data && tree.data.length > 0) return null // 已在 effect 中跳转

  return (
    <div className="flex h-full flex-col items-center justify-center gap-4 text-muted-foreground">
      <div className="text-[15px]">{t('common:empty', { ns: 'common' })}</div>
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
