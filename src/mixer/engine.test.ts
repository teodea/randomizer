import { describe, expect, it } from 'vitest'
import type { Track } from '../spotify/types'
import { buildMix, type MixItem, type MixOptions, type MixSource } from './engine'
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

/** Share of `sourceId` among `items`. */
function share(items: MixItem[], sourceId: string) {
  return items.filter((item) => item.sourceId === sourceId).length / items.length
}

/** Share of `sourceId` in the first `length` tracks, averaged over many seeds. */
function openingShare(sources: MixSource[], options: MixOptions, sourceId: string, length: number) {
  const openings = Array.from({ length: 200 }, (_, i) => buildMix(sources, options, createRng(i + 1)).slice(0, length))
  return share(openings.flat(), sourceId)
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

  it('balanced weighting gives each source an equal share while all sources last', () => {
    // 60 tracks vs 20: b runs out after about 40 draws, so the first 20 are all "while both last".
    const sources = [source('a', 60), source('b', 20)]

    expect(openingShare(sources, { weighting: { mode: 'balanced' } }, 'a', 20)).toBeCloseTo(0.5, 1)
  })

  it('balanced weighting gives three sources a third each', () => {
    const sources = [source('a', 90), source('b', 30), source('c', 15)]
    const options: MixOptions = { weighting: { mode: 'balanced' } }

    expect(openingShare(sources, options, 'a', 24)).toBeCloseTo(1 / 3, 1)
    expect(openingShare(sources, options, 'b', 24)).toBeCloseTo(1 / 3, 1)
    expect(openingShare(sources, options, 'c', 24)).toBeCloseTo(1 / 3, 1)
  })

  it('respects custom weights', () => {
    const sources = [source('a', 100), source('b', 100)]
    const options: MixOptions = { weighting: { mode: 'custom', weights: { a: 70, b: 30 } } }

    expect(openingShare(sources, options, 'a', 50)).toBeCloseTo(0.7, 1)
  })

  it('treats custom weights as relative, whatever they add up to', () => {
    const sources = [source('a', 100), source('b', 100)]
    const options: MixOptions = { weighting: { mode: 'custom', weights: { a: 1, b: 3 } } }

    expect(openingShare(sources, options, 'a', 50)).toBeCloseTo(0.25, 1)
  })

  it('drops an exhausted source and keeps the rest in their relative proportions', () => {
    // a has half the weight but only 5 tracks; once it is gone, b and c should keep 30:20 = 60%:40%.
    const sources = [source('a', 5), source('b', 100), source('c', 100)]
    const options: MixOptions = { weighting: { mode: 'custom', weights: { a: 50, b: 30, c: 20 } } }
    const afterA: MixItem[] = []
    for (let seed = 1; seed <= 200; seed++) {
      const mix = buildMix(sources, options, createRng(seed))
      const lastA = mix.findLastIndex((item) => item.sourceId === 'a')
      afterA.push(...mix.slice(lastA + 1, lastA + 51))
    }

    expect(share(afterA, 'a')).toBe(0)
    expect(share(afterA, 'b')).toBeCloseTo(0.6, 1)
  })

  it.each<[string, MixOptions]>([
    ['balanced', { weighting: { mode: 'balanced' } }],
    ['custom', { weighting: { mode: 'custom', weights: { a: 90, b: 5, c: 5 } } }],
    ['custom with a zero weight', { weighting: { mode: 'custom', weights: { a: 0, b: 1, c: 1 } } }],
    ['custom with a missing weight', { weighting: { mode: 'custom', weights: { a: 1 } } }],
    ['custom with every weight zero', { weighting: { mode: 'custom', weights: { a: 0, b: 0, c: 0 } } }],
  ])('still uses every eligible track with %s weighting', (_, options) => {
    const sources = [source('a', 7), source('b', 3), source('c', 12)]

    const mix = buildMix(sources, options, createRng(5))

    expect(mix.map((item) => item.track.id).sort()).toEqual(
      sources.flatMap((s) => s.tracks.map((t) => t.id)).sort(),
    )
  })

  it('plays a zero-weight source only after every other source has run out', () => {
    const sources = [source('a', 4), source('b', 6)]

    const mix = buildMix(sources, { weighting: { mode: 'custom', weights: { a: 0, b: 1 } } }, createRng(3))

    expect(mix.map((item) => item.sourceId)).toEqual(['b', 'b', 'b', 'b', 'b', 'b', 'a', 'a', 'a', 'a'])
  })

  it('gives the same weighted mix for the same seed', () => {
    const sources = [source('a', 10), source('b', 10)]
    const options: MixOptions = { weighting: { mode: 'custom', weights: { a: 2, b: 1 } } }

    expect(buildMix(sources, options, createRng(9))).toEqual(buildMix(sources, options, createRng(9)))
  })
})

