import { useEffect, useMemo, useRef, useState } from 'preact/hooks'
import type { CanvasImageViewerApi, CanvasImageViewerViewState } from '../../shared/components/CanvasImageViewer'

type CropRect = { x: number; y: number; w: number; h: number } // 原图坐标系

export type CropMode =
  | { kind: 'free' }
  | { kind: 'ratio'; ratio: number; label: string }
  | { kind: 'circle' }

type CropOverlayProps = {
  api: CanvasImageViewerApi
  imageWidth: number
  imageHeight: number
  mode: CropMode
  rect: CropRect
  onRectChange: (next: CropRect) => void
}

type Handle =
  | 'move'
  | 'n'
  | 's'
  | 'e'
  | 'w'
  | 'ne'
  | 'nw'
  | 'se'
  | 'sw'

const MIN_SIZE = 24
// 视觉尺寸与热区：视觉小一些，热区更大，提升可操作性
const HANDLE_VISUAL_SIZE = 10
const HANDLE_HIT_SIZE = 18

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v))
}

function rectNormalize(r: CropRect): CropRect {
  const x1 = Math.min(r.x, r.x + r.w)
  const y1 = Math.min(r.y, r.y + r.h)
  const x2 = Math.max(r.x, r.x + r.w)
  const y2 = Math.max(r.y, r.y + r.h)
  return { x: x1, y: y1, w: x2 - x1, h: y2 - y1 }
}

function getRatio(mode: CropMode): number | null {
  if (mode.kind === 'ratio') return mode.ratio
  if (mode.kind === 'circle') return 1
  return null
}

function effectiveSize(v: CanvasImageViewerViewState) {
  return { w: v.effectiveWidth, h: v.effectiveHeight }
}

function pointOriginalToEffective(
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number,
) {
  if (rotation === 0) return { x, y }
  if (rotation === 90) return { x: origH - y, y: x }
  if (rotation === 180) return { x: origW - x, y: origH - y }
  // 270
  return { x: y, y: origW - x }
}

function pointEffectiveToOriginal(
  x: number,
  y: number,
  rotation: 0 | 90 | 180 | 270,
  origW: number,
  origH: number,
) {
  if (rotation === 0) return { x, y }
  if (rotation === 90) return { x: y, y: origH - x }
  if (rotation === 180) return { x: origW - x, y: origH - y }
  // 270
  return { x: origW - y, y: x }
}

function rectOriginalToEffective(r: CropRect, v: CanvasImageViewerViewState): CropRect {
  const a = pointOriginalToEffective(r.x, r.y, v.rotation, v.imageWidth, v.imageHeight)
  const b = pointOriginalToEffective(r.x + r.w, r.y, v.rotation, v.imageWidth, v.imageHeight)
  const c = pointOriginalToEffective(r.x, r.y + r.h, v.rotation, v.imageWidth, v.imageHeight)
  const d = pointOriginalToEffective(r.x + r.w, r.y + r.h, v.rotation, v.imageWidth, v.imageHeight)
  const minX = Math.min(a.x, b.x, c.x, d.x)
  const minY = Math.min(a.y, b.y, c.y, d.y)
  const maxX = Math.max(a.x, b.x, c.x, d.x)
  const maxY = Math.max(a.y, b.y, c.y, d.y)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function rectEffectiveToOriginal(r: CropRect, v: CanvasImageViewerViewState): CropRect {
  const a = pointEffectiveToOriginal(r.x, r.y, v.rotation, v.imageWidth, v.imageHeight)
  const b = pointEffectiveToOriginal(r.x + r.w, r.y, v.rotation, v.imageWidth, v.imageHeight)
  const c = pointEffectiveToOriginal(r.x, r.y + r.h, v.rotation, v.imageWidth, v.imageHeight)
  const d = pointEffectiveToOriginal(r.x + r.w, r.y + r.h, v.rotation, v.imageWidth, v.imageHeight)
  const minX = Math.min(a.x, b.x, c.x, d.x)
  const minY = Math.min(a.y, b.y, c.y, d.y)
  const maxX = Math.max(a.x, b.x, c.x, d.x)
  const maxY = Math.max(a.y, b.y, c.y, d.y)
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY }
}

