import { render } from 'preact-render-to-string'
import { h } from 'preact'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { locales } from '../src/i18n/locales'
import type { Locale } from '../src/i18n/locales'
import { t as translate } from '../src/i18n/translations'
import { getLocaleDir } from '../src/shared/locale-path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const distDir = resolve(__dirname, '../dist')
const rootDir = resolve(__dirname, '..')

// 页面配置：HTML 路径 -> 组件导入路径
const pages = [
  {
    htmlPath: 'index.html',
    componentPath: '/src/pages/home/Home.tsx',
    componentName: 'Home',
  },
  {
    htmlPath: 'pages/image-crop.html',
    componentPath: '/src/pages/image-crop/ImageCropPage.tsx',
    componentName: 'ImageCropPage',
  },
  {
    htmlPath: 'pages/image-compress.html',
    componentPath: '/src/pages/image-compress/ImageCompressPage.tsx',
    componentName: 'ImageCompressPage',
  },
  {
    htmlPath: 'pages/image-mosaic.html',
    componentPath: '/src/pages/image-mosaic/ImageMosaicPage.tsx',
    componentName: 'ImageMosaicPage',
  },
  {
    htmlPath: 'pages/image-watermark.html',
    componentPath: '/src/pages/image-watermark/ImageWatermarkPage.tsx',
    componentName: 'ImageWatermarkPage',
  },
  {
    htmlPath: 'pages/image-convert.html',
    componentPath: '/src/pages/image-convert/ImageConvertPage.tsx',
    componentName: 'ImageConvertPage',
  },
  {
    htmlPath: 'pages/image-filter.html',
    componentPath: '/src/pages/image-filter/ImageFilterPage.tsx',
    componentName: 'ImageFilterPage',
  },
  {
    htmlPath: 'pages/image-pdf.html',
    componentPath: '/src/pages/image-pdf/ImagePdfPage.tsx',
    componentName: 'ImagePdfPage',
  },
]

function ensureDir(p: string) {
  if (!existsSync(p)) mkdirSync(p, { recursive: true })
}

const BASE_URL = 'https://imgtools365.com'

const pageSeoKeys: Record<string, { titleKey: string; descriptionKey: string }> = {
  'index.html': {
    titleKey: 'home.title',
    descriptionKey: 'home.hero.subtitle',
  },
  'pages/image-crop.html': {
    titleKey: 'imageCrop.title',
    descriptionKey: 'home.tool.crop.desc',
  },
  'pages/image-compress.html': {
    titleKey: 'imageCompress.title',
    descriptionKey: 'home.tool.compress.desc',
  },
  'pages/image-mosaic.html': {
    titleKey: 'imageMosaic.title',
    descriptionKey: 'home.tool.mosaic.desc',
  },
  'pages/image-watermark.html': {
    titleKey: 'imageWatermark.title',
    descriptionKey: 'home.tool.watermark.desc',
  },
  'pages/image-convert.html': {
    titleKey: 'imageConvert.title',
    descriptionKey: 'home.tool.convert.desc',
  },
  'pages/image-filter.html': {
    titleKey: 'imageFilter.title',
    descriptionKey: 'home.tool.filter.desc',
  },
  'pages/image-pdf.html': {
    titleKey: 'imagePdf.title',
    descriptionKey: 'imagePdf.uploadDesc',
  },
}

function localizedAbsoluteUrl(locale: Locale, pagePath: string) {
  const localeDir = getLocaleDir(locale)
  if (pagePath === 'index.html') {
    return `${BASE_URL}/${localeDir ? `${localeDir}/` : ''}`
  }
  return `${BASE_URL}/${localeDir ? `${localeDir}/` : ''}${pagePath}`
}

function toHreflang(locale: Locale) {
  return locale === 'en-US' ? 'en' : locale
}

function buildAlternateLinks(pagePath: string) {
  const links = locales.map((loc) => {
    const href = localizedAbsoluteUrl(loc, pagePath)
    return `  <link rel="alternate" hreflang="${toHreflang(loc)}" href="${href}" />`
  })
  links.push(
    `  <link rel="alternate" hreflang="x-default" href="${localizedAbsoluteUrl('zh-CN', pagePath)}" />`
  )
  return links.join('\n')
}

function getSeoMeta(locale: Locale, pagePath: string) {
  const keys = pageSeoKeys[pagePath]
  if (!keys) return null
  const titleText = translate(locale, keys.titleKey as any)
  const descriptionText = translate(locale, keys.descriptionKey as any)
  const siteTitle = translate(locale, 'site.title' as any)
  const title =
    pagePath === 'index.html' ? titleText : `${titleText} - ${siteTitle}`
  const keywords = `${titleText},${siteTitle},ImgTools365`
  return { title, description: descriptionText, keywords, siteTitle }
}

