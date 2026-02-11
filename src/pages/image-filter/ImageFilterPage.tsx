import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { canvasToBlob, revokeImageInfo, type ImageInfo } from '../../shared/image'
import { ImageToolLayout } from '../../shared/components/ImageToolLayout'
import { type OutputType } from '../../shared/components/ExportSettingsDialog'
import { PremiumSlider } from '../../shared/components/PremiumSlider'

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
import { useImageItems } from '../../shared/useImageItems'

type FilterParams = {
  brightness: number
  contrast: number
  saturation: number
  temperature: number
  highlights: number
  shadows: number
  sharpness: number
  vignette: number
}

type FilterPreset = {
  id: string
  name: string
  params: Partial<FilterParams>
}

const defaultParams: FilterParams = {
  brightness: 0,
  contrast: 0,
  saturation: 0,
  temperature: 0,
  highlights: 0,
  shadows: 0,
  sharpness: 0,
  vignette: 0,
}

const previewMaxSize = 1600

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(errorMessage))
    img.src = url
  })
}

function clamp(v: number, min: number, max: number) {
  return Math.min(max, Math.max(min, v))
}

function clampByte(v: number) {
  return Math.max(0, Math.min(255, v))
}

function calcPreviewSize(width: number, height: number, maxSize: number) {
  const maxEdge = Math.max(width, height)
  if (maxEdge <= maxSize) return { width, height }
  const scale = maxSize / maxEdge
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  }
}

function applySharpen(data: Uint8ClampedArray, width: number, height: number, sharpness: number) {
  if (sharpness <= 0) return
  const src = new Uint8ClampedArray(data)
  const amount = sharpness / 100
  for (let y = 1; y < height - 1; y += 1) {
    for (let x = 1; x < width - 1; x += 1) {
      const idx = (y * width + x) * 4
      for (let c = 0; c < 3; c += 1) {
        const i = idx + c
        const blur =
          (src[i - 4] + src[i + 4] +
            src[i - width * 4] + src[i + width * 4] +
            src[i - width * 4 - 4] + src[i - width * 4 + 4] +
            src[i + width * 4 - 4] + src[i + width * 4 + 4] +
            src[i]) / 9
        data[i] = clampByte(src[i] + (src[i] - blur) * amount)
      }
    }
  }
}

function applyFiltersToImageData(
  data: Uint8ClampedArray,
  width: number,
  height: number,
  params: FilterParams
) {
  const brightness = (params.brightness / 100) * 255
  const contrast = params.contrast
  const contrastFactor = (259 * (contrast + 255)) / (255 * (259 - contrast))
  const saturationFactor = (params.saturation + 100) / 100
  const temperature = (params.temperature / 100) * 255
  const highlights = params.highlights / 100
  const shadows = params.shadows / 100
  const vignette = clamp(params.vignette / 100, 0, 1)
  const cx = width / 2
  const cy = height / 2

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const idx = (y * width + x) * 4
      let r = data[idx]
      let g = data[idx + 1]
      let b = data[idx + 2]

      r += brightness
      g += brightness
      b += brightness

      r = contrastFactor * (r - 128) + 128
      g = contrastFactor * (g - 128) + 128
      b = contrastFactor * (b - 128) + 128

      const lum = 0.2126 * r + 0.7152 * g + 0.0722 * b
      if (params.saturation !== 0) {
        r = lum + (r - lum) * saturationFactor
        g = lum + (g - lum) * saturationFactor
        b = lum + (b - lum) * saturationFactor
      }

      if (params.temperature !== 0) {
        r += temperature
        b -= temperature
      }

      if (params.highlights !== 0) {
        const t = Math.max(0, (lum - 128) / 127)
        const adj = 255 * highlights * t
        r += adj
        g += adj
        b += adj
      }

      if (params.shadows !== 0) {
        const t = Math.max(0, (128 - lum) / 128)
        const adj = 255 * shadows * t
        r += adj
        g += adj
        b += adj
      }

      if (vignette > 0) {
        const dx = (x - cx) / cx
        const dy = (y - cy) / cy
        const dist = dx * dx + dy * dy
        const factor = clamp(1 - vignette * dist, 0, 1)
        r *= factor
        g *= factor
        b *= factor
      }

      data[idx] = clampByte(r)
      data[idx + 1] = clampByte(g)
      data[idx + 2] = clampByte(b)
    }
  }

  applySharpen(data, width, height, params.sharpness)
}

