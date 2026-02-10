#!/usr/bin/env tsx
/**
 * 批量翻译脚本：将 zh-CN.ts 的所有 key 翻译到其他语言文件
 * 使用免费的谷歌翻译 API (@vitalets/google-translate-api)
 */

import { readFileSync, writeFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { translate } from '@vitalets/google-translate-api'
import type { Locale } from '../src/i18n/locales'
import { locales } from '../src/i18n/locales'

const __dirname = dirname(fileURLToPath(import.meta.url))
const rootDir = resolve(__dirname, '..')
const translationsDir = resolve(rootDir, 'src/i18n/translations')

// 语言代码映射（Google Translate API 使用的语言代码）
const localeToGoogleLang: Record<Locale, string> = {
  'zh-CN': 'zh',
  'zh-TW': 'zh-TW',
  'en-US': 'en',
  'ko-KR': 'ko',
  'ja-JP': 'ja',
  'es-ES': 'es',
  'es-MX': 'es',
  'pt-BR': 'pt',
  'vi-VN': 'vi',
  'id-ID': 'id',
  'de-DE': 'de',
  'fr-FR': 'fr',
  'ru-RU': 'ru',
  'uk-UA': 'uk',
}

// 语言文件变量名映射
const localeToVarName: Record<Locale, string> = {
  'zh-CN': 'zhCN',
  'zh-TW': 'zhTW',
  'en-US': 'enUS',
  'ko-KR': 'koKR',
  'ja-JP': 'jaJP',
  'es-ES': 'esES',
  'es-MX': 'esMX',
  'pt-BR': 'ptBR',
  'vi-VN': 'viVN',
  'id-ID': 'idID',
  'de-DE': 'deDE',
  'fr-FR': 'frFR',
  'ru-RU': 'ruRU',
  'uk-UA': 'ukUA',
}

// 语言注释映射
const localeToComment: Record<Locale, string> = {
  'zh-CN': '简体中文',
  'zh-TW': '繁體中文',
  'en-US': 'English',
  'ko-KR': '한국어',
  'ja-JP': '日本語',
  'es-ES': 'Español',
  'es-MX': 'Español (Latam)',
  'pt-BR': 'Português',
  'vi-VN': 'Tiếng Việt',
  'id-ID': 'Bahasa Indonesia',
  'de-DE': 'Deutsch',
  'fr-FR': 'Français',
  'ru-RU': 'Русский',
  'uk-UA': 'Українська',
}

// 解析 zh-CN.ts 文件，提取所有 key-value
function parseZhCNFile(): Record<string, string> {
  const filePath = resolve(translationsDir, 'zh-CN.ts')
  const content = readFileSync(filePath, 'utf-8')

  // 提取对象内容（从 { 开始到 }; 结束）
  const match = content.match(/export const zhCN[^=]*=\s*\{([\s\S]*)\};/)
  if (!match) {
    throw new Error('无法解析 zh-CN.ts 文件')
  }

  const objContent = match[1]
  const translations: Record<string, string> = {}

  // 使用正则表达式提取 key-value 对
  // 匹配 "key": "value" 或 "key": "value", 格式
  const kvRegex = /"([^"]+)":\s*"([^"]*(?:\\.[^"]*)*)"/g
  let m: RegExpExecArray | null
  while ((m = kvRegex.exec(objContent)) !== null) {
    const key = m[1]
    // 处理转义字符
    const value = m[2]
      .replace(/\\n/g, '\n')
      .replace(/\\"/g, '"')
      .replace(/\\\\/g, '\\')
    translations[key] = value
  }

  return translations
}

// 提取参数占位符（如 {width}、{height} 等）
function extractPlaceholders(text: string): { cleanText: string; placeholders: Array<{ key: string; value: string }> } {
  const placeholders: Array<{ key: string; value: string }> = []
  const placeholderRegex = /\{(\w+)\}/g
  let match: RegExpExecArray | null
  const seen = new Set<string>()

  while ((match = placeholderRegex.exec(text)) !== null) {
    const key = match[1]
    if (!seen.has(key)) {
      seen.add(key)
      placeholders.push({ key, value: match[0] })
    }
  }

  // 用临时标记替换占位符，翻译后再恢复
  let cleanText = text
  placeholders.forEach((p, idx) => {
    cleanText = cleanText.replace(new RegExp(`\\{${p.key}\\}`, 'g'), `__PLACEHOLDER_${idx}__`)
  })

  return { cleanText, placeholders }
}

// 恢复参数占位符
function restorePlaceholders(text: string, placeholders: Array<{ key: string; value: string }>): string {
  let result = text
  placeholders.forEach((p, idx) => {
    result = result.replace(new RegExp(`__PLACEHOLDER_${idx}__`, 'g'), p.value)
  })
  return result
}

