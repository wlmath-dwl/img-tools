import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { canvasToBlob, type ImageInfo } from "../../shared/image";
import { ImageToolLayout } from "../../shared/components/ImageToolLayout";
import type { CanvasImageViewerViewState } from "../../shared/components/CanvasImageViewer";
import { useImageItems } from "../../shared/useImageItems";
import { BrushIcon, SelectionCursorIcon } from "../../shared/icons";

type MosaicMode = "brush" | "rect";
type MosaicEffect = "mosaic" | "blur";
type InteractionMode = "draw" | "drag";
type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type PerImageState = {
  effectType: MosaicEffect;
  strength: number;
  blurStrength: number;
  brushSize: number;
  mode: MosaicMode;
  // 绘制内容（仅在页面内存中缓存，切图/导出使用）
  maskData: ImageData | null;
  maskWidth: number;
  maskHeight: number;
};

function RectIcon({ size = 20 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
    >
      <rect x="4" y="5" width="16" height="14" rx="2" />
    </svg>
  );
}

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function normalizeRect(rect: Rect): Rect {
  const x = rect.w < 0 ? rect.x + rect.w : rect.x;
  const y = rect.h < 0 ? rect.y + rect.h : rect.y;
  const w = Math.abs(rect.w);
  const h = Math.abs(rect.h);
  return { x, y, w, h };
}

function getBlockSize(strength: number) {
  // strength: 10~80 -> block: 5~40
  return Math.max(4, Math.round(strength / 2));
}

function toImagePoint(
  x: number,
  y: number,
  view: CanvasImageViewerViewState,
): Point | null {
  const rx = (x - view.boxX) / view.boxW;
  const ry = (y - view.boxY) / view.boxH;
  if (rx < 0 || rx > 1 || ry < 0 || ry > 1) return null;

  const ex = rx * view.effectiveWidth;
  const ey = ry * view.effectiveHeight;

  let ix = 0;
  let iy = 0;
  if (view.rotation === 0) {
    ix = ex;
    iy = ey;
  } else if (view.rotation === 90) {
    ix = ey;
    iy = view.imageHeight - ex;
  } else if (view.rotation === 180) {
    ix = view.imageWidth - ex;
    iy = view.imageHeight - ey;
  } else {
    ix = view.imageWidth - ey;
    iy = ex;
  }

  return {
    x: clamp(ix, 0, view.imageWidth),
    y: clamp(iy, 0, view.imageHeight),
  };
}

function buildBrushCursor(size: number) {
  const diameter = Math.max(6, Math.round(size));
  const radius = Math.max(1, diameter / 2 - 1);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${diameter}" height="${diameter}" viewBox="0 0 ${diameter} ${diameter}"><circle cx="${diameter / 2}" cy="${diameter / 2}" r="${radius}" fill="none" stroke="#111" stroke-width="3"/><circle cx="${diameter / 2}" cy="${diameter / 2}" r="${radius}" fill="none" stroke="#fff" stroke-width="1.5"/></svg>`;
  const encoded = encodeURIComponent(svg);
  const hotspot = diameter / 2;
  return `url("data:image/svg+xml;utf8,${encoded}") ${hotspot} ${hotspot}, crosshair`;
}

function drawBrushStroke(
  ctx: CanvasRenderingContext2D,
  from: Point,
  to: Point,
  size: number,
) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#ffffff";
  ctx.lineWidth = size;
  ctx.beginPath();
  ctx.moveTo(from.x, from.y);
  ctx.lineTo(to.x, to.y);
  ctx.stroke();
  ctx.restore();
}

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(errorMessage));
    img.src = url;
  });
}

