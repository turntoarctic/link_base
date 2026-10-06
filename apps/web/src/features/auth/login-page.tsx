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
import { Card } from '@/components/ui/card'
import { Field, FieldLabel } from '@/components/ui/field'
import { LanguageSwitcher } from '@/components/language-switcher'
import { BrandMark } from '@/components/brand-mark'

export default function LoginPage() {
  const { t } = useTranslation(['auth', 'common', 'errors'])
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
      if (err instanceof HttpError) setError(t(`errors:${err.code}`))
      else setError(t('errors:LB_INTERNAL'))
    }
  })

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-(--background) px-4">
      {/* 极淡品牌底纹（克制，06 §5 总纲） */}
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
            <div className="mt-1 text-[13px] text-(--muted-foreground)">{t('auth:login.subtitle')}</div>
          </div>
        </div>

        <form className="flex flex-col gap-4" onSubmit={onSubmit} noValidate>
          <Field>
            <FieldLabel htmlFor="login-email">{t('auth:login.email')}</FieldLabel>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth:login.emailPlaceholder')}
              className="mt-1.5"
              {...form.register('email')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="login-password">{t('auth:login.password')}</FieldLabel>
            <Input
              id="login-password"
              type="password"
              autoComplete="current-password"
              placeholder={t('auth:login.passwordPlaceholder')}
              className="mt-1.5"
              {...form.register('password')}
            />
          </Field>
          {error && <div className="text-[13px] text-(--destructive)">{error}</div>}
          <Button type="submit" size="lg" className="mt-1 w-full" disabled={form.formState.isSubmitting}>
            {t('auth:login.submit')}
          </Button>
        </form>

        <div className="mt-5 border-t border-(--border) pt-4 text-center text-[13px] text-(--muted-foreground)">
          <a className="text-(--primary) hover:underline" href="/register">
            {t('auth:login.toRegister')}
          </a>
        </div>
      </Card>
    </div>
  )
}
