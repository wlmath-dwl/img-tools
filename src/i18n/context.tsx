import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Locale } from "./locales";
import type { TranslationKey } from "./types";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (key, params) => {
    const text = key;
    if (!params) return text;
    return text.replace(/\{(\w+)\}/g, (_: string, paramKey: string) => {
      return String(params[paramKey] || `{${paramKey}}`);
    });
  },
});

export function useI18n() {
  return useContext(I18nContext);
}
