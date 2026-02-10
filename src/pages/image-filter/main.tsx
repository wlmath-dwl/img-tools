import { hydrate, render } from 'preact'
import '../../index.css'
import { ImageFilterPage } from './ImageFilterPage'
import { getTheme, applyTheme } from '../../shared/theme'
import { I18nProvider } from '../../shared/I18nProvider'

// 初始化主题
applyTheme(getTheme())

// 智能选择：如果容器有内容则 hydrate（生产构建），否则 render（开发模式）
const app = document.getElementById('app')!
if (app.children.length > 0) {
  // 生产构建：容器已有预渲染的 HTML，使用 hydrate
  hydrate(
    <I18nProvider>
      <ImageFilterPage />
    </I18nProvider>,
    app
  )
} else {
  // 开发模式：容器为空，使用 render
  render(
    <I18nProvider>
      <ImageFilterPage />
    </I18nProvider>,
    app
  )
}
