import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useCallback,
} from "preact/hooks";
import { useI18n } from "../../i18n/context";
import {
  canvasToBlob,
  fileToImageInfo,
  revokeImageInfo,
  type ImageInfo,
} from "../../shared/image";
import { ImageToolLayout } from "../../shared/components/ImageToolLayout";
import { ColorPicker } from "../../shared/components/ColorPicker";
import type { CanvasImageViewerViewState } from "../../shared/components/CanvasImageViewer";
import { useImageItems } from "../../shared/useImageItems";

type WatermarkType = "text" | "image";
type PositionMode = "single" | "tile";
type Point = { x: number; y: number };
type Rect = { x: number; y: number; w: number; h: number };
type TextAlign = "left" | "center" | "right";

type AppliedRule = {
  // 通用
  watermarkType: WatermarkType;
  opacity: number;
  rotation: number;

  // 文字
  watermarkText: string;
  fontSize: number;
  fontFamily: string;
  isBold: boolean;
  textColor: string;
  textAlign: TextAlign;
  strokeEnabled: boolean;
  strokeWidth: number;
  strokeColor: string;

  // 图片水印
  logoScale: number;
  logoInfo: ImageInfo | null;

  // 排版
  margin: number;

  // 位置模式
  positionMode: PositionMode;
  tileRows: number;
  tileCols: number;
  tileStagger: boolean;

  // 偏移（百分比，便于不同尺寸复用）
  singleOffsetX: number;
  singleOffsetY: number;
  tileOffsetX: number;
  tileOffsetY: number;
};

function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
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

// 说明：水印页使用 canvas 直接渲染，部分几何计算放在工具函数里，便于复用/统一导出与预览效果

function clampInt(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, Math.round(value)));
}

function wrapSigned(value: number, period: number) {
  if (period <= 0) return value;
  let v = value % period;
  if (v > period / 2) v -= period;
  if (v < -period / 2) v += period;
  return v;
}

function normalizeLines(text: string) {
  const raw = String(text ?? "")
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n");
  const lines = raw.split("\n");
  if (lines.length === 0) return [" "];
  return lines.map((l) => (l.trim().length === 0 ? " " : l));
}

function buildFont(isBold: boolean, fontSize: number, fontFamily: string) {
  const weight = isBold ? 600 : 400;
  return `${weight} ${fontSize}px ${fontFamily}`;
}

function getMultilineMetrics(lines: string[], font: string, fontSize: number) {
  // 近似兜底（SSR 或 canvas 不可用）
  if (typeof document === "undefined") {
    const maxLen = Math.max(1, ...lines.map((l) => l.length));
    const lh = Math.max(1, Math.round(fontSize * 1.2));
    return {
      width: Math.max(1, fontSize * maxLen * 0.6),
      height: Math.max(1, lh * lines.length),
      lineHeight: lh,
    };
  }
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    const maxLen = Math.max(1, ...lines.map((l) => l.length));
    const lh = Math.max(1, Math.round(fontSize * 1.2));
    return {
      width: Math.max(1, fontSize * maxLen * 0.6),
      height: Math.max(1, lh * lines.length),
      lineHeight: lh,
    };
  }
  ctx.font = font;
  let maxW = 1;
  for (const l of lines) {
    const m = ctx.measureText(l);
    maxW = Math.max(maxW, m.width);
  }
  const lh = Math.max(1, Math.round(fontSize * 1.2));
  return {
    width: Math.max(1, maxW),
    height: Math.max(1, lh * lines.length),
    lineHeight: lh,
  };
}

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(errorMessage));
    img.src = url;
  });
}

