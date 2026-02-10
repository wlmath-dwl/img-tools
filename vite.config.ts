import { defineConfig } from 'vite'
import preact from '@preact/preset-vite'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'node:path'

// https://vite.dev/config/
export default defineConfig({
  plugins: [tailwindcss(), preact()],
  // 让构建产物在任意静态托管（子路径/Pages/GitHub Pages）下都更稳：资源使用相对路径
  base: './',
  build: {
    // 更强的 CSS 压缩（对 Tailwind/DaisyUI 产物更友好）
    cssMinify: 'lightningcss',
    rollupOptions: {
      // 多页面入口：每个工具一个 HTML（中文版本）。英文版本在 build 后由 prerender 脚本生成到 dist/en/。
      input: {
        index: resolve(__dirname, 'index.html'),
        imageCrop: resolve(__dirname, 'pages/image-crop.html'),
        imageCompress: resolve(__dirname, 'pages/image-compress.html'),
        imageMosaic: resolve(__dirname, 'pages/image-mosaic.html'),
        imageWatermark: resolve(__dirname, 'pages/image-watermark.html'),
        imageConvert: resolve(__dirname, 'pages/image-convert.html'),
        imageFilter: resolve(__dirname, 'pages/image-filter.html'),
        imagePdf: resolve(__dirname, 'pages/image-pdf.html'),
      },
    },
  },
})
