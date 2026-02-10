import { render } from 'preact-render-to-string'
import { h } from 'preact'
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createServer } from 'vite'
import { locales } from '../src/i18n/locales'
import type { Locale } from '../src/i18n/locales'
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

// 英文版 SEO 元数据映射
const enSeoMeta: Record<string, {
  title: string
  description: string
  keywords: string
  schemaName: string
  schemaFeatures: string[]
}> = {
  'index.html': {
    title: 'Image to PDF - ImgTools365 | Free Online Image Toolbox',
    description: 'ImgTools365: Free privacy image toolbox. Focus on image to PDF conversion, supporting lossless compression, cropping, and WebP/JPG conversion. All processing is completed locally in browser, ensuring privacy security.',
    keywords: 'image to PDF,ImgTools365,online image tools,lossless compression,WebP to JPG,image crop,batch image processing,privacy tools,free image tools',
    schemaName: 'ImgTools365 Image to PDF',
    schemaFeatures: [],
  },
  'pages/image-pdf.html': {
    title: 'Image to PDF - Free Online Batch Converter | ImgTools365',
    description: 'Free online image to PDF tool. Support JPG/PNG/WebP batch conversion, drag and drop to reorder pages. Pure browser-based local processing, protecting privacy.',
    keywords: 'image to PDF,JPG to PDF,PNG to PDF,WebP to PDF,batch image to PDF,online PDF generator,free PDF tool,merge images to PDF',
    schemaName: 'Image to PDF - ImgTools365',
    schemaFeatures: ['Batch image to PDF', 'Drag and drop reorder', 'Custom paper size', 'Privacy-first local processing'],
  },
  'pages/image-crop.html': {
    title: 'Image Crop - Free Online Cropping Tool | ImgTools365',
    description: 'Free online image cropping tool. Support preset ratios (16:9, 4:3, 1:1), circle crop, and pixel-level controls. Batch crop with one-click sync. Pure browser-based local processing.',
    keywords: 'image crop,online crop,photo cropper,circle crop,batch crop,ratio crop,free crop tool',
    schemaName: 'Image Crop - ImgTools365',
    schemaFeatures: ['Preset ratio cropping', 'Circle crop', 'Pixel-level controls', 'Batch sync apply'],
  },
  'pages/image-compress.html': {
    title: 'Image Compress - Free Online Compression Tool | ImgTools365',
    description: 'Free online image compression tool. Support JPG/PNG/WebP batch compression with adjustable quality parameters. Pure browser-based local processing, protecting privacy.',
    keywords: 'image compress,online compression,JPG compress,PNG compress,WebP compress,batch compress,image size reducer,free compression tool',
    schemaName: 'Image Compress - ImgTools365',
    schemaFeatures: ['JPG/PNG/WebP compression', 'Batch compression', 'Custom quality parameters', 'Real-time preview'],
  },
  'pages/image-mosaic.html': {
    title: 'Privacy Mosaic - Free Online Image Blur Tool | ImgTools365',
    description: 'Free online image mosaic tool. Support brush painting and rectangle masking with mosaic and Gaussian blur effects. Protect sensitive privacy info. Pure browser-based local processing.',
    keywords: 'image mosaic,online blur,privacy protection,image blur,sensitive info masking,free mosaic tool,photo blur',
    schemaName: 'Privacy Mosaic - ImgTools365',
    schemaFeatures: ['Brush painting blur', 'Rectangle masking', 'Mosaic effect', 'Gaussian blur effect'],
  },
  'pages/image-watermark.html': {
    title: 'Batch Watermark - Free Online Watermark Tool | ImgTools365',
    description: 'Free online image watermark tool. Support text and logo watermarks with full-screen tile mode. Batch add watermarks for copyright protection. Pure browser-based local processing.',
    keywords: 'image watermark,batch watermark,text watermark,logo watermark,copyright protection,free watermark tool,online watermark',
    schemaName: 'Batch Watermark - ImgTools365',
    schemaFeatures: ['Text watermark', 'Logo watermark', 'Full-screen tile mode', 'Batch watermarking'],
  },
  'pages/image-convert.html': {
    title: 'Format Convert - Free Online Image Converter | ImgTools365',
    description: 'Free online image format converter. Convert between JPG/PNG/WebP instantly with batch export and custom quality settings. Pure browser-based local processing.',
    keywords: 'image format convert,JPG to PNG,PNG to JPG,WebP convert,batch format convert,free image converter,online converter',
    schemaName: 'Format Convert - ImgTools365',
    schemaFeatures: ['JPG/PNG/WebP conversion', 'Batch format convert', 'Custom output quality', 'Instant conversion'],
  },
  'pages/image-filter.html': {
    title: 'Image Filter - Free Online Photo Enhancement Tool | ImgTools365',
    description: 'Free online image filter and color adjustment tool. Precisely adjust brightness, contrast, saturation, and temperature. Built-in presets for batch enhancement. Pure browser-based processing.',
    keywords: 'image filter,online color adjustment,brightness contrast,saturation adjustment,preset filters,batch enhancement,free filter tool,photo editing',
    schemaName: 'Image Filter - ImgTools365',
    schemaFeatures: ['Brightness/Contrast/Saturation adjustment', 'Temperature adjustment', 'Preset filters', 'Batch enhancement'],
  },
}

