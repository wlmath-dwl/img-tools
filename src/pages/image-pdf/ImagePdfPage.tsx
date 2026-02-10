import { useEffect, useRef, useState } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { ImageToolLayout } from "../../shared/components/ImageToolLayout";
import {
  fileToImageInfo,
  revokeImageInfo,
  type ImageInfo,
} from "../../shared/image";
import { CloseIcon, RotateRight90Icon } from "../../shared/icons";
import type { PdfGridItemView } from "./PdfDndGrid";

type PageSizeOption = "auto" | "a4" | "a3";
type MarginOption = "none" | "narrow" | "wide";

type PdfItem = {
  id: string;
  file: File;
  info: ImageInfo;
  rotation: number;
};

type RenderedDims = {
  width: number;
  height: number;
  rotation: number;
};

type PreviewPaper = {
  widthPx: number;
  aspectRatio: string;
  paddingPx: number;
  drawWidthPx: number;
  drawHeightPx: number;
};

const A4_SIZE = { width: 595.28, height: 841.89 };
const A3_SIZE = { width: 841.89, height: 1190.55 };

function arrayMove<T>(arr: T[], from: number, to: number) {
  const next = arr.slice();
  const start = Math.max(0, Math.min(arr.length - 1, from));
  const end = Math.max(0, Math.min(arr.length - 1, to));
  const [item] = next.splice(start, 1);
  next.splice(end, 0, item);
  return next;
}

function makeId() {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(errorMessage));
    img.src = url;
  });
}

function getMarginPts(margin: MarginOption) {
  if (margin === "wide") return 36;
  if (margin === "narrow") return 18;
  return 0;
}

function getRotatedDims(item: PdfItem, rotation: number) {
  // 说明：这里只关心 90° 的宽高交换（预览/导出均是 90° 步进旋转）
  return rotation % 180 === 0
    ? { w: item.info.width, h: item.info.height }
    : { w: item.info.height, h: item.info.width };
}

function getPaperWidthPx(option: PageSizeOption) {
  if (option === "a3") return 280;
  return 220;
}

function getPreviewPaper(
  option: PageSizeOption,
  margin: MarginOption,
  rendered: { width: number; height: number },
): PreviewPaper {
  const widthPx = getPaperWidthPx(option);
  const marginPts = getMarginPts(margin);

  if (option === "auto") {
    // auto 模式下，导出会把边距“加到页面尺寸里”（page = image + margin*2）
    // 这里预览也用相同规则计算页面比例与 padding，保证所见即所得
    const rotated = { w: rendered.width, h: rendered.height };
    const pageW = rotated.w + marginPts * 2;
    const pageH = rotated.h + marginPts * 2;
    const ptToPx = pageW > 0 ? widthPx / pageW : 1;
    const availableW = Math.max(0, pageW - marginPts * 2);
    const availableH = Math.max(0, pageH - marginPts * 2);
    const fit = Math.min(
      availableW / rotated.w,
      availableH / rotated.h,
    );
    const drawW = rotated.w * fit;
    const drawH = rotated.h * fit;
    return {
      widthPx,
      aspectRatio: `${pageW} / ${pageH}`,
      paddingPx: marginPts * ptToPx,
      drawWidthPx: drawW * ptToPx,
      drawHeightPx: drawH * ptToPx,
    };
  }

  const base = option === "a3" ? A3_SIZE : A4_SIZE;
  // A4/A3 固定使用竖向页面
  const pageW = base.width;
  const pageH = base.height;
  const ptToPx = pageW > 0 ? widthPx / pageW : 1;
  const rotated = { w: rendered.width, h: rendered.height };
  const availableW = Math.max(0, pageW - marginPts * 2);
  const availableH = Math.max(0, pageH - marginPts * 2);
  const fit = Math.min(
    availableW / rotated.w,
    availableH / rotated.h,
  );
  const drawW = rotated.w * fit;
  const drawH = rotated.h * fit;

  return {
    widthPx,
    aspectRatio: `${pageW} / ${pageH}`,
    paddingPx: marginPts * ptToPx,
    drawWidthPx: drawW * ptToPx,
    drawHeightPx: drawH * ptToPx,
  };
}

