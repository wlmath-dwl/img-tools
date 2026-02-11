import { type JSX } from "preact";

type PrivacyShieldIconProps = {
  size?: number;
  color?: string;
  class?: string;
};

// 隐私盾牌：用于“100% 隐私保护”等提示
export function PrivacyShieldIcon({
  size = 24,
  color = "currentColor",
  class: className,
}: PrivacyShieldIconProps): JSX.Element {
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
        d="M6 9.25564L24.0086 4L42 9.25564V20.0337C42 31.3622 34.7502 41.4194 24.0026 45.0005C13.2521 41.4195 6 31.36 6 20.0287V9.25564Z"
        fill="none"
        stroke={color}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M15 23L22 30L34 18"
        stroke={color}
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  );
}








