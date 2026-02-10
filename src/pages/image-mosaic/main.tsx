import { hydrate, render } from 'preact'
import '../../index.css'
import { ImageMosaicPage } from './ImageMosaicPage'
import { getTheme, applyTheme } from '../../shared/theme'
import { I18nProvider } from '../../shared/I18nProvider'

// 初始化主题
applyTheme(getTheme())

// 智能选择：如果容器有内容则 hydrate（生产构建），否则 render（开发模式）
const app = document.getElementById('app')!
if (app.children.length > 0) {
  hydrate(
    <I18nProvider>
      <ImageMosaicPage />
    </I18nProvider>,
    app
  )
} else {
  render(
    <I18nProvider>
      <ImageMosaicPage />
    </I18nProvider>,
    app
  )
}

