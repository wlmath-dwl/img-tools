// 语言管理
import type { Locale } from '../i18n/locales'
import { defaultLocale, locales } from '../i18n/locales'

const LOCALE_STORAGE_KEY = 'locale'

export function getLocale(): Locale {
  if (typeof window === 'undefined') return defaultLocale
  
  const stored = localStorage.getItem(LOCALE_STORAGE_KEY) as Locale | null
  // 仅接受白名单内的 locale（避免脏数据导致渲染异常）
  if (stored && (locales as readonly string[]).includes(stored)) {
    return stored
  }
  
  // 尝试从浏览器语言检测
  const browserLang = navigator.language || navigator.languages?.[0]
  if (browserLang?.startsWith('zh')) return 'zh-CN'
  if (browserLang?.startsWith('en')) return 'en-US'
  
  return defaultLocale
}

export function setLocale(locale: Locale) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(LOCALE_STORAGE_KEY, locale)
  document.documentElement.lang = locale
  // 给 SSR/hydration 做额外兜底（I18nProvider 会优先读取该值）
  document.body?.setAttribute('data-locale', locale)
}

// 初始化语言
if (typeof window !== 'undefined') {
  const locale = getLocale()
  setLocale(locale)
}