function localizeUrl(url: string, localeDir: string) {
  if (!localeDir) return url
  const marker = `imgtools365.com/${localeDir}/`
  if (url.includes(marker)) return url
  return url.replace('imgtools365.com/', `imgtools365.com/${localeDir}/`)
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

function toEnHtmlFromZhHtml(zhHtml: string, depth: 'root' | 'pages', pagePath: string) {
  let html = applyLocaleBaseHtml(zhHtml, depth, 'en-US')

  // 3) 替换 SEO 元数据为英文版
  const enMeta = enSeoMeta[pagePath]
  if (enMeta) {
    // title
    html = html.replace(/<title>[^<]*<\/title>/, `<title>${enMeta.title}</title>`)
    
    // meta description
    html = html.replace(
      /<meta name="description" content="[^"]*"/,
      `<meta name="description" content="${enMeta.description}"`
    )
    
    // meta keywords
    html = html.replace(
      /<meta name="keywords" content="[^"]*"/,
      `<meta name="keywords" content="${enMeta.keywords}"`
    )
    
    // canonical URL：替换为 /en/ 路径
    html = html.replace(
      /<link rel="canonical" href="([^"]*)"/,
      (_, url) => `<link rel="canonical" href="${localizeUrl(url, 'en')}"`
    )
    
    // hreflang x-default：英文版的 x-default 指向英文版
    html = html.replace(
      /<link rel="alternate" hreflang="x-default" href="([^"]*)"/,
      (_, url) => `<link rel="alternate" hreflang="x-default" href="${localizeUrl(url, 'en')}"`
    )
    
    // og:url
    html = html.replace(
      /<meta property="og:url" content="([^"]*)"/,
      (_, url) => `<meta property="og:url" content="${localizeUrl(url, 'en')}"`
    )
    
    // og:locale
    html = html.replace(
      /<meta property="og:locale" content="[^"]*"/,
      '<meta property="og:locale" content="en_US"'
    )
    
    // og:title
    html = html.replace(
      /<meta property="og:title" content="[^"]*"/,
      `<meta property="og:title" content="${enMeta.title}"`
    )
    
    // og:description（可能跨行，使用正则 s 标志）
    html = html.replace(
      /<meta property="og:description"[\s\S]*?content="[^"]*"/,
      `<meta property="og:description" content="${enMeta.description}"`
    )
    
    // twitter:title
    html = html.replace(
      /<meta name="twitter:title" content="[^"]*"/,
      `<meta name="twitter:title" content="${enMeta.title}"`
    )
    
    // twitter:description（可能跨行，使用正则 [\s\S]*? 匹配换行）
    html = html.replace(
      /<meta name="twitter:description"[\s\S]*?content="[^"]*"/,
      `<meta name="twitter:description" content="${enMeta.description}"`
    )

    // 替换 Schema.org JSON-LD 结构化数据为英文版
    // 替换 WebApplication Schema 中的中文内容
    html = html.replace(
      /"name":\s*"[^"]*\s*-\s*ImgTools365"/g,
      `"name": "${enMeta.schemaName}"`
    )
    html = html.replace(
      /"description":\s*"[^"]*"/g,
      `"description": "${enMeta.description}"`
    )
    // 替换 URL 为英文版路径
    html = html.replace(
      /"url":\s*"https:\/\/imgtools365\.com\/([^"]*)"/g,
      (_, path) => {
        const enPath = path ? `en/${path}` : 'en/'
        return `"url": "https://imgtools365.com/${enPath}"`
      }
    )
    // 替换 featureList
    if (enMeta.schemaFeatures.length > 0) {
      html = html.replace(
        /"featureList":\s*\[[^\]]*\]/,
        `"featureList": ${JSON.stringify(enMeta.schemaFeatures)}`
      )
    }
    // 替换 priceCurrency
    html = html.replace(/"priceCurrency":\s*"CNY"/g, '"priceCurrency": "USD"')
    // 替换 inLanguage
    html = html.replace(/"inLanguage":\s*"zh-CN"/g, '"inLanguage": "en-US"')
    // 替换 alternateName
    html = html.replace(/"alternateName":\s*"[^"]*"/g, '"alternateName": "Image Toolbox"')
    // 替换首页 SoftwareApplication 的 name
    html = html.replace(
      /"name":\s*"ImgTools365 图片转 PDF"/g,
      '"name": "ImgTools365 Image to PDF"'
    )
    // 替换 HowTo Schema 中的中文内容
    html = html.replace(/"name":\s*"如何将图片转换为PDF"/g, '"name": "How to convert images to PDF"')
    html = html.replace(
      /"description":\s*"使用ImgTools365免费在线工具将多张图片批量转换为PDF文档"/g,
      '"description": "Use ImgTools365 free online tool to batch convert multiple images to PDF document"'
    )
    html = html.replace(/"name":\s*"上传图片"/g, '"name": "Upload images"')
    html = html.replace(
      /"text":\s*"点击或拖拽上传JPG\/PNG\/WebP格式的图片，支持批量上传"/g,
      '"text": "Click or drag and drop to upload JPG/PNG/WebP images, supports batch upload"'
    )
    html = html.replace(/"name":\s*"调整顺序"/g, '"name": "Reorder"')
    html = html.replace(
      /"text":\s*"拖动图片调整PDF页面顺序"/g,
      '"text": "Drag images to adjust PDF page order"'
    )
    html = html.replace(/"name":\s*"生成下载"/g, '"name": "Generate and download"')
    html = html.replace(
      /"text":\s*"点击生成按钮，PDF将立即在本地生成并下载"/g,
      '"text": "Click generate button, PDF will be created and downloaded instantly on your device"'
    )
  }

  return html
}

