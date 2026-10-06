/** 注册页：注册成功即直接进入自动创建的工作空间与快速开始页（01 §3.1 零仪式） */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Navigate, useNavigate } from 'react-router'
import { registerSchema, type RegisterInput } from '@linkbase/contracts'
import { authApi } from '@/lib/api'
import { HttpError, getAccessToken, setTokens } from '@/lib/fetch'
import { useAuthStore } from '@/stores/auth'
import { changeLocale } from '@/i18n'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { LanguageSwitcher } from '@/components/language-switcher'

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'common'])
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', name: '' },
  })

  if (getAccessToken()) return <Navigate to="/" replace />

  const onSubmit = form.handleSubmit(async (input) => {
    setError(null)
    try {
      const result = await authApi.register(input)
      setTokens(result.accessToken, result.refreshToken)
      setUser(result.user)
      if (result.workspace) {
        // 零仪式：直接落在快速开始页，光标即可输入（P0-2）
        navigate(`/${result.workspace.id}/page/${result.workspace.welcomePageId}`, { replace: true })
        return
      }
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
          <div className="mt-1 text-[13px] text-(--muted-foreground)">{t('auth:register.subtitle')}</div>
        </div>
        <form className="flex flex-col gap-3" onSubmit={onSubmit} noValidate>
          <label className="text-[13px] text-(--muted-foreground)" htmlFor="reg-name">
            {t('auth:register.name')}
          </label>
          <Input id="reg-name" autoComplete="name" {...form.register('name')} />
          <label className="text-[13px] text-(--muted-foreground)" htmlFor="reg-email">
            {t('auth:register.email')}
          </label>
          <Input id="reg-email" type="email" autoComplete="email" {...form.register('email')} />
          <label className="text-[13px] text-(--muted-foreground)" htmlFor="reg-password">
            {t('auth:register.password')}
          </label>
          <Input
            id="reg-password"
            type="password"
            autoComplete="new-password"
            {...form.register('password')}
          />
          {form.formState.errors.name && (
            <div className="text-[13px] text-(--destructive)">{t('errors.LB_VALIDATION', { ns: 'errors' })}</div>
          )}
          {error && <div className="text-[13px] text-(--destructive)">{error}</div>}
          <Button type="submit" className="mt-2 h-9" disabled={form.formState.isSubmitting}>
            {t('auth:register.submit')}
          </Button>
        </form>
        <div className="mt-4 text-center text-[13px]">
          <a className="text-(--primary) hover:underline" href="/login">
            {t('auth:register.toLogin')}
          </a>
        </div>
      </div>
    </div>
  )
}
