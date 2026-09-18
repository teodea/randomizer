import type { Track } from '../spotify/types'
import type { Rng } from './random'

/** A selected source together with the tracks read from it. */
export interface MixSource {
  id: string
  tracks: Track[]
}

/** Which tracks are eligible for the mix. Every field is optional; leaving one out turns it off. */
export interface PoolOptions {
  /** Keep only the first copy of a track that appears more than once across the sources. */
  removeDuplicates?: boolean
  /** Leave out tracks shorter than this. */
  minDurationMs?: number
  /** Leave out tracks longer than this. */
  maxDurationMs?: number
  /** Leave out explicit tracks. */
  excludeExplicit?: boolean
  /** Use at most this many tracks. Without it, every eligible track is used. */
  length?: number
}

/**
 * Which source the next track is drawn from:
 * - `uniform`: every remaining track is equally likely, so bigger sources appear more.
 * - `balanced`: every source is equally likely, whatever its size.
 * - `custom`: each source is as likely as its weight. Weights are relative (70/30 and 7/3 are the
 *   same); a source with no weight, or weight 0, is drawn only once every other source has run out.
 *
 * Whatever the mode, a source that runs out leaves the mix and the rest keep their relative
 * proportions, until every eligible track is used (or the fixed length is reached).
 */
export type Weighting =
  | { mode: 'uniform' }
  | { mode: 'balanced' }
  | { mode: 'custom'; weights: Record<string, number> }

/**
 * How the drawn tracks are arranged. Every mode follows the weighting:
 * - `random`: each track's source is drawn at random, as likely as its weight.
 * - `alternate`: sources take turns (A, B, C…); a heavier source gets more turns, spread out evenly.
 * - `blocks`: like `alternate`, but each turn plays `size` tracks from the source in a row.
 *
 * In every mode the tracks within a source come in random order.
 */
export type Order = { mode: 'random' } | { mode: 'alternate' } | { mode: 'blocks'; size: number }

/**
 * How to build the mix. With no options, every eligible track is used once,
 * weighted uniformly (each track equally likely) and in random order.
 */
export interface MixOptions {
  pool?: PoolOptions
  weighting?: Weighting
  order?: Order
  /**
   * Reorder the finished mix so the same primary artist doesn't play twice in a row, wherever
   * that can be avoided. Tracks move as little as needed; none are added or dropped.
   */
  spreadArtists?: boolean
}

export interface MixItem {
  track: Track
  /** The source the track was drawn from. */
  sourceId: string
}

/** Builds a mix. Pure: the same sources, options and seed give the same result. */
export function buildMix(sources: MixSource[], options: MixOptions, rng: Rng): MixItem[] {
  const pool = options.pool ?? {}
  const weighting = options.weighting ?? { mode: 'uniform' }
  const order = options.order ?? { mode: 'random' }
  const remaining = eligibleSources(sources, pool).map((source) => ({
    id: source.id,
    weight: fixedWeight(weighting, source.id),
    tracks: shuffle(source.tracks, rng),
    // Turn-taking credit for `alternate` and `blocks` (smooth weighted round-robin).
    credit: 0,
  }))

  const mix: MixItem[] = []
  for (;;) {
    const live = remaining.filter((source) => source.tracks.length > 0)
    if (live.length === 0 || mix.length === pool.length) break
    // Uniform weighs each source by what it has left, which makes every remaining track equally likely.
    let weights = live.map((source) => source.weight ?? source.tracks.length)
    // Only zero-weight sources are left: they share out what remains equally.
    if (weights.every((weight) => weight === 0)) weights = weights.map(() => 1)

    if (order.mode === 'random') {
      const source = live[pick(weights, rng)]
      mix.push({ track: source.tracks.pop()!, sourceId: source.id })
      continue
    }
    const source = live[takeTurn(live, weights)]
    const run = order.mode === 'blocks' ? Math.max(1, Math.floor(order.size)) : 1
    for (let i = 0; i < run && source.tracks.length > 0 && mix.length !== pool.length; i++) {
      mix.push({ track: source.tracks.pop()!, sourceId: source.id })
    }
  }
  return options.spreadArtists ? spreadArtists(mix) : mix
}

/**
 * Smooth weighted round-robin: every source earns its weight in credit, the richest plays and pays
 * back the total. Equal weights take strict turns in selection order; 70/30 gives A B A A B A A…,
 * each source's turns as evenly spaced as the weights allow.
 */
function takeTurn(live: { credit: number }[], weights: number[]): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let chosen = 0
  live.forEach((source, i) => {
    source.credit += weights[i]
    if (source.credit > live[chosen].credit) chosen = i
  })
  live[chosen].credit -= total
  return chosen
}

