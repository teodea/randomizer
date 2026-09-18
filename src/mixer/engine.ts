import type { Track } from '../spotify/types'
import type { Rng } from './random'

/** A selected source together with the tracks read from it. */
export interface MixSource {
  id: string
  tracks: Track[]
}

/**
 * How to build the mix. With no options, every eligible track is used once,
 * weighted uniformly (each track equally likely) and in random order.
 */
export type MixOptions = Record<string, never>

export interface MixItem {
  track: Track
  /** The source the track was drawn from. */
  sourceId: string
}

/** Builds a mix. Pure: the same sources, options and seed give the same result. */
export function buildMix(sources: MixSource[], _options: MixOptions, rng: Rng): MixItem[] {
  const pool = sources.flatMap((source) => source.tracks.map((track) => ({ track, sourceId: source.id })))
  return shuffle(pool, rng)
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
