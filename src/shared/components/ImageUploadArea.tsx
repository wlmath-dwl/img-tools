import { useState, useRef, useCallback } from "preact/hooks";
import { useI18n } from "../../i18n/context";

export type ImageUploadAreaTexts = {
  /** 按钮文案，默认「上传图片」 */
  buttonLabel?: string;
  /** 描述文案，不传则使用默认上传提示 */
  description?: string;
};

type ImageUploadAreaProps = {
  // 新接口：支持多选/批量
  onFilesSelect?: (files: File[]) => void;
  // 兼容旧接口：单图工具页仍可只传 onImageSelect
  onImageSelect?: (file: File) => void;
  acceptedTypes?: string;
  texts?: ImageUploadAreaTexts;
};

function isLikelyImageByName(name: string) {
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  return [
    "jpg",
    "jpeg",
    "png",
    "gif",
    "webp",
    "bmp",
    "svg",
    "avif",
    "heic",
    "heif",
  ].includes(ext);
}

function isImageFile(file: File) {
  return (
    file.type.startsWith("image/") ||
    (!file.type && isLikelyImageByName(file.name))
  );
}

function pickImageFiles(list: FileList | null | undefined): File[] {
  if (!list || list.length === 0) return [];
  const files: File[] = [];
  for (let i = 0; i < list.length; i += 1) {
    const f = list.item(i);
    if (f && isImageFile(f)) files.push(f);
  }
  return files;
}

async function pickImageFilesFromDataTransfer(
  dt: DataTransfer,
): Promise<File[]> {
  // 兜底：浏览器已展开文件夹时，files 通常会包含所有文件
  if (!dt.items || dt.items.length === 0) return pickImageFiles(dt.files);

  const hasEntryApi = Array.from(dt.items).some(
    (it) => typeof it.webkitGetAsEntry === "function",
  );
  if (!hasEntryApi) return pickImageFiles(dt.files);

  const out: File[] = [];

  async function walkEntry(entry: any): Promise<void> {
    if (!entry) return;
    if (entry.isFile) {
      await new Promise<void>((resolve) => {
        entry.file(
          (file: File) => {
            if (isImageFile(file)) out.push(file);
            resolve();
          },
          () => resolve(),
        );
      });
      return;
    }
    if (entry.isDirectory) {
      const reader = entry.createReader();
      // reader.readEntries 可能分批返回
      // eslint-disable-next-line no-constant-condition
      while (true) {
        const entries: any[] = await new Promise((resolve) =>
          reader.readEntries(resolve, () => resolve([])),
        );
        if (!entries || entries.length === 0) break;
        for (const child of entries) await walkEntry(child);
      }
    }
  }

  const roots = Array.from(dt.items)
    .map((it) => it.webkitGetAsEntry?.())
    .filter(Boolean);
  if (roots.length === 0) return pickImageFiles(dt.files);

  for (const e of roots) await walkEntry(e);
  return out.length > 0 ? out : pickImageFiles(dt.files);
}

// const DESC_DEFAULT =
"拖拽图片或文件夹到这里，或点击选择图片，支持 jpg/png/webp";

export function ImageUploadArea({
  onFilesSelect,
  onImageSelect,
  acceptedTypes = "image/*",
  texts,
}: ImageUploadAreaProps) {
  const { t } = useI18n();
  const [isDragOver, setIsDragOver] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const allowMultiple = true;
  const description = texts?.description ?? t('upload.dragDrop');
  const buttonLabel = texts?.buttonLabel ?? t('upload.button');

  const emitFiles = useCallback(
    (files: File[]) => {
      if (files.length === 0) return;
      // 优先走新接口；否则回退到旧接口（取第一张）
      if (onFilesSelect) onFilesSelect(files);
      else if (onImageSelect) onImageSelect(files[0]);
    },
    [onFilesSelect, onImageSelect],
  );

  const handleDrop = useCallback(
    (e: DragEvent) => {
      e.preventDefault();
      setIsDragOver(false);
      const dt = e.dataTransfer;
      if (!dt) return;
      void (async () => {
        const files = await pickImageFilesFromDataTransfer(dt);
        emitFiles(files);
      })();
    },
    [emitFiles, allowMultiple],
  );

  const handleDragOver = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(true);
  }, []);

  const handleDragLeave = useCallback((e: DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);
  }, []);

  const handleClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = (e: Event) => {
    const target = e.target as HTMLInputElement;
    const files = pickImageFiles(target.files);
    emitFiles(files);
    // 清空 value，允许重复选择同一文件也触发 change
    if (target) target.value = "";
  };

  return (
    <div
      role="button"
      tabIndex={0}
      aria-label={buttonLabel}
      class={`upload-area flex flex-col items-center justify-center rounded-2xl border-2 border-dashed px-8 py-12 md:py-16 cursor-pointer transition-all min-h-[140px] md:min-h-[160px] w-[90%] md:w-full md:max-w-2xl mx-auto focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 ${isDragOver
          ? "border-primary bg-primary/10 shadow-lg"
          : "border-slate-300 dark:border-slate-500 hover:border-primary hover:bg-primary/5 hover:shadow-md"
        }`}
      onDrop={handleDrop}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          handleClick();
        }
      }}
    >
      <button
        type="button"
        class="btn btn-primary btn-lg mb-10"
        onClick={(e) => {
          e.stopPropagation();
          fileInputRef.current?.click();
        }}
      >
        {buttonLabel}
      </button>
      <p class="text-sm text-center text-base-content/70">{description}</p>
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptedTypes}
        multiple={allowMultiple}
        class="hidden"
        onChange={handleFileChange}
      />
    </div>
  );
}


