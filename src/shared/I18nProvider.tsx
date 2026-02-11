import { type ComponentChildren } from "preact";
import { useEffect, useMemo, useState } from "preact/hooks";
import { I18nContext } from "../i18n/context";
import { getLocale, setLocale } from "./locale";
import { locales, type Locale } from "../i18n/locales";
import type { TranslationKey } from "../i18n/types";
import { getLocaleFromPathname } from "./locale-path";
import {
  loadLocaleMessages,
  type TranslationMessages,
} from "../i18n/translations/runtime";

type I18nProviderProps = {
  children: ComponentChildren;
  locale?: Locale;
  messages?: TranslationMessages;
  fallbackMessages?: TranslationMessages;
};

function translate(
  messages: TranslationMessages,
  fallbackMessages: TranslationMessages,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const text = messages[key] ?? fallbackMessages[key] ?? key;

  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (_: string, paramKey: string) => {
    return String(params[paramKey] || `{${paramKey}}`);
  });
}

function normalizeLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  // 支持所有已声明的语言（locale 列表即白名单）
  if ((locales as readonly string[]).includes(v)) return v as Locale;
  return null;
}

function detectLocaleFromDocument(): Locale | null {
  if (typeof document === "undefined") return null;
  const fromBody = normalizeLocale(document.body?.dataset?.locale);
  if (fromBody) return fromBody;
  const fromHtml = normalizeLocale(document.documentElement?.lang);
  if (fromHtml) return fromHtml;
  return null;
}

function detectLocaleFromPathname(): Locale | null {
  if (typeof window === "undefined") return null;
  return getLocaleFromPathname(window.location.pathname);
}

export function I18nProvider({
  children,
  locale: initialLocale,
  messages: initialMessages,
  fallbackMessages: initialFallbackMessages,
}: I18nProviderProps) {
  // 1) SSR 传入 locale（保证预渲染正确）
  // 2) 客户端优先读路径（/en/、/de-DE/），确保路由语言优先
  // 3) 再读 localStorage/浏览器语言（保证用户偏好一致）
  // 4) 最后读 HTML/body 上的 lang/data-locale（hydration 兜底）
  const initial = useMemo<Locale>(() => {
    return (
      initialLocale ||
      detectLocaleFromPathname() ||
      getLocale() ||
      detectLocaleFromDocument()
    );
  }, [initialLocale]);

  const [locale, setLocaleState] = useState<Locale>(initial);
  const [loadedLocale, setLoadedLocale] = useState<Locale | null>(
    initialMessages ? initial : null,
  );
  const [messages, setMessages] = useState<TranslationMessages>(
    initialMessages || {},
  );
  const [fallbackMessages, setFallbackMessages] = useState<TranslationMessages>(
    initialFallbackMessages || initialMessages || {},
  );

  useEffect(() => {
    // locale 变化时同步到 localStorage + <html lang>
    setLocale(locale);
  }, [locale]);

  useEffect(() => {
    let cancelled = false;

    async function syncMessages(nextLocale: Locale) {
      const nextMessages = await loadLocaleMessages(nextLocale);
      const nextFallbackMessages =
        nextLocale === "zh-CN"
          ? nextMessages
          : await loadLocaleMessages("zh-CN");

      if (cancelled) return;
      setMessages(nextMessages);
      setFallbackMessages(nextFallbackMessages);
      setLoadedLocale(nextLocale);
    }

    if (loadedLocale !== locale) {
      void syncMessages(locale);
    }

    return () => {
      cancelled = true;
    };
  }, [locale, loadedLocale]);

  // 使用 useMemo 确保 value 对象在 locale 变化时才更新
  const value = useMemo(
    () => ({
      locale,
      setLocale: setLocaleState,
      t: (key: TranslationKey, params?: Record<string, string | number>) =>
        translate(messages, fallbackMessages, key, params),
    }),
    [locale, messages, fallbackMessages],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}
