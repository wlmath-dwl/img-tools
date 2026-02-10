import { type JSX } from 'preact'

type CloseIconProps = {
  size?: number
  color?: string
  class?: string
}

// 关闭：“X”
export function CloseIcon({
  size = 24,
  color = 'currentColor',
  class: className,
}: CloseIconProps): JSX.Element {
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
        d="M8 8L40 40"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M8 40L40 8"
        stroke={color}
        strokeWidth="4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

