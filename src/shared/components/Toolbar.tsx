import { type ComponentChildren } from 'preact'
import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import { useI18n } from '../../i18n/context'
import { BackIcon } from '../icons/BackIcon'

type ToolbarProps = {
    title: string
    rightInfo?: ComponentChildren
    onBackToHome?: () => void
    onReselect?: () => void
    secondaryActionLabel?: string
    secondaryDisabled?: boolean
    primaryActionLabel?: string
    primaryDisabled?: boolean
    onPrimaryAction?: () => unknown | Promise<unknown>
    onAddFiles?: () => void
    addFilesLabel?: string
    addFilesDisabled?: boolean
}

export function Toolbar({
    title,
    rightInfo,
    onBackToHome,
    onReselect,
    secondaryActionLabel,
    secondaryDisabled,
    primaryActionLabel,
    primaryDisabled,
    onPrimaryAction,
    onAddFiles,
    addFilesLabel,
    addFilesDisabled,
}: ToolbarProps) {
    const { t } = useI18n()
    const [compactActions, setCompactActions] = useState(false)
    const [menuOpen, setMenuOpen] = useState(false)
    const menuRootRef = useRef<HTMLDivElement | null>(null)

    const actions = useMemo(() => {
        const list: Array<{
            key: 'add' | 'reselect' | 'primary'
            label: string
            onClick?: () => unknown | Promise<unknown>
            disabled?: boolean
            primary?: boolean
        }> = []
        if (addFilesLabel) {
            list.push({
                key: 'add',
                label: addFilesLabel,
                onClick: onAddFiles,
                disabled: addFilesDisabled,
            })
        }
        if (secondaryActionLabel) {
            list.push({
                key: 'reselect',
                label: secondaryActionLabel,
                onClick: onReselect,
                disabled: secondaryDisabled,
            })
        }
        if (primaryActionLabel) {
            list.push({
                key: 'primary',
                label: primaryActionLabel,
                onClick: onPrimaryAction,
                disabled: primaryDisabled,
                primary: true,
            })
        }
        return list
    }, [
        addFilesLabel,
        onAddFiles,
        addFilesDisabled,
        secondaryActionLabel,
        onReselect,
        secondaryDisabled,
        primaryActionLabel,
        onPrimaryAction,
        primaryDisabled,
    ])

    useEffect(() => {
        if (typeof window === 'undefined') return
        const update = () => {
            // 小屏优先折叠，避免长文案按钮挤压标题与布局
            setCompactActions(window.innerWidth < 900)
        }
        update()
        window.addEventListener('resize', update)
        return () => window.removeEventListener('resize', update)
    }, [])

    useEffect(() => {
        if (!menuOpen) return
        const onPointerDown = (e: PointerEvent) => {
            const root = menuRootRef.current
            if (!root) return
            if (e.target instanceof Node && root.contains(e.target)) return
            setMenuOpen(false)
        }
        const onKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'Escape') setMenuOpen(false)
        }
        window.addEventListener('pointerdown', onPointerDown, { capture: true })
        window.addEventListener('keydown', onKeyDown)
        return () => {
            window.removeEventListener('pointerdown', onPointerDown, { capture: true } as any)
            window.removeEventListener('keydown', onKeyDown)
        }
    }, [menuOpen])

    const showCompactMenu = compactActions && actions.length > 0

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
                        <div class="text-xs text-slate-600 dark:text-slate-300 truncate w-full text-center">
                            {rightInfo}
                        </div>
                    ) : null}
                </div>

                <div class="flex items-center justify-end gap-2 min-w-0">
                    {showCompactMenu ? (
                        <div ref={menuRootRef} class="relative">
                            <button
                                type="button"
                                class="btn btn-sm btn-square rounded-xl"
                                aria-label={t('common.actions')}
                                title={t('common.actions')}
                                onClick={() => setMenuOpen((v) => !v)}
                            >
                                ⋯
                            </button>
                            {menuOpen ? (
                                <div class="absolute right-0 mt-2 z-20 w-44 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-lg p-2 flex flex-col gap-1">
                                    {actions.map((action) => (
                                        <button
                                            key={action.key}
                                            type="button"
                                            class={action.primary ? 'btn btn-primary btn-sm justify-start' : 'btn btn-sm justify-start'}
                                            disabled={action.disabled}
                                            onClick={() => {
                                                setMenuOpen(false)
                                                void action.onClick?.()
                                            }}
                                        >
                                            {action.label}
                                        </button>
                                    ))}
                                </div>
                            ) : null}
                        </div>
                    ) : (
                        <>
                            {actions.map((action) => (
                                <button
                                    key={action.key}
                                    type="button"
                                    class={action.primary ? 'btn btn-primary btn-sm' : 'btn btn-sm'}
                                    onClick={() => void action.onClick?.()}
                                    disabled={action.disabled}
                                >
                                    {action.label}
                                </button>
                            ))}
                        </>
                    )}
                </div>
            </div>
        </div>
    )
}