function clampEffectiveRect(r: CropRect, v: CanvasImageViewerViewState): CropRect {
  const s = effectiveSize(v)
  const rr = rectNormalize(r)
  const w = clamp(rr.w, MIN_SIZE, s.w)
  const h = clamp(rr.h, MIN_SIZE, s.h)
  const x = clamp(rr.x, 0, s.w - w)
  const y = clamp(rr.y, 0, s.h - h)
  return { x, y, w, h }
}

function applyRatio(r: CropRect, handle: Handle, ratio: number): CropRect {
  // ratio = w/h
  let { x, y, w, h } = rectNormalize(r)
  if (w <= 0 || h <= 0) return { x, y, w, h }

  const cx = x + w / 2
  const cy = y + h / 2

  // 根据当前 w/h 调整一边
  const wantW = h * ratio
  const wantH = w / ratio

  const adjustByWidth = Math.abs(w - wantW) < Math.abs(h - wantH)

  if (handle === 'move') return { x, y, w, h }

  if (handle === 'n' || handle === 's') {
    // 锁高 -> 算宽，保持中心
    w = h * ratio
    x = cx - w / 2
    return { x, y, w, h }
  }
  if (handle === 'e' || handle === 'w') {
    // 锁宽 -> 算高，保持中心
    h = w / ratio
    y = cy - h / 2
    return { x, y, w, h }
  }

  // 四角：固定对角点
  if (adjustByWidth) {
    w = h * ratio
  } else {
    h = w / ratio
  }

  if (handle === 'se') {
    // 固定 nw
    return { x, y, w, h }
  }
  if (handle === 'sw') {
    // 固定 ne
    return { x: x + (rectNormalize(r).w - w), y, w, h }
  }
  if (handle === 'ne') {
    // 固定 sw
    return { x, y: y + (rectNormalize(r).h - h), w, h }
  }
  // nw：固定 se
  return {
    x: x + (rectNormalize(r).w - w),
    y: y + (rectNormalize(r).h - h),
    w,
    h,
  }
}

function cursorForHandle(h: Handle) {
  if (h === 'move') return 'move'
  if (h === 'n' || h === 's') return 'ns-resize'
  if (h === 'e' || h === 'w') return 'ew-resize'
  if (h === 'ne' || h === 'sw') return 'nesw-resize'
  // nw / se
  return 'nwse-resize'
}

function effectiveToScreenRect(eff: CropRect, v: CanvasImageViewerViewState) {
  const sx = v.boxX + (eff.x / v.effectiveWidth) * v.boxW
  const sy = v.boxY + (eff.y / v.effectiveHeight) * v.boxH
  const sw = (eff.w / v.effectiveWidth) * v.boxW
  const sh = (eff.h / v.effectiveHeight) * v.boxH
  return { x: sx, y: sy, w: sw, h: sh }
}

function screenToEffectivePoint(
  clientX: number,
  clientY: number,
  rootEl: HTMLDivElement,
  v: CanvasImageViewerViewState,
) {
  const rect = rootEl.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const ex = ((x - v.boxX) / v.boxW) * v.effectiveWidth
  const ey = ((y - v.boxY) / v.boxH) * v.effectiveHeight
  return { x: ex, y: ey }
}

