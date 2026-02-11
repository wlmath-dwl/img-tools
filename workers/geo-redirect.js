/**
 * Cloudflare Worker: 根路径按国家分发语言
 *
 * 部署：复制到 Cloudflare Dashboard -> Workers -> 新建 Worker -> 粘贴 -> 保存
 * 路由：Workers & Pages -> 详情 -> Settings -> Triggers -> Add route
 *       例如：imgtools365.com/* 或 your-domain.com/*
 *
 * 规则：
 * - 仅处理 "/" 和 "/index.html"
 * - 按 cf.country 映射到对应语言子目录，找不到则默认 /en/
 * - 所有语言均使用目录路径（例如 /zh-CN/）
 * - Bot 不重定向，SEO 爬虫正常抓取
 * - 优先 cookie.locale（用户手动切换语言时写入）
 */

const DEFAULT_LOCALE = "en-US";

const SUPPORTED_LOCALES = new Set([
  "zh-CN",
  "zh-TW",
  "en-US",
  "ko-KR",
  "ja-JP",
  "es-ES",
  "es-MX",
  "pt-BR",
  "vi-VN",
  "id-ID",
  "de-DE",
  "fr-FR",
  "it-IT",
  "pl-PL",
  "nl-NL",
  "ru-RU",
  "uk-UA",
  "tr-TR",
]);

const COUNTRY_TO_LOCALE = {
  // 简中
  CN: "zh-CN",

  // 繁中
  TW: "zh-TW",
  HK: "zh-TW",
  MO: "zh-TW",

  // 英文
  US: "en-US",
  GB: "en-US",
  CA: "en-US",
  AU: "en-US",
  NZ: "en-US",
  IE: "en-US",
  SG: "en-US",
  IN: "en-US",
  PH: "en-US",
  MY: "en-US",

  // 日韩
  JP: "ja-JP",
  KR: "ko-KR",

  // 西语
  ES: "es-ES",
  MX: "es-MX",
  AR: "es-MX",
  CL: "es-MX",
  CO: "es-MX",
  PE: "es-MX",
  VE: "es-MX",
  UY: "es-MX",
  PY: "es-MX",
  BO: "es-MX",
  EC: "es-MX",
  CR: "es-MX",
  PA: "es-MX",
  GT: "es-MX",
  HN: "es-MX",
  SV: "es-MX",
  NI: "es-MX",
  DO: "es-MX",
  PR: "es-MX",

  // 葡语
  BR: "pt-BR",

  // 越南/印尼
  VN: "vi-VN",
  ID: "id-ID",

  // 欧洲语系
  DE: "de-DE",
  AT: "de-DE",
  CH: "de-DE",

  FR: "fr-FR",
  BE: "fr-FR",
  LU: "fr-FR",

  IT: "it-IT",
  PL: "pl-PL",
  NL: "nl-NL",
  RU: "ru-RU",
  UA: "uk-UA",
  TR: "tr-TR",
};

function localeToDir(locale) {
  if (locale === "en-US") return "en";
  return locale;
}

function isBot(ua = "") {
  return /bot|crawler|spider|googlebot|bingbot|yandex|baiduspider|duckduckbot|slurp/i.test(ua);
}

function parseCookie(cookieHeader = "") {
  const map = {};
  for (const part of cookieHeader.split(";")) {
    const i = part.indexOf("=");
    if (i > -1) {
      const k = part.slice(0, i).trim();
      const v = decodeURIComponent(part.slice(i + 1).trim());
      map[k] = v;
    }
  }
  return map;
}

function resolveLocale(request) {
  const cookies = parseCookie(request.headers.get("cookie") || "");
  const fromCookie = cookies.locale;
  if (fromCookie && SUPPORTED_LOCALES.has(fromCookie)) return fromCookie;

  const country = request.cf?.country || "US";
  const mapped = COUNTRY_TO_LOCALE[country] || DEFAULT_LOCALE;
  return SUPPORTED_LOCALES.has(mapped) ? mapped : DEFAULT_LOCALE;
}

export default {
  async fetch(request) {
    const url = new URL(request.url);
    const path = url.pathname;

    const isRoot = path === "/" || path === "/index.html";
    if (!isRoot) return fetch(request);

    const ua = request.headers.get("user-agent") || "";
    if (isBot(ua)) return fetch(request);

    const locale = resolveLocale(request);
    const dir = localeToDir(locale);
    const target = `${url.origin}/${dir ? `${dir}/` : ""}`;

    if (url.href === target || url.pathname === `/${dir}/`) return fetch(request);

    return Response.redirect(target, 302);
  },
};
