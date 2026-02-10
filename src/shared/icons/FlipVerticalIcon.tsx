import { type JSX } from 'preact'

type FlipVerticalIconProps = {
  size?: number
  color?: string
  class?: string
}

// 垂直翻转
export function FlipVerticalIcon({
  size = 24,
  color = 'currentColor',
  class: className,
}: FlipVerticalIconProps): JSX.Element {
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
        d="M42 24L6 24"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M14 4L36 16H14V4Z"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
      <path
        d="M14 44V32H36L14 44Z"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}

