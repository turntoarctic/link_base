/**
 * i18next 初始化（13 §3）：zh-CN 默认 + en；探测优先级
 * 登录用户 users.locale → localStorage → navigator.language → zh-CN。
 * 语言不进 URL（13 §1）；切换同步 <html lang>（13 §3）。
 */
import i18next, { type i18n as I18n } from 'i18next'
import LanguageDetector from 'i18next-browser-languagedetector'
import { initReactI18next } from 'react-i18next'
import { z } from 'zod'

import commonEn from './locales/en/common.json'
import authEn from './locales/en/auth.json'
import workspaceEn from './locales/en/workspace.json'
import editorEn from './locales/en/editor.json'
import errorsEn from './locales/en/errors.json'
import commonZh from './locales/zh-CN/common.json'
import authZh from './locales/zh-CN/auth.json'
import workspaceZh from './locales/zh-CN/workspace.json'
import editorZh from './locales/zh-CN/editor.json'
import errorsZh from './locales/zh-CN/errors.json'

export const LOCALES = ['zh-CN', 'en'] as const
export type AppLocale = (typeof LOCALES)[number]
export const LOCALE_STORAGE_KEY = 'linkbase.locale'

export const localeSchema = z.enum(LOCALES)

export const resources = {
  'zh-CN': {
    common: commonZh,
    auth: authZh,
    workspace: workspaceZh,
    editor: editorZh,
    errors: errorsZh,
  },
  en: {
    common: commonEn,
    auth: authEn,
    workspace: workspaceEn,
    editor: editorEn,
    errors: errorsEn,
  },
} as const

export function normalizeLocale(input: string | null | undefined): AppLocale | null {
  if (!input) return null
  if ((LOCALES as readonly string[]).includes(input)) return input as AppLocale
  // 'zh' / 'zh-TW' → zh-CN；'en-US' → en
  if (input.toLowerCase().startsWith('zh')) return 'zh-CN'
  if (input.toLowerCase().startsWith('en')) return 'en'
  return null
}

export async function initI18n(): Promise<I18n> {
  await i18next.use(LanguageDetector).use(initReactI18next).init({
    resources,
    fallbackLng: 'zh-CN',
    supportedLngs: [...LOCALES],
    // 不设 load: 'languageOnly'——region 剥离会导致 t() 丢失（13 §2 踩坑），保持精确匹配
    detection: {
      // 探测顺序：localStorage → navigator（users.locale 由登录态显式 changeLanguage）
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LOCALE_STORAGE_KEY,
      caches: ['localStorage'],
    },
    interpolation: { escapeValue: false },
    returnNull: false,
  })
  syncHtmlLang(i18next.language)
  i18next.on('languageChanged', (lng) => syncHtmlLang(lng))
  return i18next
}

export function syncHtmlLang(lng: string | undefined): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = lng ?? 'zh-CN'
  }
}

/** 切换语言：本地持久化 + <html lang>；登录态由调用方再 PATCH users.locale */
export async function changeLocale(locale: AppLocale): Promise<void> {
  await i18next.changeLanguage(locale)
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
}
