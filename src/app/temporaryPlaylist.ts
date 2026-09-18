import type { SpotifyGateway } from '../spotify/gateway'
import type { Source } from '../spotify/types'

/**
 * How the app recognises its own playlist. The name alone isn't enough: the user
 * could have a playlist with the same name, and the app must never touch it.
 */
const MARKER = '[randomizer:temporary]'

/** The one private playlist each mix is written to. */
export const TEMPORARY_PLAYLIST = {
  name: 'Randomizer mix',
  description: `Temporary mix made by Randomizer. Your next mix replaces it. ${MARKER}`,
}

/** Whether a source is the app's temporary playlist: one of the user's own, carrying the marker. */
export function isTemporaryPlaylist(source: Source): boolean {
  return source.ownedByUser && (source.description ?? '').includes(MARKER)
}

/** The sources to offer, without the temporary playlist, and the temporary playlist's ID if there is one. */
export function splitLibrary(library: Source[]): { sources: Source[]; temporaryPlaylistId: string | null } {
  return {
    sources: library.filter((source) => !isTemporaryPlaylist(source)),
    temporaryPlaylistId: library.find(isTemporaryPlaylist)?.id ?? null,
  }
}

/**
 * Removes the temporary playlist from the user's library. With no ID to go on,
 * it looks the playlist up first; `null` means there's known to be none.
 */
export async function removeTemporaryPlaylist(gateway: SpotifyGateway, playlistId?: string | null): Promise<void> {
  const id = playlistId === undefined ? splitLibrary(await gateway.listSources()).temporaryPlaylistId : playlistId
  if (id) await gateway.removePlaylist(id)
}

/** The playlist's page on Spotify, which opens the app where it's installed. */
export function playlistUrl(playlistId: string): string {
  return `https://open.spotify.com/playlist/${encodeURIComponent(playlistId)}`
}
