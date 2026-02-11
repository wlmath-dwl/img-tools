export type PremiumSliderProps = {
  label?: string
  value: number
  min: number
  max: number
  step?: number
  disabled?: boolean
  showValue?: boolean
  valueFormatter?: (value: number) => string
  onInput: (value: number) => void
  class?: string
}

/**
 * 高级感滑动条组件
 * 特点：
 * - 白色滑块 + 紫色边框，对比鲜明
 * - 精致投影，制造浮动感
 * - 交互时略微放大，增强操控感
 * - 保持一定的分量感（粗轨道）
 * - 已滑动部分显示主色背景
 */
export function PremiumSlider({
  label,
  value,
  min,
  max,
  step = 1,
  disabled = false,
  showValue = false,
  valueFormatter,
  onInput,
  class: className,
}: PremiumSliderProps) {
  const displayValue = valueFormatter ? valueFormatter(value) : value
  
  // 计算进度百分比，用于显示已滑动部分的背景色
  const percentage = ((value - min) / (max - min)) * 100

  return (
    <div class={`flex flex-col gap-2 ${className || ''}`}>
      {label && (
        <div class="flex items-center justify-between">
          <label class="text-sm font-medium text-slate-600 dark:text-slate-300">
            {label}
          </label>
          {showValue && (
            <span class="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
              {displayValue}
            </span>
          )}
        </div>
      )}
      <input
        type="range"
        class="premium-slider"
        style={`--value: ${percentage}; --min: ${min}; --max: ${max}`}
        value={value}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onInput={(e) => {
          const target = e.currentTarget as HTMLInputElement
          onInput(Number(target.value))
        }}
      />
    </div>
  )
}





