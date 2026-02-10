import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { useI18n } from "../../i18n/context";
import { canvasToBlob, downloadBlob, type ImageInfo } from "../../shared/image";
import { ImageToolLayout } from "../../shared/components/ImageToolLayout";
import { type OutputType } from "../../shared/components/ExportSettingsDialog";
import { useImageItems } from "../../shared/useImageItems";
import { DownloadIcon } from "../../shared/icons/DownloadIcon";

function extByType(t: OutputType) {
  if (t === "image/png") return "png";
  if (t === "image/webp") return "webp";
  return "jpg";
}

function formatFromName(name: string): OutputType {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  if (ext === "png") return "image/png";
  if (ext === "webp") return "image/webp";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  return "image/jpeg";
}

function formatBytes(bytes: number) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "--";
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}

function formatPercent(v: number) {
  if (!Number.isFinite(v)) return "--";
  return `${v.toFixed(1)}%`;
}

function calcSizeRatioPercent(originalBytes: number, outputBytes: number) {
  if (originalBytes <= 0 || outputBytes <= 0) return null;
  return (outputBytes / originalBytes) * 100;
}

function calcSaveRatePercent(originalBytes: number, outputBytes: number) {
  const ratio = calcSizeRatioPercent(originalBytes, outputBytes);
  if (ratio === null) return null;
  // “节省率”定义为体积减少比例，范围 [0, 100]
  return Math.max(0, Math.min(100, 100 - ratio));
}

async function loadImage(url: string, errorMessage: string) {
  return await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(errorMessage));
    img.src = url;
  });
}

