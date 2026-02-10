import type { ComponentChildren } from 'preact'
import { useEffect, useRef, useState } from 'preact/hooks'

type CanvasImageViewerProps = {
    imageUrl: string
    imageWidth: number
    imageHeight: number
    onApi?: (api: CanvasImageViewerApi) => void
    onViewStateChange?: (state: CanvasImageViewerViewState | null) => void
    /** 可选：覆盖层（裁切框等）。放在 viewer 容器内部，避免阻断缩放/平移事件。 */
    overlay?: ComponentChildren
    /** 可选：绘制滤镜（Canvas 2D filter 字符串） */
    filter?: string
    /** 是否绘制透明背景网格（默认 true）。预览查看器等场景可关闭。 */
    showCheckerboard?: boolean
}

export type CanvasImageViewerApi = {
    zoomIn: () => void
    zoomOut: () => void
    rotateLeft90: () => void
    rotateRight90: () => void
    /** 水平翻转（镜像） */
    flipHorizontal: () => void
    /** 垂直翻转（镜像） */
    flipVertical: () => void
    fit: () => void
    reset: () => void
    /** 只读：当前图片在画布中的可视状态（用于 overlay 对齐） */
    getViewState: () => CanvasImageViewerViewState | null
}

export type CanvasImageViewerViewState = {
    /** 容器尺寸（CSS px） */
    containerWidth: number
    containerHeight: number
    /** 旋转角度（0/90/180/270） */
    rotation: 0 | 90 | 180 | 270
    /** 原图尺寸（px） */
    imageWidth: number
    imageHeight: number
    /** “有效尺寸”：旋转 90/270 时宽高交换（用于计算映射） */
    effectiveWidth: number
    effectiveHeight: number
    /** 图片轴对齐包围盒（CSS px，已包含 zoom/pan） */
    boxX: number
    boxY: number
    boxW: number
    boxH: number
}

// 绘制透明背景网格
function drawCheckerboard(
    ctx: CanvasRenderingContext2D,
    width: number,
    height: number,
    gridSize: number = 20
) {
    // 检测是否为暗色模式
    const isDark = document.documentElement.classList.contains('dark')

    // 根据主题设置颜色
    const lightColor = isDark ? '#1e293b' : '#ffffff'
    const darkColor = isDark ? '#0f172a' : '#e5e5e5'

    ctx.fillStyle = lightColor
    ctx.fillRect(0, 0, width, height)

    ctx.fillStyle = darkColor
    for (let y = 0; y < height; y += gridSize) {
        for (let x = 0; x < width; x += gridSize) {
            if ((x / gridSize + y / gridSize) % 2 === 0) {
                ctx.fillRect(x, y, gridSize, gridSize)
            }
        }
    }
}

// 计算 contain 模式的尺寸和位置（带边距）
function fitContainWithPadding(
    imgWidth: number,
    imgHeight: number,
    containerWidth: number,
    containerHeight: number,
    padding: number = 20
) {
    const availableWidth = containerWidth - padding * 2
    const availableHeight = containerHeight - padding * 2

    const scale = Math.min(
        availableWidth / imgWidth,
        availableHeight / imgHeight
    )

    const w = imgWidth * scale
    const h = imgHeight * scale
    const x = (containerWidth - w) / 2
    const y = (containerHeight - h) / 2

    return { x, y, w, h, scale }
}

