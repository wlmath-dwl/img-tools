import { hydrate, render } from "preact";
import type { ComponentType } from "preact";
import { I18nProvider } from "./I18nProvider";
import { getTheme, applyTheme } from "./theme";
import { getLocale } from "./locale";
import { getLocaleFromPathname } from "./locale-path";
import { locales, type Locale } from "../i18n/locales";
import { loadLocaleMessages } from "../i18n/translations/runtime";

function normalizeLocale(v: string | null | undefined): Locale | null {
  if (!v) return null;
  if ((locales as readonly string[]).includes(v)) return v as Locale;
  return null;
}

function resolveInitialLocale(): Locale {
  return (
    getLocaleFromPathname(window.location.pathname) ||
    normalizeLocale(document.body?.dataset?.locale) ||
    normalizeLocale(document.documentElement.lang) ||
    getLocale()
  );
}

export async function bootstrapPage(Page: ComponentType) {
  applyTheme(getTheme());

  const app = document.getElementById("app");
  if (!app) return;

  const locale = resolveInitialLocale();
  const messagesPromise = loadLocaleMessages(locale);
  const fallbackPromise =
    locale === "zh-CN" ? messagesPromise : loadLocaleMessages("zh-CN");
  const [messages, fallbackMessages] = await Promise.all([
    messagesPromise,
    fallbackPromise,
  ]);

  const node = (
    <I18nProvider
      locale={locale}
      messages={messages}
      fallbackMessages={fallbackMessages}
    >
      <Page />
    </I18nProvider>
  );

  if (app.children.length > 0) {
    hydrate(node, app);
  } else {
    render(node, app);
  }
}
