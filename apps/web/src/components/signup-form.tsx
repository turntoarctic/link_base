/** 注册表单（shadcn signup-05 块改造：官方 field 排版；昵称+邮箱+密码，成功即入工作空间） */
import { useState } from 'react'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { useTranslation } from 'react-i18next'
import { Link, useNavigate } from 'react-router'
import { registerSchema, type RegisterInput } from '@linkbase/contracts'
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

export function SignupForm({
  className,
  ...props
}: React.ComponentProps<'div'>) {
  const { t } = useTranslation(['auth', 'errors'])
  const navigate = useNavigate()
  const setUser = useAuthStore((s) => s.setUser)
  const [error, setError] = useState<string | null>(null)

  const form = useForm<RegisterInput>({
    resolver: zodResolver(registerSchema),
    defaultValues: { email: '', password: '', name: '' },
  })

  const onSubmit = form.handleSubmit(async (input) => {
    setError(null)
    try {
      const result = await authApi.register(input)
      setTokens(result.accessToken, result.refreshToken)
      setUser(result.user)
      if (result.workspace) {
        // 零仪式：注册成功直接落在自动创建工作空间的快速开始页（P0-2）
        navigate('/' + result.workspace.id + '/page/' + result.workspace.welcomePageId, { replace: true })
        return
      }
      navigate('/', { replace: true })
    } catch (err) {
      setError(err instanceof HttpError ? t('errors:' + err.code) : t('errors:LB_INTERNAL'))
    }
  })

  const fieldError =
    form.formState.errors.name ??
    form.formState.errors.email ??
    form.formState.errors.password

  return (
    <div className={cn('flex flex-col gap-6', className)} {...props}>
      <form onSubmit={onSubmit} noValidate>
        <FieldGroup>
          <div className="flex flex-col items-center gap-2 text-center">
            <a href="#" className="flex flex-col items-center gap-2 font-medium">
              <BrandMark size={32} />
              <span className="sr-only">Linkbase</span>
            </a>
            <h1 className="text-xl font-bold">{t('auth:register.title')}</h1>
            <FieldDescription>
              {t('auth:register.noAccount')}{' '}
              <Link to="/login">{t('auth:register.signInLink')}</Link>
            </FieldDescription>
          </div>
          <Field>
            <FieldLabel htmlFor="signup-name">{t('auth:register.name')}</FieldLabel>
            <Input
              id="signup-name"
              type="text"
              autoComplete="name"
              required
              {...form.register('name')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="signup-email">{t('auth:register.email')}</FieldLabel>
            <Input
              id="signup-email"
              type="email"
              autoComplete="email"
              placeholder={t('auth:login.emailPlaceholder')}
              required
              {...form.register('email')}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="signup-password">{t('auth:register.password')}</FieldLabel>
            <Input
              id="signup-password"
              type="password"
              autoComplete="new-password"
              required
              {...form.register('password')}
            />
          </Field>
          <FieldError>
            {error ?? (fieldError ? t('errors:LB_VALIDATION') : null)}
          </FieldError>
          <Field>
            <Button type="submit" disabled={form.formState.isSubmitting}>
              {t('auth:register.submit')}
            </Button>
          </Field>
        </FieldGroup>
      </form>
      <FieldDescription className="px-6 text-center">
        {t('auth:register.terms')}
      </FieldDescription>
    </div>
  )
}