export function ImageCompressPage() {
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

  const [compressionQuality] = useState<number>(80);

  const exportCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const jobsRef = useRef<Record<string, CompressJob>>({});
  const processingRunIdRef = useRef(0);

  const [jobs, setJobs] = useState<Record<string, CompressJob>>({});
  jobsRef.current = jobs;

  function onReselect() {
    setError(null);
    clearAll();
    setJobs({});
  }

  async function drawToCanvas(
    canvas: HTMLCanvasElement,
    targetInfo: ImageInfo,
  ) {
    canvas.width = targetInfo.width;
    canvas.height = targetInfo.height;

    const img = await loadImage(targetInfo.url, t('error.imageLoadFailed'));
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error(t('error.canvasInitFailed'));
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  }

  async function exportOne(targetInfo: ImageInfo, format: OutputType) {
    const canvas = exportCanvasRef.current ?? document.createElement("canvas");
    exportCanvasRef.current = canvas;

    await drawToCanvas(canvas, targetInfo);

    const normalizedQuality = Math.max(
      0.1,
      Math.min(1, compressionQuality / 100),
    );
    const q = format === "image/png" ? 1 : normalizedQuality;
    const blob = await canvasToBlob(canvas, format, q);
    const ext = extByType(format);
    const name = targetInfo.name.replace(/\.[^.]+$/, "");
    return { blob, filename: `${name}-compressed.${ext}` };
  }

  function startProgress(id: string) {
    let progress = 5;
    const timer = window.setInterval(() => {
      progress = Math.min(90, progress + Math.random() * 8 + 2);
      setJob(id, { progress: Math.round(progress) });
    }, 120);
    return () => window.clearInterval(timer);
  }

  function setJob(id: string, patch: Partial<CompressJob>) {
    setJobs((prev) => {
      const base = prev[id] ?? { status: "pending", progress: 0 };
      return { ...prev, [id]: { ...base, ...patch } };
    });
  }

  function ensureJobRecords() {
    setJobs((prev) => {
      const next: Record<string, CompressJob> = {};
      for (const it of items) {
        next[it.id] = prev[it.id] ?? { status: "pending", progress: 0 };
      }
      return next;
    });
  }

  async function compressItem(it: { id: string; info: ImageInfo; file: File }) {
    const format = formatFromName(it.info.name);
    const payload = await exportOne(it.info, format);
    return { payload, format };
  }

  useEffect(() => {
    ensureJobRecords();
  }, [items]);

  useEffect(() => {
    if (items.length === 0) return;
    const runId = ++processingRunIdRef.current;
    let cancelled = false;

    const run = async () => {
      for (const it of items) {
        if (cancelled || runId !== processingRunIdRef.current) return;
        const current = jobsRef.current[it.id];
        if (current?.status === "done" || current?.status === "processing")
          continue;
        setJob(it.id, { status: "processing", progress: 5, error: undefined });
        const stop = startProgress(it.id);
        try {
          const res = await compressItem(it);
          if (cancelled || runId !== processingRunIdRef.current) return;
          stop();
          setJob(it.id, {
            status: "done",
            progress: 100,
            payload: res.payload,
            outputBytes: res.payload.blob.size,
            format: res.format,
          });
        } catch (e) {
          stop();
          setJob(it.id, {
            status: "error",
            progress: 0,
            error: e instanceof Error ? e.message : t('imageCompress.failed'),
          });
        }
      }
    };

    void run();
    return () => {
      cancelled = true;
    };
  }, [items]);

  const allDone = useMemo(() => {
    if (items.length === 0) return false;
    return items.every((it) => jobs[it.id]?.status === "done");
  }, [items, jobs]);

  // 全局汇总信息
  const totalOriginalBytes = useMemo(() => {
    return items.reduce((sum, it) => sum + it.file.size, 0);
  }, [items]);

  const totalOutputBytes = useMemo(() => {
    return items.reduce((sum, it) => {
      const job = jobs[it.id];
      return sum + (job?.outputBytes ?? 0);
    }, 0);
  }, [items, jobs]);

  const totalSaveRate = useMemo(() => {
    return calcSaveRatePercent(totalOriginalBytes, totalOutputBytes);
  }, [totalOriginalBytes, totalOutputBytes]);

  const totalSavedBytes = useMemo(() => {
    return totalOriginalBytes - totalOutputBytes;
  }, [totalOriginalBytes, totalOutputBytes]);

  async function onExport() {
    if (!info) return;
    const job = jobs[activeId];
    if (job?.payload) return job.payload;
  }

  async function buildAllExports() {
    if (!allDone) return;
    const payloads = items
      .map((it) => jobs[it.id]?.payload)
      .filter(Boolean) as { blob: Blob; filename: string }[];
    return payloads.length > 0 ? payloads : undefined;
  }

  function handleDownloadOne(id: string) {
    const job = jobs[id];
    if (job?.payload) {
      downloadBlob(job.payload.blob, job.payload.filename);
    }
  }

  return (
    <ImageToolLayout
      title={t("imageCompress.title")}
      onBackToHome={() => (window.location.href = "../index.html")}
      onReselect={onReselect}
      secondaryActionLabel={t("common.reselect")}
      onPrimaryAction={onExport}
      onPrimaryActionAll={buildAllExports}
      primaryActionLabel={t("imageCompress.download")}
      info={info}
      hasContent={items.length > 0}
      showRightPanel={false}
      showThumbStrip={false}
      toolbarConfig={{ showPreview: false }}
      primaryDisabled={!allDone}
      centerPanel={
        <div class="w-full h-full flex flex-col overflow-hidden">
          <div class="flex-1 overflow-y-auto p-6">
            {/* 全局汇总信息 */}
            {allDone && items.length > 0 && totalSaveRate !== null ? (
              <div class="mb-4 p-4 rounded-xl bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200/50 dark:border-emerald-800/50">
                <div class="text-sm text-slate-700 dark:text-slate-300">
                  {t('imageCompress.summary', { 
                    count: items.length, 
                    saved: formatBytes(totalSavedBytes), 
                    rate: formatPercent(totalSaveRate) 
                  })}
                </div>
              </div>
            ) : null}

            <div class="flex flex-col gap-4">
              {items.map((it) => {
                const job = jobs[it.id];
                const progress = job?.progress ?? 0;
                const isDone = job?.status === "done";
                const isError = job?.status === "error";
                const isProcessing = job?.status === "processing";
                const outputBytes = job?.outputBytes ?? 0;
                const saveRate = calcSaveRatePercent(it.file.size, outputBytes);
                return (
                  <div class="flex items-center gap-4 p-4 rounded-2xl border border-slate-200/70 dark:border-slate-700/70 bg-white dark:bg-slate-900/80 hover:shadow-lg hover:border-slate-300 dark:hover:border-slate-600 transition-all">
                    <div class="w-14 h-14 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-800 shrink-0 shadow-sm">
                      <img
                        src={it.info.url}
                        alt={it.info.name}
                        class="w-full h-full object-cover"
                      />
                    </div>
                    <div class="flex-1 min-w-0">
                      {/* 文件名 */}
                      <div class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate mb-2">
                        {it.info.name}
                      </div>

                      {/* 体积变化（数字加深） */}
                      {isDone ? (
                        <div class="text-sm text-slate-600 dark:text-slate-400">
                          {t('imageCompress.original')}{" "}
                          <span class="font-semibold text-slate-900 dark:text-slate-100">
                            {formatBytes(it.file.size)}
                          </span>
                          {" → "}
                          <span class="font-semibold text-slate-900 dark:text-slate-100">
                            {formatBytes(outputBytes)}
                          </span>
                          {saveRate !== null ? (
                            <span class="ml-2 font-semibold text-emerald-600 dark:text-emerald-400">
                              {t('imageCompress.saved', { percent: formatPercent(saveRate) })}
                            </span>
                          ) : null}
                        </div>
                      ) : null}

                      {/* 压缩中/错误状态 */}
                      {!isDone ? (
                        <>
                          <div class="mt-2 h-1.5 rounded-full bg-slate-200/80 dark:bg-slate-700/80 overflow-hidden">
                            <div
                              class={`h-full transition-all ${isError ? "bg-red-500" : "bg-blue-500"}`}
                              style={{ width: `${progress}%` }}
                            />
                          </div>
                          <div class="mt-1 text-xs text-slate-500 dark:text-slate-400">
                            {isProcessing
                              ? t('imageCompress.compressing', { progress })
                              : isError
                                ? (job?.error ?? t('imageCompress.failed'))
                                : t('imageCompress.waiting')}
                          </div>
                        </>
                      ) : null}
                    </div>

                    {/* 下载按钮放右侧 */}
                    {isDone ? (
                      <button
                        type="button"
                        class="w-9 h-9 flex items-center justify-center rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-slate-200 dark:hover:bg-slate-700 transition-colors shrink-0"
                        onClick={() => handleDownloadOne(it.id)}
                        title={t('imageCompress.download')}
                      >
                        <DownloadIcon size={18} color="currentColor" />
                      </button>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {error ? (
              <div class="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </div>
            ) : null}
            <canvas ref={exportCanvasRef} class="hidden" />
          </div>
        </div>
      }
      onFilesSelect={async (files) => {
        setError(null);
        try {
          await addFiles(files);
        } catch (e) {
          setError(
            e instanceof Error ? e.message : t("imageCompress.selectImage"),
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
            }
          : null
      }
    >
      {null}
    </ImageToolLayout>
  );
}

type CompressJob = {
  status: "pending" | "processing" | "done" | "error";
  progress: number;
  outputBytes?: number;
  payload?: { blob: Blob; filename: string };
  error?: string;
  format?: OutputType;
};