describe('buildMix pool', () => {
  const ids = (mix: MixItem[]) => mix.map((item) => item.track.id).sort()
  const withTracks = (id: string, tracks: Track[]): MixSource => ({ id, tracks })

  describe('duplicate removal', () => {
    it('keeps every copy when duplicates are allowed', () => {
      const shared = track('x')
      const mix = buildMix([withTracks('a', [shared]), withTracks('b', [shared])], {}, createRng(1))

      expect(ids(mix)).toEqual(['x', 'x'])
    })

    it('removes tracks with the same Spotify track ID', () => {
      const mix = buildMix(
        [withTracks('a', [track('x'), track('y')]), withTracks('b', [track('x'), track('z')])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['x', 'y', 'z'])
    })

    it('keeps the first copy, from the source selected first', () => {
      const mix = buildMix(
        [withTracks('a', [track('x')]), withTracks('b', [track('x')])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(mix).toEqual([{ track: track('x'), sourceId: 'a' }])
    })

    it('removes different releases of the same recording, matched by ISRC', () => {
      const single = { ...track('single'), name: 'Song', isrc: 'USABC0000001' }
      const remaster = { ...track('remaster'), name: 'Song - Remastered', isrc: 'USABC0000001' }
      const mix = buildMix(
        [withTracks('a', [single]), withTracks('b', [remaster, track('other')])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['other', 'single'])
    })

    it('falls back to normalised title and primary artist when the ISRC is missing', () => {
      const original = { ...track('p'), name: 'Café  Nights!', artists: ['The Band', 'Guest'] }
      const copy = { ...track('q'), name: 'cafe nights', artists: ['the band'] }
      const otherArtist = { ...track('r'), name: 'Cafe Nights', artists: ['Someone Else'] }
      const mix = buildMix(
        [withTracks('a', [original]), withTracks('b', [copy, otherArtist])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['p', 'r'])
    })

    it('matches a track without an ISRC against one that has it, by title and artist', () => {
      const coded = { ...track('p', 'Band'), name: 'Song', isrc: 'USABC0000001' }
      const uncoded = { ...track('q', 'Band'), name: 'Song' }
      const mix = buildMix(
        [withTracks('a', [coded]), withTracks('b', [uncoded])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['p'])
    })

    it('keeps tracks with the same title and artist but different ISRCs, as different recordings', () => {
      const studio = { ...track('p', 'Band'), name: 'Song', isrc: 'USABC0000001' }
      const live = { ...track('q', 'Band'), name: 'Song', isrc: 'USABC0000002' }
      const mix = buildMix(
        [withTracks('a', [studio]), withTracks('b', [live])],
        { pool: { removeDuplicates: true } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['p', 'q'])
    })
  })

  describe('filters', () => {
    const lasting = (id: string, seconds: number): Track => ({ ...track(id), durationMs: seconds * 1000 })
    const durations = withTracks('a', [lasting('intro', 40), lasting('song', 200), lasting('epic', 600)])

    it('excludes tracks shorter than the minimum duration', () => {
      const mix = buildMix([durations], { pool: { minDurationMs: 60_000 } }, createRng(1))

      expect(ids(mix)).toEqual(['epic', 'song'])
    })

    it('excludes tracks longer than the maximum duration', () => {
      const mix = buildMix([durations], { pool: { maxDurationMs: 300_000 } }, createRng(1))

      expect(ids(mix)).toEqual(['intro', 'song'])
    })

    it('keeps tracks exactly at the duration limits', () => {
      const mix = buildMix([durations], { pool: { minDurationMs: 40_000, maxDurationMs: 200_000 } }, createRng(1))

      expect(ids(mix)).toEqual(['intro', 'song'])
    })

    it('excludes explicit tracks when asked', () => {
      const tracks = [{ ...track('clean') }, { ...track('explicit'), explicit: true }]

      expect(ids(buildMix([withTracks('a', tracks)], {}, createRng(1)))).toEqual(['clean', 'explicit'])
      expect(ids(buildMix([withTracks('a', tracks)], { pool: { excludeExplicit: true } }, createRng(1)))).toEqual([
        'clean',
      ])
    })
  })

  describe('length', () => {
    it('uses a fixed number of tracks when one is set', () => {
      const mix = buildMix([source('a', 10), source('b', 10)], { pool: { length: 7 } }, createRng(1))

      expect(mix).toHaveLength(7)
      expect(new Set(mix.map((item) => item.track.id)).size).toBe(7)
    })

    it('stops the weighted draw at the fixed length, so the weights still hold', () => {
      const mix = buildMix(
        [source('a', 20), source('b', 20)],
        { pool: { length: 10 }, weighting: { mode: 'custom', weights: { a: 1, b: 0 } } },
        createRng(1),
      )

      expect(mix).toHaveLength(10)
      expect(mix.every((item) => item.sourceId === 'a')).toBe(true)
    })

    it('uses every eligible track when the fixed length is larger than the pool', () => {
      const mix = buildMix([source('a', 3), source('b', 2)], { pool: { length: 50 } }, createRng(1))

      expect(mix).toHaveLength(5)
    })

    it('counts the length after duplicates and filters are applied', () => {
      const shared = [track('x'), track('y'), { ...track('e'), explicit: true }]
      const mix = buildMix(
        [withTracks('a', shared), withTracks('b', [...shared, track('z')])],
        { pool: { removeDuplicates: true, excludeExplicit: true, length: 10 } },
        createRng(1),
      )

      expect(ids(mix)).toEqual(['x', 'y', 'z'])
    })

    it('draws the fixed-length mix from the whole pool, not just the first source', () => {
      const seen = new Set<string>()
      for (let seed = 1; seed <= 50; seed++) {
        for (const item of buildMix([source('a', 5), source('b', 5)], { pool: { length: 2 } }, createRng(seed))) {
          seen.add(item.track.id)
        }
      }

      expect(seen.size).toBe(10)
    })
  })
})
