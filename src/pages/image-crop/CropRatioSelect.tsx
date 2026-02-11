import { useMemo, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'

type CropRatioOption = {
  value: string
  ratio: number
  label: string
}

type CropRatioSelectProps = {
  value: string
  onChange: (value: string) => void
  label?: string
  disabled?: boolean
}

export function CropRatioSelect({
  value,
  onChange,
  label,
  disabled = false,
}: CropRatioSelectProps) {
  const { t } = useI18n()
  const [isOpen, setIsOpen] = useState(false)
  const [activeIndex, setActiveIndex] = useState(0)

  // 动态获取翻译后的选项
  const RATIO_OPTIONS: CropRatioOption[] = useMemo(() => [
    { value: 'free', ratio: 0, label: t('cropRatio.free') },
    { value: '1:1', ratio: 1, label: '1:1' },
    { value: '9:16', ratio: 9 / 16, label: '9:16' },
    { value: '16:9', ratio: 16 / 9, label: '16:9' },
    { value: '4:5', ratio: 4 / 5, label: '4:5' },
    { value: '2:3', ratio: 2 / 3, label: '2:3' },
    { value: '4:3', ratio: 4 / 3, label: '4:3' },
    { value: '3:2', ratio: 3 / 2, label: '3:2' },
    { value: 'circle', ratio: 1, label: t('cropRatio.circle') },
    { value: 'custom', ratio: 0, label: t('cropRatio.custom') },
  ], [t])

  const selected = useMemo(() => {
    return RATIO_OPTIONS.find((o) => o.value === value) ?? RATIO_OPTIONS[0]
  }, [value])

  return (
    <div class="flex flex-col gap-1.5">
      {label && (
        <label class="text-sm font-medium text-slate-700 dark:text-slate-300">
          {label}
        </label>
      )}

      <div class="relative">
          <button
            type="button"
            disabled={disabled}
            class={`w-full h-10 px-3 text-sm rounded-xl border border-slate-200/60 dark:border-slate-700/60
              bg-white/50 dark:bg-slate-900/50 text-slate-900 dark:text-slate-100
              focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-900 focus-visible:ring-offset-1 dark:focus-visible:ring-slate-100 dark:focus-visible:ring-offset-slate-900
              disabled:opacity-50 disabled:cursor-not-allowed transition-all hover:border-slate-300 dark:hover:border-slate-600
              flex items-center justify-between gap-2`}
            onClick={() => {
              if (disabled) return
              setIsOpen((v) => !v)
            }}
          >
            <div class="min-w-0 flex-1 text-left">
              <div class="truncate font-medium text-sm">{selected.label}</div>
            </div>
            <span class="text-slate-600 dark:text-slate-300 text-xs shrink-0">
              {isOpen ? '▲' : '▼'}
            </span>
          </button>

          {isOpen ? (
            <>
              <div
                class="fixed inset-0 z-40"
                onClick={() => setIsOpen(false)}
              />
              <div class="absolute z-50 mt-1 w-full bg-white/95 dark:bg-slate-900/95 backdrop-blur-sm border border-slate-200/60 dark:border-slate-700/60 rounded-xl shadow-lg max-h-60 overflow-y-auto">
                {RATIO_OPTIONS.map((opt, idx) => {
                  const isSelected = opt.value === value
                  const isActive = idx === activeIndex
                  return (
                    <button
                      key={opt.value}
                      type="button"
                      class={`w-full flex items-center gap-2 px-2.5 py-2 text-left transition-colors ${
                        isActive
                          ? 'bg-slate-100 dark:bg-slate-800'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/50'
                      }`}
                      onMouseEnter={() => setActiveIndex(idx)}
                      onClick={() => {
                        onChange(opt.value)
                        setIsOpen(false)
                      }}
                    >
                      <div class="min-w-0 flex-1">
                        <div class="text-sm font-medium truncate">{opt.label}</div>
                      </div>
                      {isSelected ? (
                        <span class="text-xs text-slate-500 dark:text-slate-400 shrink-0">✓</span>
                      ) : null}
                    </button>
                  )
                })}
              </div>
            </>
          ) : null}
      </div>
    </div>
  )
}

export function getRatioByValue(value: string): number | null {
  // 静态的比例映射，不依赖翻译
  const ratioMap: Record<string, number | null> = {
    'free': null,
    '1:1': 1,
    '9:16': 9 / 16,
    '16:9': 16 / 9,
    '4:5': 4 / 5,
    '2:3': 2 / 3,
    '4:3': 4 / 3,
    '3:2': 3 / 2,
    'circle': 1,
    'custom': null,
  }
  return ratioMap[value] ?? null
}



