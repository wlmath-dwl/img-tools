import {
  DndContext,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
  type DragEndEvent,
} from "@dnd-kit/core";
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CloseIcon, RotateRight90Icon } from "../../shared/icons";
import { useI18n } from "../../i18n/context";

export type PdfGridItemView = {
  id: string;
  name: string;
  url: string;
  rotation: number;
  preview: {
    widthPx: number;
    aspectRatio: string;
    paddingPx: number;
    drawWidthPx: number;
    drawHeightPx: number;
  };
  onRotate: () => void;
  onRemove: () => void;
};

type PdfDndGridProps = {
  items: PdfGridItemView[];
  onReorder: (activeId: string, overId: string) => void;
};

function SortableCard({ item, index }: { item: PdfGridItemView; index: number }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: item.id });
  const { t } = useI18n();
  const shouldSwap = item.rotation % 180 !== 0;

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      class={`group flex justify-center ${isDragging ? "opacity-70" : "opacity-100"}`}
      // dnd-kit 的类型是面向 React 的，和 Preact JSX 的 aria/role 类型不完全一致
      // 这里做一次类型兜底，避免 tsc 构建失败
      {...(attributes as any)}
      {...(listeners as any)}
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
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              item.onRotate();
            }}
          >
            <RotateRight90Icon size={16} />
          </button>
          <button
            type="button"
            class="w-8 h-8 flex items-center justify-center rounded-full bg-white/95 hover:bg-white shadow border border-slate-200"
            title={t('imagePdf.delete')}
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => {
              e.stopPropagation();
              item.onRemove();
            }}
          >
            <CloseIcon size={16} />
          </button>
        </div>
        <div
          // 预览说明：外层浅灰表示纸张，内层白色表示内容区（便于看清边距）
          class="bg-slate-100 dark:bg-slate-800/60 rounded-xl shadow-lg border border-slate-200/70 dark:border-slate-700/60 overflow-hidden transition-all duration-300"
          style={{
            width: `${item.preview.widthPx}px`,
            aspectRatio: item.preview.aspectRatio,
            padding: `${item.preview.paddingPx}px`,
          }}
        >
          <div class="w-full h-full flex items-center justify-center bg-white dark:bg-slate-950">
            {/* 图片占用区域：按导出 PDF 的 fit/contain 规则计算 */}
            <div
              class="relative rounded-sm bg-slate-200/70 dark:bg-slate-700/40 border border-slate-300/70 dark:border-slate-600/50"
              style={{
                width: `${item.preview.drawWidthPx}px`,
                height: `${item.preview.drawHeightPx}px`,
              }}
            >
              <img
                src={item.url}
                alt={item.name}
                // 关键：关闭全局 img max-width 约束，避免 90° 预览时被压缩导致“看起来没撑满”
                class="absolute left-1/2 top-1/2 block max-w-none max-h-none"
                style={{
                  width: `${shouldSwap ? item.preview.drawHeightPx : item.preview.drawWidthPx}px`,
                  height: `${shouldSwap ? item.preview.drawWidthPx : item.preview.drawHeightPx}px`,
                  transform: `translate(-50%, -50%) rotate(${item.rotation}deg)`,
                }}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export function PdfDndGrid({ items, onReorder }: PdfDndGridProps) {
  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 6 } }),
  );

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={closestCenter}
      onDragEnd={(event: DragEndEvent) => {
        const { active, over } = event;
        if (!over || active.id === over.id) return;
        onReorder(String(active.id), String(over.id));
      }}
    >
      <SortableContext items={items.map((it) => it.id)} strategy={rectSortingStrategy}>
        <div
          class="grid gap-6 p-6"
          style={{ gridTemplateColumns: "repeat(auto-fill, minmax(220px, 1fr))" }}
        >
          {items.map((item, index) => (
            <SortableCard key={item.id} item={item} index={index} />
          ))}
        </div>
      </SortableContext>
    </DndContext>
  );
}

