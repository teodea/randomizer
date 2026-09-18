import { SourceUnavailableError } from './errors'
import type { PlaybackOutcome, SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

/**
 * A source together with its tracks; the fake derives the track count from them.
 * An `unavailable` source is listed but its tracks can't be read, like a playlist
 * Spotify no longer lets the app open. Sources have no description and belong to
 * someone else unless said otherwise.
 */
export type FakeSource = Omit<Source, 'trackCount' | 'description' | 'ownedByUser'> &
  Partial<Pick<Source, 'description' | 'ownedByUser'>> & { tracks: Track[]; unavailable?: boolean }

export interface FakeGatewayOptions {
  /** What happens when the app asks to start playback. */
  playback?: PlaybackOutcome
}

/** The fake plus what tests need to look at or change in it. */
export interface FakeGateway extends SpotifyGateway {
  /** The playlist playing on the user's device, if any. */
  nowPlaying(): string | null
  setPlayback(outcome: PlaybackOutcome): void
}

/** Same batch size as the Web API, so progress reports look the same. */
const WRITE_BATCH_SIZE = 100

/** An in-memory gateway over the given sources, which the app can add playlists to. */
export function createFakeGateway(sources: FakeSource[], { playback = 'started' }: FakeGatewayOptions = {}): FakeGateway {
  const playlists = sources.map((source) => ({ ...source, tracks: [...source.tracks] }))
  const catalog = new Map(sources.flatMap((source) => source.tracks.map((track) => [track.id, track] as const)))
  let created = 0
  let playing: string | null = null

  function find(id: string) {
    const playlist = playlists.find((candidate) => candidate.id === id)
    if (!playlist) throw new Error(`Unknown source: ${id}`)
    return playlist
  }

  return {
    async listSources(): Promise<Source[]> {
      return playlists.map(({ id, name, owner, imageUrl, tracks, description, ownedByUser }) => ({
        id,
        name,
        owner,
        imageUrl,
        trackCount: tracks.length,
        description: description ?? null,
        ownedByUser: ownedByUser ?? false,
      }))
    },

    async getSourceTracks(sourceId: string): Promise<Track[]> {
      const source = find(sourceId)
      if (source.unavailable) throw new SourceUnavailableError(sourceId)
      return source.tracks.map((track) => ({ ...track, artists: [...track.artists] }))
    },

    async createPlaylist({ name, description }) {
      const id = `created-${++created}`
      playlists.push({ id, name, description, owner: 'You', ownedByUser: true, imageUrl: null, tracks: [] })
      return id
    },

    async replacePlaylistTracks(playlistId, trackIds, onProgress) {
      const playlist = find(playlistId)
      // Spotify refuses to edit other people's playlists.
      if (!playlist.ownedByUser) throw new Error(`Not the user's playlist: ${playlistId}`)
      playlist.tracks = trackIds.map((id) => {
        const track = catalog.get(id)
        if (!track) throw new Error(`Unknown track: ${id}`)
        return track
      })
      for (let written = 0; written < trackIds.length; ) {
        written = Math.min(written + WRITE_BATCH_SIZE, trackIds.length)
        onProgress?.(written)
      }
    },

    async startPlayback(playlistId) {
      find(playlistId)
      if (playback === 'started') playing = playlistId
      return playback
    },

    nowPlaying: () => playing,

    setPlayback(outcome) {
      playback = outcome
    },
  }
}
