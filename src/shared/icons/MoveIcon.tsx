import { type JSX } from 'preact'

type MoveIconProps = {
  size?: number
  color?: string
  class?: string
}

export function MoveIcon({ size = 24, color = 'currentColor', class: className }: MoveIconProps): JSX.Element {
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
        d="M8 6L43 25L24 27L13.9948 44L8 6Z"
        fill="none"
        stroke={color}
        strokeWidth="4"
        strokeLinejoin="round"
      />
    </svg>
  )
}
