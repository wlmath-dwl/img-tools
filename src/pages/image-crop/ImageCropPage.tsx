import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { canvasToBlob, type ImageInfo } from '../../shared/image'
import { ImageToolLayout } from '../../shared/components/ImageToolLayout'
import { type OutputType } from '../../shared/components/ExportSettingsDialog'
import type { CropMode } from './CropOverlay'
import { CropOverlay } from './CropOverlay'
import { CropRatioSelect, getRatioByValue } from './CropRatioSelect'
import { useImageItems } from '../../shared/useImageItems'

// 获取默认导出设置（从 localStorage 读取或使用默认值）
function getDefaultExportSettings() {
  const STORAGE_KEY = 'img-tools-export-settings-v1'
  const DEFAULT_SETTINGS = {
    format: 'image/png' as OutputType,
    quality: 85,
    optimizeForWeb: false,
  }
  
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<typeof DEFAULT_SETTINGS>
    return {
      format: parsed.format ?? DEFAULT_SETTINGS.format,
      quality: parsed.quality ?? DEFAULT_SETTINGS.quality,
      optimizeForWeb: parsed.optimizeForWeb ?? DEFAULT_SETTINGS.optimizeForWeb,
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function clampInt(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, Math.trunc(v)))
}

type CropRect = { x: number; y: number; w: number; h: number }
type AppliedCropRule = {
  modeValue: string
  customRatioW: number | null
  customRatioH: number | null
  rectX: number
  rectY: number
  rectW: number
  rectH: number
  // 圆形裁切：用中心点与最短边比例保持正圆
  rectCx?: number
  rectCy?: number
  rectSize?: number
}
type SavedCropState = {
  modeValue: string
  customRatioW: number | null
  customRatioH: number | null
  rect: CropRect
}

function clampRect(r: CropRect, maxW: number, maxH: number): CropRect {
  const x = clampInt(r.x, 0, Math.max(0, maxW - 1))
  const y = clampInt(r.y, 0, Math.max(0, maxH - 1))
  const w = clampInt(r.w, 1, Math.max(1, maxW - x))
  const h = clampInt(r.h, 1, Math.max(1, maxH - y))
  return { x, y, w, h }
}

function initRect(maxW: number, maxH: number): CropRect {
  const inset = 0.1
  const w = Math.max(48, Math.round(maxW * (1 - inset * 2)))
  const h = Math.max(48, Math.round(maxH * (1 - inset * 2)))
  const x = Math.round((maxW - w) / 2)
  const y = Math.round((maxH - h) / 2)
  return clampRect({ x, y, w, h }, maxW, maxH)
}

function fitRectToRatio(rect: CropRect, ratio: number, maxW: number, maxH: number): CropRect {
  // ratio = w/h，保持中心，尽量在原 rect 内缩放
  const cx = rect.x + rect.w / 2
  const cy = rect.y + rect.h / 2
  let w = rect.w
  let h = rect.h
  if (w / h > ratio) w = Math.round(h * ratio)
  else h = Math.round(w / ratio)
  const x = Math.round(cx - w / 2)
  const y = Math.round(cy - h / 2)
  return clampRect({ x, y, w, h }, maxW, maxH)
}

