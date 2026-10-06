/** 邀请落地页（03 §5）：展示邀请信息；未登录提示先登录/注册，登录后自动加入并跳转 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { workspaceApi } from '@/lib/api'
import { getAccessToken } from '@/lib/fetch'
import { Button } from '@/components/ui/button'

export default function InvitePage() {
  const { t } = useTranslation(['auth', 'common'])
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const [joined, setJoined] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const info = useQuery({
    queryKey: ['invite', token],
    queryFn: () => workspaceApi.inviteInfo(token),
    retry: false,
  })

  const loggedIn = Boolean(getAccessToken())

  useEffect(() => {
    if (!loggedIn || joined || !info.data) return
    workspaceApi
      .acceptInvite(token)
      .then(() => setJoined(true))
      .catch(() => setError(t('auth:invite.expired')))
  }, [loggedIn, joined, info.data, token, t])

  if (info.isLoading) return <div className="p-10 text-center text-(--muted-foreground)">{t('common:loading')}</div>

  if (info.isError || error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-4 text-center">
        <div className="text-(--destructive)">{error ?? t('auth:invite.expired')}</div>
        <Button variant="secondary" onClick={() => navigate('/')}>
          {t('common:close')}
        </Button>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center px-4">
      <div className="w-[420px] rounded-lg border border-(--border) bg-(--card) p-6 text-center shadow-(--shadow-pop)">
        <div className="text-lg font-semibold">{t('auth:invite.title')}</div>
        <div className="mt-2 text-[14px] text-(--muted-foreground)">
          {t('auth:invite.invitedBy', {
            inviter: info.data?.inviterName || '—',
            workspace: info.data?.workspaceName ?? '',
          })}
        </div>
        {joined ? (
          <Button className="mt-5 h-9 w-full" onClick={() => navigate('/')}>
            {t('common:confirm')}
          </Button>
        ) : loggedIn ? (
          <Button className="mt-5 h-9 w-full" disabled>
            {t('common:loading')}
          </Button>
        ) : (
          <div className="mt-5 flex flex-col gap-2">
            <Button className="h-9" onClick={() => navigate('/login')}>
              {t('auth:login.submit')}
            </Button>
            <Button variant="secondary" className="h-9" onClick={() => navigate('/register')}>
              {t('auth:register.submit')}
            </Button>
            <div className="text-[12px] text-(--muted-foreground)">{t('auth:invite.loginFirst')}</div>
          </div>
        )}
      </div>
    </div>
  )
}
