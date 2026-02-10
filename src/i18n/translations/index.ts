import type { Locale } from "../locales";
import type { TranslationKey } from "../types";

// 导入各个语言的翻译
import { zhCN } from "./zh-CN";
import { zhTW } from "./zh-TW";
import { enUS } from "./en-US";
import { koKR } from "./ko-KR";
import { jaJP } from "./ja-JP";
import { esES } from "./es-ES";
import { esMX } from "./es-MX";
import { ptBR } from "./pt-BR";
import { viVN } from "./vi-VN";
import { idID } from "./id-ID";
import { deDE } from "./de-DE";
import { frFR } from "./fr-FR";
import { itIT } from "./it-IT";
import { plPL } from "./pl-PL";
import { nlNL } from "./nl-NL";
import { ruRU } from "./ru-RU";
import { ukUA } from "./uk-UA";
import { trTR } from "./tr-TR";

// 允许“部分翻译”，缺失项会自动回退到 zh-CN
export const translations: Record<
  Locale,
  Partial<Record<TranslationKey, string>>
> = {
  "zh-CN": zhCN,
  "zh-TW": zhTW,
  "en-US": enUS,
  "ko-KR": koKR,
  "ja-JP": jaJP,
  "es-ES": esES,
  "es-MX": esMX,
  "pt-BR": ptBR,
  "vi-VN": viVN,
  "id-ID": idID,
  "de-DE": deDE,
  "fr-FR": frFR,
  "it-IT": itIT,
  "pl-PL": plPL,
  "nl-NL": nlNL,
  "ru-RU": ruRU,
  "uk-UA": ukUA,
  "tr-TR": trTR,
};

// 翻译函数保持不变
export function t(
  locale: Locale,
  key: TranslationKey,
  params?: Record<string, string | number>,
): string {
  const text = translations[locale]?.[key] ?? translations["zh-CN"][key] ?? key;

  if (params) {
    return text.replace(/\{(\w+)\}/g, (_: string, paramKey: string) => {
      return String(params[paramKey] || `{${paramKey}}`);
    });
  }

  return text;
}