export function ImageCropPage() {
  const { t } = useI18n()
  const [error, setError] = useState<string | null>(null)

  const { items, activeId, setActiveId, active, addFiles, removeOne, clearAll } = useImageItems()
  const info = active?.info ?? null

  const [modeValue, setModeValue] = useState<string>('free')
  const [customRatioW, setCustomRatioW] = useState<number | null>(null)
  const [customRatioH, setCustomRatioH] = useState<number | null>(null)
  const [rect, setRect] = useState<CropRect>({ x: 0, y: 0, w: 0, h: 0 })
  const [appliedRule, setAppliedRule] = useState<AppliedCropRule | null>(null)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const lastActiveIdRef = useRef<string>('')
  const skipModeResetRef = useRef(false)
  const perImageStateRef = useRef<Record<string, SavedCropState>>({})

  function buildRuleFromCurrent(): AppliedCropRule | null {
    if (!info) return null
    const safeW = info.width || 1
    const safeH = info.height || 1
    const r = clampRect(rect, info.width, info.height)
    const baseRule: AppliedCropRule = {
      modeValue,
      customRatioW,
      customRatioH,
      rectX: r.x / safeW,
      rectY: r.y / safeH,
      rectW: r.w / safeW,
      rectH: r.h / safeH,
    }
    if (modeValue === 'circle') {
      const minEdge = Math.max(1, Math.min(safeW, safeH))
      baseRule.rectCx = (r.x + r.w / 2) / safeW
      baseRule.rectCy = (r.y + r.h / 2) / safeH
      baseRule.rectSize = Math.min(r.w, r.h) / minEdge
    }
    return baseRule
  }

  function buildStateFromRule(rule: AppliedCropRule, targetInfo: ImageInfo): SavedCropState {
    if (rule.modeValue === 'circle' && rule.rectCx !== undefined && rule.rectCy !== undefined && rule.rectSize !== undefined) {
      const minEdge = Math.max(1, Math.min(targetInfo.width, targetInfo.height))
      const size = Math.max(1, Math.round(rule.rectSize * minEdge))
      const x = Math.round(rule.rectCx * targetInfo.width - size / 2)
      const y = Math.round(rule.rectCy * targetInfo.height - size / 2)
      return {
        modeValue: rule.modeValue,
        customRatioW: rule.customRatioW,
        customRatioH: rule.customRatioH,
        rect: clampRect({ x, y, w: size, h: size }, targetInfo.width, targetInfo.height),
      }
    }
    return {
      modeValue: rule.modeValue,
      customRatioW: rule.customRatioW,
      customRatioH: rule.customRatioH,
      rect: clampRect(
        {
          x: Math.round(rule.rectX * targetInfo.width),
          y: Math.round(rule.rectY * targetInfo.height),
          w: Math.round(rule.rectW * targetInfo.width),
          h: Math.round(rule.rectH * targetInfo.height),
        },
        targetInfo.width,
        targetInfo.height,
      ),
    }
  }

  function getStateForItem(it: { id: string; info: ImageInfo }): SavedCropState {
    const cached = perImageStateRef.current[it.id]
    if (cached) return cached
    const rule = appliedRule ?? buildRuleFromCurrent()
    if (rule) return buildStateFromRule(rule, it.info)
    return {
      modeValue: 'free',
      customRatioW: null,
      customRatioH: null,
      rect: initRect(it.info.width, it.info.height),
    }
  }

  function toModeFromState(state: SavedCropState): CropMode {
    if (state.modeValue === 'free') return { kind: 'free' }
    if (state.modeValue === 'circle') return { kind: 'circle' }
    if (state.modeValue === 'custom') {
      if (state.customRatioW && state.customRatioH && state.customRatioW > 0 && state.customRatioH > 0) {
        return { kind: 'ratio', ratio: state.customRatioW / state.customRatioH, label: `${state.customRatioW}:${state.customRatioH}` }
      }
      return { kind: 'free' }
    }
    const ratio = getRatioByValue(state.modeValue)
    if (ratio === null) return { kind: 'free' }
    return { kind: 'ratio', ratio, label: state.modeValue }
  }

  async function exportOne(
    targetInfo: ImageInfo,
    state: SavedCropState,
  ) {
    const settings = getDefaultExportSettings()
    const modeForExport = toModeFromState(state)
    const r = clampRect(state.rect, targetInfo.width, targetInfo.height)
    const sx = clampInt(r.x, 0, targetInfo.width - 1)
    const sy = clampInt(r.y, 0, targetInfo.height - 1)
    const sw = clampInt(r.w, 1, targetInfo.width - sx)
    const sh = clampInt(r.h, 1, targetInfo.height - sy)

    const targetW = sw
    const targetH = sh
    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvasRef.current = canvas
    canvas.width = targetW
    canvas.height = targetH

    const img = new Image()
    img.src = targetInfo.url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(t('error.imageLoadFailed')))
    })

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('error.canvasInitFailed'))
    ctx.clearRect(0, 0, targetW, targetH)

    if (modeForExport.kind === 'circle') {
      const radius = Math.min(targetW, targetH) / 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(targetW / 2, targetH / 2, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
      ctx.restore()
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
    }

    const baseName = targetInfo.name.replace(/\.[^.]+$/, '')
    const rawExt = targetInfo.name.split('.').pop()?.toLowerCase() ?? ''
    const sourceMime: OutputType =
      rawExt === 'png'
        ? 'image/png'
        : rawExt === 'webp'
          ? 'image/webp'
          : 'image/jpeg'
    const fixedFormat: OutputType =
      modeForExport.kind === 'circle' ? 'image/png' : sourceMime
    const optimizedQuality = settings.optimizeForWeb
      ? Math.max(0.1, Math.min(1, settings.quality * 0.85))
      : settings.quality
    const q = fixedFormat === 'image/png' ? 1 : optimizedQuality
    const blob = await canvasToBlob(canvas, fixedFormat, q)
    const suffix = modeForExport.kind === 'circle' ? 'circle' : 'crop'
    const ext =
      fixedFormat === 'image/png'
        ? 'png'
        : fixedFormat === 'image/webp'
          ? 'webp'
          : 'jpg'
    return { blob, filename: `${baseName}-${suffix}-${targetW}x${targetH}.${ext}` }
  }

  // 将 modeValue 转换为 CropMode
  const mode = useMemo<CropMode>(() => {
    if (modeValue === 'free') return { kind: 'free' }
    if (modeValue === 'circle') return { kind: 'circle' }
    if (modeValue === 'custom') {
      // 自定义模式：如果有自定义宽高比，使用自定义比例
      if (customRatioW && customRatioH && customRatioW > 0 && customRatioH > 0) {
        return { kind: 'ratio', ratio: customRatioW / customRatioH, label: `${customRatioW}:${customRatioH}` }
      }
      return { kind: 'free' }
    }
    const ratio = getRatioByValue(modeValue)
    if (ratio === null) return { kind: 'free' }
    return { kind: 'ratio', ratio, label: modeValue }
  }, [modeValue, customRatioW, customRatioH])

  useEffect(() => {
    if (!info) {
      lastActiveIdRef.current = ''
      return
    }
    // 切换 active 时重置裁切框，避免沿用上一张的尺寸
    if (activeId && activeId !== lastActiveIdRef.current) {
      const cached = perImageStateRef.current[activeId]
      if (cached) {
        skipModeResetRef.current = true
        setModeValue(cached.modeValue)
        setCustomRatioW(cached.customRatioW)
        setCustomRatioH(cached.customRatioH)
        setRect(clampRect(cached.rect, info.width, info.height))
      } else if (appliedRule) {
        skipModeResetRef.current = true
        setModeValue(appliedRule.modeValue)
        setCustomRatioW(appliedRule.customRatioW)
        setCustomRatioH(appliedRule.customRatioH)
        const nextRect = clampRect({
          x: Math.round(appliedRule.rectX * info.width),
          y: Math.round(appliedRule.rectY * info.height),
          w: Math.round(appliedRule.rectW * info.width),
          h: Math.round(appliedRule.rectH * info.height),
        }, info.width, info.height)
        setRect(nextRect)
      } else {
        const r = initRect(info.width, info.height)
        setRect(r)
        setModeValue('free')
        setCustomRatioW(null)
        setCustomRatioH(null)
      }
      lastActiveIdRef.current = activeId
    }
  }, [activeId, info, appliedRule])

  useEffect(() => {
    if (!activeId || !info) return
    perImageStateRef.current[activeId] = {
      modeValue,
      customRatioW,
      customRatioH,
      rect: clampRect(rect, info.width, info.height),
    }
  }, [activeId, info, modeValue, customRatioW, customRatioH, rect])

  async function onExport() {
    try {
      setError(null)
      if (!info) throw new Error(t('error.noImageSelected'))
      return await exportOne(info, {
        modeValue,
        customRatioW,
        customRatioH,
        rect,
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'))
      throw e
    }
  }

  async function buildAllExports() {
    if (items.length === 0) return
    setError(null)
    try {
      const payloads: { blob: Blob; filename: string }[] = []
      for (const it of items) {
        const state = getStateForItem(it)
        const payload = await exportOne(it.info, state)
        payloads.push(payload)
        await new Promise<void>((r) => window.setTimeout(() => r(), 0))
      }
      return payloads
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'))
      throw e
    }
  }

  function onReselect() {
    setError(null)
    clearAll()
    setRect({ x: 0, y: 0, w: 0, h: 0 })
    setModeValue('free')
    setCustomRatioW(null)
    setCustomRatioH(null)
    setAppliedRule(null)
    perImageStateRef.current = {}
  }


  useEffect(() => {
    if (!info) return
    if (skipModeResetRef.current) {
      skipModeResetRef.current = false
      return
    }
    const baseRect = initRect(info.width, info.height)
    const ratio = mode.kind === 'ratio' ? mode.ratio : mode.kind === 'circle' ? 1 : null
    if (!ratio) {
      setRect(baseRect)
      return
    }
    setRect(fitRectToRatio(baseRect, ratio, info.width, info.height))
  }, [mode, info])

  // 预览：生成“当前裁切结果”用于弹窗展示（顶部/底部预览按钮共用）
  async function buildPreviewBlob() {
    if (!info) throw new Error('未选择图片')
    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvasRef.current = canvas

    const r = clampRect(rect, info.width, info.height)
    const sx = clampInt(r.x, 0, info.width - 1)
    const sy = clampInt(r.y, 0, info.height - 1)
    const sw = clampInt(r.w, 1, info.width - sx)
    const sh = clampInt(r.h, 1, info.height - sy)

    const targetW = sw
    const targetH = sh
    canvas.width = targetW
    canvas.height = targetH

    const img = new Image()
    img.src = info.url
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve()
      img.onerror = () => reject(new Error(t('error.imageLoadFailed')))
    })

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('error.canvasInitFailed'))
    ctx.clearRect(0, 0, targetW, targetH)

    if (mode.kind === 'circle') {
      // 圆形裁切：预览用 PNG（透明背景）
      const radius = Math.min(targetW, targetH) / 2
      ctx.save()
      ctx.beginPath()
      ctx.arc(targetW / 2, targetH / 2, radius, 0, Math.PI * 2)
      ctx.clip()
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
      ctx.restore()
    } else {
      ctx.drawImage(img, sx, sy, sw, sh, 0, 0, targetW, targetH)
    }

    const blob = await canvasToBlob(canvas, 'image/png', 1)
    return { blob, width: targetW, height: targetH }
  }

  return (
    <ImageToolLayout
      title={t('imageCrop.title')}
      onBackToHome={() => window.location.href = '../index.html'}
      onReselect={onReselect}
      secondaryActionLabel={t('imageCrop.reselect')}
      onPrimaryAction={onExport}
      onPrimaryActionAll={buildAllExports}
      primaryActionLabel={t('imageCrop.download')}
      getPreviewBlob={buildPreviewBlob}
      onFilesSelect={async (files) => {
        setError(null)
        try {
          await addFiles(files)
        } catch (e) {
          setError(e instanceof Error ? e.message : t('imageCrop.selectImage'))
        }
      }}
      images={items.length > 0 ? {
        items: items.map((it) => ({ id: it.id, info: it.info })),
        activeId,
        onSelect: (id) => setActiveId(id),
        onRemove: removeOne,
        onApplyToAll: () => {
          const nextRule = buildRuleFromCurrent()
          if (!nextRule) return
          setAppliedRule(nextRule)
          const nextCache = { ...perImageStateRef.current }
          for (const it of items) {
            nextCache[it.id] = buildStateFromRule(nextRule, it.info)
          }
          perImageStateRef.current = nextCache
        },
      } : null}
      canvasOverlay={(api) =>
        info ? (
          <CropOverlay
            api={api}
            imageWidth={info.width}
            imageHeight={info.height}
            mode={mode}
            rect={rect}
            onRectChange={(next) => setRect(clampRect(next, info.width, info.height))}
          />
        ) : null
      }
    >
      {info && (
        <div class="flex flex-col gap-4">
          <div class="flex flex-col gap-3">
            <CropRatioSelect
              label={t('imageCrop.mode')}
              value={modeValue}
              onChange={(v) => {
                setModeValue(v)
                if (v === 'custom') {
                  setCustomRatioW((prev) => prev ?? 1)
                  setCustomRatioH((prev) => prev ?? 1)
                } else {
                  setCustomRatioW(null)
                  setCustomRatioH(null)
                }
              }}
            />
          </div>

          {modeValue === 'custom' ? (
            <div class="flex flex-col gap-2">
              <div class="text-sm font-medium text-slate-700 dark:text-slate-300">{t('imageCrop.customRatio')}</div>
              <div class="flex items-center gap-3">
                <div class="flex items-center gap-2 flex-1">
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('imageCrop.width.label')}</label>
                  <input
                    type="number"
                    min={1}
                    value={customRatioW ?? 1}
                    onChange={(e) => {
                      const w = Math.max(1, Math.round(Number(e.currentTarget.value)))
                      setCustomRatioW(w)
                      const h = customRatioH ?? 1
                      if (h > 0) {
                        const ratio = w / h
                        const r = fitRectToRatio(rect, ratio, info.width, info.height)
                        setRect(r)
                      }
                    }}
                    class="w-full h-10 px-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60
                      bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm
                      placeholder:text-slate-400 dark:placeholder:text-slate-500
                      focus:outline-none focus:ring-0
                      focus:border-slate-300/80 dark:focus:border-slate-600/80 focus:bg-white dark:focus:bg-slate-900
                      transition-colors"
                  />
                </div>
                <div class="flex items-center gap-2 flex-1">
                  <label class="text-sm font-medium text-slate-700 dark:text-slate-300 whitespace-nowrap">{t('imageCrop.height.label')}</label>
                  <input
                    type="number"
                    min={1}
                    value={customRatioH ?? 1}
                    onChange={(e) => {
                      const h = Math.max(1, Math.round(Number(e.currentTarget.value)))
                      setCustomRatioH(h)
                      const w = customRatioW ?? 1
                      if (w > 0) {
                        const ratio = w / h
                        const r = fitRectToRatio(rect, ratio, info.width, info.height)
                        setRect(r)
                      }
                    }}
                    class="w-full h-10 px-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60
                      bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100 text-sm
                      placeholder:text-slate-400 dark:placeholder:text-slate-500
                      focus:outline-none focus:ring-0
                      focus:border-slate-300/80 dark:focus:border-slate-600/80 focus:bg-white dark:focus:bg-slate-900
                      transition-colors"
                  />
                </div>
              </div>
              <div class="text-sm text-slate-500 dark:text-slate-400">
                {t('imageCrop.currentCrop', { width: Math.round(rect.w), height: Math.round(rect.h) })}
              </div>
            </div>
          ) : (
            <div class="text-sm text-slate-500 dark:text-slate-400">
              当前裁切：{Math.round(rect.w)}×{Math.round(rect.h)} px
            </div>
          )}
        </div>
      )
      }

      <canvas ref={canvasRef} class="hidden" />

      {
        error && (
          <div class="card">
            <div class="error">{error}</div>
          </div>
        )
      }
    </ImageToolLayout>
  )
}








