import { SourceUnavailableError } from './errors'
import type { PlaybackOutcome, PlaybackState, SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

/**
 * A source together with its tracks; the fake derives the track count from them.
 * An `unavailable` source is listed but its tracks can't be read, like a playlist
 * Spotify no longer lets the app open. Sources have no description, a cover in one
 * size only, and belong to someone else unless said otherwise.
 */
export type FakeSource = Omit<Source, 'trackCount' | 'description' | 'ownedByUser' | 'imageSrcSet'> &
  Partial<Pick<Source, 'description' | 'ownedByUser' | 'imageSrcSet'>> & { tracks: Track[]; unavailable?: boolean }

export interface FakeGatewayOptions {
  /** What happens when the app asks to start playback. */
  playback?: PlaybackOutcome
}

/** The fake plus what tests need to look at or change in it. */
export interface FakeGateway extends SpotifyGateway {
  /** The playlist playing on the user's device, if any. */
  nowPlaying(): string | null
  setPlayback(outcome: PlaybackOutcome): void
  /** Moves playback to the track at `position` in the playing playlist, as if the user had listened that far. */
  playTrackAt(position: number): void
  /** Stops playback on every device. */
  stopPlayback(): void
}

/** Same batch size as the Web API, so progress reports look the same. */
const WRITE_BATCH_SIZE = 100

function reportProgress(total: number, onProgress?: (written: number) => void) {
  for (let written = 0; written < total; ) {
    written = Math.min(written + WRITE_BATCH_SIZE, total)
    onProgress?.(written)
  }
}

/** An in-memory gateway over the given sources, which the app can add playlists to. */
export function createFakeGateway(sources: FakeSource[], { playback = 'started' }: FakeGatewayOptions = {}): FakeGateway {
  const playlists = sources.map((source) => ({ ...source, tracks: [...source.tracks] }))
  const catalog = new Map(sources.flatMap((source) => source.tracks.map((track) => [track.id, track] as const)))
  let created = 0
  let playing: { playlistId: string; position: number } | null = null

  function find(id: string) {
    const playlist = playlists.find((candidate) => candidate.id === id)
    if (!playlist) throw new Error(`Unknown source: ${id}`)
    return playlist
  }

  function write(playlistId: string, trackIds: string[]) {
    const playlist = find(playlistId)
    // Spotify refuses to edit other people's playlists.
    if (!playlist.ownedByUser) throw new Error(`Not the user's playlist: ${playlistId}`)
    playlist.tracks = trackIds.map((id) => {
      const track = catalog.get(id)
      if (!track) throw new Error(`Unknown track: ${id}`)
      return track
    })
  }

  return {
    async listSources(): Promise<Source[]> {
      return playlists.map(({ id, name, owner, imageUrl, imageSrcSet, tracks, description, ownedByUser }) => ({
        id,
        name,
        owner,
        imageUrl,
        imageSrcSet: imageSrcSet ?? null,
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
      write(playlistId, trackIds)
      reportProgress(trackIds.length, onProgress)
    },

    async replacePlaylistTail(playlistId, kept, currentTail, nextTail, onProgress) {
      const playlist = find(playlistId)
      const now = playlist.tracks.map((track) => track.id)
      if (now.join() !== [...kept, ...currentTail].join()) throw new Error(`Playlist changed: ${playlistId}`)
      // Like Spotify, the player keeps its place: the kept tracks haven't moved.
      write(playlistId, [...kept, ...nextTail])
      reportProgress(nextTail.length, onProgress)
    },

    async removePlaylist(playlistId) {
      playlists.splice(playlists.indexOf(find(playlistId)), 1)
      if (playing?.playlistId === playlistId) playing = null
    },

    async startPlayback(playlistId) {
      find(playlistId)
      if (playback === 'started') playing = { playlistId, position: 0 }
      return playback
    },

    async getPlaybackState(): Promise<PlaybackState | null> {
      if (!playing) return null
      const track = find(playing.playlistId).tracks[playing.position]
      return { playlistId: playing.playlistId, trackId: track?.id ?? null }
    },

    nowPlaying: () => playing?.playlistId ?? null,

    playTrackAt(position) {
      if (!playing) throw new Error('Nothing is playing')
      playing = { ...playing, position }
    },

    stopPlayback() {
      playing = null
    },

    setPlayback(outcome) {
      playback = outcome
    },
  }
}