function toLocalizedHtmlFromZhHtml(
  zhHtml: string,
  depth: 'root' | 'pages',
  pagePath: string,
  locale: Locale,
) {
  if (locale === 'en-US') return toEnHtmlFromZhHtml(zhHtml, depth, pagePath)
  let html = applyLocaleBaseHtml(zhHtml, depth, locale)
  if (locale === 'zh-CN') return html

  const localeDir = getLocaleDir(locale)
  const ogLocale = locale.replace('-', '_')

  html = html.replace(
    /<link rel="canonical" href="([^"]*)"/,
    (_, url) => `<link rel="canonical" href="${localizeUrl(url, localeDir)}"`
  )
  html = html.replace(
    /<meta property="og:url" content="([^"]*)"/,
    (_, url) => `<meta property="og:url" content="${localizeUrl(url, localeDir)}"`
  )
  html = html.replace(
    /<meta property="og:locale" content="[^"]*"/,
    `<meta property="og:locale" content="${ogLocale}"`
  )
  html = html.replace(
    /"url":\s*"https:\/\/imgtools365\.com\/([^"]*)"/g,
    (_, path) => {
      const localizedPath = path ? `${localeDir}/${path}` : `${localeDir}/`
      return `"url": "https://imgtools365.com/${localizedPath}"`
    }
  )
  html = html.replace(/"inLanguage":\s*"[^"]*"/g, `"inLanguage": "${locale}"`)

  return html
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

    // 为每种语言预渲染（zh-CN 根目录，其它语言使用独立目录）
    const prerenderLocales = locales

    for (const locale of prerenderLocales) {
      console.log(`\n📝 预渲染语言: ${locale}`)

      for (const page of pages) {
        try {
          const baseHtml = baseHtmlByPage.get(page.htmlPath)
          if (!baseHtml) continue

          // 输出路径：中文在根目录，其它语言在 dist/<localeDir>/ 下
          const localeDir = getLocaleDir(locale)
          const outPath =
            locale === 'zh-CN'
              ? resolve(distDir, page.htmlPath)
              : resolve(distDir, `${localeDir}/${page.htmlPath}`)

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
          const htmlTemplate =
            locale === 'zh-CN'
              ? baseHtml
              : toLocalizedHtmlFromZhHtml(baseHtml, depth, page.htmlPath, locale)

          // 将预渲染的 HTML 注入到 <div id="app"></div> 中（模板应为空容器）
          const updatedHtml =
            htmlTemplate.includes('<div id="app"></div>')
              ? htmlTemplate.replace('<div id="app"></div>', `<div id="app">${appHtml}</div>`)
              : htmlTemplate.replace(/<div id="app">\s*<\/div>/, `<div id="app">${appHtml}</div>`)

          writeFileSync(outPath, updatedHtml, 'utf-8')
          const displayPath = locale === 'zh-CN' 
            ? page.htmlPath 
            : `${localeDir}/${page.htmlPath}`
          console.log(`✅ 已预渲染: ${displayPath}`)
        } catch (error) {
          console.error(`❌ 预渲染失败 ${page.htmlPath} (${locale}):`, error)
        }
      }
    }
  } finally {
    await server.close()
  }

  console.log('\n✨ SSR 预渲染完成')
}

prerender().catch(console.error)