export function CanvasImageViewer({
    imageUrl,
    imageWidth,
    imageHeight,
    onApi,
    onViewStateChange,
    overlay,
    filter,
    showCheckerboard = true,
}: CanvasImageViewerProps) {
    const canvasRef = useRef<HTMLCanvasElement>(null)
    const containerRef = useRef<HTMLDivElement>(null)
    const imageRef = useRef<HTMLImageElement | null>(null)

    const [zoom, setZoom] = useState(1)
    const [pan, setPan] = useState({ x: 0, y: 0 })
    const [rotation, setRotation] = useState<0 | 90 | 180 | 270>(0)
    const [flipX, setFlipX] = useState(false)
    const [flipY, setFlipY] = useState(false)
    const zoomRef = useRef(1)
    const panRef = useRef({ x: 0, y: 0 })
    const rotationRef = useRef<0 | 90 | 180 | 270>(0)
    const flipXRef = useRef(false)
    const flipYRef = useRef(false)
    const [isDragging, setIsDragging] = useState(false)
    const [dragStart, setDragStart] = useState({ x: 0, y: 0 })
    const [panStart, setPanStart] = useState({ x: 0, y: 0 })
    const viewStateRef = useRef<CanvasImageViewerViewState | null>(null)

    // 同步 ref 和 state
    useEffect(() => {
        zoomRef.current = zoom
    }, [zoom])

    useEffect(() => {
        panRef.current = pan
    }, [pan])

    useEffect(() => {
        rotationRef.current = rotation
    }, [rotation])

    useEffect(() => {
        flipXRef.current = flipX
    }, [flipX])

    useEffect(() => {
        flipYRef.current = flipY
    }, [flipY])

    // 加载图片
    useEffect(() => {
        const img = new Image()
        img.onload = () => {
            imageRef.current = img
            // 重置缩放和平移
            setZoom(1)
            setPan({ x: 0, y: 0 })
            setRotation(0)
            setFlipX(false)
            setFlipY(false)
            zoomRef.current = 1
            panRef.current = { x: 0, y: 0 }
            rotationRef.current = 0
            flipXRef.current = false
            flipYRef.current = false
            draw()
        }
        img.src = imageUrl
    }, [imageUrl])

    // 绘制函数
    const draw = () => {
        const canvas = canvasRef.current
        if (!canvas || !imageRef.current) return

        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const rect = canvas.getBoundingClientRect()
        const dpr = window.devicePixelRatio || 1
        canvas.width = rect.width * dpr
        canvas.height = rect.height * dpr
        // 每次重绘前重置变换，避免累计缩放
        ctx.setTransform(1, 0, 0, 1, 0, 0)
        ctx.scale(dpr, dpr)

        const width = rect.width
        const height = rect.height

        // 背景：默认绘制透明网格；关闭时清空画布即可
        ctx.filter = 'none'
        if (showCheckerboard) {
            drawCheckerboard(ctx, width, height)
        } else {
            ctx.clearRect(0, 0, width, height)
        }

        const r = rotationRef.current
        const isQuarterTurn = r === 90 || r === 270
        const effectiveW = isQuarterTurn ? imageHeight : imageWidth
        const effectiveH = isQuarterTurn ? imageWidth : imageHeight

        // 计算初始 contain 尺寸
        const base = fitContainWithPadding(
            effectiveW,
            effectiveH,
            width,
            height
        )

        // 应用缩放和平移（使用 ref 获取最新值）
        const currentZoom = zoomRef.current
        const currentPan = panRef.current
        const boxW = base.w * currentZoom
        const boxH = base.h * currentZoom
        const x = base.x + (base.w - boxW) / 2 + currentPan.x
        const y = base.y + (base.h - boxH) / 2 + currentPan.y

        // 保存给 overlay 使用的视图状态（只读）
        viewStateRef.current = {
            containerWidth: width,
            containerHeight: height,
            rotation: r,
            imageWidth,
            imageHeight,
            effectiveWidth: effectiveW,
            effectiveHeight: effectiveH,
            boxX: x,
            boxY: y,
            boxW,
            boxH,
        }
        onViewStateChange?.(viewStateRef.current)

        // 绘制图片（支持 90° 旋转）
        const cx = x + boxW / 2
        const cy = y + boxH / 2
        const radians = (r * Math.PI) / 180

        // 旋转 90/270 时，先绘制的宽高需要交换，旋转后包围盒才是 boxW/boxH
        const drawW = isQuarterTurn ? boxH : boxW
        const drawH = isQuarterTurn ? boxW : boxH

        ctx.save()
        ctx.filter = filter || 'none'
        ctx.translate(cx, cy)
        ctx.rotate(radians)
        // 翻转：在“图片自身坐标系”里做镜像，避免影响 box 计算
        ctx.scale(flipXRef.current ? -1 : 1, flipYRef.current ? -1 : 1)
        ctx.drawImage(imageRef.current, -drawW / 2, -drawH / 2, drawW, drawH)
        ctx.restore()
    }

    // 监听容器尺寸变化
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const resizeObserver = new ResizeObserver(() => {
            draw()
        })
        resizeObserver.observe(container)

        return () => {
            resizeObserver.disconnect()
        }
    }, [])

    // 当 zoom 或 pan 变化时重绘
    useEffect(() => {
        draw()
    }, [zoom, pan, rotation, flipX, flipY, filter, showCheckerboard])

    // 鼠标滚轮缩放
    useEffect(() => {
        const container = containerRef.current
        if (!container) return

        const handleWheel = (e: WheelEvent) => {
            const canvas = canvasRef.current
            if (!canvas || !imageRef.current) return

            // 阻止浏览器默认的缩放行为（尤其是触控板 pinch-to-zoom）
            if (e.ctrlKey || Math.abs(e.deltaY) !== 0) {
                e.preventDefault()
            }

            const rect = canvas.getBoundingClientRect()
            const mouseX = e.clientX - rect.left
            const mouseY = e.clientY - rect.top

            // 计算缩放前的图片坐标（使用 ref 获取最新值）
            const r = rotationRef.current
            const isQuarterTurn = r === 90 || r === 270
            const effectiveW = isQuarterTurn ? imageHeight : imageWidth
            const effectiveH = isQuarterTurn ? imageWidth : imageHeight

            const base = fitContainWithPadding(
                effectiveW,
                effectiveH,
                rect.width,
                rect.height
            )
            const currentZoom = zoomRef.current
            const currentPan = panRef.current
            const boxW = base.w * currentZoom
            const boxH = base.h * currentZoom
            const imgX = base.x + (base.w - boxW) / 2 + currentPan.x
            const imgY = base.y + (base.h - boxH) / 2 + currentPan.y

            // 计算鼠标在图片上的相对位置
            const relativeX = (mouseX - imgX) / boxW
            const relativeY = (mouseY - imgY) / boxH

            // 计算新的缩放值：每次滚轮固定倍率（不做复杂归一化）
            const step = 1.05
            const direction = e.deltaY < 0 ? 1 : -1
            const nextZoom = direction > 0 ? currentZoom * step : currentZoom / step
            const newZoom = Math.max(0.1, Math.min(10, nextZoom))

            // 计算新的平移值，保持鼠标位置对应的图片点不变
            const newBoxW = base.w * newZoom
            const newBoxH = base.h * newZoom
            const newImgX = base.x + (base.w - newBoxW) / 2
            const newImgY = base.y + (base.h - newBoxH) / 2

            const newPanX = mouseX - newImgX - relativeX * newBoxW
            const newPanY = mouseY - newImgY - relativeY * newBoxH

            zoomRef.current = newZoom
            panRef.current = { x: newPanX, y: newPanY }
            setZoom(newZoom)
            setPan({ x: newPanX, y: newPanY })
        }

        // Safari 特有的手势事件，用于禁用系统缩放
        const handleGesture = (e: Event) => {
            e.preventDefault()
        }

        container.addEventListener('wheel', handleWheel, { passive: false })
        container.addEventListener('gesturestart', handleGesture, { passive: false })
        container.addEventListener('gesturechange', handleGesture, { passive: false })

        return () => {
            container.removeEventListener('wheel', handleWheel)
            container.removeEventListener('gesturestart', handleGesture)
            container.removeEventListener('gesturechange', handleGesture)
        }
    }, [imageWidth, imageHeight])

    // 对外暴露画布控制 API（用于画布附近的工具条）
    useEffect(() => {
        if (!onApi) return
        const api: CanvasImageViewerApi = {
            zoomIn: () => {
                const next = Math.min(10, zoomRef.current * 1.2)
                zoomRef.current = next
                setZoom(next)
            },
            zoomOut: () => {
                const next = Math.max(0.1, zoomRef.current / 1.2)
                zoomRef.current = next
                setZoom(next)
            },
            rotateLeft90: () => {
                const curr = rotationRef.current
                const next = ((curr + 270) % 360) as 0 | 90 | 180 | 270
                rotationRef.current = next
                setRotation(next)
            },
            rotateRight90: () => {
                const curr = rotationRef.current
                const next = ((curr + 90) % 360) as 0 | 90 | 180 | 270
                rotationRef.current = next
                setRotation(next)
            },
            flipHorizontal: () => {
                const next = !flipXRef.current
                flipXRef.current = next
                setFlipX(next)
            },
            flipVertical: () => {
                const next = !flipYRef.current
                flipYRef.current = next
                setFlipY(next)
            },
            fit: () => {
                zoomRef.current = 1
                panRef.current = { x: 0, y: 0 }
                setZoom(1)
                setPan({ x: 0, y: 0 })
            },
            reset: () => {
                zoomRef.current = 1
                panRef.current = { x: 0, y: 0 }
                rotationRef.current = 0
                flipXRef.current = false
                flipYRef.current = false
                setZoom(1)
                setPan({ x: 0, y: 0 })
                setRotation(0)
                setFlipX(false)
                setFlipY(false)
            },
            getViewState: () => viewStateRef.current,
        }
        onApi(api)
    }, [onApi])

    // 鼠标按下开始拖拽
    const handleMouseDown = (e: MouseEvent) => {
        if (e.button !== 0) return // 只处理左键
        e.preventDefault()
        setIsDragging(true)
        setDragStart({ x: e.clientX, y: e.clientY })
        setPanStart({ ...panRef.current })
    }

    // 鼠标移动拖拽
    useEffect(() => {
        if (!isDragging) return

        const handleMouseMove = (e: MouseEvent) => {
            const dx = e.clientX - dragStart.x
            const dy = e.clientY - dragStart.y

            const newPan = {
                x: panStart.x + dx,
                y: panStart.y + dy,
            }
            panRef.current = newPan
            setPan(newPan)
        }

        const handleMouseUp = () => {
            setIsDragging(false)
        }

        window.addEventListener('mousemove', handleMouseMove)
        window.addEventListener('mouseup', handleMouseUp)

        return () => {
            window.removeEventListener('mousemove', handleMouseMove)
            window.removeEventListener('mouseup', handleMouseUp)
        }
    }, [isDragging, dragStart, panStart])

    // 触摸事件支持
    const handleTouchStart = (e: TouchEvent) => {
        if (e.touches.length === 1) {
            e.preventDefault()
            const touch = e.touches[0]
            setIsDragging(true)
            setDragStart({ x: touch.clientX, y: touch.clientY })
            setPanStart({ ...panRef.current })
        }
    }

    useEffect(() => {
        if (!isDragging) return

        const handleTouchMove = (e: TouchEvent) => {
            if (e.touches.length !== 1) return
            e.preventDefault()

            const touch = e.touches[0]
            const dx = touch.clientX - dragStart.x
            const dy = touch.clientY - dragStart.y

            const newPan = {
                x: panStart.x + dx,
                y: panStart.y + dy,
            }
            panRef.current = newPan
            setPan(newPan)
        }

        const handleTouchEnd = () => {
            setIsDragging(false)
        }

        window.addEventListener('touchmove', handleTouchMove, { passive: false })
        window.addEventListener('touchend', handleTouchEnd)

        return () => {
            window.removeEventListener('touchmove', handleTouchMove)
            window.removeEventListener('touchend', handleTouchEnd)
        }
    }, [isDragging, dragStart, panStart])

    return (
        <div
            ref={containerRef}
            // 关键：禁用容器内的浏览器手势（避免触控板/移动端缩放把整页缩放）
            class="w-full h-full relative overflow-hidden touch-none overscroll-contain"
            data-allow-zoom="true"
            onMouseDown={handleMouseDown}
            onTouchStart={handleTouchStart}
            style={{ cursor: isDragging ? 'grabbing' : 'grab' }}
        >
            <canvas
                ref={canvasRef}
                class="w-full h-full block"
            />
            {/** 覆盖层放在容器内部：事件会冒泡到容器，避免阻断缩放/平移 */}
            {/** 注意：覆盖层自身可用 pointer-events 控制“透传/可交互”区域 */}
            {overlay ? <div class="absolute inset-0 z-10">{overlay}</div> : null}
        </div>
    )
}
