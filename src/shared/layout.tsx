import { type ComponentChildren } from 'preact'
import { useState, useEffect } from 'preact/hooks'
import { useI18n } from '../i18n/context'
import { getTheme, setTheme, applyTheme, type Theme } from './theme'
import { locales, localeLabels, type Locale } from '../i18n/locales'
import { setLocale } from './locale'
import { buildLocalizedRelativePath, getLocaleDir } from './locale-path'

type NavItem = {
  label: string
  href: string
}

type LayoutProps = {
  title: string
  nav?: NavItem[]
  children: ComponentChildren
  showHeader?: boolean
  showFooter?: boolean
}

// 根据当前语言和路径生成导航链接
function getLocalizedNav(locale: string, baseNav: NavItem[]): NavItem[] {
  const localeDir = getLocaleDir(locale as Locale)

  return baseNav.map((item) => {
    let href = item.href

    // 相对链接（./ ../）本身已经按页面目录结构写好了，英文目录下同样适用，所以不改写。
    // 仅当出现绝对路径时，英文版本追加 /en 前缀。
    if (href.startsWith('/')) {
      // 绝对路径：根据语言添加前缀
      if (localeDir) {
        const prefix = `/${localeDir}`
        href = href.startsWith(`${prefix}/`) || href === prefix ? href : `${prefix}${href}`
      }
    }

    return { ...item, href }
  })
}

export function Layout({ 
  title, 
  nav = [], 
  children, 
  showHeader = true, 
  showFooter = true 
}: LayoutProps) {
  const { t, locale } = useI18n()
  const localizedNav = nav.length > 0 ? getLocalizedNav(locale, nav) : []

  return (
    <div class="page">
      {showHeader && (
        <header class="header">
          <div class="brand">
            <div class="brand-title">{t('site.title')}</div>
            <div class="brand-subtitle">{t('site.subtitle')}</div>
          </div>
          <div class="flex items-center gap-3">
            <ThemeSelector />
            <LocaleSelector />
            {localizedNav.length > 0 && (
              <nav class="nav" aria-label="主导航">
                {localizedNav.map((item, index) => (
                  <a key={item.href || index} class="nav-link" href={item.href}>
                    {item.label}
                  </a>
                ))}
              </nav>
            )}
          </div>
        </header>
      )}

      <main class="main">
        <h1 class="h1">{title}</h1>
        {children}
      </main>

      {showFooter && (
        <footer class="footer">
          <span>{t('footer.copyright')}</span>
        </footer>
      )}
    </div>
  )
}

function ThemeSelector() {
  const { t } = useI18n()
  const [theme, setThemeState] = useState<Theme>(getTheme())

  useEffect(() => {
    applyTheme(theme)
  }, [theme])

  function handleThemeChange(newTheme: Theme) {
    setThemeState(newTheme)
    setTheme(newTheme)
  }

  return (
    <div class="flex items-center gap-2">
      <button
        onClick={() => handleThemeChange('light')}
        class={`px-2 py-1 text-xs rounded transition-colors ${theme === 'light'
          ? 'bg-slate-200 dark:bg-slate-700'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        title={t('theme.light')}
      >
        ☀️
      </button>
      <button
        onClick={() => handleThemeChange('dark')}
        class={`px-2 py-1 text-xs rounded transition-colors ${theme === 'dark'
          ? 'bg-slate-200 dark:bg-slate-700'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        title={t('theme.dark')}
      >
        🌙
      </button>
      <button
        onClick={() => handleThemeChange('auto')}
        class={`px-2 py-1 text-xs rounded transition-colors ${theme === 'auto'
          ? 'bg-slate-200 dark:bg-slate-700'
          : 'hover:bg-slate-100 dark:hover:bg-slate-800'
          }`}
        title={t('theme.auto')}
      >
        ⚙️
      </button>
    </div>
  )
}

function LocaleSelector() {
  const { locale, setLocale: setLocaleContext } = useI18n()

  function handleLocaleChange(newLocale: typeof locale) {
    setLocaleContext(newLocale)
    setLocale(newLocale)

    // 跳转到对应语言的页面（使用目录划分）
    if (typeof window !== 'undefined') {
      const path = window.location.pathname
      window.location.href = buildLocalizedRelativePath(path, newLocale)
    }
  }

  return (
    <select
      class="select select-bordered select-sm"
      value={locale}
      onChange={(e) =>
        handleLocaleChange(
          (e.currentTarget as HTMLSelectElement).value as typeof locale,
        )
      }
    >
      {locales.map((loc) => (
        <option key={loc} value={loc}>
          {localeLabels[loc]}
        </option>
      ))}
    </select>
  )
}