export function ImageFilterPage() {
  const { t } = useI18n()
  const { items, activeId, setActiveId, active, addFiles, removeOne, clearAll } = useImageItems()
  const info = active?.info ?? null
  const [preview, setPreview] = useState<ImageInfo | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [params, setParams] = useState<FilterParams>(defaultParams)
  const [presetId, setPresetId] = useState<string>('custom')
  const [presetThumbs, setPresetThumbs] = useState<Record<string, string>>({})
  const [currentThumb, setCurrentThumb] = useState<string>('')
  const [imageReadyTick, setImageReadyTick] = useState(0)

  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const imageRef = useRef<HTMLImageElement | null>(null)
  const activeIdRef = useRef<string | null>(null)
  const perImageParamsRef = useRef<Record<string, FilterParams>>({})
  const perImagePresetRef = useRef<Record<string, string>>({})
  const appliedParamsRef = useRef<FilterParams | null>(null)
  const baseThumbRef = useRef<{ width: number; height: number; data: Uint8ClampedArray } | null>(null)

  const presets = useMemo<FilterPreset[]>(() => ([
    {
      id: 'clean-bright',
      name: t('imageFilter.preset.cleanBright'),
      params: { brightness: 12, contrast: 8, saturation: 6, highlights: -10, shadows: 12, sharpness: 10 },
    },
    {
      id: 'warm-life',
      name: t('imageFilter.preset.warmLife'),
      params: { brightness: 6, contrast: 4, saturation: 10, temperature: 18 },
    },
    {
      id: 'cool-modern',
      name: t('imageFilter.preset.coolModern'),
      params: { contrast: 12, saturation: -6, temperature: -20, highlights: -10 },
    },
    {
      id: 'soft-portrait',
      name: t('imageFilter.preset.softPortrait'),
      params: { brightness: 8, contrast: -10, shadows: 18, sharpness: 0, vignette: 8 },
    },
    {
      id: 'high-contrast-pop',
      name: t('imageFilter.preset.highContrastPop'),
      params: { contrast: 25, saturation: 15, highlights: -15, shadows: -15, sharpness: 15 },
    },
    {
      id: 'matte-fade',
      name: t('imageFilter.preset.matteFade'),
      params: { contrast: -20, saturation: -15, highlights: -10, shadows: 25, temperature: 5 },
    },
    {
      id: 'vintage-warm',
      name: t('imageFilter.preset.vintageWarm'),
      params: { contrast: -15, saturation: -20, temperature: 20, vignette: 15 },
    },
    {
      id: 'bw-pro',
      name: t('imageFilter.preset.bwPro'),
      params: { saturation: -100, contrast: 20, highlights: -20, shadows: 10, sharpness: 10 },
    },
    {
      id: 'moody-dark',
      name: t('imageFilter.preset.moodyDark'),
      params: { brightness: -10, contrast: 15, shadows: -20, temperature: -10, vignette: 20 },
    },
    {
      id: 'fresh-food',
      name: t('imageFilter.preset.freshFood'),
      params: { brightness: 10, contrast: 10, saturation: 18, temperature: 10, sharpness: 12 },
    },
    {
      id: 'flat-clean',
      name: t('imageFilter.preset.flatClean'),
      params: { contrast: -15, saturation: -10, highlights: -15, shadows: 15 },
    },
    {
      id: 'cinematic-blue',
      name: t('imageFilter.preset.cinematicBlue'),
      params: { contrast: 10, temperature: -25, highlights: -15, shadows: 10, vignette: 15 },
    },
  ]), [t])

  useEffect(() => {
    return () => revokeImageInfo(preview)
  }, [preview])

  useEffect(() => {
    if (!info) {
      imageRef.current = null
      return
    }
    let cancelled = false
    loadImage(info.url, t('error.imageLoadFailed'))
      .then((img) => {
        if (!cancelled) {
          imageRef.current = img
          setImageReadyTick((v) => v + 1)
        }
      })
      .catch(() => {
        if (!cancelled) imageRef.current = null
      })
    return () => { cancelled = true }
  }, [info])

  useEffect(() => {
    if (!info) return
    const prevId = activeIdRef.current
    if (prevId) {
      perImageParamsRef.current[prevId] = params
      perImagePresetRef.current[prevId] = presetId
    }
    const cachedParams = perImageParamsRef.current[activeId]
    const cachedPreset = perImagePresetRef.current[activeId]
    const nextParams = appliedParamsRef.current ?? cachedParams ?? defaultParams
    const nextPreset = appliedParamsRef.current
      ? 'custom'
      : cachedPreset ?? 'custom'
    setParams(nextParams)
    setPresetId(nextPreset)
    setPreview((prev) => {
      revokeImageInfo(prev)
      return null
    })
    activeIdRef.current = activeId
  }, [activeId, info?.url])

  function onReselect() {
    setError(null)
    clearAll()
    setParams(defaultParams)
    setPresetId('custom')
    perImageParamsRef.current = {}
    perImagePresetRef.current = {}
    appliedParamsRef.current = null
    setPreview((prev) => {
      revokeImageInfo(prev)
      return null
    })
  }

  function updateParams(patch: Partial<FilterParams>) {
    setParams((prev) => ({ ...prev, ...patch }))
    setPresetId('custom')
  }

  function applyPreset(id: string) {
    if (id === 'custom') {
      setPresetId('custom')
      return
    }
    const preset = presets.find((p) => p.id === id)
    if (!preset) return
    setParams({ ...defaultParams, ...preset.params })
    setPresetId(preset.id)
  }

  function applyToAll() {
    const next = { ...params }
    appliedParamsRef.current = next
    const all: Record<string, FilterParams> = {}
    for (const it of items) {
      all[it.id] = next
    }
    perImageParamsRef.current = all
    perImagePresetRef.current = {}
    setPresetId('custom')
  }

  useEffect(() => {
    if (!info || !imageRef.current) return
    const img = imageRef.current
    const size = calcPreviewSize(info.width, info.height, 120)
    const canvas = document.createElement('canvas')
    canvas.width = size.width
    canvas.height = size.height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    ctx.clearRect(0, 0, size.width, size.height)
    ctx.drawImage(img, 0, 0, size.width, size.height)
    const base = ctx.getImageData(0, 0, size.width, size.height)
    baseThumbRef.current = {
      width: size.width,
      height: size.height,
      data: new Uint8ClampedArray(base.data),
    }
  }, [info, imageReadyTick])

  useEffect(() => {
    if (!baseThumbRef.current) return
    let cancelled = false
    const { width, height, data } = baseThumbRef.current
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const nextThumbs: Record<string, string> = {}
    const generate = () => {
      for (const preset of presets) {
        if (cancelled) return
        const buffer = new Uint8ClampedArray(data)
        applyFiltersToImageData(buffer, width, height, { ...defaultParams, ...preset.params })
        const imageData = new ImageData(buffer, width, height)
        ctx.putImageData(imageData, 0, 0)
        nextThumbs[preset.id] = canvas.toDataURL('image/png')
      }
      if (!cancelled) setPresetThumbs(nextThumbs)
    }
    generate()
    return () => { cancelled = true }
  }, [presets, imageReadyTick])

  useEffect(() => {
    if (!baseThumbRef.current) return
    let cancelled = false
    const { width, height, data } = baseThumbRef.current
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    const buffer = new Uint8ClampedArray(data)
    applyFiltersToImageData(buffer, width, height, params)
    const imageData = new ImageData(buffer, width, height)
    ctx.putImageData(imageData, 0, 0)
    const url = canvas.toDataURL('image/png')
    if (!cancelled) setCurrentThumb(url)
    return () => { cancelled = true }
  }, [params, imageReadyTick])

  useEffect(() => {
    if (!info || !imageRef.current) return
    let cancelled = false
    const timer = window.setTimeout(() => {
      try {
        const img = imageRef.current
        if (!img) return
        const size = calcPreviewSize(info.width, info.height, previewMaxSize)
        const canvas = document.createElement('canvas')
        canvas.width = size.width
        canvas.height = size.height
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        ctx.clearRect(0, 0, size.width, size.height)
        ctx.drawImage(img, 0, 0, size.width, size.height)
        const imageData = ctx.getImageData(0, 0, size.width, size.height)
        applyFiltersToImageData(imageData.data, size.width, size.height, params)
        ctx.putImageData(imageData, 0, 0)

        const url = canvas.toDataURL('image/png')
        if (cancelled) return
        setPreview((prev) => {
          revokeImageInfo(prev)
          return { url, width: size.width, height: size.height, name: 'preview.png' }
        })
      } catch {
        // 预览失败不影响导出
      }
    }, 200)

    return () => {
      cancelled = true
      window.clearTimeout(timer)
    }
  }, [info, params, imageReadyTick])

  async function exportOne(targetInfo: ImageInfo, paramsOverride?: FilterParams) {
    const canvas = exportCanvasRef.current ?? document.createElement('canvas')
    exportCanvasRef.current = canvas
    const paramsToUse = paramsOverride ?? params

    const settings = getDefaultExportSettings()
    const targetW = targetInfo.width
    const targetH = targetInfo.height
    canvas.width = targetW
    canvas.height = targetH

    const img = await loadImage(targetInfo.url, t('error.imageLoadFailed'))
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('error.canvasInitFailed'))
    ctx.clearRect(0, 0, targetW, targetH)
    ctx.drawImage(img, 0, 0, targetW, targetH)
    const imageData = ctx.getImageData(0, 0, targetW, targetH)
    applyFiltersToImageData(imageData.data, targetW, targetH, paramsToUse)
    ctx.putImageData(imageData, 0, 0)

    const nameMatch = targetInfo.name.match(/\.([^.]+)$/)
    const originExt = nameMatch ? nameMatch[1].toLowerCase() : ''
    const outputType =
      originExt === 'png'
        ? 'image/png'
        : originExt === 'webp'
          ? 'image/webp'
          : originExt === 'jpg' || originExt === 'jpeg'
            ? 'image/jpeg'
            : settings.format
    const optimizedQuality = settings.optimizeForWeb ? Math.max(0.1, Math.min(1, settings.quality * 0.85)) : settings.quality
    const q = outputType === 'image/png' ? 1 : optimizedQuality
    const blob = await canvasToBlob(canvas, outputType, q)
    const name = targetInfo.name.replace(/\.[^.]+$/, '')
    const ext = originExt || (outputType === 'image/png' ? 'png' : outputType === 'image/webp' ? 'webp' : 'jpg')
    return { blob, filename: `${name}-filter.${ext}` }
  }

  async function onExport() {
    try {
      setError(null)
      if (!info) throw new Error(t('error.noImageSelected'))
      return await exportOne(info)
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
        const paramsToUse =
          appliedParamsRef.current ??
          perImageParamsRef.current[it.id] ??
          params
        const payload = await exportOne(it.info, paramsToUse)
        payloads.push(payload)
        await new Promise<void>((r) => window.setTimeout(() => r(), 0))
      }
      return payloads
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'))
      throw e
    }
  }

  const canvasInfo = preview ?? info

  return (
    <ImageToolLayout
      title={t('imageFilter.title')}
      onBackToHome={() => window.location.href = '../index.html'}
      onReselect={onReselect}
      secondaryActionLabel={t('imageCrop.reselect')}
      onPrimaryAction={onExport}
      onPrimaryActionAll={buildAllExports}
      primaryActionLabel={t('imageFilter.download')}
      info={canvasInfo}
      onFilesSelect={async (files) => {
        setError(null)
        try {
          await addFiles(files)
        } catch (e) {
          setError(e instanceof Error ? e.message : t('imageFilter.selectImage'))
        }
      }}
      images={items.length > 0 ? {
        items: items.map((it) => ({ id: it.id, info: it.info })),
        activeId,
        onSelect: (id) => setActiveId(id),
        onRemove: removeOne,
        onApplyToAll: applyToAll,
      } : null}
    >
      {info ? (
        <div class="flex flex-col h-full gap-4">
          <div class="flex flex-col gap-2">
            <label class="text-sm font-medium text-slate-900 dark:text-slate-100">
              {t('imageFilter.preset')}
            </label>
            <div class="flex gap-3 overflow-x-auto pb-2 -mx-1 px-1">
              {[
                { id: 'custom', name: t('imageFilter.preset.custom'), thumb: currentThumb },
                ...presets.map((preset) => ({
                  id: preset.id,
                  name: preset.name,
                  thumb: presetThumbs[preset.id],
                })),
              ].map((preset) => (
                <button
                  key={preset.id}
                  type="button"
                  onClick={() => applyPreset(preset.id)}
                  class={[
                    'flex flex-col items-center gap-2 w-24 shrink-0 rounded-xl border p-2 text-center',
                    presetId === preset.id
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-700 dark:text-slate-200',
                  ].join(' ')}
                >
                  <div class="w-16 h-16 rounded-lg bg-slate-100 dark:bg-slate-800 overflow-hidden flex items-center justify-center">
                    {preset.thumb ? (
                      <img src={preset.thumb} alt={preset.name} class="w-full h-full object-cover" />
                    ) : (
                      <div class="w-full h-full bg-slate-200 dark:bg-slate-700" />
                    )}
                  </div>
                  <div class="text-xs font-medium leading-tight">
                    {preset.name}
                  </div>
                </button>
              ))}
            </div>
          </div>
          <div class="flex-1 overflow-y-auto">
            <div class="flex flex-col gap-3">
              <PremiumSlider
                label={`${t('imageFilter.brightness')}（-100~100）`}
                value={params.brightness}
                min={-100}
                max={100}
                step={1}
                showValue
                onInput={(value) => updateParams({ brightness: value })}
              />
              <PremiumSlider
                label={`${t('imageFilter.contrast')}（-100~100）`}
                value={params.contrast}
                min={-100}
                max={100}
                step={1}
                showValue
                onInput={(value) => updateParams({ contrast: value })}
              />
              <PremiumSlider
                label={`${t('imageFilter.saturation')}（-100~100）`}
                value={params.saturation}
                min={-100}
                max={100}
                step={1}
                showValue
                onInput={(value) => updateParams({ saturation: value })}
              />
              <PremiumSlider
                label={`${t('imageFilter.sharpness')}（0~100）`}
                value={params.sharpness}
                min={0}
                max={100}
                step={1}
                showValue
                onInput={(value) => updateParams({ sharpness: value })}
              />
            </div>
          </div>

          {error ? (
            <div class="text-sm text-red-600 dark:text-red-400">{error}</div>
          ) : null}

          <canvas ref={exportCanvasRef} class="hidden" />
        </div>
      ) : (
        error ? <div class="text-sm text-red-600 dark:text-red-400">{error}</div> : null
      )}
    </ImageToolLayout>
  )
}









