import { type JSX } from "preact";

type TrashIconProps = {
  size?: number;
  color?: string;
  class?: string;
};

/** 垃圾桶图标：用于删除等文件管理操作 */
export function TrashIcon({
  // 说明：默认尺寸按设计稿 SVG（23x23）设置
  size = 23,
  color = "currentColor",
  class: className,
}: TrashIconProps): JSX.Element {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      class={className}
    >
      <path
        fill-rule="evenodd"
        clip-rule="evenodd"
        d="M8 15H40L37 44H11L8 15Z"
        fill="none"
        stroke={color}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M20.002 25.0024V35.0026"
        stroke={color}
        stroke-width="4"
        stroke-linecap="round"
      />
      <path
        d="M28.0024 24.9995V34.9972"
        stroke={color}
        stroke-width="4"
        stroke-linecap="round"
      />
      <path
        d="M12 14.9999L28.3242 3L36 15"
        stroke={color}
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}
