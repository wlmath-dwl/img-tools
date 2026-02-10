// 多语言配置
export type Locale =
  | 'zh-CN'     // 简体中文 - 中国大陆
  | 'zh-TW'     // 繁體中文 - 港澳台/海外华人
  | 'en-US'     // English - 全球/北美
  | 'ko-KR'     // 한국어 - 韩国
  | 'ja-JP'     // 日本語 - 日本
  | 'es-ES'     // Español - 西班牙
  | 'es-MX'     // Español (Latam) - 拉美
  | 'pt-BR'     // Português - 巴西
  | 'vi-VN'     // Tiếng Việt - 越南
  | 'id-ID'     // Bahasa Indonesia - 印尼
  | 'de-DE'     // Deutsch - 德国
  | 'fr-FR'     // Français - 法国
  | 'it-IT'     // Italiano - 意大利
  | 'pl-PL'     // Polski - 波兰
  | 'nl-NL'     // Nederlands - 荷兰
  | 'ru-RU'     // Русский - 俄罗斯
  | 'uk-UA'     // Українська - 乌克兰
  | 'tr-TR'     // Türkçe - 土耳其

export const locales: Locale[] = [
  'zh-CN', 'zh-TW', 'en-US', 'ko-KR', 'ja-JP',
  'es-ES', 'es-MX', 'pt-BR', 'vi-VN', 'id-ID',
  'de-DE', 'fr-FR', 'it-IT', 'pl-PL', 'nl-NL', 'ru-RU',
  'uk-UA', 'tr-TR'
]

export const defaultLocale: Locale = 'zh-CN'

// 语言标签映射
export const localeLabels: Record<Locale, string> = {
  'zh-CN': '中文',
  'zh-TW': '繁體',
  'en-US': 'English',
  'ko-KR': '한국어',
  'ja-JP': '日本語',
  'es-ES': 'Español',
  'es-MX': 'Español (Latam)',
  'pt-BR': 'Português',
  'vi-VN': 'Tiếng Việt',
  'id-ID': 'Bahasa',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'it-IT': 'Italiano',
  'pl-PL': 'Polski',
  'nl-NL': 'Nederlands',
  'ru-RU': 'Русский',
  'uk-UA': 'Українська',
  'tr-TR': 'Türkçe',
}
