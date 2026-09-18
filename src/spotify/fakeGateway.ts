import { SourceUnavailableError } from './errors'
import type { SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

/**
 * A source together with its tracks; the fake derives the track count from them.
 * An `unavailable` source is listed but its tracks can't be read, like a playlist
 * Spotify no longer lets the app open.
 */
export type FakeSource = Omit<Source, 'trackCount'> & { tracks: Track[]; unavailable?: boolean }

/** An in-memory gateway over the given sources. */
export function createFakeGateway(sources: FakeSource[]): SpotifyGateway {
  return {
    async listSources(): Promise<Source[]> {
      return sources.map(({ id, name, owner, imageUrl, tracks }) => ({
        id,
        name,
        owner,
        imageUrl,
        trackCount: tracks.length,
      }))
    },

    async getSourceTracks(sourceId: string): Promise<Track[]> {
      const source = sources.find((candidate) => candidate.id === sourceId)
      if (!source) throw new Error(`Unknown source: ${sourceId}`)
      if (source.unavailable) throw new SourceUnavailableError(sourceId)
      return source.tracks.map((track) => ({ ...track, artists: [...track.artists] }))
    },
  }
}
