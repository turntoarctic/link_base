/** 登录表单（shadcn login-05 块改造：官方 field 排版，接线 stores/auth + lib/api；仅邮箱+密码） */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { loginSchema, type LoginInput } from '@linkbase/contracts'
import { authApi } from '@/lib/api'
import { HttpError, setTokens } from '@/lib/fetch'
import { useAuthStore } from '@/stores/auth'
import { cn } from 'cn'

import { BrandMark } from '@/components/brand-mark'
import { Button } from '@/components/ui/button'
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from '@/components/ui/field'
import { Input } from '@/components/ui/input'

export function LoginForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { t } = useTranslation(['auth', 'errors'])
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<LoginInput>({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  })

  const onSubmit = form.handleSubmit(async (input) => {
    setError(null)
    try {
      const result = await authApi.login(input)
      setTokens(result.accessToken, result.refreshToken)
      setUser(result.user)
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof HttpError ? t('errors:' + err.code) : t('errors:LB_INTERNAL'))
    }
  })

  const fieldError = form.formState.errors.email ?? form.formState.errors.password

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="#" className="flex flex-col items-center gap-2 font-medium">
              <BrandMark size={32} />
              <span className="sr-only">Linkbase</span>
            </a>
            <h1 className="text-xl font-bold">{t('auth:login.title')}</h1>
            <FieldDescription>
              {t('auth:login.noAccount')}{' '}
              <Link to="/register">{t('auth:login.signUpLink')}</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="login-email">{t('auth:login.email')}</FieldLabel>
            <Input
              id="login-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth:login.emailPlaceholder')}
              required
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
              required
              {...form.register('password')}
            />
          </Field>
          <FieldError>
            {error ?? (fieldError ? t('errors:LB_VALIDATION') : null)}
          </FieldError>
          <Field>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('auth:login.submit')}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {t('auth:login.terms')}
      </FieldDescription>
    </div>
  )
}