export function ImageWatermarkPage() {
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
  const [viewState, setViewState] = useState<CanvasImageViewerViewState | null>(
    null,
  );

  const [appliedRule, setAppliedRule] = useState<AppliedRule | null>(null);

  const [watermarkType, setWatermarkType] = useState<WatermarkType>("text");
  const [watermarkText, setWatermarkText] = useState("Sample");
  const [fontSize, setFontSize] = useState(36);
  const [fontFamily, setFontFamily] = useState(
    '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif',
  );
  const [isBold, setIsBold] = useState(true);
  const [textColor, setTextColor] = useState("#6b7280");
  const [textAlign, setTextAlign] = useState<TextAlign>("center");
  const [strokeEnabled, setStrokeEnabled] = useState(false);
  const [strokeWidth, setStrokeWidth] = useState(2);
  const [strokeColor, setStrokeColor] = useState("#111827");
  const [opacity, setOpacity] = useState(60);
  const [rotation, setRotation] = useState(0);

  const [logoInfo, setLogoInfo] = useState<ImageInfo | null>(null);
  const [logoScale, setLogoScale] = useState(0.35);
  const logoImageRef = useRef<HTMLImageElement | null>(null);
  const logoInputRef = useRef<HTMLInputElement | null>(null);

  const [margin, setMargin] = useState(24);

  const [positionMode, setPositionMode] = useState<PositionMode>("single");
  const [tileRows, setTileRows] = useState(4);
  const [tileCols, setTileCols] = useState(4);
  const [tileStagger, setTileStagger] = useState(true);
  const [tileOffset, setTileOffset] = useState<Point>({ x: 0, y: 0 });

  const [position, setPosition] = useState<Point | null>(null);
  const overlayCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const dragOffsetRef = useRef<Point | null>(null);
  const isDraggingRef = useRef(false);
  const lastActiveIdRef = useRef<string>("");
  const lastActiveInfoRef = useRef<ImageInfo | null>(null);
  const perImageRuleRef = useRef<Record<string, AppliedRule>>({});

  // 基础控件直接使用 daisyUI class（避免在 shared/components 再封装一遍）
  function renderCheckbox(props: {
    checked: boolean;
    onChange: (checked: boolean) => void;
    label: string;
    disabled?: boolean;
  }) {
    const { checked, onChange, label, disabled = false } = props;
    return (
      <label
        class={`label cursor-pointer justify-start gap-2 ${
          disabled ? "opacity-50 cursor-not-allowed" : ""
        }`}
      >
        <input
          type="checkbox"
          class="checkbox checkbox-primary checkbox-sm"
          checked={checked}
          disabled={disabled}
          onChange={(e) =>
            onChange((e.currentTarget as HTMLInputElement).checked)
          }
        />
        <span class="label-text text-sm">{label}</span>
      </label>
    );
  }

  function applyRuleToState(rule: AppliedRule, targetInfo: ImageInfo) {
    setWatermarkType(rule.watermarkType);
    setWatermarkText(rule.watermarkText);
    setFontSize(rule.fontSize);
    setFontFamily(rule.fontFamily);
    setIsBold(rule.isBold);
    setTextColor(rule.textColor);
    setTextAlign(rule.textAlign);
    setStrokeEnabled(rule.strokeEnabled);
    setStrokeWidth(rule.strokeWidth);
    setStrokeColor(rule.strokeColor);
    setOpacity(rule.opacity);
    setRotation(rule.rotation);

    setMargin(rule.margin);
    setPositionMode(rule.positionMode);
    setTileRows(rule.tileRows);
    setTileCols(rule.tileCols);
    setTileStagger(rule.tileStagger);
    setTileOffset({
      x: rule.tileOffsetX * targetInfo.width,
      y: rule.tileOffsetY * targetInfo.height,
    });

    setLogoScale(rule.logoScale);
    // 注意：logoInfo 可能会被复用（缓存/应用到全部），这里避免不必要的 revoke
    setLogoInfo((prev) => {
      if (prev?.url && rule.logoInfo?.url && prev.url === rule.logoInfo.url)
        return prev;
      return rule.logoInfo;
    });

    setPosition({
      x: rule.singleOffsetX * targetInfo.width,
      y: rule.singleOffsetY * targetInfo.height,
    });
  }

  useEffect(() => {
    return () => revokeImageInfo(logoInfo);
  }, [logoInfo]);

  useEffect(() => {
    if (!info) {
      lastActiveIdRef.current = "";
      lastActiveInfoRef.current = null;
      setPosition(null);
      return;
    }
    if (activeId && activeId !== lastActiveIdRef.current) {
      // 1) 先把“上一张图”的设置缓存起来（切回来要能恢复）
      const prevId = lastActiveIdRef.current;
      const prevInfo = lastActiveInfoRef.current;
      if (prevId && prevInfo) {
        perImageRuleRef.current[prevId] = buildAppliedRuleFromState(prevInfo);
      }

      // 2) 恢复当前图：优先用该图缓存；否则用“应用到全部”的规则；都没有就仅重置位置
      const cached = perImageRuleRef.current[activeId];
      const ruleToApply = cached ?? appliedRule;
      if (ruleToApply) {
        applyRuleToState(ruleToApply, info);
      } else {
        setPosition(null);
      }

      lastActiveIdRef.current = activeId;
      lastActiveInfoRef.current = info;
    }
  }, [activeId, info, appliedRule]);

  useEffect(() => {
    if (!logoInfo) {
      logoImageRef.current = null;
      return;
    }
    loadImage(logoInfo.url, t('error.imageLoadFailed'))
      .then((img) => {
        logoImageRef.current = img;
        drawOverlay();
      })
      .catch(() => {
        logoImageRef.current = null;
      });
  }, [logoInfo]);

  const watermarkRect = useMemo<Rect | null>(() => {
    if (!info) return null;
    if (watermarkType === "text") {
      const lines = normalizeLines(watermarkText);
      const font = buildFont(isBold, fontSize, fontFamily);
      const metrics = getMultilineMetrics(lines, font, fontSize);
      const pad = strokeEnabled ? Math.max(0, strokeWidth) * 2 : 0;
      return {
        x: position?.x ?? 0,
        y: position?.y ?? 0,
        w: metrics.width + pad,
        h: metrics.height + pad,
      };
    }
    if (!logoInfo) return null;
    const w = Math.max(1, logoInfo.width * logoScale);
    const h = Math.max(1, logoInfo.height * logoScale);
    return { x: position?.x ?? 0, y: position?.y ?? 0, w, h };
  }, [
    fontFamily,
    fontSize,
    isBold,
    logoInfo,
    logoScale,
    position?.x,
    position?.y,
    strokeEnabled,
    strokeWidth,
    watermarkText,
    watermarkType,
    info,
  ]);

  useEffect(() => {
    if (!info || !watermarkRect) return;
    if (positionMode === "tile") return;
    if (!position) {
      const x = Math.max(margin, info.width - watermarkRect.w - margin);
      const y = Math.max(margin, info.height - watermarkRect.h - margin);
      setPosition({ x, y });
      return;
    }
    const nextX = clamp(
      position.x,
      0,
      Math.max(0, info.width - watermarkRect.w),
    );
    const nextY = clamp(
      position.y,
      0,
      Math.max(0, info.height - watermarkRect.h),
    );
    if (nextX !== position.x || nextY !== position.y)
      setPosition({ x: nextX, y: nextY });
  }, [info, margin, position, positionMode, watermarkRect]);

  const drawOverlay = useCallback(() => {
    const canvas = overlayCanvasRef.current;
    if (!canvas || !viewState || !info || !watermarkRect) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    canvas.width = viewState.containerWidth * dpr;
    canvas.height = viewState.containerHeight * dpr;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, viewState.containerWidth, viewState.containerHeight);

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
    ctx.scale(drawW / viewState.imageWidth, drawH / viewState.imageHeight);
    ctx.translate(-viewState.imageWidth / 2, -viewState.imageHeight / 2);

    const w = watermarkRect.w;
    const h = watermarkRect.h;
    const alpha = clamp(opacity / 100, 0, 1);
    const rotateRad = (rotation * Math.PI) / 180;

    const drawText = () => {
      const lines = normalizeLines(watermarkText);
      const font = buildFont(isBold, fontSize, fontFamily);
      const metrics = getMultilineMetrics(lines, font, fontSize);
      const pad = strokeEnabled ? Math.max(0, strokeWidth) : 0;

      ctx.fillStyle = textColor;
      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      let x0 = 0;
      if (textAlign === "left") {
        ctx.textAlign = "left";
        x0 = -w / 2 + pad;
      } else if (textAlign === "right") {
        ctx.textAlign = "right";
        x0 = w / 2 - pad;
      } else {
        ctx.textAlign = "center";
        x0 = 0;
      }

      const totalH = metrics.lineHeight * lines.length;
      const startY = -totalH / 2 + metrics.lineHeight / 2;

      for (let i = 0; i < lines.length; i += 1) {
        const y = startY + i * metrics.lineHeight;
        const line = lines[i] ?? " ";
        if (strokeEnabled) {
          ctx.strokeStyle = strokeColor;
          ctx.lineWidth = Math.max(1, strokeWidth);
          ctx.strokeText(line, x0, y);
        }
        ctx.fillText(line, x0, y);
      }
    };

    const drawLogo = () => {
      if (!logoImageRef.current) return;
      ctx.drawImage(logoImageRef.current, -w / 2, -h / 2, w, h);
    };

    const drawOne = (centerX: number, centerY: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(centerX, centerY);
      ctx.rotate(rotateRad);
      if (watermarkType === "text") drawText();
      else drawLogo();
      ctx.restore();
    };

    if (positionMode === "single") {
      const x = position?.x ?? 0;
      const y = position?.y ?? 0;
      drawOne(x + w / 2, y + h / 2);
    } else if (info) {
      const rows = clampInt(tileRows, 1, 12);
      const cols = clampInt(tileCols, 1, 12);
      const stepX = cols > 0 ? info.width / cols : info.width;
      const stepY = rows > 0 ? info.height / rows : info.height;
      const ox = wrapSigned(tileOffset.x, stepX);
      const oy = wrapSigned(tileOffset.y, stepY);

      // 额外多画一圈，保证拖动偏移后边缘不断层
      for (let rr = -1; rr <= rows; rr += 1) {
        for (let cc = -1; cc <= cols; cc += 1) {
          const stagger = tileStagger && rr % 2 !== 0 ? stepX / 2 : 0;
          const cx = (cc + 0.5) * stepX + ox + stagger;
          const cy = (rr + 0.5) * stepY + oy;
          // 粗略裁剪，减少无效绘制
          if (cx < -w || cx > info.width + w || cy < -h || cy > info.height + h)
            continue;
          drawOne(cx, cy);
        }
      }
    }
    ctx.restore();
  }, [
    fontFamily,
    fontSize,
    isBold,
    info,
    opacity,
    position,
    rotation,
    strokeColor,
    strokeEnabled,
    strokeWidth,
    textAlign,
    textColor,
    tileCols,
    positionMode,
    tileOffset.x,
    tileOffset.y,
    tileRows,
    tileStagger,
    viewState,
    watermarkRect,
    watermarkText,
    watermarkType,
  ]);

  useEffect(() => {
    drawOverlay();
  }, [drawOverlay]);

  // 图片选择由 ImageToolLayout onFilesSelect 驱动（支持多选）

  async function onPickLogo(file: File) {
    setError(null);
    try {
      const next = await fileToImageInfo(file);
      setLogoInfo((prev) => {
        revokeImageInfo(prev);
        return next;
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : t("imageWatermark.selectLogo"));
    }
  }

  function setPresetPosition(
    preset: "lt" | "t" | "rt" | "l" | "c" | "r" | "lb" | "b" | "rb",
  ) {
    if (!info || !watermarkRect) return;
    const w = watermarkRect.w;
    const h = watermarkRect.h;
    let x = 0;
    let y = 0;
    if (preset === "lt") {
      x = margin;
      y = margin;
    } else if (preset === "t") {
      x = Math.max(0, (info.width - w) / 2);
      y = margin;
    } else if (preset === "rt") {
      x = Math.max(margin, info.width - w - margin);
      y = margin;
    } else if (preset === "l") {
      x = margin;
      y = Math.max(0, (info.height - h) / 2);
    } else if (preset === "c") {
      x = Math.max(0, (info.width - w) / 2);
      y = Math.max(0, (info.height - h) / 2);
    } else if (preset === "r") {
      x = Math.max(margin, info.width - w - margin);
      y = Math.max(0, (info.height - h) / 2);
    } else if (preset === "lb") {
      x = margin;
      y = Math.max(margin, info.height - h - margin);
    } else if (preset === "b") {
      x = Math.max(0, (info.width - w) / 2);
      y = Math.max(margin, info.height - h - margin);
    } else if (preset === "rb") {
      x = Math.max(margin, info.width - w - margin);
      y = Math.max(margin, info.height - h - margin);
    }
    setPosition({ x, y });
  }

  function getHitRect(): Rect | null {
    if (positionMode === "tile") return null;
    if (!watermarkRect || !position) return null;
    return {
      x: position.x,
      y: position.y,
      w: watermarkRect.w,
      h: watermarkRect.h,
    };
  }

  function hitTest(p: Point, rect: Rect | null) {
    if (!rect) return false;
    return (
      p.x >= rect.x &&
      p.x <= rect.x + rect.w &&
      p.y >= rect.y &&
      p.y <= rect.y + rect.h
    );
  }

  const handlePointerDown = useCallback(
    (e: PointerEvent) => {
      if (e.button !== 0 || !viewState) return;
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const p = toImagePoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewState,
      );
      if (!p) return;
      if (positionMode === "single") {
        const hit = hitTest(p, getHitRect());
        if (!hit) return;
      }
      e.preventDefault();
      e.stopPropagation();
      overlayCanvasRef.current?.setPointerCapture(e.pointerId);
      isDraggingRef.current = true;
      if (positionMode === "tile") {
        dragOffsetRef.current = {
          x: p.x - tileOffset.x,
          y: p.y - tileOffset.y,
        };
      } else {
        dragOffsetRef.current = {
          x: p.x - (position?.x ?? 0),
          y: p.y - (position?.y ?? 0),
        };
      }
    },
    [position, positionMode, tileOffset.x, tileOffset.y, viewState],
  );

  const handlePointerMove = useCallback(
    (e: PointerEvent) => {
      if (!isDraggingRef.current || !viewState || !watermarkRect || !info)
        return;
      const rect = overlayCanvasRef.current?.getBoundingClientRect();
      if (!rect) return;
      const p = toImagePoint(
        e.clientX - rect.left,
        e.clientY - rect.top,
        viewState,
      );
      if (!p || !dragOffsetRef.current) return;
      e.preventDefault();
      e.stopPropagation();
      if (positionMode === "tile") {
        const rows = clampInt(tileRows, 1, 12);
        const cols = clampInt(tileCols, 1, 12);
        const stepX = cols > 0 ? info.width / cols : info.width;
        const stepY = rows > 0 ? info.height / rows : info.height;
        const rawX = p.x - dragOffsetRef.current.x;
        const rawY = p.y - dragOffsetRef.current.y;
        setTileOffset({
          x: wrapSigned(rawX, stepX),
          y: wrapSigned(rawY, stepY),
        });
      } else {
        const nextX = clamp(
          p.x - dragOffsetRef.current.x,
          0,
          Math.max(0, info.width - watermarkRect.w),
        );
        const nextY = clamp(
          p.y - dragOffsetRef.current.y,
          0,
          Math.max(0, info.height - watermarkRect.h),
        );
        setPosition({ x: nextX, y: nextY });
      }
    },
    [info, tileCols, positionMode, tileRows, viewState, watermarkRect],
  );

  const handlePointerUp = useCallback((e: PointerEvent) => {
    if (!isDraggingRef.current) return;
    isDraggingRef.current = false;
    dragOffsetRef.current = null;
    overlayCanvasRef.current?.releasePointerCapture(e.pointerId);
  }, []);

  function buildAppliedRuleFromState(baseInfo: ImageInfo): AppliedRule {
    const px = position?.x ?? 0;
    const py = position?.y ?? 0;
    return {
      watermarkType,
      opacity,
      rotation,
      watermarkText,
      fontSize,
      fontFamily,
      isBold,
      textColor,
      textAlign,
      strokeEnabled,
      strokeWidth,
      strokeColor,
      logoScale,
      logoInfo,
      margin,
      positionMode,
      tileRows,
      tileCols,
      tileStagger,
      singleOffsetX: baseInfo.width > 0 ? px / baseInfo.width : 0,
      singleOffsetY: baseInfo.height > 0 ? py / baseInfo.height : 0,
      tileOffsetX: baseInfo.width > 0 ? tileOffset.x / baseInfo.width : 0,
      tileOffsetY: baseInfo.height > 0 ? tileOffset.y / baseInfo.height : 0,
    };
  }

  async function renderResultToBlobFor(
    canvas: HTMLCanvasElement,
    targetInfo: ImageInfo,
    rule: AppliedRule,
  ) {
    canvas.width = targetInfo.width;
    canvas.height = targetInfo.height;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t('error.canvasInitFailed'));
    const baseImg = await loadImage(targetInfo.url, t('error.imageLoadFailed'));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(baseImg, 0, 0);

    let w = 0;
    let h = 0;
    if (rule.watermarkType === "text") {
      const lines = normalizeLines(rule.watermarkText);
      const font = buildFont(rule.isBold, rule.fontSize, rule.fontFamily);
      const metrics = getMultilineMetrics(lines, font, rule.fontSize);
      const pad = rule.strokeEnabled ? Math.max(0, rule.strokeWidth) * 2 : 0;
      w = metrics.width + pad;
      h = metrics.height + pad;
    } else if (rule.logoInfo) {
      w = Math.max(1, rule.logoInfo.width * rule.logoScale);
      h = Math.max(1, rule.logoInfo.height * rule.logoScale);
    } else {
      const blob = await canvasToBlob(canvas, "image/png", 1);
      return { blob, width: targetInfo.width, height: targetInfo.height };
    }

    const alpha = clamp(rule.opacity / 100, 0, 1);
    const rotateRad = (rule.rotation * Math.PI) / 180;
    const logoImage =
      rule.watermarkType === "image" && rule.logoInfo
        ? await loadImage(rule.logoInfo.url, t('error.imageLoadFailed'))
        : null;

    const drawText = () => {
      const lines = normalizeLines(rule.watermarkText);
      const font = buildFont(rule.isBold, rule.fontSize, rule.fontFamily);
      const metrics = getMultilineMetrics(lines, font, rule.fontSize);
      const pad = rule.strokeEnabled ? Math.max(0, rule.strokeWidth) : 0;

      ctx.fillStyle = rule.textColor;
      ctx.font = font;
      ctx.textBaseline = "middle";
      ctx.lineJoin = "round";
      ctx.miterLimit = 2;

      let x0 = 0;
      if (rule.textAlign === "left") {
        ctx.textAlign = "left";
        x0 = -w / 2 + pad;
      } else if (rule.textAlign === "right") {
        ctx.textAlign = "right";
        x0 = w / 2 - pad;
      } else {
        ctx.textAlign = "center";
        x0 = 0;
      }

      const totalH = metrics.lineHeight * lines.length;
      const startY = -totalH / 2 + metrics.lineHeight / 2;

      for (let i = 0; i < lines.length; i += 1) {
        const y = startY + i * metrics.lineHeight;
        const line = lines[i] ?? " ";
        if (rule.strokeEnabled) {
          ctx.strokeStyle = rule.strokeColor;
          ctx.lineWidth = Math.max(1, rule.strokeWidth);
          ctx.strokeText(line, x0, y);
        }
        ctx.fillText(line, x0, y);
      }
    };

    const drawLogo = () => {
      if (!logoImage) return;
      ctx.drawImage(logoImage, -w / 2, -h / 2, w, h);
    };

    const drawOne = (centerX: number, centerY: number) => {
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.translate(centerX, centerY);
      ctx.rotate(rotateRad);
      if (rule.watermarkType === "text") drawText();
      else drawLogo();
      ctx.restore();
    };

    if (rule.positionMode === "single") {
      const x = rule.singleOffsetX * targetInfo.width;
      const y = rule.singleOffsetY * targetInfo.height;
      drawOne(x + w / 2, y + h / 2);
    } else {
      const rows = clampInt(rule.tileRows, 1, 12);
      const cols = clampInt(rule.tileCols, 1, 12);
      const stepX = cols > 0 ? targetInfo.width / cols : targetInfo.width;
      const stepY = rows > 0 ? targetInfo.height / rows : targetInfo.height;
      const ox = wrapSigned(rule.tileOffsetX * targetInfo.width, stepX);
      const oy = wrapSigned(rule.tileOffsetY * targetInfo.height, stepY);

      for (let rr = -1; rr <= rows; rr += 1) {
        for (let cc = -1; cc <= cols; cc += 1) {
          const stagger = rule.tileStagger && rr % 2 !== 0 ? stepX / 2 : 0;
          const cx = (cc + 0.5) * stepX + ox + stagger;
          const cy = (rr + 0.5) * stepY + oy;
          if (
            cx < -w ||
            cx > targetInfo.width + w ||
            cy < -h ||
            cy > targetInfo.height + h
          )
            continue;
          drawOne(cx, cy);
        }
      }
    }

    const blob = await canvasToBlob(canvas, "image/png", 1);
    return { blob, width: targetInfo.width, height: targetInfo.height };
  }

  // 说明：导出/预览都依赖同一份“处理后结果”，集中渲染避免两套逻辑不一致
  async function renderResultToBlob(canvas: HTMLCanvasElement) {
    if (!info || !watermarkRect) throw new Error(t('error.noImageSelected'));
    const rule = buildAppliedRuleFromState(info);
    return await renderResultToBlobFor(canvas, info, rule);
  }

  async function buildPreviewBlob() {
    const canvas = exportCanvasRef.current ?? document.createElement("canvas");
    exportCanvasRef.current = canvas;
    return await renderResultToBlob(canvas);
  }

  async function onExport() {
    if (!info || !watermarkRect) throw new Error(t('error.noImageSelected'));
    try {
      setError(null);
      const canvas =
        exportCanvasRef.current ?? document.createElement("canvas");
      exportCanvasRef.current = canvas;
      const rule = buildAppliedRuleFromState(info);
      const { blob } = await renderResultToBlobFor(canvas, info, rule);
      const name = info.name.replace(/\.[^.]+$/, "");
      return { blob, filename: `${name}-watermark.png` };
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'));
      throw e;
    }
  }

  async function buildAllExports() {
    if (items.length === 0 || !info) return;
    setError(null);
    try {
      const payloads: { blob: Blob; filename: string }[] = [];
      const activeRule = buildAppliedRuleFromState(info);
      const rulesById = appliedRule
        ? null
        : { ...perImageRuleRef.current, ...(activeId ? { [activeId]: activeRule } : {}) };
      for (const it of items) {
        const canvas =
          exportCanvasRef.current ?? document.createElement("canvas");
        exportCanvasRef.current = canvas;
        const rule = appliedRule ?? rulesById?.[it.id] ?? activeRule;
        const { blob } = await renderResultToBlobFor(canvas, it.info, rule);
        const name = it.info.name.replace(/\.[^.]+$/, "");
        payloads.push({ blob, filename: `${name}-watermark.png` });
        await new Promise<void>((r) => window.setTimeout(() => r(), 0));
      }
      return payloads;
    } catch (e) {
      setError(e instanceof Error ? e.message : t('error.exportFailed'));
      throw e;
    }
  }

  const overlay = (
    <canvas
      ref={overlayCanvasRef}
      class="w-full h-full block"
      onPointerDown={(e) => handlePointerDown(e as unknown as PointerEvent)}
      onPointerMove={(e) => handlePointerMove(e as unknown as PointerEvent)}
      onPointerUp={(e) => handlePointerUp(e as unknown as PointerEvent)}
      onPointerCancel={(e) => handlePointerUp(e as unknown as PointerEvent)}
      style={{ cursor: isDraggingRef.current ? "grabbing" : "grab" }}
    />
  );

  return (
    <ImageToolLayout
      title={t("imageWatermark.title")}
      onBackToHome={() => (window.location.href = "../index.html")}
      onReselect={() => {
        setError(null);
        clearAll();
        setAppliedRule(null);
        perImageRuleRef.current = {};
        lastActiveInfoRef.current = null;
        setLogoInfo((prev) => {
          revokeImageInfo(prev);
          return null;
        });
        setPosition(null);
        setTileOffset({ x: 0, y: 0 });
        setPositionMode("single");
      }}
      secondaryActionLabel={t("imageWatermark.reselect")}
      onPrimaryAction={onExport}
      onPrimaryActionAll={buildAllExports}
      primaryActionLabel={t("imageWatermark.download")}
      onFilesSelect={async (files) => {
        setError(null);
        try {
          await addFiles(files);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : t("imageWatermark.selectImage"),
          );
        }
      }}
      images={
        items.length > 0
          ? {
              items: items.map((it) => ({ id: it.id, info: it.info })),
              activeId,
              onSelect: (id) => setActiveId(id),
              onRemove: removeOne,
              onApplyToAll: () => {
                if (!info || !watermarkRect) return;
                const rule = buildAppliedRuleFromState(info);
                setAppliedRule(rule);
                // 同时覆盖所有图片的临时缓存，保证切换立刻生效（和其它模块一致）
                const next: Record<string, AppliedRule> = {};
                for (const it of items) next[it.id] = rule;
                perImageRuleRef.current = next;
              },
            }
          : null
      }
      onViewStateChange={setViewState}
      canvasOverlay={overlay}
      getPreviewBlob={buildPreviewBlob}
    >
      <div class="flex flex-col gap-6">
        {/* 水印类型 */}
        <div class="tabs tabs-lift tabs-md w-full">
          <input
            type="radio"
            name="watermark_type_tabs"
            class="tab"
            aria-label={t("imageWatermark.type.text")}
            checked={watermarkType === "text"}
            onChange={() => setWatermarkType("text")}
          />
          <div class="tab-content bg-base-100 border-base-300 p-4 w-full">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.text")}
                </label>
                <textarea
                  value={watermarkText}
                  rows={2}
                  onInput={(e) =>
                    setWatermarkText(
                      (e.currentTarget as HTMLTextAreaElement).value,
                    )
                  }
                  class="w-full min-h-[44px] px-3 py-2 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-sm resize-y"
                  placeholder={t("imageWatermark.textPlaceholder")}
                />
                <div class="text-xs text-slate-500 dark:text-slate-400">
                  支持多行（回车换行）
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.fontSize")}
                </label>
                <input
                  type="number"
                  class="input input-bordered w-full h-11 text-sm"
                  value={fontSize}
                  step={1}
                  onInput={(e) =>
                    setFontSize(
                      Number((e.currentTarget as HTMLInputElement).value),
                    )
                  }
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  字体
                </label>
                <select
                  class="select select-bordered w-full h-11 text-sm"
                  value={fontFamily}
                  onChange={(e) =>
                    setFontFamily((e.currentTarget as HTMLSelectElement).value)
                  }
                >
                  <option
                    value={
                      '"PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
                    }
                  >
                    通用黑体（推荐）
                  </option>
                  <option
                    value={'"Source Han Sans SC","Noto Sans SC",sans-serif'}
                  >
                    思源黑体
                  </option>
                  <option value="serif">衬线体（Serif）</option>
                  <option value="monospace">等宽（Monospace）</option>
                </select>
              </div>

              {renderCheckbox({
                checked: isBold,
                onChange: setIsBold,
                label: "加粗",
              })}

              <ColorPicker
                value={textColor}
                onChange={setTextColor}
                label={t("imageWatermark.color")}
              />

              <div class="flex flex-col gap-2">
                <div class="flex items-center gap-2">
                  {renderCheckbox({
                    checked: strokeEnabled,
                    onChange: setStrokeEnabled,
                    label: "描边",
                  })}
                  <span class="text-xs text-slate-500 dark:text-slate-400">
                    背景复杂/小字号建议开启
                  </span>
                </div>
                {strokeEnabled ? (
                  <div class="flex flex-col gap-4">
                    <div class="flex flex-col gap-2">
                      <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                        描边宽度
                      </label>
                      <input
                        type="number"
                        class="input input-bordered w-full h-11 text-sm"
                        value={strokeWidth}
                        min={1}
                        max={12}
                        step={1}
                        onInput={(e) =>
                          setStrokeWidth(
                            clampInt(
                              Number(
                                (e.currentTarget as HTMLInputElement).value,
                              ),
                              1,
                              12,
                            ),
                          )
                        }
                      />
                    </div>
                    <ColorPicker
                      value={strokeColor}
                      onChange={setStrokeColor}
                      label="描边颜色"
                    />
                  </div>
                ) : null}
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.opacity")}：{Math.round(opacity)}%
                </label>
                <input
                  type="range"
                  class="range range-primary w-full"
                  value={Math.round(opacity)}
                  min={10}
                  max={100}
                  step={1}
                  onInput={(e) =>
                    setOpacity(
                      Number((e.currentTarget as HTMLInputElement).value),
                    )
                  }
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.rotation")}：{Math.round(rotation)}°
                </label>
                <input
                  type="range"
                  class="range range-primary w-full"
                  value={Math.round(rotation)}
                  min={-180}
                  max={180}
                  step={1}
                  onInput={(e) =>
                    setRotation(
                      Number((e.currentTarget as HTMLInputElement).value),
                    )
                  }
                />
              </div>
            </div>
          </div>

          <input
            type="radio"
            name="watermark_type_tabs"
            class="tab"
            aria-label={t("imageWatermark.type.image")}
            checked={watermarkType === "image"}
            onChange={() => setWatermarkType("image")}
          />
          <div class="tab-content bg-base-100 border-base-300 p-4 w-full">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.selectLogo")}
                </label>
                <div class="flex items-center gap-3">
                  <input
                    ref={logoInputRef}
                    type="file"
                    accept="image/*"
                    class="hidden"
                    onChange={(e) => {
                      const input = e.currentTarget;
                      const file = input.files?.[0];
                      if (file) void onPickLogo(file);
                      input.value = "";
                    }}
                  />
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => logoInputRef.current?.click()}
                  >
                    {t("imageWatermark.selectLogo")}
                  </button>
                  <div class="text-xs text-slate-500 dark:text-slate-400 truncate">
                    {logoInfo ? logoInfo.name : t("imageWatermark.logoHint")}
                  </div>
                </div>
                {logoInfo ? (
                  <div class="flex flex-col gap-2">
                    <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                      {t("imageWatermark.logoSize")}：
                      {Math.round(logoScale * 100)}%
                    </label>
                    <input
                      type="range"
                      class="range range-primary w-full"
                      value={Math.round(logoScale * 100)}
                      min={10}
                      max={120}
                      step={1}
                      onInput={(e) =>
                        setLogoScale(
                          Number((e.currentTarget as HTMLInputElement).value) /
                            100,
                        )
                      }
                    />
                  </div>
                ) : null}
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.opacity")}：{Math.round(opacity)}%
                </label>
                <input
                  type="range"
                  class="range range-primary w-full"
                  value={Math.round(opacity)}
                  min={10}
                  max={100}
                  step={1}
                  onInput={(e) =>
                    setOpacity(
                      Number((e.currentTarget as HTMLInputElement).value),
                    )
                  }
                />
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.rotation")}：{Math.round(rotation)}°
                </label>
                <input
                  type="range"
                  class="range range-primary w-full"
                  value={Math.round(rotation)}
                  min={-180}
                  max={180}
                  step={1}
                  onInput={(e) =>
                    setRotation(
                      Number((e.currentTarget as HTMLInputElement).value),
                    )
                  }
                />
              </div>
            </div>
          </div>
        </div>

        {/* 位置模式 */}
        <div class="tabs tabs-lift tabs-md w-full">
          <input
            type="radio"
            name="position_mode_tabs"
            class="tab"
            aria-label="自由放置"
            checked={positionMode === "single"}
            onChange={() => setPositionMode("single")}
          />
          <div class="tab-content bg-base-100 border-base-300 p-4 w-full">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  {t("imageWatermark.position")}
                </label>
                <div class="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("lt")}
                  >
                    {t("imageWatermark.pos.lt")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("t")}
                  >
                    {t("imageWatermark.pos.t")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("rt")}
                  >
                    {t("imageWatermark.pos.rt")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("l")}
                  >
                    {t("imageWatermark.pos.l")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("c")}
                  >
                    {t("imageWatermark.pos.c")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("r")}
                  >
                    {t("imageWatermark.pos.r")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("lb")}
                  >
                    {t("imageWatermark.pos.lb")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("b")}
                  >
                    {t("imageWatermark.pos.b")}
                  </button>
                  <button
                    type="button"
                    class="btn btn-sm"
                    onClick={() => setPresetPosition("rb")}
                  >
                    {t("imageWatermark.pos.rb")}
                  </button>
                </div>
              </div>

              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  边距
                </label>
                <input
                  type="number"
                  class="input input-bordered w-full h-11 text-sm"
                  value={margin}
                  min={0}
                  max={200}
                  step={1}
                  onInput={(e) =>
                    setMargin(
                      clampInt(
                        Number((e.currentTarget as HTMLInputElement).value),
                        0,
                        200,
                      ),
                    )
                  }
                />
                <div class="text-xs text-slate-500 dark:text-slate-400">
                  用于快捷定位时距离边缘的间距
                </div>
              </div>
            </div>
          </div>

          <input
            type="radio"
            name="position_mode_tabs"
            class="tab"
            aria-label="平铺"
            checked={positionMode === "tile"}
            onChange={() => setPositionMode("tile")}
          />
          <div class="tab-content bg-base-100 border-base-300 p-4 w-full">
            <div class="flex flex-col gap-4">
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  水平列数
                </label>
                <input
                  type="number"
                  class="input input-bordered w-full h-11 text-sm"
                  value={tileCols}
                  min={1}
                  max={12}
                  step={1}
                  onInput={(e) =>
                    setTileCols(
                      clampInt(
                        Number((e.currentTarget as HTMLInputElement).value),
                        1,
                        12,
                      ),
                    )
                  }
                />
              </div>
              <div class="flex flex-col gap-2">
                <label class="text-sm font-medium text-slate-600 dark:text-slate-400">
                  垂直行数
                </label>
                <input
                  type="number"
                  class="input input-bordered w-full h-11 text-sm"
                  value={tileRows}
                  min={1}
                  max={12}
                  step={1}
                  onInput={(e) =>
                    setTileRows(
                      clampInt(
                        Number((e.currentTarget as HTMLInputElement).value),
                        1,
                        12,
                      ),
                    )
                  }
                />
              </div>
              {renderCheckbox({
                checked: tileStagger,
                onChange: setTileStagger,
                label: "错位平铺（相邻行错开）",
              })}
            </div>
          </div>
        </div>

        {error ? (
          <div class="text-sm text-red-600 dark:text-red-400">{error}</div>
        ) : null}
      </div>
    </ImageToolLayout>
  );
}







