/** "1 track", "12 tracks". */
export function trackCountLabel(count: number) {
  const { count: value, unit } = trackCountParts(count)
  return `${value} ${unit}`
}

/**
 * The same count, split so the numeral can be set at catalogue scale while its
 * unit stays a label. Keeping one source for both means they can never disagree.
 */
export function trackCountParts(count: number) {
  return { count: String(count), unit: count === 1 ? 'track' : 'tracks' }
}

/** One track's running time, as a sleeve prints it: "4:12". */
export function trackTimeLabel(totalMs: number) {
  const seconds = Math.round(totalMs / 1000)
  return `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`
}

/** A whole mix's span, where minutes are the useful unit: "42 min", or "1 h 07". */
export function durationLabel(totalMs: number) {
  const minutes = Math.round(totalMs / 60_000)
  if (minutes < 60) return `${minutes} min`
  return `${Math.floor(minutes / 60)} h ${String(minutes % 60).padStart(2, '0')}`
}

/** The same span as a machine-readable ISO 8601 duration, for `<time datetime>`. */
export function durationAttr(totalMs: number) {
  return `PT${Math.round(totalMs / 1000)}S`
}