export function CropOverlay({ api, imageWidth, imageHeight, mode, rect, onRectChange }: CropOverlayProps) {
  const rootRef = useRef<HTMLDivElement>(null)
  const [view, setView] = useState<CanvasImageViewerViewState | null>(null)
  const viewRef = useRef<CanvasImageViewerViewState | null>(null)

  // 轮询 viewState（缩放/平移/旋转都会改变）
  useEffect(() => {
    let raf = 0
    const tick = () => {
      const next = api.getViewState()
      // 轻量比较，减少重渲染
      const same =
        !!next &&
        !!viewRef.current &&
        next.boxX === viewRef.current.boxX &&
        next.boxY === viewRef.current.boxY &&
        next.boxW === viewRef.current.boxW &&
        next.boxH === viewRef.current.boxH &&
        next.rotation === viewRef.current.rotation
      if (!same) {
        viewRef.current = next
        setView(next)
      }
      raf = requestAnimationFrame(tick)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [api])

  const ratio = getRatio(mode)

  const screen = useMemo(() => {
    if (!view) return null
    const eff = clampEffectiveRect(rectOriginalToEffective(rect, view), view)
    return effectiveToScreenRect(eff, view)
  }, [rect, view])

  const dragRef = useRef<{
    handle: Handle
    startEff: CropRect
    startPt: { x: number; y: number }
    // 允许通过 Shift 临时锁定比例（free 模式下取起始宽高比）
    startRatio: number | null
  } | null>(null)

  function startDrag(handle: Handle, e: PointerEvent) {
    const root = rootRef.current
    const v = view
    if (!root || !v) return
    e.preventDefault()
    // 阻止事件冒泡到 CanvasImageViewer，避免“拖裁切框时画布也开始拖拽”
    e.stopPropagation?.()
    // 关键：覆盖层本身需要“透传”事件，只有手柄/裁切框可交互。
    // 因此 pointer capture 放到触发元素上，让 move/up 事件继续冒泡到 root 来统一处理。
    const el = (e.currentTarget as HTMLElement | null)
    if (el && typeof el.setPointerCapture === 'function') {
      el.setPointerCapture(e.pointerId)
    }

    const startEff = clampEffectiveRect(rectOriginalToEffective(rect, v), v)
    const startPt = screenToEffectivePoint(e.clientX, e.clientY, root, v)
    dragRef.current = {
      handle,
      startEff,
      startPt,
      startRatio: startEff.h > 0 ? (startEff.w / startEff.h) : null,
    }
  }

  function onMove(e: PointerEvent) {
    const root = rootRef.current
    const v = view
    const drag = dragRef.current
    if (!root || !v || !drag) return

    e.preventDefault()
    const pt = screenToEffectivePoint(e.clientX, e.clientY, root, v)
    const dx = pt.x - drag.startPt.x
    const dy = pt.y - drag.startPt.y
    let next = { ...drag.startEff }

    const apply = (patch: Partial<CropRect>) => {
      next = { ...next, ...patch }
    }

    switch (drag.handle) {
      case 'move':
        apply({ x: next.x + dx, y: next.y + dy })
        break
      case 'e':
        apply({ w: next.w + dx })
        break
      case 'w':
        apply({ x: next.x + dx, w: next.w - dx })
        break
      case 's':
        apply({ h: next.h + dy })
        break
      case 'n':
        apply({ y: next.y + dy, h: next.h - dy })
        break
      case 'se':
        apply({ w: next.w + dx, h: next.h + dy })
        break
      case 'sw':
        apply({ x: next.x + dx, w: next.w - dx, h: next.h + dy })
        break
      case 'ne':
        apply({ y: next.y + dy, h: next.h - dy, w: next.w + dx })
        break
      case 'nw':
        apply({ x: next.x + dx, w: next.w - dx, y: next.y + dy, h: next.h - dy })
        break
    }

    // 比例锁定：优先使用模式自带比例；free 模式下按住 Shift 临时锁定起始宽高比
    const shiftRatio = (e as unknown as { shiftKey?: boolean }).shiftKey ? drag.startRatio : null
    const ratioToApply = ratio ?? shiftRatio
    if (ratioToApply && drag.handle !== 'move') {
      next = applyRatio(next, drag.handle, ratioToApply)
    }

    next = clampEffectiveRect(next, v)
    const orig = rectNormalize(rectEffectiveToOriginal(next, v))
    const clampedOrig: CropRect = {
      x: clamp(orig.x, 0, imageWidth - MIN_SIZE),
      y: clamp(orig.y, 0, imageHeight - MIN_SIZE),
      w: clamp(orig.w, MIN_SIZE, imageWidth),
      h: clamp(orig.h, MIN_SIZE, imageHeight),
    }
    onRectChange(clampedOrig)
  }

  function endDrag(e: PointerEvent) {
    const root = rootRef.current
    if (!root) return
    if (dragRef.current) {
      e.preventDefault()
      dragRef.current = null
    }
  }

  if (!view || !screen) return null

  const hitHalf = HANDLE_HIT_SIZE / 2
  const x1 = screen.x
  const y1 = screen.y
  const x2 = screen.x + screen.w
  const y2 = screen.y + screen.h

  return (
    <div
      ref={rootRef}
      // 默认透传：避免影响 CanvasImageViewer 的缩放/平移命中
      class="absolute inset-0 pointer-events-none"
      onPointerMove={(e) => onMove(e as unknown as PointerEvent)}
      onPointerUp={(e) => endDrag(e as unknown as PointerEvent)}
      onPointerCancel={(e) => endDrag(e as unknown as PointerEvent)}
    >
      {/* 遮罩：仅覆盖画布区域（圆形模式挖圆洞） */}
      {(() => {
        const maskId = `crop-hole-${Math.random().toString(36).slice(2)}`
        return (
          <svg class="absolute inset-0 w-full h-full pointer-events-none">
            <defs>
              <mask id={maskId}>
                <rect x="0" y="0" width="100%" height="100%" fill="white" />
                {mode.kind === 'circle' ? (
                  <circle
                    cx={x1 + screen.w / 2}
                    cy={y1 + screen.h / 2}
                    r={Math.min(screen.w, screen.h) / 2}
                    fill="black"
                  />
                ) : (
                  <rect x={x1} y={y1} width={screen.w} height={screen.h} fill="black" />
                )}
              </mask>
            </defs>
            <rect
              x="0"
              y="0"
              width="100%"
              height="100%"
              fill={mode.kind === 'circle' ? 'rgba(0,0,0,0.5)' : 'rgba(0,0,0,0.35)'}
              mask={`url(#${maskId})`}
            />
          </svg>
        )
      })()}

      {/* 裁切框（可拖拽） */}
      <div
        class="absolute border-2 border-white/90 hover:border-blue-400/90 pointer-events-auto touch-none transition-colors"
        style={{
          left: `${x1}px`,
          top: `${y1}px`,
          width: `${screen.w}px`,
          height: `${screen.h}px`,
          cursor: 'move',
        }}
        onPointerDown={(e) => startDrag('move', e as unknown as PointerEvent)}
        onMouseDown={(e) => {
          // 兼容：阻止 pointerdown 触发的 mouse 事件继续冒泡导致画布开始拖拽
          e.stopPropagation()
          e.preventDefault()
        }}
      >
        {/* 圆形模式：显示圆形蒙版提示 */}
        {mode.kind === 'circle' ? (
          <>
            <div
              class="absolute inset-0 pointer-events-none rounded-full border-2 border-white/90"
              style={{ borderRadius: '9999px' }}
            />
            {/* 圆形内部高亮提示 */}
            <div
              class="absolute inset-0 pointer-events-none rounded-full"
              style={{
                borderRadius: '9999px',
                boxShadow: 'inset 0 0 0 1px rgba(255,255,255,0.3)',
              }}
            />
          </>
        ) : null}
      </div>

      {/* 8 个拉伸手柄 */}
      {(
        [
          ['nw', x1, y1],
          ['n', x1 + screen.w / 2, y1],
          ['ne', x2, y1],
          ['w', x1, y1 + screen.h / 2],
          ['e', x2, y1 + screen.h / 2],
          ['sw', x1, y2],
          ['s', x1 + screen.w / 2, y2],
          ['se', x2, y2],
        ] as Array<[Handle, number, number]>
      ).map(([h, hx, hy]) => (
        <div
          key={h}
          // 外层用于扩大命中热区；内层才是可见的“拉伸点”
          class="absolute group pointer-events-auto touch-none"
          style={{
            left: `${hx - hitHalf}px`,
            top: `${hy - hitHalf}px`,
            width: `${HANDLE_HIT_SIZE}px`,
            height: `${HANDLE_HIT_SIZE}px`,
            cursor: cursorForHandle(h),
          }}
          onPointerDown={(e) => startDrag(h, e as unknown as PointerEvent)}
          onMouseDown={(e) => {
            e.stopPropagation()
            e.preventDefault()
          }}
        >
          {/* 可见拉伸点：白色小圆点，hover 轻微放大/变色 */}
          <div
            class="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-full shadow border border-slate-200/50 transition-transform transition-colors duration-150 group-hover:scale-110 group-hover:bg-blue-100"
            style={{
              width: `${HANDLE_VISUAL_SIZE}px`,
              height: `${HANDLE_VISUAL_SIZE}px`,
            }}
          />
        </div>
      ))}
    </div>
  )
}

