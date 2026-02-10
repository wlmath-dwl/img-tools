import { useState, useEffect, useRef } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { getTheme, setTheme, applyTheme, type Theme } from "../theme";
import { locales, localeLabels } from "../../i18n/locales";
import { setLocale } from "../locale";
import { buildLocalizedRelativePath } from "../locale-path";
import { DarkModeIcon, LightModeIcon, GlobeIcon } from "../icons";

export function Header() {
  const { locale, setLocale: setLocaleContext } = useI18n();
  const [theme, setThemeState] = useState<Theme>(getTheme());
  const [isLangOpen, setIsLangOpen] = useState(false);
  const langRootRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    applyTheme(theme);
  }, [theme]);

  // 确保主题只可能是 light 或 dark（移除 auto）
  useEffect(() => {
    if (theme === "auto") {
      const prefersDark = window.matchMedia(
        "(prefers-color-scheme: dark)",
      ).matches;
      const actualTheme = prefersDark ? "dark" : "light";
      setThemeState(actualTheme);
      setTheme(actualTheme);
    }
  }, []);

  function handleThemeToggle() {
    const newTheme = theme === "light" ? "dark" : "light";
    setThemeState(newTheme);
    setTheme(newTheme);
  }

  function handleLocaleChange(newLocale: typeof locale) {
    setIsLangOpen(false);
    setLocaleContext(newLocale);
    setLocale(newLocale);

    // 开发模式：不做目录跳转（/en/ 页面仅存在于 build/prerender 的 dist 中），
    // 否则会落到 dev server 的 fallback 页面导致链接/上传逻辑路径错乱。
    if (import.meta.env.DEV) return;

    // 跳转到对应语言的页面（使用目录划分）
    if (typeof window !== "undefined") {
      const path = window.location.pathname;
      window.location.href = buildLocalizedRelativePath(path, newLocale);
    }
  }

  // 确保主题是 light 或 dark
  const currentTheme = theme === "auto" ? "light" : theme;

  // 语言下拉：点击外部关闭（避免只靠 focus-within 导致“点不了/点不到”）
  useEffect(() => {
    if (!isLangOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      const root = langRootRef.current;
      if (!root) return;
      if (e.target instanceof Node && root.contains(e.target)) return;
      setIsLangOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setIsLangOpen(false);
    };
    window.addEventListener("pointerdown", onPointerDown, { capture: true });
    window.addEventListener("keydown", onKeyDown);
    return () => {
      window.removeEventListener("pointerdown", onPointerDown, { capture: true } as any);
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [isLangOpen]);

  return (
    <header class="h-16 flex items-center justify-between gap-4 w-full mx-auto bg-white dark:bg-slate-800 p-4">
      <div class="flex items-center">
        {/* 浅色模式 Logo */}
        <svg
          width="180"
          height="40"
          viewBox="0 0 180 40"
          xmlns="http://www.w3.org/2000/svg"
          class={`${currentTheme === 'dark' ? 'hidden' : 'block'}`}
        >
          <text y="28" font-family="system-ui, sans-serif" font-size="24" letter-spacing="-0.5">
            <tspan font-weight="800" fill="#111111">Img</tspan>
            <tspan font-weight="600" fill="#0891b2">Tools</tspan>
            <tspan font-weight="800" fill="#111111">365</tspan>
          </text>
        </svg>

        {/* 暗色模式 Logo */}
        <svg
          width="180"
          height="40"
          viewBox="0 0 180 40"
          xmlns="http://www.w3.org/2000/svg"
          class={`${currentTheme === 'light' ? 'hidden' : 'block'}`}
        >
          <text y="28" font-family="system-ui, sans-serif" font-size="24" letter-spacing="-0.5">
            <tspan font-weight="800" fill="#ffffff">Img</tspan>
            <tspan font-weight="600" fill="#22d3ee">Tools</tspan>
            <tspan font-weight="800" fill="#ffffff">365</tspan>
          </text>
        </svg>
      </div>
      <div class="flex items-center gap-2.5">
        {/* 语言按钮：深色背景，地球图标 + 语言标识 */}
        <div
          ref={langRootRef}
          class={`dropdown dropdown-end ${isLangOpen ? "dropdown-open" : ""}`}
        >
          <button
            type="button"
            class="btn btn-primary btn-sm gap-2"
            aria-haspopup="listbox"
            aria-expanded={isLangOpen}
            onClick={() => setIsLangOpen((v) => !v)}
          >
            <GlobeIcon size={18} />
            <span>{localeLabels[locale]}</span>
          </button>
          <ul
            class="dropdown-content menu p-2 shadow bg-base-100 rounded-box w-48 z-20"
          >
            {locales.map((loc) => (
              <li key={loc}>
                <button type="button" onClick={() => handleLocaleChange(loc)}>
                  {localeLabels[loc]}
                </button>
              </li>
            ))}
          </ul>
        </div>
        {/* 主题按钮：无背景，直接显示彩色图标 */}
        <button
          type="button"
          class="p-2 hover:opacity-80 transition-opacity"
          onClick={handleThemeToggle}
          aria-label={
            currentTheme === "light" ? "切换到深色模式" : "切换到浅色模式"
          }
          title={currentTheme === "light" ? "切换到深色模式" : "切换到浅色模式"}
        >
          {/* 图标显示“将要切换到的模式”，与 title/aria 文案保持一致 */}
          {currentTheme === "light" ? (
            <LightModeIcon size={24} color="#d97706" />
          ) : (
            <DarkModeIcon size={24} color="#fde68a" />
          )}
        </button>
      </div>
    </header>
  );
}
