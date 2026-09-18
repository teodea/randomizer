import type { Source, Track } from './types'

/** How a request to start playback turned out, when Spotify gave a reason the user can act on. */
export type PlaybackOutcome = 'started' | 'no-device' | 'premium-required'

/**
 * Everything the app needs from Spotify. The real implementation talks to the
 * Web API; the fake one serves in-memory data to tests and to demo mode, so
 * both run exactly the same app code.
 */
export interface SpotifyGateway {
  /** The sources the user can mix from, the app's own temporary playlist included. */
  listSources(): Promise<Source[]>
  /**
   * Every playable track of a source, in the source's own order. Throws
   * `SourceUnavailableError` when Spotify won't let the app read the source.
   */
  getSourceTracks(sourceId: string): Promise<Track[]>
  /** Creates a private playlist in the user's library and returns its ID. */
  createPlaylist(details: { name: string; description: string }): Promise<string>
  /**
   * Replaces a playlist's tracks with `trackIds`, in order. Large lists are
   * written in batches; `onProgress` hears how many tracks are written so far.
   */
  replacePlaylistTracks(playlistId: string, trackIds: string[], onProgress?: (written: number) => void): Promise<void>
  /** Plays the playlist from its first track, in order, on the user's active device. */
  startPlayback(playlistId: string): Promise<PlaybackOutcome>
}