// 批量翻译（每次最多 100 个字符，避免 API 限制）
async function translateBatch(
  texts: string[],
  targetLang: string,
): Promise<string[]> {
  const results: string[] = []
  const batchSize = 5 // 每次翻译 5 条，避免频率限制

  for (let i = 0; i < texts.length; i += batchSize) {
    const batch = texts.slice(i, i + batchSize)
    console.log(`  翻译批次 ${Math.floor(i / batchSize) + 1}/${Math.ceil(texts.length / batchSize)} (${batch.length} 条)`)

    const batchPromises = batch.map(async (text, idx) => {
      if (!text || text.trim().length === 0) {
        return text
      }

      // 跳过纯英文或数字（如 "A4", "Clean Bright" 等），但保留包含中文的
      if (/^[A-Za-z0-9\s\-_()]+$/.test(text) && !text.includes('中文') && !text.includes('（')) {
        return text
      }

      try {
        // 提取占位符
        const { cleanText, placeholders } = extractPlaceholders(text)

        // 添加延迟避免频率限制
        await new Promise((r) => setTimeout(r, idx * 200 + Math.random() * 100))

        const result = await translate(cleanText, {
          to: targetLang,
          from: 'zh',
        })

        // 恢复占位符
        const translated = restorePlaceholders(result.text, placeholders)
        return translated
      } catch (error) {
        console.error(`    翻译失败 "${text.substring(0, 30)}...":`, error)
        // 翻译失败时返回原文
        return text
      }
    })

    const batchResults = await Promise.all(batchPromises)
    results.push(...batchResults)

    // 批次间延迟
    if (i + batchSize < texts.length) {
      await new Promise((r) => setTimeout(r, 1000))
    }
  }

  return results
}

// 生成语言文件内容
function generateLanguageFile(
  locale: Locale,
  translations: Record<string, string>,
): string {
  const varName = localeToVarName[locale]
  const comment = localeToComment[locale]
  const isPartial = locale !== 'zh-CN'

  const header = `import type { TranslationKey } from "../types";

// ${comment}：${isPartial ? '允许部分翻译，缺失项会回退到 zh-CN' : '完整翻译'}
export const ${varName}: ${isPartial ? 'Partial<Record<TranslationKey, string>>' : 'Record<TranslationKey, string>'} = {`

  const entries = Object.entries(translations)
    .map(([key, value]) => {
      // 转义特殊字符
      const escapedValue = value
        .replace(/\\/g, '\\\\')
        .replace(/"/g, '\\"')
        .replace(/\n/g, '\\n')
      return `  "${key}": "${escapedValue}"`
    })
    .join(',\n')

  return `${header}\n${entries}\n} as const;\n`
}

// 主函数
async function main() {
  console.log('🚀 开始批量翻译 i18n 文件...\n')

  // 1. 解析 zh-CN.ts
  console.log('📖 解析 zh-CN.ts 文件...')
  const zhCNTranslations = parseZhCNFile()
  const keys = Object.keys(zhCNTranslations)
  const values = Object.values(zhCNTranslations)
  console.log(`✅ 找到 ${keys.length} 个翻译键\n`)

  // 2. 需要翻译的目标语言（排除 zh-CN 和 en-US）
  const targetLocales = locales.filter(
    (loc) => loc !== 'zh-CN' && loc !== 'en-US',
  )

  console.log(`🎯 目标语言: ${targetLocales.join(', ')}\n`)

  // 3. 对每个目标语言进行翻译
  for (const locale of targetLocales) {
    const googleLang = localeToGoogleLang[locale]
    const varName = localeToVarName[locale]
    const comment = localeToComment[locale]

    console.log(`\n🌍 翻译到 ${comment} (${locale})...`)

    try {
      // 批量翻译所有值
      const translatedValues = await translateBatch(values, googleLang)

      // 构建翻译结果对象
      const translatedTranslations: Record<string, string> = {}
      for (let i = 0; i < keys.length; i++) {
        translatedTranslations[keys[i]] = translatedValues[i]
      }

      // 生成文件内容
      const fileContent = generateLanguageFile(locale, translatedTranslations)

      // 写入文件
      const fileName = locale.replace('-', '-') + '.ts'
      const filePath = resolve(translationsDir, fileName)
      writeFileSync(filePath, fileContent, 'utf-8')

      console.log(`✅ 已生成: ${fileName}`)
    } catch (error) {
      console.error(`❌ 翻译 ${locale} 失败:`, error)
    }
  }

  console.log('\n✨ 翻译完成！')
}

main().catch(console.error)
