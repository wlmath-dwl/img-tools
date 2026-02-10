import { type ComponentChildren } from 'preact'

type IconProps = {
  children: ComponentChildren
  size?: number | string
  color?: string
  class?: string
}

export function Icon({ 
  children, 
  size = 24, 
  color = 'currentColor',
  class: className = '',
}: IconProps) {
  const sizeValue = typeof size === 'number' ? `${size}px` : size

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      height={sizeValue}
      viewBox="0 -960 960 960"
      width={sizeValue}
      fill={color}
      class={className}
    >
      {children}
    </svg>
  )
}
