import { useEffect, useRef, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { canvasToBlob, downloadBlob, fileToImageInfo, revokeImageInfo, type ImageInfo } from '../../shared/image'
import { ImageToolLayout } from '../../shared/components/ImageToolLayout'
import { DownloadIcon } from '../../shared/icons/DownloadIcon'
import { TrashIcon } from '../../shared/icons'
import { PremiumSlider } from '../../shared/components/PremiumSlider'

type OutputType = 'image/jpeg' | 'image/png' | 'image/webp'

type ConvertItem = {
  id: string
  file: File
  info: ImageInfo
}

function extByType(t: OutputType) {
  if (t === 'image/png') return 'png'
  if (t === 'image/webp') return 'webp'
  return 'jpg'
}

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error(errorMessage))
    img.src = url
  })
}

function makeId() {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) return crypto.randomUUID()
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`
}

export function ImageConvertPage() {
  const { t } = useI18n()

  const [items, setItems] = useState<ConvertItem[]>([])
  const [activeId, setActiveId] = useState<string>('')
  const [error, setError] = useState<string | null>(null)

  const [format, setFormat] = useState<OutputType>('image/jpeg')
  const [quality, setQuality] = useState<number>(80)

  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const hasContent = items.length > 0

  useEffect(() => {
    return () => {
      // 页面卸载时回收所有 blob URL
      for (const it of items) revokeImageInfo(it.info)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    // items 变化时，清理被移除项的 URL（通过对比旧值）
    return () => {
      // no-op：我们在删除时单点 revoke，避免频繁循环
    }
  }, [items])

  async function addFiles(files: File[]) {
    setError(null)
    try {
      const nextInfos = await Promise.all(files.map(async (file) => {
        const info = await fileToImageInfo(file)
        return { id: makeId(), file, info } satisfies ConvertItem
      }))
      setItems((prev) => {
        const merged = [...prev, ...nextInfos]
        // 首次加入时自动选中第一张
        if (!activeId && merged.length > 0) setActiveId(merged[0].id)
        return merged
      })
    } catch (e) {
      setError(e instanceof Error ? e.message : t('imageConvert.selectImages'))
    }
  }

  function clearAll() {
    setError(null)
    setItems((prev) => {
      for (const it of prev) revokeImageInfo(it.info)
      return []
    })
    setActiveId('')
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id)
      if (target) revokeImageInfo(target.info)
      const next = prev.filter((x) => x.id !== id)
      setActiveId((current) => (current === id ? (next[0]?.id ?? '') : current))
      return next
    })
  }

  async function convertOne(it: ConvertItem) {
    const canvas = canvasRef.current ?? document.createElement('canvas')
    canvasRef.current = canvas

    const img = await loadImage(it.info.url, t('error.imageLoadFailed'))
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight

    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error(t('error.canvasInitFailed'))
    ctx.clearRect(0, 0, canvas.width, canvas.height)
    ctx.drawImage(img, 0, 0)

    const q = format === 'image/png' ? 1 : Math.max(0.1, Math.min(1, quality / 100))
    return await canvasToBlob(canvas, format, q)
  }

  async function buildAllExports() {
    if (items.length === 0) return
    setError(null)
    setIsDownloading(true)
    try {
      const payloads: { blob: Blob; filename: string }[] = []
      for (const it of items) {
        const blob = await convertOne(it)
        const name = it.info.name.replace(/\.[^.]+$/, '')
        payloads.push({ blob, filename: `${name}.${extByType(format)}` })
        // 轻微让出主线程，避免长队列卡顿
        await new Promise<void>((r) => window.setTimeout(() => r(), 0))
      }
      return payloads
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'))
      throw e
    } finally {
      setIsDownloading(false)
    }
  }

  async function handleDownloadOne(it: ConvertItem) {
    if (isDownloading) return
    setError(null)
    try {
      const blob = await convertOne(it)
      const name = it.info.name.replace(/\.[^.]+$/, '')
      downloadBlob(blob, `${name}.${extByType(format)}`)
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'))
    }
  }

  const leftPanel = (
    <div class="w-full h-full flex flex-col">
      <div class="flex-1 min-h-0 overflow-y-auto p-4 bg-gray-100 dark:bg-gray-800">
        <div class="flex flex-col gap-4">
          {items.map((it) => {
            return (
              <div
                key={it.id}
                class="w-full flex items-center gap-4 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/80 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 text-left transition-all"
              >
                <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 flex-shrink-0 shadow-sm">
                  <img src={it.info.url} alt={it.info.name} class="w-full h-full object-cover" />
                </div>
                <div class="flex-1 min-w-0">
                  <div class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mb-1">
                    {it.info.name}
                  </div>
                  <div class="text-xs text-slate-600 dark:text-slate-300">
                    {it.info.width}×{it.info.height}px
                  </div>
                </div>
                <div class="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:text-blue-600 hover:bg-blue-50 dark:text-slate-300 dark:hover:text-blue-400 dark:hover:bg-blue-900/30 transition-colors"
                    onClick={() => void handleDownloadOne(it)}
                    title={t('common.download')}
                  >
                    <DownloadIcon size={18} color="currentColor" />
                  </button>
                  <button
                    type="button"
                    class="w-9 h-9 flex items-center justify-center rounded-lg text-slate-700 hover:text-red-600 hover:bg-red-50 dark:text-slate-300 dark:hover:text-red-400 dark:hover:bg-red-900/20 transition-colors"
                    onClick={() => removeItem(it.id)}
                    title={t('common.delete')}
                  >
                    <TrashIcon size={20} color="currentColor" />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )

  return (
    <ImageToolLayout
      title={t('imageConvert.title')}
      onBackToHome={() => window.location.href = '../index.html'}
      onReselect={clearAll}
      secondaryActionLabel={t('common.reselect')}
      onPrimaryAction={buildAllExports}
      primaryActionLabel={isDownloading ? t('imageConvert.processing') : t('common.downloadAll')}
      hasContent={hasContent}
      leftPanel={hasContent ? leftPanel : undefined}
      onFilesSelect={addFiles}
      onPrimaryActionAll={buildAllExports}
      toolbarConfig={{
        showPreview: false,
        showReselect: true,
        showPrimary: true,
      }}
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-600 dark:text-slate-300">
            {t('imageConvert.outputFormat')}
          </label>
          <select
            class="select select-bordered w-full h-11 text-sm"
            value={format}
            onChange={(e) =>
              setFormat((e.currentTarget as HTMLSelectElement).value as OutputType)
            }
          >
            <option value="image/jpeg">{t('imageConvert.formatJpg')}</option>
            <option value="image/png">{t('imageConvert.formatPng')}</option>
            <option value="image/webp">{t('imageConvert.formatWebp')}</option>
          </select>
        </div>

        {format === 'image/png' ? null : (
          <PremiumSlider
            label={`${t('imageConvert.quality')}（${Math.round(quality)}%）`}
            value={Math.round(quality)}
            min={10}
            max={100}
            step={1}
            showValue
            onInput={setQuality}
          />
        )}

        {error ? (
          <div class="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : null}

        {/* 右侧只做配置，不提供预览按钮；转换使用复用 canvas */}
        <canvas ref={canvasRef} class="hidden" />
      </div>
    </ImageToolLayout>
  )
}











