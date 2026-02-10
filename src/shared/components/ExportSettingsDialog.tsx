import { useEffect, useMemo, useState } from 'preact/hooks'

export type OutputType = 'image/png' | 'image/jpeg' | 'image/webp'

export type ExportSettingsResult = {
  format: OutputType
  quality: number
  optimizeForWeb: boolean
  removeMetadata: boolean
  targetWidth?: number
  targetHeight?: number
}

type ExportSettingsDialogProps = {
  isOpen: boolean
  onClose: () => void
  onConfirm: (settings: ExportSettingsResult) => void
  baseSize?: { width: number; height: number } | null
  sizeMode?: 'hidden' | 'readonly' | 'editable'
  title?: string
  formats?: OutputType[]
  showFormat?: boolean
  showQuality?: boolean
  showAdvanced?: boolean
  fixedFormat?: OutputType
  fixedQuality?: number
}

type StoredSettings = {
  format: OutputType
  quality: number
  optimizeForWeb: boolean
}

const STORAGE_KEY = 'img-tools-export-settings-v1'
const DEFAULT_SETTINGS: StoredSettings = {
  format: 'image/png',
  quality: 85,
  optimizeForWeb: false,
}

function loadSettings(): StoredSettings {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<StoredSettings>
    return {
      format: parsed.format ?? DEFAULT_SETTINGS.format,
      quality: typeof parsed.quality === 'number' ? parsed.quality : DEFAULT_SETTINGS.quality,
      optimizeForWeb: Boolean(parsed.optimizeForWeb),
    }
  } catch {
    return DEFAULT_SETTINGS
  }
}

function saveSettings(settings: StoredSettings) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
}

function parsePositiveInt(input: string) {
  if (!input) return null
  const n = Math.trunc(Number(input))
  if (!Number.isFinite(n) || n <= 0) return null
  return Math.min(20000, n)
}

