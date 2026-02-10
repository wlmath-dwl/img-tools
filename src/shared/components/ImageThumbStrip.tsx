import type { ComponentChildren } from 'preact'

export type ImageThumbItem = {
  id: string
  url: string
  name: string
}

type ImageThumbStripProps = {
  items: ImageThumbItem[]
  activeId: string
  onSelect: (id: string) => void
  onRemove?: (id: string) => void
  /** 可选：放在右侧的附加操作（例如“添加更多”按钮） */
  extraRight?: ComponentChildren
}

export function ImageThumbStrip({ items, activeId, onSelect, onRemove: _onRemove, extraRight }: ImageThumbStripProps) {
  return (
    <div class="w-full flex items-center gap-3 px-3 py-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur border-t border-slate-200/70 dark:border-slate-700/70">
      <div class="flex-1 min-w-0 overflow-x-auto overflow-y-visible">
        <div class="flex gap-2 w-max pr-2">
          {items.map((it) => {
            const isActive = it.id === activeId
            return (
              <button
                key={it.id}
                type="button"
                class={`relative w-16 h-16 p-1 rounded-lg transition-colors flex-shrink-0 border-2 ${isActive
                  ? 'border-blue-500'
                  : 'border-transparent'
                  }`}
                onClick={() => onSelect(it.id)}
                title={it.name}
                aria-label={it.name}
              >
                <div class="w-full h-full rounded-md overflow-hidden bg-slate-100 dark:bg-slate-800">
                  <img
                    src={it.url}
                    alt={it.name}
                    class="w-full h-full object-cover block"
                    draggable={false}
                  />
                </div>
                {/* 缩略条不提供“删除叉号”，删除统一走上方操作栏 */}
              </button>
            )
          })}
        </div>
      </div>

      {extraRight ? (
        <div class="shrink-0">
          {extraRight}
        </div>
      ) : null}
    </div>
  )
}