export function ImageMosaicPage() {
  const { t } = useI18n();

  const {
    items,
    activeId,
    setActiveId,
    active,
    addFiles,
    removeOne,
    clearAll,
  } = useImageItems();
  const info = active?.info ?? null;
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<MosaicMode>("brush");
  const [effectType, setEffectType] = useState<MosaicEffect>("mosaic");
  const [appliedRule, setAppliedRule] = useState<{
    effectType: MosaicEffect;
    strength: number;
    blurStrength: number;
    brushSize: number;
    mode: MosaicMode;
  } | null>(null);
  // 交互方式：绘制马赛克 / 拖拽平移（由底部按钮切换）
  const [interactionMode, setInteractionMode] =
    useState<InteractionMode>("draw");
  const [strength, setStrength] = useState<number>(50);
  const [blurStrength, setBlurStrength] = useState<number>(8);
  const [brushSize, setBrushSize] = useState<number>(28);
  const brushCursor = useMemo(() => buildBrushCursor(brushSize), [brushSize]);
  const [viewState, setViewState] = useState<CanvasImageViewerViewState | null>(
    null,
  );
  const [rectPreview, setRectPreview] = useState<Rect | null>(null);
  const [maskDirty, setMaskDirty] = useState(false);
  const [isSpacePressed, setIsSpacePressed] = useState(false);
  const [isClearConfirmOpen, setIsClearConfirmOpen] = useState(false);

  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const maskCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const effectCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const baseImageRef = useRef<HTMLImageElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const isDrawingRef = useRef(false);
  const lastPointRef = useRef<Point | null>(null);
  const rectStartRef = useRef<Point | null>(null);
  const lastLoadedIdRef = useRef<string>("");
  const perImageStateRef = useRef<Record<string, PerImageState>>({});

  function resetWorkState() {
    baseImageRef.current = null;
    maskCanvasRef.current = null;
    effectCanvasRef.current = null;
    setMaskDirty(false);
    setRectPreview(null);
  }

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(true);
    };
    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") setIsSpacePressed(false);
    };
    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, []);

  const mosaicBlockSize = useMemo(() => getBlockSize(strength), [strength]);

  useEffect(() => {
    if (!activeId) return;
    const prev = perImageStateRef.current[activeId];
    perImageStateRef.current[activeId] = {
      effectType,
      strength,
      blurStrength,
      brushSize,
      mode,
      maskData: prev?.maskData ?? null,
      maskWidth: prev?.maskWidth ?? 0,
      maskHeight: prev?.maskHeight ?? 0,
    };
  }, [activeId, effectType, strength, blurStrength, brushSize, mode]);

  const saveCurrentState = useCallback(
    (id: string | null) => {
      if (!id) return null;
      const mask = maskCanvasRef.current;
      let maskData: ImageData | null = null;
      let maskWidth = 0;
      let maskHeight = 0;
      if (mask && maskDirty) {
        const ctx = mask.getContext("2d");
        if (ctx) {
          maskWidth = mask.width;
          maskHeight = mask.height;
          maskData = ctx.getImageData(0, 0, maskWidth, maskHeight);
        }
      }
      perImageStateRef.current[id] = {
        effectType,
        strength,
        blurStrength,
        brushSize,
        mode,
        maskData,
        maskWidth,
        maskHeight,
      };
      return perImageStateRef.current[id];
    },
    [effectType, strength, blurStrength, brushSize, mode, maskDirty],
  );

  const rebuildEffectCanvas = useCallback(() => {
    if (!baseImageRef.current) return;
    const img = baseImageRef.current;
    const effect = effectCanvasRef.current ?? document.createElement("canvas");
    effectCanvasRef.current = effect;
    effect.width = img.naturalWidth;
    effect.height = img.naturalHeight;
    const ectx = effect.getContext("2d");
    if (!ectx) return;

    ectx.clearRect(0, 0, effect.width, effect.height);

    if (effectType === "mosaic") {
      const smallW = Math.max(
        1,
        Math.round(img.naturalWidth / mosaicBlockSize),
      );
      const smallH = Math.max(
        1,
        Math.round(img.naturalHeight / mosaicBlockSize),
      );
      const small = document.createElement("canvas");
      small.width = smallW;
      small.height = smallH;
      const sctx = small.getContext("2d");
      if (!sctx) return;
      sctx.imageSmoothingEnabled = false;
      ectx.imageSmoothingEnabled = false;
      sctx.clearRect(0, 0, smallW, smallH);
      sctx.drawImage(img, 0, 0, smallW, smallH);
      ectx.drawImage(small, 0, 0, effect.width, effect.height);
      return;
    }

    if (effectType === "blur") {
      ectx.filter = `blur(${Math.max(1, Math.round(blurStrength))}px)`;
      ectx.drawImage(img, 0, 0, effect.width, effect.height);
      ectx.filter = "none";
      return;
    }
  }, [effectType, blurStrength, mosaicBlockSize]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    const maskCanvas = maskCanvasRef.current;
    const effectCanvas = effectCanvasRef.current;
    if (!canvas || !viewState) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewState.containerWidth * dpr;
    canvas.height = viewState.containerHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewState.containerWidth, viewState.containerHeight);

    if (maskCanvas && effectCanvas && maskDirty) {
      const r = viewState.rotation;
      const isQuarterTurn = r === 90 || r === 270;
      const drawW = isQuarterTurn ? viewState.boxH : viewState.boxW;
      const drawH = isQuarterTurn ? viewState.boxW : viewState.boxH;
      const cx = viewState.boxX + viewState.boxW / 2;
      const cy = viewState.boxY + viewState.boxH / 2;
      const radians = (r * Math.PI) / 180;

      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(radians);
      ctx.drawImage(effectCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.globalCompositeOperation = "destination-in";
      ctx.drawImage(maskCanvas, -drawW / 2, -drawH / 2, drawW, drawH);
      ctx.restore();
      ctx.globalCompositeOperation = "source-over";
    }

    if (rectPreview) {
      const r = viewState.rotation;
      const isQuarterTurn = r === 90 || r === 270;
      const drawW = isQuarterTurn ? viewState.boxH : viewState.boxW;
      const drawH = isQuarterTurn ? viewState.boxW : viewState.boxH;
      const cx = viewState.boxX + viewState.boxW / 2;
      const cy = viewState.boxY + viewState.boxH / 2;
      const radians = (r * Math.PI) / 180;

      const rect = normalizeRect(rectPreview);
      ctx.save();
      ctx.translate(cx, cy);
      ctx.rotate(radians);
      ctx.scale(drawW / viewState.imageWidth, drawH / viewState.imageHeight);
      ctx.strokeStyle = "rgba(59, 130, 246, 0.95)";
      ctx.lineWidth = 2 / Math.max(1, drawW / viewState.imageWidth);
      ctx.strokeRect(
        -viewState.imageWidth / 2 + rect.x,
        -viewState.imageHeight / 2 + rect.y,
        rect.w,
        rect.h,
      );
      ctx.restore();
    }
  }, [maskDirty, rectPreview, viewState]);

  // 切到“拖拽”时，终止当前绘制并清理临时预览，避免状态残留
  useEffect(() => {
    if (interactionMode !== "drag") return;
    isDrawingRef.current = false;
    lastPointRef.current = null;
    rectStartRef.current = null;
    setRectPreview(null);
    drawOverlay();
  }, [interactionMode, drawOverlay]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  useEffect(() => {
    rebuildEffectCanvas();
    drawOverlay();
  }, [rebuildEffectCanvas, drawOverlay]);

  useEffect(() => {
    if (!info) {
      lastLoadedIdRef.current = "";
      resetWorkState();
      return;
    }
    if (activeId && activeId === lastLoadedIdRef.current) return;

    let cancelled = false;
    void (async () => {
      try {
        const img = await loadImage(info.url, t('error.imageLoadFailed'));
        if (cancelled) return;
        baseImageRef.current = img;

        const mask = document.createElement("canvas");
        mask.width = img.naturalWidth;
        mask.height = img.naturalHeight;
        maskCanvasRef.current = mask;
        const cached = activeId ? perImageStateRef.current[activeId] : null;
        setRectPreview(null);
        if (cached?.maskData) {
          const ctx = mask.getContext("2d");
          if (ctx) {
            // 尺寸不同也要尽量恢复（用于“应用到全部”把 mask 套到不同尺寸的图）
            if (
              cached.maskWidth === img.naturalWidth &&
              cached.maskHeight === img.naturalHeight
            ) {
              ctx.putImageData(cached.maskData, 0, 0);
            } else {
              const src = document.createElement("canvas");
              src.width = cached.maskWidth;
              src.height = cached.maskHeight;
              const sctx = src.getContext("2d");
              if (sctx) {
                sctx.putImageData(cached.maskData, 0, 0);
                ctx.clearRect(0, 0, mask.width, mask.height);
                ctx.drawImage(src, 0, 0, mask.width, mask.height);
              }
            }
            setMaskDirty(true);
          } else {
            setMaskDirty(false);
          }
        } else {
          setMaskDirty(false);
        }
        if (cached) {
          setEffectType(cached.effectType);
          setStrength(cached.strength);
          setBlurStrength(cached.blurStrength);
          setBrushSize(cached.brushSize);
          setMode(cached.mode);
        } else if (appliedRule) {
          setEffectType(appliedRule.effectType);
          setStrength(appliedRule.strength);
          setBlurStrength(appliedRule.blurStrength);
          setBrushSize(appliedRule.brushSize);
          setMode(appliedRule.mode);
        }
        rebuildEffectCanvas();
        drawOverlay();
        lastLoadedIdRef.current = activeId;
      } catch (e) {
        if (cancelled) return;
        resetWorkState();
        setError(e instanceof Error ? e.message : t("imageMosaic.selectImage"));
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [activeId, info?.url, rebuildEffectCanvas, drawOverlay, t, appliedRule]);

  // 图片选择由 ImageToolLayout onFilesSelect 驱动（支持多选）

  function clearMask() {
    const mask = maskCanvasRef.current;
    if (!mask) return;
    const ctx = mask.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, mask.width, mask.height);
    setMaskDirty(false);
    setRectPreview(null);
    drawOverlay();
  }

  const getBrushSizeInImage = useCallback(() => {
    if (!viewState) return 1;
    const scale = viewState.boxW / viewState.effectiveWidth;
    return Math.max(1, brushSize / Math.max(0.01, scale));
  }, [brushSize, viewState]);

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0) return;
      if (interactionMode === "drag") return;
      if (isSpacePressed) return;
      if (!viewState) return;
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const p = toImagePoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewState,
      );
      if (!p) return;
      e.preventDefault();
      e.stopPropagation();
      canvas.setPointerCapture(e.pointerId);
      isDrawingRef.current = true;

      if (mode === "brush") {
        lastPointRef.current = p;
        const mask = maskCanvasRef.current;
        const ctx = mask?.getContext("2d");
        if (ctx) {
          const size = getBrushSizeInImage();
          drawBrushStroke(ctx, p, p, size);
          setMaskDirty(true);
          drawOverlay();
        }
      } else {
        rectStartRef.current = p;
        setRectPreview({ x: p.x, y: p.y, w: 1, h: 1 });
      }
    },
    [
      getBrushSizeInImage,
      interactionMode,
      isSpacePressed,
      mode,
      viewState,
      drawOverlay,
    ],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!viewState) return;
      const canvas = overlayCanvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const p = toImagePoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewState,
      );
      if (!p) return;
      if (interactionMode === "drag" || isSpacePressed) return;
      if (!isDrawingRef.current) return;
      e.preventDefault();
      e.stopPropagation();

      if (mode === "brush") {
        const last = lastPointRef.current ?? p;
        const mask = maskCanvasRef.current;
        const ctx = mask?.getContext("2d");
        if (ctx) {
          const size = getBrushSizeInImage();
          drawBrushStroke(ctx, last, p, size);
          lastPointRef.current = p;
          setMaskDirty(true);
          drawOverlay();
        }
      } else if (rectStartRef.current) {
        const start = rectStartRef.current;
        setRectPreview({
          x: start.x,
          y: start.y,
          w: p.x - start.x,
          h: p.y - start.y,
        });
        drawOverlay();
      }
    },
    [
      getBrushSizeInImage,
      interactionMode,
      isSpacePressed,
      mode,
      viewState,
      drawOverlay,
    ],
  );

  const handlePointerUp = useCallback(
    (e: PointerEvent) => {
      if (interactionMode === "drag") return;
      if (!isDrawingRef.current) return;
      const canvas = overlayCanvasRef.current;
      if (canvas) canvas.releasePointerCapture(e.pointerId);
      isDrawingRef.current = false;

      if (mode === "rect" && rectPreview) {
        const mask = maskCanvasRef.current;
        const ctx = mask?.getContext("2d");
        if (ctx) {
          const rect = normalizeRect(rectPreview);
          ctx.fillStyle = "#ffffff";
          ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
          setMaskDirty(true);
        }
        setRectPreview(null);
        drawOverlay();
      }
    },
    [interactionMode, mode, rectPreview, drawOverlay],
  );

  function getStateForExport(id: string): PerImageState {
    const cached = perImageStateRef.current[id];
    if (cached) return cached;
    if (appliedRule) {
      return {
        effectType: appliedRule.effectType,
        strength: appliedRule.strength,
        blurStrength: appliedRule.blurStrength,
        brushSize: appliedRule.brushSize,
        mode: appliedRule.mode,
        maskData: null,
        maskWidth: 0,
        maskHeight: 0,
      };
    }
    // 兜底：使用当前面板参数（无绘制内容）
    return {
      effectType,
      strength,
      blurStrength,
      brushSize,
      mode,
      maskData: null,
      maskWidth: 0,
      maskHeight: 0,
    };
  }

  async function exportOne(targetInfo: ImageInfo, state: PerImageState) {
    const canvas = exportCanvasRef.current ?? document.createElement("canvas");
    exportCanvasRef.current = canvas;
    canvas.width = targetInfo.width;
    canvas.height = targetInfo.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t('error.canvasInitFailed'));
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const img = await loadImage(targetInfo.url, t('error.imageLoadFailed'));
    ctx.drawImage(img, 0, 0);

    if (state.maskData) {
      const effect = document.createElement("canvas");
      effect.width = targetInfo.width;
      effect.height = targetInfo.height;
      const ectx = effect.getContext("2d");
      if (!ectx) throw new Error(t('error.canvasInitFailed'));
      ectx.clearRect(0, 0, effect.width, effect.height);

      if (state.effectType === "mosaic") {
        const block = getBlockSize(state.strength);
        const smallW = Math.max(1, Math.round(targetInfo.width / block));
        const smallH = Math.max(1, Math.round(targetInfo.height / block));
        const small = document.createElement("canvas");
        small.width = smallW;
        small.height = smallH;
        const sctx = small.getContext("2d");
        if (!sctx) throw new Error(t('error.canvasInitFailed'));
        sctx.imageSmoothingEnabled = false;
        ectx.imageSmoothingEnabled = false;
        sctx.clearRect(0, 0, smallW, smallH);
        sctx.drawImage(img, 0, 0, smallW, smallH);
        ectx.drawImage(small, 0, 0, effect.width, effect.height);
      } else if (state.effectType === "blur") {
        ectx.filter = `blur(${Math.max(1, Math.round(state.blurStrength))}px)`;
        ectx.drawImage(img, 0, 0, effect.width, effect.height);
        ectx.filter = "none";
      }

      const mask = document.createElement("canvas");
      mask.width = targetInfo.width;
      mask.height = targetInfo.height;
      const mctx = mask.getContext("2d");
      if (mctx) {
        mctx.clearRect(0, 0, mask.width, mask.height);
        const src = document.createElement("canvas");
        src.width = state.maskWidth;
        src.height = state.maskHeight;
        const sctx = src.getContext("2d");
        if (sctx) {
          sctx.putImageData(state.maskData, 0, 0);
          mctx.drawImage(src, 0, 0, mask.width, mask.height);
        }
      }

      const temp = document.createElement("canvas");
      temp.width = targetInfo.width;
      temp.height = targetInfo.height;
      const tctx = temp.getContext("2d");
      if (!tctx) throw new Error(t('error.canvasInitFailed'));
      tctx.clearRect(0, 0, temp.width, temp.height);
      tctx.drawImage(effect, 0, 0);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(mask, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      ctx.drawImage(temp, 0, 0);
    }

    const blob = await canvasToBlob(canvas, "image/png", 1);
    const name = targetInfo.name.replace(/\.[^.]+$/, "");
    return { blob, filename: `${name}-mosaic.png` };
  }

  async function onExport() {
    if (!info) throw new Error(t('error.noImageSelected'));
    try {
      setError(null);
      saveCurrentState(activeId);
      return await exportOne(info, getStateForExport(activeId));
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'));
      throw e;
    }
  }

  async function buildAllExports() {
    if (items.length === 0) return;
    setError(null);
    try {
      const payloads: { blob: Blob; filename: string }[] = [];
      saveCurrentState(activeId);
      for (const it of items) {
        const payload = await exportOne(it.info, getStateForExport(it.id));
        payloads.push(payload);
        await new Promise<void>((r) => window.setTimeout(() => r(), 0));
      }
      return payloads;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'));
      throw e;
    }
  }

  // 说明：导出/预览都需要同一份“处理后结果”，这里集中渲染，避免两套逻辑不一致
  async function renderResultToBlob(canvas: HTMLCanvasElement) {
    if (!info || !baseImageRef.current) throw new Error(t('error.noImageSelected'));
    canvas.width = info.width;
    canvas.height = info.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t('error.canvasInitFailed'));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImageRef.current, 0, 0);

    // 没有绘制马赛克时也返回原图结果（“处理后=未处理”）
    if (maskDirty && maskCanvasRef.current && effectCanvasRef.current) {
      const temp = document.createElement("canvas");
      temp.width = info.width;
      temp.height = info.height;
      const tctx = temp.getContext("2d");
      if (!tctx) throw new Error(t('error.canvasInitFailed'));
      tctx.clearRect(0, 0, temp.width, temp.height);
      tctx.drawImage(effectCanvasRef.current, 0, 0);
      tctx.globalCompositeOperation = "destination-in";
      tctx.drawImage(maskCanvasRef.current, 0, 0);
      tctx.globalCompositeOperation = "source-over";
      ctx.drawImage(temp, 0, 0);
    }

    const blob = await canvasToBlob(canvas, "image/png", 1);
    return { blob, width: info.width, height: info.height };
  }

  async function buildPreviewBlob() {
    const canvas = exportCanvasRef.current ?? document.createElement("canvas");
    exportCanvasRef.current = canvas;
    return await renderResultToBlob(canvas);
  }

  const overlay = (
    <div class="w-full h-full relative" style={{ cursor: "inherit" }}>
      <canvas
        ref={overlayCanvasRef}
        class="absolute inset-0 w-full h-full block"
        // 拖拽模式（或按住空格）时让事件透传到底层 viewer 以支持平移
        style={{
          pointerEvents:
            interactionMode === "drag" || isSpacePressed ? "none" : "auto",
          cursor:
            interactionMode === "draw" && !isSpacePressed
              ? mode === "brush"
                ? brushCursor
                : "crosshair"
              : "grab",
        }}
        onPointerDown={(e) => handlePointerDown(e as unknown as PointerEvent)}
        onPointerMove={(e) => handlePointerMove(e as unknown as PointerEvent)}
        onPointerUp={(e) => handlePointerUp(e as unknown as PointerEvent)}
        onPointerCancel={(e) => handlePointerUp(e as unknown as PointerEvent)}
      />

      {/* 图片容器底部：切换拖拽 / 画笔 / 矩形（居中） */}
      <div class="absolute inset-x-0 bottom-3 z-20 flex justify-center">
        <div
          class="flex items-center gap-2 p-1 rounded-full bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900 border border-slate-900/10 dark:border-slate-200 shadow-sm"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
          role="group"
          aria-label={t("imageMosaic.interaction")}
        >
          <button
            type="button"
            class={[
              "relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all",
              interactionMode === "drag"
                ? "bg-white/15 dark:bg-slate-900/10"
                : "hover:bg-white/10 dark:hover:bg-slate-900/10",
            ].join(" ")}
            aria-pressed={interactionMode === "drag"}
            title={t("imageMosaic.interaction.drag")}
            onClick={() => setInteractionMode("drag")}
          >
            <SelectionCursorIcon size={20} />
          </button>

          <button
            type="button"
            class={[
              "relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all",
              interactionMode === "draw" && mode === "brush"
                ? "bg-white/15 dark:bg-slate-900/10"
                : "hover:bg-white/10 dark:hover:bg-slate-900/10",
            ].join(" ")}
            aria-pressed={interactionMode === "draw" && mode === "brush"}
            title={t("imageMosaic.mode.brush")}
            onClick={() => {
              setInteractionMode("draw");
              setMode("brush");
            }}
          >
            <BrushIcon size={20} />
          </button>

          <button
            type="button"
            class={[
              "relative z-10 flex items-center justify-center w-10 h-10 rounded-full transition-all",
              interactionMode === "draw" && mode === "rect"
                ? "bg-white/15 dark:bg-slate-900/10"
                : "hover:bg-white/10 dark:hover:bg-slate-900/10",
            ].join(" ")}
            aria-pressed={interactionMode === "draw" && mode === "rect"}
            title={t("imageMosaic.mode.rect")}
            onClick={() => {
              setInteractionMode("draw");
              setMode("rect");
            }}
          >
            <RectIcon size={20} />
          </button>
        </div>
      </div>
    </div>
  );

  return (
    <ImageToolLayout
      title={t("imageMosaic.title")}
      onBackToHome={() => (window.location.href = "../index.html")}
      onReselect={() => {
        setError(null);
        clearAll();
        resetWorkState();
      }}
      secondaryActionLabel={t("imageMosaic.reselect")}
      onPrimaryAction={onExport}
      onPrimaryActionAll={buildAllExports}
      primaryActionLabel={t("imageMosaic.download")}
      onFilesSelect={async (files) => {
        setError(null);
        try {
          await addFiles(files);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : t("imageMosaic.selectImage"),
          );
        }
      }}
      images={
        items.length > 0
          ? {
              items: items.map((it) => ({ id: it.id, info: it.info })),
              activeId,
              onSelect: (id) => {
                if (id === activeId) return;
                saveCurrentState(activeId);
                setActiveId(id);
              },
              onRemove: (id) => {
                delete perImageStateRef.current[id];
                removeOne(id);
              },
              onApplyToAll: () => {
                const snapshot = saveCurrentState(activeId);
                setAppliedRule({
                  effectType,
                  strength,
                  blurStrength,
                  brushSize,
                  mode,
                });
                const sharedMaskData = snapshot?.maskData ?? null;
                const sharedMaskWidth = snapshot?.maskWidth ?? 0;
                const sharedMaskHeight = snapshot?.maskHeight ?? 0;
                items.forEach((it) => {
                  const prev = perImageStateRef.current[it.id];
                  perImageStateRef.current[it.id] = {
                    effectType,
                    strength,
                    blurStrength,
                    brushSize,
                    mode,
                    // 如果当前图有绘制内容，则把 mask 一并应用到全部；否则仅同步参数
                    maskData: sharedMaskData ?? prev?.maskData ?? null,
                    maskWidth: sharedMaskData
                      ? sharedMaskWidth
                      : (prev?.maskWidth ?? 0),
                    maskHeight: sharedMaskData
                      ? sharedMaskHeight
                      : (prev?.maskHeight ?? 0),
                  };
                });
              },
            }
          : null
      }
      onViewStateChange={setViewState}
      canvasOverlay={overlay}
      getPreviewBlob={buildPreviewBlob}
    >
      <div class="flex flex-col gap-4">
        <div class="flex flex-col gap-2">
          <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
            {t("imageMosaic.type")}
          </label>
          <select
            class="select select-bordered w-full h-11 text-sm"
            value={effectType}
            onChange={(e) =>
              setEffectType(
                (e.currentTarget as HTMLSelectElement).value as MosaicEffect,
              )
            }
          >
            <option value="mosaic">{t("imageMosaic.type.mosaic")}</option>
            <option value="blur">{t("imageMosaic.type.blur")}</option>
          </select>
        </div>

        {effectType === "mosaic" ? (
          <>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("imageMosaic.strength")}（{Math.round(strength)}）
              </label>
              <input
                type="range"
                class="range range-primary w-full"
                value={Math.round(strength)}
                min={10}
                max={80}
                step={1}
                onInput={(e) =>
                  setStrength(Number((e.currentTarget as HTMLInputElement).value))
                }
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("imageMosaic.size")}（{Math.round(brushSize)}px）
              </label>
              <input
                type="range"
                class="range range-primary w-full"
                value={Math.round(brushSize)}
                min={6}
                max={80}
                step={1}
                onInput={(e) =>
                  setBrushSize(Number((e.currentTarget as HTMLInputElement).value))
                }
              />
            </div>
          </>
        ) : null}

        {effectType === "blur" ? (
          <>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("imageMosaic.blurStrength")}（{Math.round(blurStrength)}）
              </label>
              <input
                type="range"
                class="range range-primary w-full"
                value={Math.round(blurStrength)}
                min={2}
                max={24}
                step={1}
                onInput={(e) =>
                  setBlurStrength(
                    Number((e.currentTarget as HTMLInputElement).value),
                  )
                }
              />
            </div>
            <div class="flex flex-col gap-2">
              <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                {t("imageMosaic.size")}（{Math.round(brushSize)}px）
              </label>
              <input
                type="range"
                class="range range-primary w-full"
                value={Math.round(brushSize)}
                min={6}
                max={80}
                step={1}
                onInput={(e) =>
                  setBrushSize(Number((e.currentTarget as HTMLInputElement).value))
                }
              />
            </div>
          </>
        ) : null}

        {maskDirty ? (
          <div class="flex items-center gap-3 mt-2">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onClick={() => setIsClearConfirmOpen(true)}
            >
              {t("imageMosaic.clear")}
            </button>
          </div>
        ) : null}

        {error ? (
          <div class="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : null}
      </div>

      <dialog class={`modal ${isClearConfirmOpen ? "modal-open" : ""}`}>
        <div class="modal-box">
          <h3 class="font-bold text-lg">{t("imageMosaic.clearConfirm.title")}</h3>
          <div class="py-4 text-sm text-slate-700 dark:text-slate-300">
            {t("imageMosaic.clearConfirm.message")}
          </div>
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onClick={() => setIsClearConfirmOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onClick={() => {
                clearMask();
                setIsClearConfirmOpen(false);
              }}
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="button" onClick={() => setIsClearConfirmOpen(false)}>
            close
          </button>
        </form>
      </dialog>
    </ImageToolLayout>
  );
}