function applyLocaleBaseHtml(
  zhHtml: string,
  depth: 'root' | 'pages',
  locale: Locale,
) {
  let html = zhHtml
    .replace(/<html[^>]*>/, `<html lang="${locale}">`)
    .replace(/<body([^>]*)>/, `<body$1 data-locale="${locale}">`)

  const localeDir = getLocaleDir(locale)
  if (localeDir) {
    if (depth === 'root') {
      html = html
        .replaceAll('./assets/', '../assets/')
        .replaceAll('./vite.svg', '../vite.svg')
    } else {
      html = html
        .replaceAll('../assets/', '../../assets/')
        .replaceAll('../vite.svg', '../../vite.svg')
    }
  }

  return html
}

function toLocalizedHtmlFromZhHtml(
  zhHtml: string,
  depth: 'root' | 'pages',
  pagePath: string,
  locale: Locale,
) {
  let html = applyLocaleBaseHtml(zhHtml, depth, locale)
  const seoMeta = getSeoMeta(locale, pagePath)
  const ogLocale = locale.replace('-', '_')
  const canonicalUrl = localizedAbsoluteUrl(locale, pagePath)

  // 标准 SEO 元信息（title / description / keywords）
  if (seoMeta) {
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${seoMeta.title}</title>`)
    html = html.replace(
      /<meta name="description" content="[^"]*" ?\/?>/,
      `<meta name="description" content="${seoMeta.description}" />`
    )
    html = html.replace(
      /<meta name="keywords" content="[^"]*" ?\/?>/,
      `<meta name="keywords" content="${seoMeta.keywords}" />`
    )

    html = html.replace(
      /<meta property="og:title" content="[^"]*" ?\/?>/,
      `<meta property="og:title" content="${seoMeta.title}" />`
    )
    html = html.replace(
      /<meta property="og:description"[\s\S]*?content="[^"]*" ?\/?>/,
      `<meta property="og:description" content="${seoMeta.description}" />`
    )
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*" ?\/?>/,
      `<meta name="twitter:title" content="${seoMeta.title}" />`
    )
    html = html.replace(
      /<meta name="twitter:description"[\s\S]*?content="[^"]*" ?\/?>/,
      `<meta name="twitter:description" content="${seoMeta.description}" />`
    )

    // JSON-LD：同步结构化数据中的 name / description / alternateName
    html = html.replace(
      /"description":\s*"[^"]*"/g,
      `"description": "${seoMeta.description}"`
    )
    html = html.replace(
      /"name":\s*"ImgTools365 图片转 PDF"/g,
      `"name": "${seoMeta.title}"`
    )
    html = html.replace(
      /"alternateName":\s*"[^"]*"/g,
      `"alternateName": "${seoMeta.siteTitle}"`
    )
  }

  // canonical / hreflang / og:url / og:locale
  html = html.replace(
    /<link rel="canonical" href="[^"]*" ?\/?>/,
    `<link rel="canonical" href="${canonicalUrl}" />`
  )
  html = html.replace(
    /(?:\s*<link rel="alternate" hreflang="[^"]+" href="[^"]*" ?\/?>\s*)+/,
    `\n${buildAlternateLinks(pagePath)}\n`
  )
  html = html.replace(
    /<meta property="og:url" content="[^"]*" ?\/?>/,
    `<meta property="og:url" content="${canonicalUrl}" />`
  )
  html = html.replace(
    /<meta property="og:locale" content="[^"]*" ?\/?>/,
    `<meta property="og:locale" content="${ogLocale}" />`
  )

  // 结构化数据中的语言与 URL
  html = html.replace(/"inLanguage":\s*"[^"]*"/g, `"inLanguage": "${locale}"`)
  html = html.replace(/"url":\s*"https:\/\/imgtools365\.com\/[^"]*"/g, `"url": "${canonicalUrl}"`)

  return html
}

function generateSitemapXml() {
  const today = new Date().toISOString().slice(0, 10)
  const rows: string[] = []
  rows.push('<?xml version="1.0" encoding="UTF-8"?>')
  rows.push('<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"')
  rows.push('        xmlns:xhtml="http://www.w3.org/1999/xhtml">')
  rows.push('')

  for (const page of pages) {
    const isHome = page.htmlPath === 'index.html'
    const changefreq = isHome ? 'weekly' : 'monthly'
    const priority = isHome ? '1.0' : '0.8'
    const xDefault = localizedAbsoluteUrl('zh-CN', page.htmlPath)

    for (const locale of locales) {
      const loc = localizedAbsoluteUrl(locale, page.htmlPath)
      rows.push('  <url>')
      rows.push(`    <loc>${loc}</loc>`)
      rows.push(`    <lastmod>${today}</lastmod>`)
      rows.push(`    <changefreq>${changefreq}</changefreq>`)
      rows.push(`    <priority>${priority}</priority>`)
      for (const altLocale of locales) {
        rows.push(
          `    <xhtml:link rel="alternate" hreflang="${toHreflang(altLocale)}" href="${localizedAbsoluteUrl(altLocale, page.htmlPath)}"/>`
        )
      }
      rows.push(
        `    <xhtml:link rel="alternate" hreflang="x-default" href="${xDefault}"/>`
      )
      rows.push('  </url>')
      rows.push('')
    }
  }

  rows.push('</urlset>')
  return rows.join('\n')
}

async function prerender() {
  console.log('🔨 开始 SSR 预渲染（多语言）...')

  // 创建 Vite 服务器用于加载 TSX 模块
  const server = await createServer({
    root: rootDir,
    server: { middlewareMode: true },
  })

  try {
    // 先缓存“未注入 appHtml”的原始 HTML 模板（Vite build 输出应为 <div id="app"></div>）
    const baseHtmlByPage = new Map<string, string>()
    for (const page of pages) {
      const zhPath = resolve(distDir, page.htmlPath)
      if (!existsSync(zhPath)) {
        console.warn(`⚠️  缺少 HTML 模板: ${page.htmlPath}`)
        continue
      }
      baseHtmlByPage.set(page.htmlPath, readFileSync(zhPath, 'utf-8'))
    }

    // 为每种语言预渲染（所有语言都使用独立目录）
    const prerenderLocales = locales

    for (const locale of prerenderLocales) {
      console.log(`\n📝 预渲染语言: ${locale}`)

      for (const page of pages) {
        try {
          const baseHtml = baseHtmlByPage.get(page.htmlPath)
          if (!baseHtml) continue

          // 输出路径：所有语言都在 dist/<localeDir>/ 下
          const localeDir = getLocaleDir(locale)
          const outPath = resolve(distDir, `${localeDir}/${page.htmlPath}`)

          ensureDir(dirname(outPath))

          // 加载组件和 I18nProvider
          const moduleUrl = resolve(rootDir, page.componentPath.slice(1))
          const result = await server.ssrLoadModule(moduleUrl)
          const Component = result[page.componentName] || result.default

          if (!Component) {
            console.warn(`⚠️  跳过 ${page.htmlPath}：未找到组件 ${page.componentName}`)
            continue
          }

          // 加载 I18nProvider
          const i18nModule = await server.ssrLoadModule(resolve(rootDir, 'src/shared/I18nProvider.tsx'))
          const I18nProvider = i18nModule.I18nProvider

          // 预渲染组件为 HTML 字符串（传入 locale）
          const appHtml = render(
            h(I18nProvider, { locale: locale as Locale },
              h(Component, {})
            )
          )

          // 选择正确的 HTML 模板（en 需要调整 lang + 资源路径 + SEO 元数据）
          const depth: 'root' | 'pages' = page.htmlPath === 'index.html' ? 'root' : 'pages'
          const htmlTemplate = toLocalizedHtmlFromZhHtml(baseHtml, depth, page.htmlPath, locale)

          // 将预渲染的 HTML 注入到 <div id="app"></div> 中（模板应为空容器）
          const updatedHtml =
            htmlTemplate.includes('<div id="app"></div>')
              ? htmlTemplate.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
              : htmlTemplate.replace(/<div id="app">\s*<\/div>/, `<div id="app">${appHtml}</div>`)

          writeFileSync(outPath, updatedHtml, 'utf-8')
          const displayPath = `${localeDir}/${page.htmlPath}`
          console.log(`✅ 已预渲染: ${displayPath}`)
        } catch (error) {
          console.error(`❌ 预渲染失败 ${page.htmlPath} (${locale}):`, error)
        }
      }
    }
  } finally {
    await server.close()
  }

  const sitemapXml = generateSitemapXml()
  const sitemapOutPath = resolve(distDir, 'sitemap.xml')
  const sitemapPublicPath = resolve(rootDir, 'public/sitemap.xml')
  writeFileSync(sitemapOutPath, sitemapXml, 'utf-8')
  writeFileSync(sitemapPublicPath, sitemapXml, 'utf-8')
  console.log(`\n🗺️  已生成 sitemap: ${sitemapOutPath}`)

  console.log('\n✨ SSR 预渲染完成')
}

prerender().catch(console.error)
