import { describe, expect, it } from 'vitest'
import type { Track } from '../spotify/types'
import { buildMix, type MixItem, type MixSource } from './engine'
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
