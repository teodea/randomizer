/**
 * The interface's own glyphs, drawn at one stroke weight on a 16-unit grid.
 * Typographic stand-ins (×, ✓, →) belong to a font, not to an icon system.
 */

const stroke = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'square',
} as const

/** Strikes a source off the selection. */
export function StrikeIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M3.5 3.5 12.5 12.5M12.5 3.5 3.5 12.5" />
    </svg>
  )
}

/** Marks a closed group of settings that opens downwards. */
export function ChevronIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M4 6.5 8 10.5 12 6.5" />
    </svg>
  )
}

/** Goes back up to the top of something long. */
export function UpIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M8 13V4M4 8l4-4 4 4" />
    </svg>
  )
}

/** Opens something in Spotify. */
export function OpenIcon() {
  return (
    <svg viewBox="0 0 16 16" aria-hidden="true" focusable="false" {...stroke}>
      <path d="M6 3.5h6.5V10" />
      <path d="M12.5 3.5 4 12" />
    </svg>
  )
}