// 统一将图片绘制到画布中，便于手动旋转后以 PNG 导出
async function renderRotatedImageBuffer(
  item: PdfItem,
  rotation: number,
) {
  const img = await loadImage(item.info.url, "Failed to load image");
  const normalized = ((rotation % 360) + 360) % 360;
  const shouldSwap = normalized === 90 || normalized === 270;
  const canvas = document.createElement("canvas");
  canvas.width = shouldSwap ? img.naturalHeight : img.naturalWidth;
  canvas.height = shouldSwap ? img.naturalWidth : img.naturalHeight;

  const ctx = canvas.getContext("2d");
  // 说明：这里不依赖 i18n（函数在组件外），错误文本由上层兜底处理
  if (!ctx) throw new Error("Canvas init failed");

  ctx.save();
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((normalized * Math.PI) / 180);
  ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
  ctx.restore();

  const mime = "image/png";
  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (result) => {
        if (!result) reject(new Error("Image export failed"));
        else resolve(result);
      },
      mime,
    );
  });

  return {
    bytes: await blob.arrayBuffer(),
    width: canvas.width,
    height: canvas.height,
    mime,
  };
}

function StaticCard({
  item,
  index,
  preview,
  rotation,
  onRotate,
  onRemove,
}: {
  item: PdfItem;
  index: number;
  preview: PreviewPaper;
  rotation: number;
  onRotate: () => void;
  onRemove: () => void;
}) {
  const { t } = useI18n();
  const shouldSwap = rotation % 180 !== 0;
  return (
    <div
      class="group flex justify-center"
    >
      <div class="relative">
        <div class="absolute top-2 left-2 z-10 text-xs font-semibold px-2 py-1 rounded-full bg-white/90 text-slate-700 shadow">
          {String(index + 1).padStart(2, "0")}
        </div>
        <div class="absolute top-2 right-2 z-10 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-white/95 hover:bg-white shadow border border-slate-200"
            title={t('imagePdf.rotate')}
            onClick={(e) => {
              e.stopPropagation();
              onRotate();
            }}
          >
            <RotateRight90Icon size={16} />
          </button>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-white/95 hover:bg-white shadow border border-slate-200"
            title={t("imagePdf.delete")}
            onClick={(e) => {
              e.stopPropagation();
              onRemove();
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div
          // 预览说明：纸张（外层）用浅灰底，内容区（内层）用白底
          // 这样无边距时内容区会贴边，窄/宽边距会直观显示灰色“边距带”
          class="bg-slate-100 dark:bg-slate-800/60 rounded-xl shadow-lg border border-slate-200/70 dark:border-slate-700/60 overflow-hidden transition-all duration-300"
          style={{
            width: `${preview.widthPx}px`,
            aspectRatio: preview.aspectRatio,
            padding: `${preview.paddingPx}px`,
          }}
        >
          <div class="w-full h-full flex items-center justify-center bg-white dark:bg-slate-950">
            {/* 图片占用区域：按导出 PDF 的 fit/contain 规则计算 */}
            <div
              class="relative rounded-sm bg-slate-200/70 dark:bg-slate-700/40 border border-slate-300/70 dark:border-slate-600/50"
              style={{
                width: `${preview.drawWidthPx}px`,
                height: `${preview.drawHeightPx}px`,
              }}
            >
              <img
                src={item.info.url}
                alt={item.info.name}
                // 关键：关闭全局 img max-width 约束，避免 90° 预览时被压缩导致“看起来没撑满”
                class="absolute left-1/2 top-1/2 block max-w-none max-h-none"
                style={{
                  width: `${shouldSwap ? preview.drawHeightPx : preview.drawWidthPx}px`,
                  height: `${shouldSwap ? preview.drawWidthPx : preview.drawHeightPx}px`,
                  transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

const STORAGE_KEY = "img-tools-pdf-files-from-home";

// 从sessionStorage恢复文件
function restoreFilesFromSessionStorage(): File[] | null {
  try {
    const stored = sessionStorage.getItem(STORAGE_KEY);
    if (!stored) return null;

    const fileData = JSON.parse(stored) as Array<{
      name: string;
      type: string;
      size: number;
      data: number[];
    }>;

    // 清除存储，避免重复加载
    sessionStorage.removeItem(STORAGE_KEY);

    return fileData.map((item) => {
      const uint8Array = new Uint8Array(item.data);
      const blob = new Blob([uint8Array], { type: item.type });
      return new File([blob], item.name, { type: item.type });
    });
  } catch (error) {
    console.error("恢复文件数据失败:", error);
    sessionStorage.removeItem(STORAGE_KEY);
    return null;
  }
}

export function ImagePdfPage() {
  const { t } = useI18n();
  const [items, setItems] = useState<PdfItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [isExporting, setIsExporting] = useState(false);
  const itemsRef = useRef<PdfItem[]>([]);
  const [clientReady, setClientReady] = useState(false);
  const [PdfDndGrid, setPdfDndGrid] = useState<
    null | ((props: { items: PdfGridItemView[]; onReorder: (activeId: string, overId: string) => void }) => any)
  >(null);
  const hasLoadedFromStorage = useRef(false);
  const warmupRef = useRef({ dnd: false, pdfLib: false });

  const [pageSize, setPageSize] = useState<PageSizeOption>("auto");
  const [margin, setMargin] = useState<MarginOption>("narrow");
  const [renderedDimsMap, setRenderedDimsMap] = useState<Record<string, RenderedDims>>({});

  itemsRef.current = items;

  useEffect(() => {
    return () => {
      for (const it of itemsRef.current) revokeImageInfo(it.info);
    };
  }, []);

  // SSR 预渲染时不启用 dnd-kit（其内部依赖 react hooks，会导致 prerender 报错）
  useEffect(() => {
    setClientReady(true);
  }, []);

  function runIdle(cb: () => void, fallbackDelayMs = 800) {
    if (typeof window === "undefined") return () => { };
    const ric = (window as any).requestIdleCallback as undefined | ((fn: () => void, opts?: { timeout?: number }) => number);
    const cic = (window as any).cancelIdleCallback as undefined | ((id: number) => void);
    if (typeof ric === "function") {
      const id = ric(cb, { timeout: 2000 });
      return () => cic?.(id);
    }
    const id = window.setTimeout(() => cb(), fallbackDelayMs);
    return () => window.clearTimeout(id);
  }

  // 预加载（prefetch/warm-up）关键异步 chunk：
  // - 进入页面后空闲时预取拖拽排序（用户通常会很快上传图片并排序）
  // - 选图后空闲时预取 pdf-lib（用户通常会紧接着点击“导出”）
  useEffect(() => {
    if (!clientReady) return;
    if (warmupRef.current.dnd) return;
    warmupRef.current.dnd = true;
    return runIdle(() => {
      // 仅触发网络预取，不强依赖渲染结果
      void import("./PdfDndGrid");
    }, 1000);
  }, [clientReady]);

  useEffect(() => {
    if (!clientReady || items.length === 0) return;
    if (warmupRef.current.pdfLib) return;
    warmupRef.current.pdfLib = true;
    return runIdle(() => {
      void import("pdf-lib");
    }, 1200);
  }, [clientReady, items.length]);

  // 预览占用区域尺寸与导出保持一致：使用“旋转后真实像素尺寸”而非静态推导
  useEffect(() => {
    if (items.length === 0) {
      setRenderedDimsMap({});
      return;
    }
    let cancelled = false;
    void (async () => {
      const next: Record<string, RenderedDims> = {};
      for (const item of items) {
        const rotation = getEffectiveRotation(item);
        try {
          const img = await loadImage(item.info.url, "Failed to load image");
          const normalized = ((rotation % 360) + 360) % 360;
          const shouldSwap = normalized === 90 || normalized === 270;
          next[item.id] = {
            width: shouldSwap ? img.naturalHeight : img.naturalWidth,
            height: shouldSwap ? img.naturalWidth : img.naturalHeight,
            rotation,
          };
        } catch {
          const fallback = getRotatedDims(item, rotation);
          next[item.id] = { width: fallback.w, height: fallback.h, rotation };
        }
      }
      if (!cancelled) setRenderedDimsMap(next);
    })();
    return () => {
      cancelled = true;
    };
  }, [items]);

  // 仅在用户已选图后再加载拖拽排序（dnd-kit），降低首屏 JS
  useEffect(() => {
    if (!clientReady || items.length === 0) return;
    let cancelled = false;
    void import("./PdfDndGrid").then((mod) => {
      if (!cancelled) setPdfDndGrid(() => mod.PdfDndGrid);
    });
    return () => {
      cancelled = true;
    };
  }, [clientReady, items.length]);

  async function addFiles(files: File[]) {
    setError(null);
    try {
      const nextInfos = await Promise.all(
        files.map(async (file) => {
          const info = await fileToImageInfo(file);
          return { id: makeId(), file, info, rotation: 0 } satisfies PdfItem;
        }),
      );
      setItems((prev) => [...prev, ...nextInfos]);
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.imageReadFailed"));
    }
  }

  // 页面加载时检查是否有来自首页的文件数据
  useEffect(() => {
    if (!hasLoadedFromStorage.current) {
      hasLoadedFromStorage.current = true;
      const storedFiles = restoreFilesFromSessionStorage();
      if (storedFiles && storedFiles.length > 0) {
        void addFiles(storedFiles);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function removeItem(id: string) {
    setItems((prev) => {
      const target = prev.find((x) => x.id === id);
      if (target) revokeImageInfo(target.info);
      return prev.filter((x) => x.id !== id);
    });
  }

  function clearAll() {
    setItems((prev) => {
      for (const it of prev) revokeImageInfo(it.info);
      return [];
    });
  }

  function rotateItem(id: string) {
    setItems((prev) =>
      prev.map((it) =>
        it.id === id ? { ...it, rotation: (it.rotation + 90) % 360 } : it,
      ),
    );
  }

  function getEffectiveRotation(item: PdfItem) {
    return item.rotation % 360;
  }

  async function buildPdf() {
    if (items.length === 0 || isExporting) return;
    setError(null);
    setIsExporting(true);
    try {
      // 懒加载：只有导出时才加载 pdf-lib，减少首屏 JS 体积
      const { PDFDocument } = await import("pdf-lib");
      const pdfDoc = await PDFDocument.create();
      const marginPts = getMarginPts(margin);

      for (const item of items) {
        const rotation = getEffectiveRotation(item);
        const rendered = await renderRotatedImageBuffer(item, rotation);
        const pdfImage = await pdfDoc.embedPng(rendered.bytes);

        const base =
          pageSize === "a3"
            ? A3_SIZE
            : pageSize === "a4"
              ? A4_SIZE
              : { width: rendered.width, height: rendered.height };
        const pageWidth =
          pageSize === "auto"
            ? rendered.width + marginPts * 2
            : base.width;
        const pageHeight =
          pageSize === "auto"
            ? rendered.height + marginPts * 2
            : base.height;

        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const availableW = Math.max(0, pageWidth - marginPts * 2);
        const availableH = Math.max(0, pageHeight - marginPts * 2);
        const scale = Math.min(availableW / rendered.width, availableH / rendered.height);
        const drawW = rendered.width * scale;
        const drawH = rendered.height * scale;
        const x = (pageWidth - drawW) / 2;
        const y = (pageHeight - drawH) / 2;

        page.drawImage(pdfImage, { x, y, width: drawW, height: drawH });
        await new Promise<void>((r) => window.setTimeout(() => r(), 0));
      }

      const bytes = await pdfDoc.save();
      // pdf-lib 返回 Uint8Array，但在部分 TS lib 定义下会被推导为 ArrayBufferLike（含 SharedArrayBuffer）
      // 这里转换成标准 ArrayBuffer，避免 BlobPart 类型报错
      const arrayBuffer = bytes.buffer.slice(
        bytes.byteOffset,
        bytes.byteOffset + bytes.byteLength,
      );
      const blob = new Blob([arrayBuffer as BlobPart], { type: "application/pdf" });
      return { blob, filename: "images.pdf" };
    } catch (e) {
      setError(e instanceof Error ? e.message : t("error.exportFailed"));
      return;
    } finally {
      setIsExporting(false);
    }
  }

  return (
    <ImageToolLayout
      title={t("imagePdf.title")}
      onBackToHome={() => (window.location.href = "../index.html")}
      onReselect={items.length > 0 ? clearAll : undefined}
      secondaryActionLabel={items.length > 0 ? t("common.reselect") : undefined}
      primaryActionLabel={t('imagePdf.export')}
      primaryDisabled={items.length === 0 || isExporting}
      onPrimaryAction={items.length > 0 ? buildPdf : undefined}
      hasContent={items.length > 0}
      onFilesSelect={addFiles}
      acceptedTypes="image/jpeg,image/png,image/webp"
      uploadTexts={{
        buttonLabel: t('imagePdf.uploadButton'),
        description: t('imagePdf.uploadDesc'),
      }}
      centerPanel={
        clientReady ? (
          PdfDndGrid ? (
            <PdfDndGrid
              items={items.map((item) => {
                const rotation = getEffectiveRotation(item);
                const rendered = renderedDimsMap[item.id];
                const renderedForPreview =
                  rendered && rendered.rotation === rotation
                    ? { width: rendered.width, height: rendered.height }
                    : (() => {
                        const dims = getRotatedDims(item, rotation);
                        return { width: dims.w, height: dims.h };
                      })();
                const preview = getPreviewPaper(
                  pageSize,
                  margin,
                  renderedForPreview,
                );
                return {
                  id: item.id,
                  name: item.info.name,
                  url: item.info.url,
                  rotation,
                  preview,
                  onRotate: () => rotateItem(item.id),
                  onRemove: () => removeItem(item.id),
                } satisfies PdfGridItemView;
              })}
              onReorder={(activeId, overId) => {
                setItems((prev) => {
                  const oldIndex = prev.findIndex((it) => it.id === activeId);
                  const newIndex = prev.findIndex((it) => it.id === overId);
                  return arrayMove(prev, oldIndex, newIndex);
                });
              }}
            />
          ) : (
            <div
              class="grid gap-6 p-6"
              style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
            >
              {items.map((item, index) => {
                const rotation = getEffectiveRotation(item);
                const rendered = renderedDimsMap[item.id];
                const renderedForPreview =
                  rendered && rendered.rotation === rotation
                    ? { width: rendered.width, height: rendered.height }
                    : (() => {
                        const dims = getRotatedDims(item, rotation);
                        return { width: dims.w, height: dims.h };
                      })();
                const preview = getPreviewPaper(
                  pageSize,
                  margin,
                  renderedForPreview,
                );
                return (
                  <StaticCard
                    key={item.id}
                    item={item}
                    index={index}
                    preview={preview}
                    rotation={rotation}
                    onRotate={() => rotateItem(item.id)}
                    onRemove={() => removeItem(item.id)}
                  />
                );
              })}
            </div>
          )
        ) : (
          <div class="p-6 text-sm text-base-content/60">{t("imagePdf.loading")}</div>
        )
      }
      toolbarConfig={{
        showPreview: false,
        showReselect: true,
        showPrimary: true,
        showAddFiles: true,
        addFilesLabel: t("imagePdf.addImages"),
      }}
      processingConfig={{
        title: t("imagePdf.exporting"),
      }}
    >
      <div class="flex flex-col gap-5">
        <div class="flex flex-col gap-2">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">{t('imagePdf.pageSize')}</div>
          <select
            class="select select-bordered select-sm"
            value={pageSize}
            onChange={(e) => setPageSize(e.currentTarget.value as PageSizeOption)}
          >
            <option value="auto">{t('imagePdf.pageSize.auto')}</option>
            <option value="a4">{t('imagePdf.pageSize.a4')}</option>
            <option value="a3">{t('imagePdf.pageSize.a3')}</option>
          </select>
        </div>

        <div class="flex flex-col gap-2">
          <div class="text-sm font-semibold text-slate-900 dark:text-slate-100">{t("imagePdf.margin")}</div>
          <select
            class="select select-bordered select-sm"
            value={margin}
            onChange={(e) => setMargin(e.currentTarget.value as MarginOption)}
          >
            <option value="none">{t("imagePdf.margin.none")}</option>
            <option value="narrow">{t("imagePdf.margin.narrow")}</option>
            <option value="wide">{t("imagePdf.margin.wide")}</option>
          </select>
        </div>

        {error ? <div class="text-xs text-red-500 leading-relaxed">{error}</div> : null}
      </div>
    </ImageToolLayout>
  );
}








