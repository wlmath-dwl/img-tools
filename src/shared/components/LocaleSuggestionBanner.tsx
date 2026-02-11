import { useEffect, useMemo, useState } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { localeLabels, locales, type Locale } from "../../i18n/locales";
import { setLocale } from "../locale";
import { buildLocalizedRelativePath } from "../locale-path";

const LOCALE_STORAGE_KEY = "locale";
const PROMPT_DISMISS_UNTIL_KEY = "locale-prompt-dismiss-until";
const PROMPT_DISMISS_MS = 24 * 60 * 60 * 1000;

type SuggestionCopy = {
  prompt: (targetLabel: string) => string;
  switchLabel: string;
  notNowLabel: string;
};

const suggestionCopyMap: Record<Locale, SuggestionCopy> = {
  "zh-CN": {
    prompt: (targetLabel) =>
      `检测到你的浏览器语言是 ${targetLabel}，是否切换？`,
    switchLabel: "切换语言",
    notNowLabel: "暂不切换",
  },
  "zh-TW": {
    prompt: (targetLabel) =>
      `偵測到你的瀏覽器語言是 ${targetLabel}，是否切換？`,
    switchLabel: "切換語言",
    notNowLabel: "暫不切換",
  },
  "en-US": {
    prompt: (targetLabel) =>
      `Detected your browser language is ${targetLabel}. Switch now?`,
    switchLabel: "Switch",
    notNowLabel: "Not now",
  },
  "ko-KR": {
    prompt: (targetLabel) =>
      `브라우저 언어가 ${targetLabel}로 감지되었습니다. 지금 전환할까요?`,
    switchLabel: "전환",
    notNowLabel: "나중에",
  },
  "ja-JP": {
    prompt: (targetLabel) =>
      `ブラウザの言語は${targetLabel}として検出されました。切り替えますか？`,
    switchLabel: "切り替える",
    notNowLabel: "今はしない",
  },
  "es-ES": {
    prompt: (targetLabel) =>
      `Detectamos que el idioma de tu navegador es ${targetLabel}. ¿Cambiar ahora?`,
    switchLabel: "Cambiar",
    notNowLabel: "Ahora no",
  },
  "es-MX": {
    prompt: (targetLabel) =>
      `Detectamos que el idioma de tu navegador es ${targetLabel}. ¿Cambiar ahora?`,
    switchLabel: "Cambiar",
    notNowLabel: "Ahora no",
  },
  "pt-BR": {
    prompt: (targetLabel) =>
      `Detectamos que o idioma do seu navegador é ${targetLabel}. Deseja mudar agora?`,
    switchLabel: "Mudar",
    notNowLabel: "Agora não",
  },
  "vi-VN": {
    prompt: (targetLabel) =>
      `Chúng tôi phát hiện ngôn ngữ trình duyệt của bạn là ${targetLabel}. Chuyển ngay chứ?`,
    switchLabel: "Chuyển đổi",
    notNowLabel: "Để sau",
  },
  "id-ID": {
    prompt: (targetLabel) =>
      `Bahasa browser Anda terdeteksi sebagai ${targetLabel}. Ganti sekarang?`,
    switchLabel: "Ganti",
    notNowLabel: "Nanti saja",
  },
  "de-DE": {
    prompt: (targetLabel) =>
      `Die Sprache deines Browsers wurde als ${targetLabel} erkannt. Jetzt wechseln?`,
    switchLabel: "Wechseln",
    notNowLabel: "Nicht jetzt",
  },
  "fr-FR": {
    prompt: (targetLabel) =>
      `La langue de votre navigateur est ${targetLabel}. Voulez-vous changer maintenant ?`,
    switchLabel: "Changer",
    notNowLabel: "Plus tard",
  },
  "it-IT": {
    prompt: (targetLabel) =>
      `La lingua del tuo browser è ${targetLabel}. Vuoi passare ora?`,
    switchLabel: "Cambia",
    notNowLabel: "Non ora",
  },
  "pl-PL": {
    prompt: (targetLabel) =>
      `Wykryliśmy język przeglądarki: ${targetLabel}. Przełączyć teraz?`,
    switchLabel: "Przełącz",
    notNowLabel: "Nie teraz",
  },
  "nl-NL": {
    prompt: (targetLabel) =>
      `De taal van je browser is gedetecteerd als ${targetLabel}. Nu wisselen?`,
    switchLabel: "Wisselen",
    notNowLabel: "Niet nu",
  },
  "ru-RU": {
    prompt: (targetLabel) =>
      `Мы определили язык вашего браузера как ${targetLabel}. Переключить сейчас?`,
    switchLabel: "Переключить",
    notNowLabel: "Не сейчас",
  },
  "uk-UA": {
    prompt: (targetLabel) =>
      `Мову вашого браузера визначено як ${targetLabel}. Перемкнути зараз?`,
    switchLabel: "Перемкнути",
    notNowLabel: "Не зараз",
  },
  "tr-TR": {
    prompt: (targetLabel) =>
      `Tarayıcı diliniz ${targetLabel} olarak algılandı. Şimdi geçiş yapılsın mı?`,
    switchLabel: "Geçiş yap",
    notNowLabel: "Şimdi değil",
  },
};

