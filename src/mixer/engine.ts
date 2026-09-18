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
 * How to build the mix. With no options, every track is used once,
 * weighted uniformly (each track equally likely) and in random order.
 */
export interface MixOptions {
  pool?: PoolOptions
}

export interface MixItem {
  track: Track
  /** The source the track was drawn from. */
  sourceId: string
}

/** Builds a mix. Pure: the same sources, options and seed give the same result. */
export function buildMix(sources: MixSource[], options: MixOptions, rng: Rng): MixItem[] {
  const pool = options.pool ?? {}
  const eligible = eligibleTracks(sources, pool)
  return shuffle(eligible, rng).slice(0, pool.length ?? eligible.length)
}

/** Every track that passes the filters, in selection order, with duplicates removed if asked. */
function eligibleTracks(sources: MixSource[], pool: PoolOptions): MixItem[] {
  const items = sources
    .flatMap((source) => source.tracks.map((track) => ({ track, sourceId: source.id })))
    .filter(({ track }) => passesFilters(track, pool))
  return pool.removeDuplicates ? withoutDuplicates(items) : items
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
 * under the same title (a live take, say). The first copy wins.
 */
function withoutDuplicates(items: MixItem[]): MixItem[] {
  const ids = new Set<string>()
  const isrcs = new Set<string>()
  const titles = new Set<string>()
  const titlesWithoutIsrc = new Set<string>()

  return items.filter(({ track }) => {
    const title = titleKey(track)
    const duplicate =
      ids.has(track.id) ||
      (track.isrc === null ? titles.has(title) : isrcs.has(track.isrc) || titlesWithoutIsrc.has(title))
    if (duplicate) return false

    ids.add(track.id)
    titles.add(title)
    if (track.isrc === null) titlesWithoutIsrc.add(title)
    else isrcs.add(track.isrc)
    return true
  })
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

/** Fisher–Yates: every order is equally likely, so every track is equally likely at each position. */
function shuffle<T>(items: T[], rng: Rng): T[] {
  const result = [...items]
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}
