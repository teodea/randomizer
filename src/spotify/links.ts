/**
 * Links back to Spotify.
 *
 * Spotify's Developer Policy requires every piece of metadata and every cover
 * shown here to link back to the thing it came from, so these are not a
 * convenience: a track or playlist rendered without one is a policy breach.
 */

/** Liked Songs is not a playlist, so it has its own page. */
const LIKED_SONGS_ID = 'liked-songs'

export function sourceUrl(id: string): string {
  return id === LIKED_SONGS_ID
    ? 'https://open.spotify.com/collection/tracks'
    : `https://open.spotify.com/playlist/${id}`
}

export function trackUrl(id: string): string {
  return `https://open.spotify.com/track/${id}`
}
