import { type JSX } from 'preact'

type BrushIconProps = {
  size?: number
  color?: string
  class?: string
}

export function BrushIcon({ size = 24, color = 'currentColor', class: className }: BrushIconProps): JSX.Element {
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
        d="M34 5H6V20H34V5Z"
        fill="none"
        stroke={color}
        stroke-width="4"
        stroke-linejoin="round"
      />
      <path
        d="M34.0251 12H43V28.1014L19 31.2004V43"
        fill="none"
        stroke={color}
        stroke-width="4"
        stroke-linecap="round"
        stroke-linejoin="round"
      />
    </svg>
  )
}
