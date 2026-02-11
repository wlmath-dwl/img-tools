import type { Locale } from '../i18n/locales'
import { locales } from '../i18n/locales'

function normalizeLocaleSegment(segment: string): Locale | null {
  if (segment === 'en') return 'en-US'
  if ((locales as readonly string[]).includes(segment)) return segment as Locale
  return null
}

export function getLocaleDir(locale: Locale): string {
  if (locale === 'en-US') return 'en'
  return locale
}

export function getLocaleFromPathname(pathname: string): Locale | null {
  const segments = pathname.split('/').filter(Boolean)
  for (const segment of segments) {
    const locale = normalizeLocaleSegment(segment)
    if (locale) return locale
  }
  return null
}

export function buildLocalizedRelativePath(pathname: string, targetLocale: Locale): string {
  const segments = pathname.split('/').filter(Boolean)
  const isToolPage = segments.includes('pages')
  const file = pathname.endsWith('/') ? 'index.html' : (segments[segments.length - 1] || 'index.html')
  const currentLocale = getLocaleFromPathname(pathname)
  const hasLocaleDir = !!currentLocale
  const depth = isToolPage ? (hasLocaleDir ? 2 : 1) : (hasLocaleDir ? 1 : 0)
  const toRoot = depth === 0 ? './' : '../'.repeat(depth)
  const targetDir = getLocaleDir(targetLocale)
  if (isToolPage) {
    return `${toRoot}${targetDir ? `${targetDir}/` : ''}pages/${file}`
  }
  return `${toRoot}${targetDir ? `${targetDir}/` : ''}index.html`
}