function normalizeBrowserLocale(rawLocale: string): Locale | null {
  const value = rawLocale.toLowerCase();

  if (value.startsWith("zh-hant") || value.includes("-hant")) return "zh-TW";
  if (
    value.startsWith("zh-tw") ||
    value.startsWith("zh-hk") ||
    value.startsWith("zh-mo")
  ) {
    return "zh-TW";
  }
  if (value.startsWith("zh")) return "zh-CN";
  if (value.startsWith("en")) return "en-US";
  if (value.startsWith("ja")) return "ja-JP";
  if (value.startsWith("ko")) return "ko-KR";
  if (value.startsWith("es-mx")) return "es-MX";
  if (value.startsWith("es")) return "es-ES";
  if (value.startsWith("pt")) return "pt-BR";
  if (value.startsWith("vi")) return "vi-VN";
  if (value.startsWith("id")) return "id-ID";
  if (value.startsWith("de")) return "de-DE";
  if (value.startsWith("fr")) return "fr-FR";
  if (value.startsWith("it")) return "it-IT";
  if (value.startsWith("pl")) return "pl-PL";
  if (value.startsWith("nl")) return "nl-NL";
  if (value.startsWith("ru")) return "ru-RU";
  if (value.startsWith("uk")) return "uk-UA";
  if (value.startsWith("tr")) return "tr-TR";
  return null;
}

function detectPreferredLocale(): Locale | null {
  if (typeof navigator === "undefined") return null;
  const browserLocales = [
    ...(navigator.languages || []),
    navigator.language,
  ].filter(Boolean) as string[];

  for (const value of browserLocales) {
    const normalized = normalizeBrowserLocale(value);
    if (normalized && (locales as readonly string[]).includes(normalized)) {
      return normalized;
    }
  }
  return null;
}

function isRootPath(pathname: string): boolean {
  return pathname === "/" || pathname === "/index.html";
}

export function LocaleSuggestionBanner() {
  const { locale, setLocale: setLocaleContext } = useI18n();
  const [suggestedLocale, setSuggestedLocale] = useState<Locale | null>(null);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!isRootPath(window.location.pathname)) return;

    const manualLocale = localStorage.getItem(LOCALE_STORAGE_KEY);
    if (manualLocale && (locales as readonly string[]).includes(manualLocale)) {
      return;
    }

    const dismissUntilRaw = localStorage.getItem(PROMPT_DISMISS_UNTIL_KEY);
    const dismissUntil = dismissUntilRaw ? Number(dismissUntilRaw) : 0;
    if (Number.isFinite(dismissUntil) && dismissUntil > Date.now()) return;

    const preferred = detectPreferredLocale();
    if (!preferred || preferred === locale) return;

    setSuggestedLocale(preferred);
    setVisible(true);
  }, [locale]);

  const suggestionCopy = useMemo<SuggestionCopy | null>(() => {
    if (!suggestedLocale) return null;
    return suggestionCopyMap[suggestedLocale] || suggestionCopyMap["en-US"];
  }, [suggestedLocale]);

  const promptText = useMemo(() => {
    if (!suggestedLocale || !suggestionCopy) return "";
    return suggestionCopy.prompt(localeLabels[suggestedLocale]);
  }, [suggestedLocale, suggestionCopy]);

  if (!visible || !suggestedLocale || !suggestionCopy) return null;

  return (
    <div class="w-full bg-amber-50 border-b border-amber-200 dark:bg-amber-900/20 dark:border-amber-700/40">
      <div class="max-w-[1040px] mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-2">
        <div class="text-sm text-amber-900 dark:text-amber-100">
          {promptText}
        </div>
        <div class="flex items-center gap-2">
          <button
            type="button"
            class="btn btn-xs btn-outline"
            onClick={() => {
              localStorage.setItem(
                PROMPT_DISMISS_UNTIL_KEY,
                String(Date.now() + PROMPT_DISMISS_MS),
              );
              setVisible(false);
            }}
          >
            {suggestionCopy.notNowLabel}
          </button>
          <button
            type="button"
            class="btn btn-xs btn-primary"
            onClick={() => {
              setLocaleContext(suggestedLocale);
              setLocale(suggestedLocale);
              setVisible(false);
              if (typeof window !== "undefined") {
                window.location.href = buildLocalizedRelativePath(
                  window.location.pathname,
                  suggestedLocale,
                );
              }
            }}
          >
            {suggestionCopy.switchLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
