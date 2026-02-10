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
        d="M6 8.25564L24.0086 3L42 8.25564V19.0337C42 30.3622 34.7502 40.4194 24.0026 44.0005C13.2521 40.4195 6 30.36 6 19.0287V8.25564Z"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M23.9497 14.9497V30.9497"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M15.9497 22.9497H31.9497"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

