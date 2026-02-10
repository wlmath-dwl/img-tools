import { type JSX } from "preact";

type WatermarkIconProps = {
  size?: number;
  color?: string;
  class?: string;
};

export function WatermarkIcon({
  size = 24,
  color = "currentColor",
  class: className,
}: WatermarkIconProps): JSX.Element {
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
        d="M12 19H6V6H42V19H36"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M12 12H36V44L30 39.5556L24 44L18 39.5556L12 44V12Z"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M20 26H28"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
      <path
        d="M24 22L24 30"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
      />
    </svg>
  );
}
