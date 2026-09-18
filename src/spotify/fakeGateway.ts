import type { SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

export interface FakeSource {
  id: string
  name: string
  owner: string
  tracks: Track[]
}

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
