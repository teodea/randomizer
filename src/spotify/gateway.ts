import type { Source, Track } from './types'

/**
 * Everything the app needs from Spotify. The real implementation talks to the
 * Web API; the fake one serves in-memory data to tests and to demo mode, so
 * both run exactly the same app code.
 */
export interface SpotifyGateway {
  /** The sources the user can mix from. */
  listSources(): Promise<Source[]>
  /**
   * Every playable track of a source, in the source's own order. Throws
   * `SourceUnavailableError` when Spotify won't let the app read the source.
   */
  getSourceTracks(sourceId: string): Promise<Track[]>
}
