import type { ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { CloseIcon } from '../icons'

type ProcessingOverlayStatus = 'processing' | 'success' | 'error'

type ProcessingOverlayProps = {
  isOpen: boolean
  title: string
  /** 0-100，建议在处理中时到 90-97 左右停住，完成再补满 */
  progress: number
  status: ProcessingOverlayStatus
  /** 预留：顶部补充说明（当前按产品要求不展示） */
  subtitle?: string
  errorText?: string
  content?: ComponentChildren
  /** 内容区最小高度：保证有无广告/互荐切换不跳动 */
  contentMinHeight?: number
  /** 取消：仅关闭弹层，不保证中止计算（由上层决定是否支持 abort） */
  onCancel?: () => void
  /** 完成后的主按钮（默认隐藏，success 时展示） */
  primaryActionLabel?: string
  onPrimaryAction?: () => void | Promise<void>
}

function clamp01(v: number) {
  if (!Number.isFinite(v)) return 0
  return Math.max(0, Math.min(1, v))
}

/**
 * 通用“处理中”弹层：
 * - 居中遮罩 + 进度条 + 内容区（互荐/广告占位）+ 操作区
 * - 仅负责展示；进度与阶段由外部驱动，方便适配“无广告/有广告”两套策略
 */
export function ProcessingOverlay({
  isOpen,
  title,
  progress,
  status,
  subtitle,
  errorText,
  content,
  contentMinHeight = 280,
  onCancel,
  primaryActionLabel,
  onPrimaryAction,
}: ProcessingOverlayProps) {
  const rootRef = useRef<HTMLDivElement | null>(null)
  const { t } = useI18n()
  const resolvedPrimaryActionLabel = primaryActionLabel ?? t('common.download')

  // 打开时锁定滚动 & 支持 ESC 关闭（按产品习惯：ESC 等价取消）
  useEffect(() => {
    if (!isOpen) return
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'

    function onKeyDown(e: KeyboardEvent) {
      // 产品要求：处理中不允许取消；仅在非处理中阶段允许 ESC 关闭
      if (e.key === 'Escape' && status !== 'processing') onCancel?.()
    }
    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.body.style.overflow = prevOverflow
      document.removeEventListener('keydown', onKeyDown)
    }
  }, [isOpen, onCancel, status])

  // 简单焦点落点：避免打开后键盘 tab 飞到背景
  useEffect(() => {
    if (!isOpen) return
    rootRef.current?.focus?.()
  }, [isOpen])

  const displayProgress = status === 'success' ? 100 : progress
  const progressRatio = useMemo(
    () => clamp01(displayProgress / 100),
    [displayProgress],
  )
  // 当前按产品要求：进度条上方不展示描述；保留参数便于未来扩展
  void subtitle

  if (!isOpen) return null

  return (
    <div class="fixed inset-0 z-[60]">
      {/* 遮罩 */}
      <div
        class="absolute inset-0 bg-black/40 dark:bg-black/60 backdrop-blur-sm"
        onClick={() => {
          // 产品要求：处理中不允许取消；仅在非处理中阶段允许点击蒙层关闭
          if (status !== 'processing') onCancel?.()
        }}
      />

      {/* 弹层容器 */}
      <div class="absolute inset-0 flex items-center justify-center p-4">
        <div
          ref={rootRef}
          tabIndex={-1}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          class="relative w-full max-w-[600px] bg-white/95 text-slate-900 border border-slate-200/60 shadow-2xl rounded-2xl overflow-hidden outline-none dark:bg-slate-950/85 dark:text-white dark:border-white/10"
          onClick={(e) => e.stopPropagation()}
        >
          {/* 右上角关闭（处理中禁用，避免变相取消） */}
          <button
            type="button"
            aria-label={t('common.close')}
            title={status === 'processing' ? t('layout.processing') : t('common.close')}
            disabled={status === 'processing'}
            onClick={() => {
              if (status !== 'processing') onCancel?.()
            }}
            class="absolute top-3 right-3 w-11 h-11 rounded-2xl inline-flex items-center justify-center border border-slate-200/70 bg-white/70 text-slate-700 shadow-sm hover:bg-white transition-colors backdrop-blur disabled:opacity-30 disabled:cursor-not-allowed dark:border-white/10 dark:bg-slate-900/50 dark:text-white/80 dark:hover:bg-slate-900/70"
          >
            <CloseIcon size={22} />
          </button>

          {/* 状态区 */}
          <div class="px-5 pt-5 pb-4">
            <div class="flex items-center justify-between gap-3">
              <div class="text-base md:text-lg font-semibold">{title}</div>
              {/* 预留：右侧状态标签（避免过度 UI） */}
            </div>
            {/* 产品要求：进度条上方不展示描述（subtitle 仅用于可选扩展） */}

            <div class="mt-4">
              <div class="h-2 rounded-full bg-slate-200/60 dark:bg-white/10 overflow-hidden">
                <div
                  class={`h-full rounded-full transition-[width] duration-300 ${status === 'error'
                    ? 'bg-red-500'
                    : status === 'success'
                      ? 'bg-emerald-500'
                      : 'bg-slate-900 dark:bg-white/80'
                    }`}
                  style={{ width: `${Math.round(progressRatio * 100)}%` }}
                />
              </div>
              <div class="mt-2 text-xs text-slate-600 dark:text-white/60">
                {Math.round(progressRatio * 100)}%
              </div>
            </div>
          </div>

          {/* 内容区 */}
          <div
            class="px-5 pb-4"
            style={{ minHeight: `${contentMinHeight}px` }}
          >
            {content ? (
              content
            ) : (
              <div class="h-full flex items-center justify-center text-sm text-white/70 text-center">
                等待期间，可以看看我们的其他免费工具
              </div>
            )}
          </div>

          {/* 操作区 */}
          <div class="px-5 py-4 border-t border-slate-200/60 dark:border-white/10 flex items-center justify-end gap-3">
            {status === 'error' ? (
              <div class="flex items-center gap-3">
                {errorText ? (
                  <div class="text-sm text-red-600 dark:text-red-200 max-w-[360px] truncate">
                    {errorText}
                  </div>
                ) : null}
                <button
                  type="button"
                  class="h-11 px-6 rounded-xl bg-slate-900 text-white font-semibold hover:bg-slate-800 transition-colors dark:bg-white dark:text-slate-950 dark:hover:bg-white/90"
                  onClick={() => onCancel?.()}
                >
                  {t('common.close')}
                </button>
              </div>
            ) : (
              <button
                type="button"
                class={`h-11 px-6 rounded-xl font-semibold transition-colors ${status === 'processing'
                  ? 'bg-slate-200 text-slate-500 dark:bg-white/20 dark:text-white/70 cursor-not-allowed'
                  : 'bg-slate-900 text-white hover:bg-slate-800 dark:bg-white dark:text-slate-950 dark:hover:bg-white/90'
                  }`}
                disabled={status === 'processing'}
                onClick={() => {
                  if (status !== 'processing') {
                    void onPrimaryAction?.()
                  }
                }}
              >
                {resolvedPrimaryActionLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

