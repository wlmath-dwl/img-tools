import { type ComponentChildren } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { I18nContext } from '../i18n/context'
import { getLocale, setLocale } from './locale'
import { t as translate } from '../i18n/translations'
import { locales, type Locale } from '../i18n/locales'
import type { TranslationKey } from '../i18n/types'
import { getLocaleFromPathname } from './locale-path'

type I18nProviderProps = {
  children: ComponentChildren
  locale?: Locale // SSR 时可以传入语言
}

function normalizeLocale(v: string | null | undefined): Locale | null {
  if (!v) return null
  // 支持所有已声明的语言（locale 列表即白名单）
  if ((locales as readonly string[]).includes(v)) return v as Locale
  return null
}

function detectLocaleFromDocument(): Locale | null {
  if (typeof document === 'undefined') return null
  const fromBody = normalizeLocale(document.body?.dataset?.locale)
  if (fromBody) return fromBody
  const fromHtml = normalizeLocale(document.documentElement?.lang)
  if (fromHtml) return fromHtml
  return null
}

function detectLocaleFromPathname(): Locale | null {
  if (typeof window === 'undefined') return null
  return getLocaleFromPathname(window.location.pathname)
}

export function I18nProvider({ children, locale: initialLocale }: I18nProviderProps) {
  // 1) SSR 传入 locale（保证预渲染正确）
  // 2) 客户端优先读路径（/en/、/de-DE/），确保路由语言优先
  // 3) 再读 HTML/body 上的 lang/data-locale（hydration 兜底）
  // 4) 最后读 localStorage/浏览器语言
  const initial = useMemo<Locale>(() => {
    return (
      initialLocale ||
      detectLocaleFromPathname() ||
      detectLocaleFromDocument() ||
      getLocale()
    )
  }, [initialLocale])

  const [locale, setLocaleState] = useState<Locale>(initial)

  useEffect(() => {
    // locale 变化时同步到 localStorage + <html lang>
    setLocale(locale)
  }, [locale])

  // 使用 useMemo 确保 value 对象在 locale 变化时才更新
  const value = useMemo(() => ({
    locale,
    setLocale: setLocaleState,
    t: (key: TranslationKey, params?: Record<string, string | number>) =>
      translate(locale, key, params),
  }), [locale])

  return (
    <I18nContext.Provider value={value}>
      {children}
    </I18nContext.Provider>
  )
}