/** A source's weight, fixed for the whole mix; `undefined` means "weigh by tracks left" (uniform). */
function fixedWeight(weighting: Weighting, sourceId: string): number | undefined {
  switch (weighting.mode) {
    case 'uniform':
      return undefined
    case 'balanced':
      return 1
    case 'custom': {
      const weight = weighting.weights[sourceId] ?? 0
      return Number.isFinite(weight) && weight > 0 ? weight : 0
    }
  }
}

/** Picks an index with probability proportional to its weight. Weights must not all be zero. */
function pick(weights: number[], rng: Rng): number {
  const total = weights.reduce((sum, weight) => sum + weight, 0)
  let target = rng() * total
  for (let i = 0; i < weights.length; i++) {
    target -= weights[i]
    if (target < 0 && weights[i] > 0) return i
  }
  // Floating-point rounding can leave a sliver past the end: give it to the last weighted index.
  return weights.findLastIndex((weight) => weight > 0)
}

/**
 * The pool stage: each source keeps only the tracks that pass the filters and, if asked,
 * aren't a duplicate of a track kept earlier (sources are checked in selection order).
 */
function eligibleSources(sources: MixSource[], pool: PoolOptions): MixSource[] {
  const isDuplicate = pool.removeDuplicates ? duplicateChecker() : () => false
  return sources.map((source) => ({
    id: source.id,
    tracks: source.tracks.filter((track) => passesFilters(track, pool) && !isDuplicate(track)),
  }))
}

function passesFilters(track: Track, pool: PoolOptions): boolean {
  if (pool.minDurationMs !== undefined && track.durationMs < pool.minDurationMs) return false
  if (pool.maxDurationMs !== undefined && track.durationMs > pool.maxDurationMs) return false
  if (pool.excludeExplicit && track.explicit) return false
  return true
}

/**
 * Two tracks are the same if they share a Spotify track ID or an ISRC. When
 * either has no ISRC, they are also the same if their normalised title and
 * primary artist match. Two different ISRCs are different recordings, even
 * under the same title (a live take, say). The checker says whether a track
 * repeats one it has already seen, so the first copy wins.
 */
function duplicateChecker(): (track: Track) => boolean {
  const ids = new Set<string>()
  const isrcs = new Set<string>()
  const titles = new Set<string>()
  const titlesWithoutIsrc = new Set<string>()

  return (track) => {
    const title = titleKey(track)
    const duplicate =
      ids.has(track.id) ||
      (track.isrc === null ? titles.has(title) : isrcs.has(track.isrc) || titlesWithoutIsrc.has(title))
    if (duplicate) return true

    ids.add(track.id)
    titles.add(title)
    if (track.isrc === null) titlesWithoutIsrc.add(title)
    else isrcs.add(track.isrc)
    return false
  }
}

/** Title and primary artist, ignoring case, accents, punctuation and spacing. */
function titleKey(track: Track): string {
  return `${normalise(track.name)}|${normalise(track.artists[0] ?? '')}`
}

function normalise(text: string): string {
  return text
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^\p{L}\p{N}]+/gu, ' ')
    .trim()
}

/**
 * Reorders the mix so no primary artist plays twice in a row unless it can't be helped. Walking
 * the mix, each slot takes the earliest remaining track by a different artist than the one
 * before, except that an artist holding more than half of what is left must go now, or it
 * would be forced into back-to-back repeats later. This gives the fewest repeats possible and
 * keeps the original order wherever it was already fine.
 */
function spreadArtists(mix: MixItem[]): MixItem[] {
  const artist = (item: MixItem) => normalise(item.track.artists[0] ?? '') || `track:${item.track.id}`
  const left = new Map<string, number>()
  for (const item of mix) left.set(artist(item), (left.get(artist(item)) ?? 0) + 1)

  const remaining = [...mix]
  const result: MixItem[] = []
  let previous: string | undefined
  while (remaining.length > 0) {
    let crowding: string | undefined
    for (const [name, count] of left) {
      if (name !== previous && 2 * count > remaining.length) crowding = name
    }
    let index = remaining.findIndex((item) =>
      crowding === undefined ? artist(item) !== previous : artist(item) === crowding,
    )
    // Every track left is by the artist that just played: the repeat can't be avoided.
    if (index === -1) index = 0

    const [item] = remaining.splice(index, 1)
    previous = artist(item)
    left.set(previous, left.get(previous)! - 1)
    result.push(item)
  }
  return result
}

/** Fisher–Yates: every order is equally likely, so every track is equally likely at each position. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
