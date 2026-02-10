type ColorPickerProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  sizeClassName?: string;
};

export function ColorPicker({
  label,
  value,
  onChange,
  disabled = false,
  sizeClassName = "w-8 h-8",
}: ColorPickerProps) {
  return (
    <div class="w-full">
      <label
        class={`flex items-center justify-between gap-3 ${disabled ? "opacity-60 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span class="text-sm font-medium text-slate-700 dark:text-slate-200">
          {label}
        </span>
        <input
          type="color"
          aria-label={label}
          class={[
            sizeClassName,
            "cursor-pointer rounded-md border border-base-300 bg-base-100 p-0 overflow-hidden appearance-none",
            // WebKit: 让真正的颜色块也圆角 + 去掉默认 padding/border
            "[&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:border-0 [&::-webkit-color-swatch]:rounded-md",
            // Firefox
            "[&::-moz-color-swatch]:border-0 [&::-moz-color-swatch]:rounded-md",
          ].join(" ")}
          value={value}
          disabled={disabled}
          onInput={(e) => onChange((e.currentTarget as HTMLInputElement).value)}
        />
      </label>
    </div>
  );
}
