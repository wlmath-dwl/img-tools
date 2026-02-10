import { type JSX } from 'preact'

type BackIconProps = {
    size?: number
    color?: string
    class?: string
}

export function BackIcon({ size = 24, color = 'currentColor', class: className }: BackIconProps): JSX.Element {
    return (
        <svg
            xmlns="http://www.w3.org/2000/svg"
            width={size}
            height={size}
            viewBox="0 -960 960 960"
            fill={color}
            class={className}
        >
            <path d="M640-80 240-480l400-400 71 71-329 329 329 329-71 71Z" />
        </svg>
    )
}