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
import { Label } from '@/components/ui/label'
import { Card } from '@/components/ui/card'
import { LanguageSwitcher } from '@/components/language-switcher'
import { BrandMark } from '@/components/brand-mark'

export default function RegisterPage() {
  const { t } = useTranslation(['auth', 'common', 'errors'])
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
      if (err instanceof HttpError) setError(t(`errors:${err.code}`))
      else setError(t('errors:LB_INTERNAL'))
    }
  })

  const fieldError = form.formState.errors.name ?? form.formState.errors.email ?? form.formState.errors.password

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-(--background) px-4">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_srgb,var(--primary)_7%,transparent),transparent)]"
      />
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher onChange={(locale) => void changeLocale(locale)} />
      </div>

      <Card className="relative w-[400px] p-8 shadow-(--shadow-pop)">
        <div className="mb-7 flex flex-col items-center gap-3 text-center">
          <BrandMark size={40} />
          <div>
            <div className="text-[22px] font-semibold tracking-tight">Linkbase</div>
            <div className="mt-1 text-[13px] text-(--muted-foreground)">{t('auth:register.subtitle')}</div>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-name">{t('auth:register.name')}</Label>
            <Input id="reg-name" autoComplete="name" {...form.register('name')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-email">{t('auth:register.email')}</Label>
            <Input id="reg-email" type="email" autoComplete="email" {...form.register('email')} />
          </div>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="reg-password">{t('auth:register.password')}</Label>
            <Input
              id="reg-password"
              type="password"
              autoComplete="new-password"
              {...form.register('password')}
            />
          </div>
          {(fieldError || error) && (
            <div className="text-[13px] text-destructive">{error ?? t('errors:LB_VALIDATION')}</div>
          )}
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={form.formState.isSubmitting}>
            {t('auth:register.submit')}
          </Button>
        </form>

        <div className="mt-5 border-t border-(--border) pt-4 text-center text-[13px] text-(--muted-foreground)">
          <a className="text-(--primary) hover:underline" href="/login">
            {t('auth:register.toLogin')}
          </a>
        </div>
      </Card>
    </div>
  )
}
