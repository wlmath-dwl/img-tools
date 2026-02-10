import type { ComponentChildren } from 'preact'
import type { CanvasImageViewerApi } from './CanvasImageViewer'
import { FitCanvasIcon } from '../icons'
import { useI18n } from '../../i18n/context'

type CanvasToolbarProps = {
  api: CanvasImageViewerApi
}

function IconButton(props: {
  title: string
  onClick: () => void
  children: ComponentChildren
}) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      class="w-11 h-11 md:w-10 md:h-10 inline-flex items-center justify-center rounded-xl bg-white/80 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 border border-slate-200/60 dark:border-slate-700/60 shadow-sm hover:bg-white dark:hover:bg-slate-900 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-2 dark:focus-visible:ring-slate-100 dark:focus-visible:ring-offset-slate-900"
    >
      {props.children}
    </button>
  )
}

export function CanvasToolbar({ api }: CanvasToolbarProps) {
  const { t } = useI18n()
  return (
    <div class="flex flex-col gap-2">
      <IconButton title={t('viewer.zoomIn')} onClick={() => api.zoomIn()}>
        <PlusIcon />
      </IconButton>
      <IconButton title={t('viewer.zoomOut')} onClick={() => api.zoomOut()}>
        <MinusIcon />
      </IconButton>
      {/* 说明：暂未抽出独立 key，英文下会回退中文 */}
      <IconButton title="适配画布" onClick={() => api.fit()}>
        <FitCanvasIcon size={18} />
      </IconButton>
      <IconButton title={t('viewer.rotateLeft')} onClick={() => api.rotateLeft90()}>
        <RotateLeftIcon />
      </IconButton>
      <IconButton title={t('viewer.rotateRight')} onClick={() => api.rotateRight90()}>
        <RotateRightIcon />
      </IconButton>
    </div>
  )
}

function PlusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function MinusIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path d="M5 12h14" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  )
}

function RotateLeftIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M17 7h-4V3m4 4a8 8 0 1 0 2.3 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function RotateRightIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none">
      <path
        d="M7 7h4V3M7 7a8 8 0 1 1-2.3 5.6"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}
