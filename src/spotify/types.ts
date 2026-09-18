/** A track as the app needs it, independent of where it came from. */
export interface Track {
  id: string
  name: string
  /** Artist names, primary artist first. */
  artists: string[]
  durationMs: number
  explicit: boolean
  /** International Standard Recording Code, when Spotify provides one. */
  isrc: string | null
}

/** Something the user can mix from: a playlist or Liked Songs. */
export interface Source {
  id: string
  name: string
  owner: string
  trackCount: number
  /** Cover art, when the source has one. */
  imageUrl: string | null
  /** The playlist's description, when it has one. */
  description: string | null
  /** Whether the logged-in user owns it; only their own playlists can be the app's temporary one. */
  ownedByUser: boolean
}
