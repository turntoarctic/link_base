/** 语言切换（13 §6）：zh-CN / en 轻量切换，登录页与设置共用 */
import { useTranslation } from 'react-i18next'
import { LOCALES, normalizeLocale, type AppLocale } from '@/i18n'

export function LanguageSwitcher({
  onChange,
}: {
  onChange?: (locale: AppLocale) => void
}) {
  const { i18n } = useTranslation()
  const current = normalizeLocale(i18n.language) ?? 'zh-CN'

  return (
    <div className="inline-flex overflow-hidden rounded-md border border-(--border) text-[12px]">
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          className={
            'px-2 py-1 transition-colors ' +
            (current === locale
              ? 'bg-(--accent) text-(--accent-foreground)'
              : 'text-(--muted-foreground) hover:bg-(--muted)')
          }
          onClick={() => onChange?.(locale)}
        >
          {/* 自名（Intl.DisplayNames），不翻译语言名本身 */}
          {new Intl.DisplayNames([locale], { type: 'language' }).of(locale)}
        </button>
      ))}
    </div>
  )
}
