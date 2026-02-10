import { createContext } from "preact";
import { useContext } from "preact/hooks";
import type { Locale } from "./locales";
import type { TranslationKey } from "./types";
import { t as translate } from "./translations";

type I18nContextValue = {
  locale: Locale;
  setLocale: (locale: Locale) => void;
  t: (key: TranslationKey, params?: Record<string, string | number>) => string;
};

export const I18nContext = createContext<I18nContextValue>({
  locale: "zh-CN",
  setLocale: () => {},
  t: (key, params) => translate("zh-CN", key, params),
});

export function useI18n() {
  return useContext(I18nContext);
}
