import type { Locale } from "../locales";
import type { TranslationKey } from "../types";

export type TranslationMessages = Partial<Record<TranslationKey, string>>;

const cache: Partial<Record<Locale, TranslationMessages>> = {};

const loaders: Record<Locale, () => Promise<TranslationMessages>> = {
  "zh-CN": () => import("./zh-CN").then((m) => m.zhCN),
  "zh-TW": () => import("./zh-TW").then((m) => m.zhTW),
  "en-US": () => import("./en-US").then((m) => m.enUS),
  "ko-KR": () => import("./ko-KR").then((m) => m.koKR),
  "ja-JP": () => import("./ja-JP").then((m) => m.jaJP),
  "es-ES": () => import("./es-ES").then((m) => m.esES),
  "es-MX": () => import("./es-MX").then((m) => m.esMX),
  "pt-BR": () => import("./pt-BR").then((m) => m.ptBR),
  "vi-VN": () => import("./vi-VN").then((m) => m.viVN),
  "id-ID": () => import("./id-ID").then((m) => m.idID),
  "de-DE": () => import("./de-DE").then((m) => m.deDE),
  "fr-FR": () => import("./fr-FR").then((m) => m.frFR),
  "it-IT": () => import("./it-IT").then((m) => m.itIT),
  "pl-PL": () => import("./pl-PL").then((m) => m.plPL),
  "nl-NL": () => import("./nl-NL").then((m) => m.nlNL),
  "ru-RU": () => import("./ru-RU").then((m) => m.ruRU),
  "uk-UA": () => import("./uk-UA").then((m) => m.ukUA),
  "tr-TR": () => import("./tr-TR").then((m) => m.trTR),
};

export async function loadLocaleMessages(locale: Locale): Promise<TranslationMessages> {
  const hit = cache[locale];
  if (hit) return hit;

  const loader = loaders[locale];
  const messages = await loader();
  cache[locale] = messages;
  return messages;
}
