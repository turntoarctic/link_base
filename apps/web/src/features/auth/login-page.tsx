/** 登录页（shadcn login-05 页面骨架：居中 max-w-sm；右上角语言切换，品牌底纹保留） */
import { Navigate } from 'react-router'
import { getAccessToken } from '@/lib/fetch'
import { changeLocale } from '@/i18n'
import { LanguageSwitcher } from '@/components/language-switcher'
import { LoginForm } from '@/components/login-form'

export default function LoginPage() {
  if (getAccessToken()) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      {/* 极淡品牌底纹（项目质感保留，形态照 login-05） */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_-10%,color-mix(in_srgb,var(--primary)_7%,transparent),transparent)]"
      />
      <div className="absolute top-4 right-4 z-10">
        <LanguageSwitcher onChange={(locale) => void changeLocale(locale)} />
      </div>
      <div className="relative w-full max-w-sm">
        <LoginForm />
      </div>
    </div>
  )
}
