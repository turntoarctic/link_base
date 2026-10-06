/** 登录页（06 §2：居中卡片，品牌侧文案；右上角语言切换） */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { loginSchema, type LoginInput } from '@linkbase/contracts'
import { authApi } from '@/lib/api'
import { HttpError, getAccessToken, setTokens } from '@/lib/fetch'
import { useAuthStore } from '@/stores/auth'
import { changeLocale } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  if (getAccessToken()) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(async (input) => {
    setError(null)
    try {
      const result = await authApi.login(input)
      setTokens(result.accessToken, result.refreshToken)
      setUser(result.user)
      navigate('/', { replace: true })
    } catch (err) {
      if (err instanceof HttpError) setError(t(`errors.${err.code}`, { ns: 'errors' }))
      else setError(t('errors.LB_INTERNAL', { ns: 'errors' }))
    }
  })

  return (
    <div className="flex min-h-screen items-center justify-center bg-(--background) px-4">
      <div className="absolute top-4 right-4">
        <LanguageSwitcher onChange={(locale) => void changeLocale(locale)} />
      </div>
      <div className="w-[360px]">
        <div className="mb-8 text-center">
          <div className="text-2xl font-semibold tracking-tight">Linkbase</div>
          <div className="mt-1 text-[13px] text-(--muted-foreground)">{t('auth:login.subtitle')}</div>
        </div>
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <label className="text-[13px] text-(--muted-foreground)" htmlFor="login-email">
            {t('auth:login.email')}
          </label>
          <Input
            id="login-email"
            type="email"
            autoComplete="email"
            placeholder={t('auth:login.emailPlaceholder')}
            {...form.register('email')}
          />
          <label className="text-[13px] text-(--muted-foreground)" htmlFor="login-password">
            {t('auth:login.password')}
          </label>
          <Input
            id="login-password"
            type="password"
            autoComplete="current-password"
            placeholder={t('auth:login.passwordPlaceholder')}
            {...form.register('password')}
          />
          {error && <div className="text-[13px] text-(--destructive)">{error}</div>}
          <Button type="submit" className="mt-2 h-9" disabled={form.formState.isSubmitting}>
            {t('auth:login.submit')}
          </Button>
        </form>
        <div className="mt-4 text-center text-[13px]">
          <a className="text-(--primary) hover:underline" href="/register">
            {t('auth:login.toRegister')}
          </a>
        </div>
      </div>
    </div>
  )
}
