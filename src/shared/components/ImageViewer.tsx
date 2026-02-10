import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { CanvasImageViewer, type CanvasImageViewerApi } from './CanvasImageViewer'
import {
  CloseIcon,
  FlipHorizontalIcon,
  FlipVerticalIcon,
  RotateLeft90Icon,
  RotateRight90Icon,
  ZoomInIcon,
  ZoomOutIcon,
} from '../icons'

type ImageViewerProps = {
  isOpen: boolean
  src: string | null
  width?: number
  height?: number
  alt?: string
  onClose: () => void
  /** 可选：生成预览中（不展示复杂 UI，只做按钮禁用与轻提示） */
  loading?: boolean
}

function IconButton(props: {
  title: string
  onClick: () => void
  disabled?: boolean
  children: ComponentChildren
}) {
  return (
    <button
      type="button"
      title={props.title}
      aria-label={props.title}
      onClick={props.onClick}
      disabled={props.disabled}
      class="w-11 h-11 md:w-10 md:h-10 inline-flex items-center justify-center rounded-xl bg-white/10 text-white border border-white/15 shadow-sm hover:bg-white/15 transition-colors disabled:opacity-40 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-black"
    >
      {props.children}
    </button>
  )
}

/**
 * 全屏图片查看器（蒙层 + 图片），用于“点击预览”的轻量预览体验。
 * - 支持拖拽、滚轮缩放、按钮缩放、正/逆时针旋转 90°、水平/垂直翻转
 * - 右上角关闭，ESC 关闭，点蒙层关闭
 */
export function ImageViewer({
  isOpen,
  src,
  width,
  height,
  alt,
  onClose,
  loading = false,
}: ImageViewerProps) {
  const { t } = useI18n()
  alt = alt || t('viewer.preview')
  const [api, setApi] = useState<CanvasImageViewerApi | null>(null)
  const [measured, setMeasured] = useState<{ w: number; h: number } | null>(null)

  // 尽量拿到图片原始尺寸，便于 CanvasImageViewer 正确 fit
  useEffect(() => {
    if (!isOpen) return
    if (!src) return
    if ((width ?? 0) > 0 && (height ?? 0) > 0) {
      setMeasured({ w: width as number, h: height as number })
      return
    }
    let cancelled = false
    const img = new Image()
    img.onload = () => {
      if (cancelled) return
      const w = img.naturalWidth || 1
      const h = img.naturalHeight || 1
      setMeasured({ w, h })
    }
    img.src = src
    return () => {
      cancelled = true
    }
  }, [isOpen, src, width, height])

  // 打开时禁用背景滚动，并支持 ESC 关闭
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onClose])

  const effectiveSize = useMemo(() => {
    const w = width ?? measured?.w
    const h = height ?? measured?.h
    if (!w || !h) return null
    return { w, h }
  }, [width, height, measured])

  if (!isOpen) return null

  return (
    <div class="fixed inset-0 z-50">
      {/* 蒙层 */}
      <div
        class="absolute inset-0 bg-black/70 backdrop-blur-[2px]"
        onClick={onClose}
      />

      {/* 主体（图片区域） */}
      <div class="absolute inset-0 z-10 p-4 md:p-8">
        <div
          class="w-full h-full"
          role="img"
          aria-label={alt}
          onClick={(e) => {
            // 防止点到图片区域误触关闭
            e.stopPropagation()
          }}
        >
          {src && effectiveSize ? (
            <CanvasImageViewer
              imageUrl={src}
              imageWidth={effectiveSize.w}
              imageHeight={effectiveSize.h}
              onApi={setApi}
              showCheckerboard={false}
            />
          ) : (
            <div class="w-full h-full flex items-center justify-center text-sm text-white/80">
              {loading ? t('viewer.generating') : t('viewer.noPreview')}
            </div>
          )}
        </div>
      </div>

      {/* 右上角关闭 */}
      <div class="absolute top-4 right-4 z-20">
        <IconButton title={t('viewer.close')} onClick={onClose}>
          <CloseIcon size={22} color="currentColor" />
        </IconButton>
      </div>

      {/* 底部工具栏 */}
      <div class="absolute inset-x-0 bottom-6 md:bottom-8 z-20 flex justify-center pointer-events-none">
        <div class="pointer-events-auto flex items-center gap-2 rounded-2xl bg-white/10 border border-white/15 backdrop-blur px-3 py-2">
          <IconButton
            title={t('viewer.zoomIn')}
            onClick={() => api?.zoomIn()}
            disabled={!api || loading}
          >
            <ZoomInIcon size={22} color="currentColor" />
          </IconButton>
          <IconButton
            title={t('viewer.zoomOut')}
            onClick={() => api?.zoomOut()}
            disabled={!api || loading}
          >
            <ZoomOutIcon size={22} color="currentColor" />
          </IconButton>
          <div class="w-px h-7 bg-white/20 mx-1" />
          <IconButton
            title={t('viewer.rotateLeft')}
            onClick={() => api?.rotateLeft90()}
            disabled={!api || loading}
          >
            <RotateLeft90Icon size={22} color="currentColor" />
          </IconButton>
          <IconButton
            title={t('viewer.rotateRight')}
            onClick={() => api?.rotateRight90()}
            disabled={!api || loading}
          >
            <RotateRight90Icon size={22} color="currentColor" />
          </IconButton>
          <div class="w-px h-7 bg-white/20 mx-1" />
          <IconButton
            title={t('viewer.flipH')}
            onClick={() => api?.flipHorizontal()}
            disabled={!api || loading}
          >
            <FlipHorizontalIcon size={22} color="currentColor" />
          </IconButton>
          <IconButton
            title={t('viewer.flipV')}
            onClick={() => api?.flipVertical()}
            disabled={!api || loading}
          >
            <FlipVerticalIcon size={22} color="currentColor" />
          </IconButton>
        </div>
      </div>
    </div>
  )
}










