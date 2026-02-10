// 主题管理
export type Theme = 'light' | 'dark' | 'auto'

const THEME_STORAGE_KEY = 'theme'

export function getTheme(): Theme {
  // 默认主题：light（与 daisyUI 官网默认一致），仍兼容历史 auto 值
  if (typeof window === 'undefined') return 'light'
  
  const stored = localStorage.getItem(THEME_STORAGE_KEY) as Theme | null
  if (stored && ['light', 'dark', 'auto'].includes(stored)) {
    return stored
  }
  
  return 'light'
}

export function setTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  
  localStorage.setItem(THEME_STORAGE_KEY, theme)
  applyTheme(theme)
}

export function applyTheme(theme: Theme) {
  if (typeof window === 'undefined') return
  
  const root = document.documentElement
  const body = document.body
  
  if (theme === 'auto') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches
    const resolved: Exclude<Theme, 'auto'> = prefersDark ? 'dark' : 'light'
    // Tailwind：暗色模式
    root.classList.toggle('dark', prefersDark)
    // 兼容部分样式只挂在 body 的场景
    body?.classList.toggle('dark', prefersDark)
    // daisyUI：主题变量（决定 btn / bg-base-* 等观感）
    root.setAttribute('data-theme', resolved)
    body?.setAttribute('data-theme', resolved)
  } else {
    root.classList.toggle('dark', theme === 'dark')
    body?.classList.toggle('dark', theme === 'dark')
    root.setAttribute('data-theme', theme)
    body?.setAttribute('data-theme', theme)
  }
}

// 初始化主题
if (typeof window !== 'undefined') {
  applyTheme(getTheme())
  
  // 监听系统主题变化
  const mql = window.matchMedia('(prefers-color-scheme: dark)')
  const onChange = () => {
    if (getTheme() === 'auto') {
      applyTheme('auto')
    }
  }
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', onChange)
  } else if (typeof mql.addListener === 'function') {
    // 兼容旧版 Safari
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(onChange)
  }
}
