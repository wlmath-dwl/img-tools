import { type ComponentChildren } from 'preact'
import { useI18n } from '../../i18n/context'
import { BackIcon } from '../icons/BackIcon'

type ToolbarProps = {
    title: string
    rightInfo?: ComponentChildren
    onBackToHome?: () => void
    onPreview?: () => void
    previewActionLabel?: string
    onReselect?: () => void
    secondaryActionLabel?: string
    primaryActionLabel?: string
    primaryDisabled?: boolean
    onPrimaryAction?: () => unknown | Promise<unknown>
    onAddFiles?: () => void
    addFilesLabel?: string
}

export function Toolbar({
    title,
    rightInfo,
    onBackToHome,
    onPreview,
    previewActionLabel,
    onReselect,
    secondaryActionLabel,
    primaryActionLabel,
    primaryDisabled,
    onPrimaryAction,
    onAddFiles,
    addFilesLabel,
}: ToolbarProps) {
    const { t } = useI18n()

    return (
        <div class="px-3 h-14 border-b border-slate-200 dark:border-slate-700 flex items-center">
            <div class="grid grid-cols-[auto_1fr_auto] items-center gap-2 sm:gap-4 w-full">
                <div class="flex items-center gap-2 sm:gap-3 min-w-0">
                {onBackToHome ? (
                    <button
                        type="button"
                        class="btn btn-sm btn-square rounded-xl"
                        aria-label={t('nav.home')}
                        title={t('nav.home')}
                        onClick={onBackToHome}
                    >
                        <BackIcon size={18} />
                    </button>
                ) : null}
                </div>

                <div class="flex flex-col items-center justify-center min-w-0">
                    <h1 class="text-sm sm:text-lg font-bold leading-none text-slate-900 dark:text-slate-100 truncate w-full text-center">
                        {title}
                    </h1>
                    {rightInfo ? (
                        <div class="text-xs text-slate-500 dark:text-slate-400 truncate w-full text-center">
                            {rightInfo}
                        </div>
                    ) : null}
                </div>

                <div class="flex items-center justify-end gap-2 flex-wrap min-w-0">
                    {addFilesLabel && onAddFiles ? (
                        <button type="button" class="btn btn-sm" onClick={onAddFiles}>
                            {addFilesLabel}
                        </button>
                    ) : null}
                    {previewActionLabel && onPreview ? (
                        <button type="button" class="btn btn-sm" onClick={onPreview}>
                            {previewActionLabel}
                        </button>
                    ) : null}
                    {secondaryActionLabel && onReselect ? (
                        <button type="button" class="btn btn-sm" onClick={onReselect}>
                            {secondaryActionLabel}
                        </button>
                    ) : null}
                    {primaryActionLabel && onPrimaryAction ? (
                        <button
                            type="button"
                            class="btn btn-primary btn-sm"
                            onClick={onPrimaryAction}
                            disabled={primaryDisabled}
                        >
                            {primaryActionLabel}
                        </button>
                    ) : null}
                </div>
            </div>
        </div>
    )
}