function formatBytes(bytes: number) {
  if (bytes <= 0 || !Number.isFinite(bytes)) return '--'
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${Math.round(bytes / 1024)} KB`
}

function estimateBytes(
  width: number,
  height: number,
  format: OutputType,
  quality: number,
  optimizeForWeb: boolean
) {
  const pixels = Math.max(1, width * height)
  let bytes = 0
  if (format === 'image/png') {
    bytes = pixels * 4 * 0.7
  } else if (format === 'image/webp') {
    bytes = pixels * 3 * (0.18 + 0.82 * (quality / 100)) * 0.3
  } else {
    bytes = pixels * 3 * (0.2 + 0.8 * (quality / 100)) * 0.35
  }
  if (optimizeForWeb) bytes *= 0.85
  return bytes
}

export function ExportSettingsDialog({
  isOpen,
  onClose,
  onConfirm,
  baseSize,
  sizeMode = 'hidden',
  title = '导出图片',
  formats,
  showFormat = true,
  showQuality = true,
  showAdvanced = true,
  fixedFormat,
  fixedQuality,
}: ExportSettingsDialogProps) {
  const [format, setFormat] = useState<OutputType>(DEFAULT_SETTINGS.format)
  const [quality, setQuality] = useState<number>(DEFAULT_SETTINGS.quality)
  const [optimizeForWeb, setOptimizeForWeb] = useState<boolean>(DEFAULT_SETTINGS.optimizeForWeb)

  const [isAdvancedOpen, setIsAdvancedOpen] = useState(false)
  const [isSizeOpen, setIsSizeOpen] = useState(false)
  const [sizeWInput, setSizeWInput] = useState('')
  const [sizeHInput, setSizeHInput] = useState('')
  const [keepRatio, setKeepRatio] = useState(true)
  const [sizeDirty, setSizeDirty] = useState(false)

  const availableFormats: OutputType[] = formats?.length
    ? formats
    : ['image/jpeg', 'image/png', 'image/webp']
  const ratio = useMemo(() => {
    if (!baseSize || baseSize.height === 0) return 1
    return baseSize.width / baseSize.height
  }, [baseSize])

  useEffect(() => {
    if (!isOpen) return
    const stored = loadSettings()
    setFormat(stored.format)
    setQuality(stored.quality)
    setOptimizeForWeb(stored.optimizeForWeb)
  }, [isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (fixedFormat) setFormat(fixedFormat)
  }, [fixedFormat, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (typeof fixedQuality === 'number') setQuality(fixedQuality)
  }, [fixedQuality, isOpen])

  useEffect(() => {
    if (!isOpen) return
    if (!availableFormats.includes(format)) {
      setFormat(availableFormats[0])
    }
  }, [availableFormats, format, isOpen])

  useEffect(() => {
    if (!isOpen) return
    saveSettings({ format, quality, optimizeForWeb })
  }, [format, quality, optimizeForWeb, isOpen])

  useEffect(() => {
    if (!isOpen || sizeMode !== 'editable') return
    setSizeDirty(false)
    setIsSizeOpen(false)
    if (baseSize) {
      setSizeWInput(String(Math.round(baseSize.width)))
      setSizeHInput(String(Math.round(baseSize.height)))
    } else {
      setSizeWInput('')
      setSizeHInput('')
    }
    setKeepRatio(true)
  }, [isOpen, sizeMode, baseSize?.width, baseSize?.height])

  useEffect(() => {
    if (!isOpen || sizeMode !== 'editable' || sizeDirty || !baseSize) return
    setSizeWInput(String(Math.round(baseSize.width)))
    setSizeHInput(String(Math.round(baseSize.height)))
  }, [baseSize?.width, baseSize?.height, isOpen, sizeDirty, sizeMode, baseSize])

  const resolvedSize = useMemo(() => {
    if (!baseSize) return null
    if (sizeMode === 'hidden' || sizeMode === 'readonly') return baseSize
    const wInput = parsePositiveInt(sizeWInput)
    const hInput = parsePositiveInt(sizeHInput)
    let width = wInput ?? baseSize.width
    let height = hInput ?? baseSize.height
    if (keepRatio) {
      if (wInput && !hInput) height = Math.max(1, Math.round(wInput / ratio))
      if (!wInput && hInput) width = Math.max(1, Math.round(hInput * ratio))
    }
    return { width, height }
  }, [baseSize, sizeMode, sizeWInput, sizeHInput, keepRatio, ratio])

  const resolvedFormat = fixedFormat ?? format
  const resolvedQuality = typeof fixedQuality === 'number' ? fixedQuality : quality

  const sizeText = resolvedSize ? `${Math.round(resolvedSize.width)} × ${Math.round(resolvedSize.height)}` : '--'
  const estimatedSize = resolvedSize
    ? formatBytes(estimateBytes(resolvedSize.width, resolvedSize.height, resolvedFormat, resolvedQuality, optimizeForWeb))
    : '--'

  const canConfirm = Boolean(resolvedSize && resolvedSize.width > 0 && resolvedSize.height > 0)

  const handleConfirm = () => {
    if (!resolvedSize) return
    const normalizedQuality = Math.max(0.1, Math.min(1, resolvedQuality / 100))
    onConfirm({
      format: resolvedFormat,
      quality: normalizedQuality,
      optimizeForWeb,
      removeMetadata: true,
      targetWidth: resolvedSize.width,
      targetHeight: resolvedSize.height,
    })
  }

  return (
    <dialog class={`modal ${isOpen ? 'modal-open' : ''}`}>
      <div class="modal-box">
        <h3 class="font-bold text-lg">{title}</h3>
        <div class="py-4">
          <div class="flex flex-col gap-4">
        {showFormat ? (
          <div class="flex flex-col gap-2">
            <div class="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              格式
            </div>
            <div class="flex flex-wrap gap-2">
              {availableFormats.map((value) => {
                const label = value === 'image/png' ? 'PNG' : value === 'image/webp' ? 'WEBP' : 'JPG'
                const isActive = format === value
                return (
                  <button
                    key={value}
                    type="button"
                    class={`px-3 py-1.5 rounded-full text-sm border transition-colors ${
                      isActive
                        ? 'bg-slate-900 text-white border-slate-900 dark:bg-slate-100 dark:text-slate-900 dark:border-slate-100'
                        : 'border-slate-200 dark:border-slate-700 text-slate-900 dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-700'
                    }`}
                    onClick={() => setFormat(value)}
                  >
                    {label}
                  </button>
                )
              })}
            </div>
            <div class="text-xs text-slate-500 dark:text-slate-400">
              预计体积：{estimatedSize}
            </div>
          </div>
        ) : fixedFormat ? (
          <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>输出格式</span>
            <span class="font-medium">
              {fixedFormat === 'image/png' ? 'PNG' : fixedFormat === 'image/webp' ? 'WEBP' : 'JPG'}
            </span>
          </div>
        ) : null}

        {showQuality ? (
          <div class="flex flex-col gap-2">
            <div class="text-xs font-semibold tracking-wide text-slate-500 dark:text-slate-400">
              质量
            </div>
            <div class="flex flex-col gap-2">
              <div class="text-sm font-medium text-slate-600 dark:text-slate-400">
                质量（{quality}%）
              </div>
              <input
                type="range"
                class="range range-primary w-full"
                value={quality}
                min={10}
                max={100}
                step={1}
                disabled={resolvedFormat === 'image/png'}
                onInput={(e) =>
                  setQuality(Number((e.currentTarget as HTMLInputElement).value))
                }
              />
            </div>
            {resolvedFormat === 'image/png' ? (
              <div class="text-xs text-slate-500 dark:text-slate-400">PNG 使用无损输出</div>
            ) : null}
          </div>
        ) : typeof fixedQuality === 'number' ? (
          <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>压缩质量</span>
            <span class="font-medium">{fixedQuality}%</span>
          </div>
        ) : null}

        {sizeMode === 'readonly' && (
          <div class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
            <span>输出尺寸</span>
            <span class="font-medium">{sizeText}</span>
          </div>
        )}

        {sizeMode === 'editable' && (
          <div class="flex flex-col gap-3">
            <button
              type="button"
              class="flex items-center justify-between text-sm font-medium text-slate-900 dark:text-slate-100"
              onClick={() => setIsSizeOpen((v) => !v)}
            >
              <span>尺寸（可选）</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">{isSizeOpen ? '▲' : '▼'}</span>
            </button>
            {isSizeOpen && (
              <div class="flex flex-col gap-3 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <div class="grid grid-cols-2 gap-3">
                  <div class="flex flex-col gap-1">
                    <label class="text-xs text-slate-500 dark:text-slate-400">宽度</label>
                    <input
                      type="number"
                      min={1}
                      max={20000}
                      inputMode="numeric"
                      placeholder="auto"
                      class="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                      value={sizeWInput}
                      onInput={(e) => {
                        const next = e.currentTarget.value
                        setSizeDirty(true)
                        setSizeWInput(next)
                        const nextValue = parsePositiveInt(next)
                        if (keepRatio && nextValue && ratio) {
                          setSizeHInput(String(Math.max(1, Math.round(nextValue / ratio))))
                        }
                      }}
                    />
                  </div>
                  <div class="flex flex-col gap-1">
                    <label class="text-xs text-slate-500 dark:text-slate-400">高度</label>
                    <input
                      type="number"
                      min={1}
                      max={20000}
                      inputMode="numeric"
                      placeholder="auto"
                      class="w-full h-10 px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm"
                      value={sizeHInput}
                      onInput={(e) => {
                        const next = e.currentTarget.value
                        setSizeDirty(true)
                        setSizeHInput(next)
                        const nextValue = parsePositiveInt(next)
                        if (keepRatio && nextValue && ratio) {
                          setSizeWInput(String(Math.max(1, Math.round(nextValue * ratio))))
                        }
                      }}
                    />
                  </div>
                </div>
                <label class="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary checkbox-sm"
                    checked={keepRatio}
                    onChange={(e) =>
                      setKeepRatio((e.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span class="label-text text-sm">锁定比例</span>
                </label>
              </div>
            )}
            <div class="flex items-center justify-between text-xs text-slate-500 dark:text-slate-400">
              <span>输出尺寸</span>
              <span>{sizeText}</span>
            </div>
          </div>
        )}

        {showAdvanced ? (
          <div class="flex flex-col gap-2">
            <button
              type="button"
              class="flex items-center justify-between text-sm font-medium text-slate-900 dark:text-slate-100"
              onClick={() => setIsAdvancedOpen((v) => !v)}
            >
              <span>高级设置</span>
              <span class="text-xs text-slate-500 dark:text-slate-400">{isAdvancedOpen ? '▲' : '▼'}</span>
            </button>
            {isAdvancedOpen ? (
              <div class="flex flex-col gap-2 rounded-xl border border-slate-200 dark:border-slate-700 p-3">
                <label class="label cursor-not-allowed justify-start gap-2 opacity-50">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary checkbox-sm"
                    checked
                    disabled
                    onChange={() => undefined}
                  />
                  <span class="label-text text-sm">移除元数据（已默认开启）</span>
                </label>
                <label class="label cursor-pointer justify-start gap-2">
                  <input
                    type="checkbox"
                    class="checkbox checkbox-primary checkbox-sm"
                    checked={optimizeForWeb}
                    onChange={(e) =>
                      setOptimizeForWeb((e.currentTarget as HTMLInputElement).checked)
                    }
                  />
                  <span class="label-text text-sm">Web 优化（适度压缩体积）</span>
                </label>
              </div>
            ) : null}
          </div>
        ) : null}
          </div>
        </div>
        <div class="modal-action">
          <button type="button" class="btn btn-outline btn-sm" onClick={onClose}>
            取消
          </button>
          <button
            type="button"
            class="btn btn-primary btn-sm"
            onClick={handleConfirm}
            disabled={!canConfirm}
          >
            下载
          </button>
        </div>
      </div>
      <form method="dialog" class="modal-backdrop">
        <button type="button" onClick={onClose}>
          close
        </button>
      </form>
    </dialog>
  )
}
