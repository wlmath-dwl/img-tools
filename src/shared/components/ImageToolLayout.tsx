import { type ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { Toolbar } from "./Toolbar";
import { ImageUploadArea, type ImageUploadAreaTexts } from "./ImageUploadArea";
import {
  CanvasImageViewer,
  type CanvasImageViewerApi,
  type CanvasImageViewerViewState,
} from "./CanvasImageViewer";
import { CanvasToolbar } from "./CanvasToolbar.tsx";
import { ImageViewer } from "./ImageViewer";
import { ProcessingOverlay } from "./ProcessingOverlay";
import { ImageThumbStrip, type ImageThumbItem } from "./ImageThumbStrip";
import { PrivacyShieldIcon } from "../icons";
import { downloadBlob } from "../image";

type ToolbarConfig = {
  // 预览按钮默认开启；某些页面（如格式转换）需要关闭
  showPreview?: boolean;
  // 允许强制隐藏重选/主按钮（即使传了 label/handler）
  showReselect?: boolean;
  showPrimary?: boolean;
  // 多图场景的“添加图片”按钮控制
  showAddFiles?: boolean;
  addFilesLabel?: string;
  // 预览按钮文案（默认使用 i18n：common.preview）
  previewLabel?: string;
};

type ToolImageInfo = {
  url: string;
  width: number;
  height: number;
  name: string;
};

type ToolImageItem = {
  id: string;
  info: ToolImageInfo;
};

type PreviewBlobResult = {
  blob: Blob;
  width: number;
  height: number;
};

type DownloadPayload = {
  blob: Blob;
  filename: string;
};

type ImageToolLayoutProps = {
  title: string;
  onBackToHome: () => void;
  onReselect?: () => void;
  secondaryActionLabel?: string;
  primaryDisabled?: boolean;
  onPrimaryAction?: () =>
    | void
    | DownloadPayload
    | DownloadPayload[]
    | Promise<void | DownloadPayload | DownloadPayload[]>;
  onPrimaryActionAll?: () =>
    | void
    | DownloadPayload
    | DownloadPayload[]
    | Promise<void | DownloadPayload | DownloadPayload[]>;
  primaryActionLabel?: string;
  primaryActionLabelAll?: string;
  rightInfo?: ComponentChildren;
  children: ComponentChildren;
  canvasOverlay?:
    | ComponentChildren
    | ((api: CanvasImageViewerApi) => ComponentChildren);
  viewerFilter?: string;
  onViewStateChange?: (state: CanvasImageViewerViewState | null) => void;
  info?: ToolImageInfo | null;
  // 上传配置：自定义空态文案
  onImageSelect?: (file: File) => void;
  onFilesSelect?: (files: File[]) => void;
  acceptedTypes?: string;
  uploadTexts?: ImageUploadAreaTexts;

  // 自定义左侧图片容器（默认使用 CanvasImageViewer 单图预览）
  leftPanel?: ComponentChildren;
  // 自定义中间图片区（完全替换画布区域）
  centerPanel?: ComponentChildren;
  /**
   * 多图（推荐）：传入 items 与 activeId，模板会自动：
   * - 派生当前 info（用于画布与预览按钮）
   * - 在画布下方显示可横向滑动的缩略条
   */
  images?: {
    items: ToolImageItem[];
    activeId: string;
    onSelect: (id: string) => void;
    onRemove?: (id: string) => void;
    extraRight?: ComponentChildren;
    /** 可选：把当前配置应用到所有图片（由页面实现具体逻辑） */
    onApplyToAll?: () => void;
  } | null;
  /** 可选：画布下方缩略图条（用于多图场景） */
  thumbStrip?: {
    items: ImageThumbItem[];
    activeId: string;
    onSelect: (id: string) => void;
    onRemove?: (id: string) => void;
    extraRight?: ComponentChildren;
  } | null;
  // 强制决定“是否已选择图片/可显示布局”。默认：Boolean(info)
  hasContent?: boolean;
  // 可选：隐藏右侧配置区（含移动端抽屉与配置按钮）
  showRightPanel?: boolean;
  // 可选：隐藏底部缩略图条
  showThumbStrip?: boolean;
  // 顶部按钮可配置
  toolbarConfig?: ToolbarConfig;

  /**
   * 可选：生成“处理后预览图”（用于预览弹窗）。
   * - 顶部/底部的“预览”按钮都会走同一弹窗，因此这里统一注入。
   * - 返回 Blob，布局层负责创建/回收 objectURL，避免页面泄漏。
   */
  getPreviewBlob?: () => Promise<PreviewBlobResult>;

  /** 可选：点击“下载/导出”时展示“处理中”弹层 */
  processingConfig?: {
    /** 默认 true */
    enabled?: boolean;
    /**
     * 进度条时间控制模式：
     * - noAd：追求“极致效率”口碑（总时长 0.8s - 1.2s）
     * - ad：追求曝光（总时长 2.5s - 4.0s，三段式变速）
     */
    timingMode?: "noAd" | "ad";
    /** 自定义总时长范围（ms），不传则使用 timingMode 默认区间 */
    durationRangeMs?: [number, number];
    /** 最小展示时长（ms），不传则随 timingMode 随机取区间内值 */
    minDurationMs?: number;
    /** 处理中标题：不传则根据主按钮文案自动生成 */
    title?: string;
    /** 动态状态文案（轮播） */
    phrases?: string[];
    /** 内容区（互荐/广告占位），不传则使用默认互荐 */
    content?: ComponentChildren;
    /** 内容区最小高度 */
    contentMinHeight?: number;
  };
};

export function ImageToolLayout({
  title,
  onBackToHome,
  onReselect,
  secondaryActionLabel,
  primaryDisabled,
  onPrimaryAction,
  onPrimaryActionAll,
  primaryActionLabel,
  primaryActionLabelAll,
  rightInfo,
  children,
  canvasOverlay,
  viewerFilter,
  onViewStateChange,
  info,
  onImageSelect,
  onFilesSelect,
  acceptedTypes = "image/*",
  uploadTexts,
  leftPanel,
  centerPanel,
  images,
  thumbStrip,
  hasContent,
  showRightPanel = true,
  showThumbStrip = true,
  toolbarConfig,
  getPreviewBlob,
  processingConfig,
}: ImageToolLayoutProps) {
  const { t } = useI18n();

  // 移动端底部抽屉开关
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [viewerApi, setViewerApi] = useState<CanvasImageViewerApi | null>(null);
  const addFilesInputRef = useRef<HTMLInputElement | null>(null);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [isApplyAllOpen, setIsApplyAllOpen] = useState(false);

  // 预览弹窗：可展示“处理后结果”（由页面生成 blob）
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [previewSize, setPreviewSize] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);

  // “处理中”弹层：用于下载/导出等耗时操作
  const [isProcessingOpen, setIsProcessingOpen] = useState(false);
  const [processingStatus, setProcessingStatus] = useState<
    "processing" | "success" | "error"
  >("processing");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingError, setProcessingError] = useState<string | null>(null);
  const processingRunIdRef = useRef(0);
  const [downloadPayloads, setDownloadPayloads] = useState<
    DownloadPayload[] | null
  >(null);
  const [isBulkAction, setIsBulkAction] = useState(false);

  function runIdle(cb: () => void, fallbackDelayMs = 600) {
    if (typeof window === "undefined") return () => {};
    const ric = (window as any).requestIdleCallback as
      | undefined
      | ((fn: () => void, opts?: { timeout?: number }) => number);
    const cic = (window as any).cancelIdleCallback as
      | undefined
      | ((id: number) => void);
    if (typeof ric === "function") {
      const id = ric(cb, { timeout: 2000 });
      return () => cic?.(id);
    }
    const id = window.setTimeout(() => cb(), fallbackDelayMs);
    return () => window.clearTimeout(id);
  }

  // 当“下载全部(zip)”按钮即将可用时，空闲预取 jszip，降低点击后的等待
  useEffect(() => {
    if (!isProcessingOpen) return;
    if (processingStatus !== "success") return;
    if (!isBulkAction) return;
    if (!downloadPayloads || downloadPayloads.length <= 1) return;
    return runIdle(() => {
      void import("jszip");
    }, 500);
  }, [downloadPayloads, isBulkAction, isProcessingOpen, processingStatus]);

  function isDownloadPayload(x: unknown): x is DownloadPayload {
    if (!x || typeof x !== "object") return false;
    const anyX = x as { blob?: unknown; filename?: unknown };
    return anyX.blob instanceof Blob && typeof anyX.filename === "string";
  }

  // 只渲染一份 children：避免桌面/移动端各渲染一份导致 ref/点击外部判断混乱
  const [isLgUp, setIsLgUp] = useState(false);
  useEffect(() => {
    // Tailwind `lg` 断点：min-width 1024px
    if (typeof window === "undefined" || !window.matchMedia) return;
    const mql = window.matchMedia("(min-width: 1024px)");
    const update = () => {
      setIsLgUp(mql.matches);
      // 切到桌面时关闭抽屉，避免状态残留
      if (mql.matches) setIsDrawerOpen(false);
    };
    update();
    // 兼容旧浏览器 API
    if (typeof mql.addEventListener === "function") {
      mql.addEventListener("change", update);
      return () => mql.removeEventListener("change", update);
    }
    // eslint-disable-next-line deprecation/deprecation
    mql.addListener(update);
    // eslint-disable-next-line deprecation/deprecation
    return () => mql.removeListener(update);
  }, []);

  const derivedActive = images
    ? (images.items.find((x) => x.id === images.activeId) ??
      images.items[0] ??
      null)
    : null;
  // 仅当未显式传入 info（undefined）时，才从 images 派生；若传入 null 表示强制无图态
  const effectiveInfo =
    info !== undefined ? info : (derivedActive?.info ?? null);
  const ready = hasContent ?? Boolean(effectiveInfo);
  const showPreview = toolbarConfig?.showPreview ?? true;
  const showReselect = toolbarConfig?.showReselect ?? true;
  const showPrimary = toolbarConfig?.showPrimary ?? true;

  const processingEnabled = processingConfig?.enabled ?? true;
  const processingTimingMode = processingConfig?.timingMode ?? "noAd";
  const processingDurationRangeMs =
    processingConfig?.durationRangeMs ??
    (processingTimingMode === "ad" ? [2500, 4000] : [800, 1200]);
  const processingPlannedTotalMsRef = useRef<number>(0);
  const processingMinDurationMs = processingConfig?.minDurationMs;

  // “处理中”期间：进度条模拟（上限停在 97，完成再补满）
  useEffect(() => {
    if (!isProcessingOpen) return;
    if (processingStatus !== "processing") return;

    const startAt = performance.now();
    const totalMs = Math.max(1, processingPlannedTotalMsRef.current || 1000);
    setProcessingProgress(0);

    const tick = () => {
      const elapsed = performance.now() - startAt;
      const t = Math.max(0, elapsed);

      // 线性匀速：根据预估总时长均匀走完；处理未完成前最多到 97
      const ratio = Math.min(1, t / totalMs);
      const target = 97 * ratio;

      setProcessingProgress((prev) => {
        // 只增不减，且上限 97
        // 注意：完成时会把 progress 设为 100。此处避免 interval 的最后一次 tick 把 100 误压回 97。
        if (prev >= 100) return prev;
        return Math.min(97, Math.max(prev, target));
      });
    };

    const timer = window.setInterval(tick, 50);
    tick();

    return () => {
      window.clearInterval(timer);
    };
  }, [isProcessingOpen, processingStatus]);

  const defaultProcessingContent = useMemo(() => {
    return (
      <div class="h-full flex flex-col items-center justify-center text-center px-2">
        <div class="w-16 h-16 md:w-20 md:h-20 rounded-2xl bg-slate-900/5 dark:bg-white/10 flex items-center justify-center">
          <PrivacyShieldIcon size={44} class="text-slate-900 dark:text-white" />
        </div>
        <div class="mt-4 text-xl md:text-2xl font-bold text-slate-900 dark:text-white">
          {t("layout.privacyTitle")}
        </div>
        <div class="mt-3 text-sm leading-relaxed text-slate-600 dark:text-white/70 max-w-[520px]">
          {t("layout.privacyDesc")}
        </div>
      </div>
    );
  }, [t]);

  async function handlePrimaryAction(
    action?: () =>
      | void
      | DownloadPayload
      | DownloadPayload[]
      | Promise<void | DownloadPayload | DownloadPayload[]>,
    isBulk = false,
  ) {
    if (!action) return;
    setIsBulkAction(isBulk);
    if (!processingEnabled) {
      await Promise.resolve(action());
      return;
    }

    const runId = (processingRunIdRef.current += 1);
    const startedAt = performance.now();
    setProcessingError(null);
    setDownloadPayloads(null);
    setProcessingStatus("processing");
    // 为本次弹层固定一个“计划总时长”，供进度曲线与最小展示时长共用
    const plannedTotalMs =
      processingMinDurationMs ??
      Math.round(
        processingDurationRangeMs[0] +
          Math.random() *
            Math.max(
              0,
              processingDurationRangeMs[1] - processingDurationRangeMs[0],
            ),
      );
    processingPlannedTotalMsRef.current = plannedTotalMs;
    setIsProcessingOpen(true);

    try {
      const res = await Promise.resolve(action());
      const elapsed = performance.now() - startedAt;
      const remain = Math.max(
        0,
        (processingPlannedTotalMsRef.current || plannedTotalMs) - elapsed,
      );
      if (remain > 0) await new Promise((r) => setTimeout(r, remain));
      if (processingRunIdRef.current !== runId) return;

      // 若页面返回了 Blob 与文件名，则认为“已导出到内存”，等待用户点击弹层按钮才真正下载
      if (Array.isArray(res) && res.every(isDownloadPayload)) {
        setDownloadPayloads(res);
      } else if (isDownloadPayload(res)) {
        setDownloadPayloads([res]);
      } else {
        setDownloadPayloads(null);
      }

      setProcessingProgress(100);
      setProcessingStatus("success");
    } catch (e) {
      if (processingRunIdRef.current !== runId) return;
      setProcessingError(e instanceof Error ? e.message : "处理失败");
      setProcessingStatus("error");
    }
  }

  // 预览弹窗：打开时生成一次处理后预览；关闭时回收 objectURL
  useEffect(() => {
    if (!isPreviewOpen) {
      setPreviewError(null);
      setPreviewLoading(false);
      setPreviewSize(null);
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev);
        return null;
      });
      return;
    }

    if (!effectiveInfo) return;
    if (!getPreviewBlob) return;

    let cancelled = false;
    setPreviewError(null);
    setPreviewLoading(true);

    void (async () => {
      try {
        const res = await getPreviewBlob();
        if (cancelled) return;
        const url = URL.createObjectURL(res.blob);
        setPreviewUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return url;
        });
        setPreviewSize({ width: res.width, height: res.height });
      } catch (e) {
        if (cancelled) return;
        setPreviewError(e instanceof Error ? e.message : "预览生成失败");
      } finally {
        if (!cancelled) setPreviewLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [effectiveInfo, getPreviewBlob, isPreviewOpen]);
  const effectiveThumbStrip = showThumbStrip
    ? (thumbStrip ??
      (images
        ? {
            items: images.items.map(
              (it) =>
                ({
                  id: it.id,
                  url: it.info.url,
                  name: it.info.name,
                }) satisfies ImageThumbItem,
            ),
            activeId: images.activeId,
            onSelect: images.onSelect,
            onRemove: images.onRemove,
            extraRight: images.extraRight,
          }
        : null))
    : null;

  const showApplyToAll = (images?.items.length ?? 0) > 1;
  const canApplyToAll = Boolean(images?.onApplyToAll) && showApplyToAll;
  const totalImages =
    images?.items.length ?? effectiveThumbStrip?.items.length ?? 0;
  const isMulti = totalImages > 1;
  const canBulkDownload = Boolean(onPrimaryActionAll);
  const topPrimaryLabel = primaryActionLabel ?? t("common.download");
  const shouldUsePreview = Boolean(getPreviewBlob);
  const previewSource = shouldUsePreview
    ? (previewUrl ?? (previewError ? (effectiveInfo?.url ?? null) : null))
    : (effectiveInfo?.url ?? null);
  const previewWidth = shouldUsePreview
    ? previewUrl
      ? previewSize?.width
      : previewError
        ? effectiveInfo?.width
        : undefined
    : effectiveInfo?.width;
  const previewHeight = shouldUsePreview
    ? previewUrl
      ? previewSize?.height
      : previewError
        ? effectiveInfo?.height
        : undefined
    : effectiveInfo?.height;

  return (
    <div class="flex flex-col min-h-screen h-screen overflow-hidden m-0">
      <div class="bg-white dark:bg-slate-900 shrink-0">
        <Toolbar
          title={title}
          onBackToHome={onBackToHome}
          onPreview={
            ready && showPreview && effectiveInfo && !isMulti
              ? () => setIsPreviewOpen(true)
              : undefined
          }
          previewActionLabel={
            ready && showPreview && effectiveInfo && !isMulti
              ? (toolbarConfig?.previewLabel ?? t("common.preview"))
              : undefined
          }
          onReselect={
            ready && showReselect && !isMulti ? onReselect : undefined
          }
          secondaryActionLabel={
            ready && showReselect && !isMulti ? secondaryActionLabel : undefined
          }
          onAddFiles={
            ready && onFilesSelect && (isMulti || toolbarConfig?.showAddFiles)
              ? () => addFilesInputRef.current?.click()
              : undefined
          }
          addFilesLabel={
            ready && (isMulti || toolbarConfig?.showAddFiles)
              ? (toolbarConfig?.addFilesLabel ?? t("layout.addImages"))
              : undefined
          }
          primaryActionLabel={
            ready && showPrimary ? topPrimaryLabel : undefined
          }
          primaryDisabled={ready && showPrimary ? primaryDisabled : undefined}
          onPrimaryAction={
            ready && showPrimary
              ? () => {
                  if (isMulti && canBulkDownload && onPrimaryActionAll) {
                    void handlePrimaryAction(onPrimaryActionAll, true);
                  } else if (onPrimaryAction) {
                    void handlePrimaryAction(onPrimaryAction, false);
                  }
                }
              : undefined
          }
          rightInfo={ready ? rightInfo : undefined}
        />
        <input
          ref={addFilesInputRef}
          type="file"
          accept={acceptedTypes}
          multiple
          class="hidden"
          onChange={(e) => {
            const input = e.currentTarget;
            const files = Array.from(input.files || []);
            if (files.length > 0 && onFilesSelect) {
              void onFilesSelect(files);
            }
            input.value = "";
          }}
        />
      </div>

      <div class="flex-1 w-full flex flex-col min-h-0 overflow-hidden">
        {!ready ? (
          // 未上传图片时显示上传区域
          <div class="flex flex-col gap-6 items-center justify-center flex-1 min-h-0">
            <ImageUploadArea
              onImageSelect={onImageSelect}
              onFilesSelect={onFilesSelect}
              acceptedTypes={acceptedTypes}
              texts={uploadTexts}
            />
          </div>
        ) : (
          // 已上传图片时显示左右两列布局
          <div class="flex flex-1 min-h-0 overflow-hidden">
            <div class="flex-1 min-w-0 bg-gray-100 dark:bg-gray-800 overflow-hidden relative h-full flex flex-col">
              <div class="flex-1 min-h-0 w-full overflow-hidden relative flex items-center justify-center">
                {centerPanel ? (
                  <div class="w-full h-full overflow-hidden relative">
                    {centerPanel}
                  </div>
                ) : leftPanel ? (
                  <div class="w-full h-full overflow-hidden relative">
                    {leftPanel}
                  </div>
                ) : effectiveInfo ? (
                  <>
                    <CanvasImageViewer
                      imageUrl={effectiveInfo.url}
                      imageWidth={effectiveInfo.width}
                      imageHeight={effectiveInfo.height}
                      onApi={setViewerApi}
                      onViewStateChange={onViewStateChange}
                      filter={viewerFilter}
                      overlay={
                        canvasOverlay
                          ? typeof canvasOverlay === "function"
                            ? viewerApi
                              ? canvasOverlay(viewerApi)
                              : null
                            : canvasOverlay
                          : null
                      }
                    />

                    {/* 画布附近的即时操作（缩放/旋转/适配/重置） */}
                    {viewerApi ? (
                      <div class="absolute top-3 left-3 z-10">
                        <CanvasToolbar api={viewerApi} />
                      </div>
                    ) : null}
                  </>
                ) : null}

                {/* 小屏：配置按钮（放在画布区，避免压住底部缩略条） */}
                {!isLgUp && showRightPanel ? (
                  <button
                    type="button"
                    class="absolute right-3 bottom-3 z-10 px-3 py-2 rounded-full bg-white/90 dark:bg-slate-900/90 text-slate-900 dark:text-slate-100 shadow border border-slate-200/60 dark:border-slate-700/60"
                    onClick={() => setIsDrawerOpen(true)}
                  >
                    {t("layout.config")}
                  </button>
                ) : null}
              </div>

              {/* 底部操作栏：当前图片相关操作（多图/缩略条场景） */}
              {showThumbStrip &&
              effectiveThumbStrip &&
              effectiveThumbStrip.items.length > 1 ? (
                <div class="shrink-0 px-3 py-2 bg-white/70 dark:bg-slate-900/70 backdrop-blur border-t border-slate-200/70 dark:border-slate-700/70">
                  <div class="flex items-center gap-2 flex-wrap">
                    <button
                      type="button"
                      class="btn btn-xs"
                      disabled={!showPreview || !effectiveInfo}
                      onClick={() => setIsPreviewOpen(true)}
                    >
                      {toolbarConfig?.previewLabel ?? t("common.preview")}
                    </button>
                    <button
                      type="button"
                      class="btn btn-xs"
                      disabled={!images?.onRemove || !images?.activeId}
                      onClick={() => {
                        if (images?.onRemove && images.activeId)
                          images.onRemove(images.activeId);
                      }}
                    >
                      {t("common.delete")}
                    </button>
                  </div>
                </div>
              ) : null}

              {showThumbStrip &&
              effectiveThumbStrip &&
              effectiveThumbStrip.items.length > 1 ? (
                <div class="shrink-0">
                  <ImageThumbStrip
                    items={effectiveThumbStrip.items}
                    activeId={effectiveThumbStrip.activeId}
                    onSelect={effectiveThumbStrip.onSelect}
                    onRemove={effectiveThumbStrip.onRemove}
                    extraRight={effectiveThumbStrip.extraRight}
                  />
                </div>
              ) : null}
            </div>

            {/* 桌面端：固定右侧参数区 */}
            {isLgUp && showRightPanel ? (
              <div class="flex flex-col w-80 border-l border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 h-full">
                <div class="flex-1 min-h-0 overflow-y-auto p-4">{children}</div>
                {showApplyToAll ? (
                  <div class="shrink-0 p-4 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      class="btn btn-primary btn-md btn-block"
                      disabled={!canApplyToAll}
                      title={
                        !canApplyToAll
                          ? t("layout.applyToAllNotImplemented")
                          : undefined
                      }
                      onClick={() => canApplyToAll && setIsApplyAllOpen(true)}
                    >
                      {t("common.applyToAll")}
                    </button>
                  </div>
                ) : null}
              </div>
            ) : null}
          </div>
        )}
      </div>

      {/* 移动端：底部抽屉参数区 */}
      {ready && showRightPanel && !isLgUp && isDrawerOpen && (
        <div>
          <div class="fixed inset-0 z-50" aria-hidden={!isDrawerOpen}>
            <div
              class="absolute inset-0 bg-black/40"
              onClick={() => setIsDrawerOpen(false)}
            />
            <div class="absolute inset-x-0 bottom-0 bg-white dark:bg-slate-900 rounded-t-2xl max-h-[75vh] overflow-y-auto border-t border-slate-200 dark:border-slate-700">
              <div class="flex items-center justify-between px-4 h-12 border-b border-slate-200 dark:border-slate-700">
                <div class="text-sm font-medium text-slate-900 dark:text-slate-100">
                  {t("layout.config")}
                </div>
                <button
                  type="button"
                  class="text-sm text-slate-500 hover:text-slate-900 dark:text-slate-400 dark:hover:text-slate-100"
                  onClick={() => setIsDrawerOpen(false)}
                >
                  {t("common.close")}
                </button>
              </div>
              <div class="p-4 flex flex-col gap-4">
                {children}
                {showApplyToAll ? (
                  <div class="pt-3 border-t border-slate-200 dark:border-slate-700">
                    <button
                      type="button"
                      class="btn btn-primary btn-md btn-block"
                      disabled={!canApplyToAll}
                      title={
                        !canApplyToAll
                          ? t("layout.applyToAllNotImplemented")
                          : undefined
                      }
                      onClick={() => canApplyToAll && setIsApplyAllOpen(true)}
                    >
                      {t("common.applyToAll")}
                    </button>
                  </div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}

      <dialog class={`modal ${isApplyAllOpen ? "modal-open" : ""}`}>
        <div class="modal-box">
          <h3 class="font-bold text-lg">{t("common.applyToAll")}</h3>
          <div class="py-4 text-sm text-slate-700 dark:text-slate-200">
            {t("common.applyToAllConfirm")}
          </div>
          <div class="modal-action">
            <button
              type="button"
              class="btn btn-outline btn-sm"
              onClick={() => setIsApplyAllOpen(false)}
            >
              {t("common.cancel")}
            </button>
            <button
              type="button"
              class="btn btn-primary btn-sm"
              onClick={() => {
                setIsApplyAllOpen(false);
                images?.onApplyToAll?.();
              }}
            >
              {t("common.confirm")}
            </button>
          </div>
        </div>
        <form method="dialog" class="modal-backdrop">
          <button type="button" onClick={() => setIsApplyAllOpen(false)}>
            close
          </button>
        </form>
      </dialog>

      {/* 预览：全屏蒙层图片查看器（替代 Dialog 内容） */}
      {effectiveInfo ? (
        <ImageViewer
          isOpen={isPreviewOpen}
          onClose={() => setIsPreviewOpen(false)}
          src={previewSource}
          width={previewWidth}
          height={previewHeight}
          alt={t("common.preview")}
          loading={
            shouldUsePreview && previewLoading && !previewUrl && !previewError
          }
        />
      ) : null}

      <ProcessingOverlay
        isOpen={isProcessingOpen}
        title={
          processingConfig?.title ??
          (processingStatus === "success"
            ? t("layout.completed")
            : processingStatus === "error"
              ? t("layout.failed")
              : t("layout.exportingImage"))
        }
        progress={processingProgress}
        status={processingStatus}
        errorText={processingError ?? undefined}
        content={processingConfig?.content ?? defaultProcessingContent}
        contentMinHeight={processingConfig?.contentMinHeight ?? 280}
        onCancel={() => {
          // 关闭弹层不代表中断计算：这里只做 UI 关闭
          setIsProcessingOpen(false);
          processingRunIdRef.current += 1;
          setDownloadPayloads(null);
          setIsBulkAction(false);
          processingPlannedTotalMsRef.current = 0;
          // 重置：确保下次打开从 0% 开始走
          setProcessingProgress(0);
          setProcessingStatus("processing");
          setProcessingError(null);
        }}
        primaryActionLabel={
          isBulkAction
            ? (primaryActionLabelAll ?? t("layout.downloadAll"))
            : (primaryActionLabel ??
              (downloadPayloads && downloadPayloads.length > 1
                ? t("layout.downloadAll")
                : t("layout.download")))
        }
        onPrimaryAction={async () => {
          if (downloadPayloads && downloadPayloads.length > 0) {
            if (isBulkAction && downloadPayloads.length > 1) {
              // 懒加载：只在「下载全部」时才加载 jszip，减少首屏 JS 体积
              const { default: JSZip } = await import("jszip");
              const zip = new JSZip();
              const nameCounts = new Map<string, number>();
              for (const it of downloadPayloads) {
                const base = it.filename || "image";
                const count = nameCounts.get(base) ?? 0;
                nameCounts.set(base, count + 1);
                const filename =
                  count > 0
                    ? base.replace(/(\.[^.]*)?$/, `(${count + 1})$1`)
                    : base;
                zip.file(filename, it.blob);
              }
              const zipBlob = await zip.generateAsync({ type: "blob" });
              const safeTitle = title.replace(/\s+/g, "-") || "images";
              downloadBlob(zipBlob, `${safeTitle}-all.zip`);
            } else {
              // 点击弹层下载时才真正触发浏览器下载
              for (const it of downloadPayloads) {
                downloadBlob(it.blob, it.filename);
                // 让出主线程，避免批量下载时卡顿
                await new Promise<void>((r) => window.setTimeout(() => r(), 0));
              }
            }
          }
          setIsProcessingOpen(false);
          setDownloadPayloads(null);
          setIsBulkAction(false);
          processingPlannedTotalMsRef.current = 0;
          // 重置：确保下次打开从 0% 开始走
          setProcessingProgress(0);
          setProcessingStatus("processing");
          setProcessingError(null);
        }}
      />
    </div>
  );
}
