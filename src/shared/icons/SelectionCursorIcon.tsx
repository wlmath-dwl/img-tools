import { type JSX } from "preact";

type SelectionCursorIconProps = {
  size?: number;
  color?: string;
  class?: string;
};

// 选择/拖拽（光标）图标：2px 线条，风格更轻盈统一
export function SelectionCursorIcon({
  size = 20,
  color = "currentColor",
  class: className,
}: SelectionCursorIconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      stroke-width="2"
      stroke-linecap="round"
      stroke-linejoin="round"
      class={className}
    >
      <path d="M3 3l7.07 16.97 2.51-7.39 7.39-2.51L3 3z" />
      <path d="M13 13l6 6" />
    </svg>
  );
}
