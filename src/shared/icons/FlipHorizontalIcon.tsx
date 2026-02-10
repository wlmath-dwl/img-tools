import { type JSX } from 'preact'

type FlipHorizontalIconProps = {
  size?: number
  color?: string
  class?: string
}

// 水平翻转
export function FlipHorizontalIcon({
  size = 24,
  color = 'currentColor',
  class: className,
}: FlipHorizontalIconProps): JSX.Element {
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
        d="M24 6V42"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M4 34L16 12V34H4Z"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M44 34H32V12L44 34Z"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

