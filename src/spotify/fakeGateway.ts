import type { SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

/** A source together with its tracks; the fake derives the track count from them. */
export type FakeSource = Omit<Source, 'trackCount'> & { tracks: Track[] }

/** An in-memory gateway over the given sources. */
export function createFakeGateway(sources: FakeSource[]): SpotifyGateway {
  return {
    async listSources(): Promise<Source[]> {
      return sources.map(({ id, name, owner, tracks }) => ({ id, name, owner, trackCount: tracks.length }))
    },

    async getSourceTracks(sourceId: string): Promise<Track[]> {
      const source = sources.find((candidate) => candidate.id === sourceId)
      if (!source) throw new Error(`Unknown source: ${sourceId}`)
      return source.tracks.map((track) => ({ ...track, artists: [...track.artists] }))
    },
  }
}
