import { describe, expect, it } from 'vitest'
import type { Track } from '../spotify/types'
import { buildMix, type MixSource } from './engine'
import { createRng } from './random'

function track(id: string, artist = `Artist ${id}`): Track {
  return { id, name: `Track ${id}`, artists: [artist], durationMs: 180_000, explicit: false, isrc: null }
}

function source(id: string, size: number): MixSource {
  return {
    id,
    tracks: Array.from({ length: size }, (_, i) => track(`${id}${i + 1}`)),
  }
}

describe('buildMix', () => {
  it('uses every eligible track exactly once', () => {
    const mix = buildMix([source('a', 5), source('b', 3), source('c', 1)], {}, createRng(1))

    expect(mix.map((item) => item.track.id).sort()).toEqual(
      ['a1', 'a2', 'a3', 'a4', 'a5', 'b1', 'b2', 'b3', 'c1'].sort(),
    )
  })

  it('gives the same mix for the same seed', () => {
    const sources = [source('a', 10), source('b', 10)]

    const first = buildMix(sources, {}, createRng(42))
    const second = buildMix(sources, {}, createRng(42))

    expect(second).toEqual(first)
  })

  it('gives a different order for a different seed', () => {
    const sources = [source('a', 10), source('b', 10)]
    const ids = (seed: number) => buildMix(sources, {}, createRng(seed)).map((item) => item.track.id)

    expect(ids(1)).not.toEqual(ids(2))
  })

  it('weights sources uniformly, so each source’s share follows its size', () => {
    // 30 tracks vs 10: a should fill about 3/4 of any stretch of the mix.
    const sources = [source('a', 30), source('b', 10)]
    let fromA = 0
    let drawn = 0
    for (let seed = 1; seed <= 200; seed++) {
      const opening = buildMix(sources, {}, createRng(seed)).slice(0, 20)
      fromA += opening.filter((item) => item.sourceId === 'a').length
      drawn += opening.length
    }

    expect(fromA / drawn).toBeCloseTo(0.75, 1)
  })
})
