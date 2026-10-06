/** 邀请落地页（03 §5）：展示邀请信息；未登录提示先登录/注册，登录后自动加入并跳转 */
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useNavigate, useParams } from 'react-router'
import { useQuery } from '@tanstack/react-query'
import { UsersRound } from 'lucide-react'
import { workspaceApi } from '@/lib/api'
import { getAccessToken } from '@/lib/fetch'
import { Button } from '@/components/ui/button'
import { Card } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/primitives'
import { BrandMark } from '@/components/brand-mark'

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

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--background) px-4">
      <Card className="w-[420px] p-8 text-center shadow-(--shadow-pop)">
        <div className="mb-5 flex justify-center">
          <BrandMark size={40} />
        </div>

        {info.isPending ? (
          <div className="flex flex-col items-center gap-3">
            <Skeleton className="h-5 w-52" />
            <Skeleton className="h-4 w-64" />
            <Skeleton className="mt-4 h-9 w-32" />
          </div>
        ) : info.isError || error ? (
          <>
            <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-(--muted) text-(--muted-foreground)">
              <UsersRound size={20} />
            </div>
            <div className="text-[15px] font-semibold">{t('auth:invite.title')}</div>
            <div className="mt-1.5 text-[13px] text-destructive">
              {error ?? t('auth:invite.expired')}
            </div>
            <Button variant="secondary" className="mt-6 h-9 w-full" onClick={() => navigate('/')}>
              {t('common:close')}
            </Button>
          </>
        ) : (
          <>
            <div className="text-[15px] font-semibold">{t('auth:invite.title')}</div>
            <div className="mt-2 text-[14px] leading-relaxed text-(--muted-foreground)">
              {t('auth:invite.invitedBy', {
                inviter: info.data?.inviterName || '—',
                workspace: info.data?.workspaceName ?? '',
              })}
            </div>
            {joined ? (
              <Button className="mt-6 h-9 w-full" onClick={() => navigate('/')}>
                {t('common:confirm')}
              </Button>
            ) : loggedIn ? (
              <Button className="mt-6 h-9 w-full" disabled>
                {t('common:loading')}
              </Button>
            ) : (
              <div className="mt-6 flex flex-col gap-2">
                <Button className="h-9" onClick={() => navigate('/login')}>
                  {t('auth:login.submit')}
                </Button>
                <Button variant="secondary" className="h-9" onClick={() => navigate('/register')}>
                  {t('auth:register.submit')}
                </Button>
                <div className="mt-1 text-[12px] text-(--muted-foreground)">
                  {t('auth:invite.loginFirst')}
                </div>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  )
}
