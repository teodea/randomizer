import { SessionExpiredError, SourceUnavailableError } from './errors'
import type { SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

const API = 'https://api.spotify.com/v1'

/** Liked Songs isn't a playlist, so it gets an ID no Spotify playlist can have. */
export const LIKED_SONGS_ID = 'liked-songs'

/** The Web API's largest page for playlists, playlist items and saved tracks. */
const PAGE_SIZE = 50
/** How many times to wait out a rate limit before giving up. */
const MAX_RATE_LIMIT_RETRIES = 5

export interface WebGatewayOptions {
  getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string>
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
}

// The parts of the Web API's responses the app reads. The February 2026 changes
// renamed some fields; both names are accepted while Spotify serves either.

interface Paging<T> {
  items: (T | null)[]
  total?: number
  next: string | null
}

interface ApiPlaylist {
  id: string
  name: string
  owner?: { display_name?: string | null; id?: string } | null
  images?: { url: string }[] | null
  items?: { total: number } | null
  tracks?: { total: number } | null
}

interface ApiTrack {
  type?: string
  id: string | null
  name: string
  artists?: { name: string }[]
  duration_ms: number
  explicit: boolean
  external_ids?: { isrc?: string } | null
  is_local?: boolean
  is_playable?: boolean
}

interface ApiPlaylistEntry {
  is_local?: boolean
  item?: ApiTrack | { type: string } | null
  track?: ApiTrack | { type: string } | null
}

interface ApiSavedTrack {
  track: ApiTrack | null
}

/** Spotify's Web API over HTTP, for a logged-in user. */
export function createWebGateway({
  getAccessToken,
  fetch = globalThis.fetch.bind(globalThis),
  sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms)),
}: WebGatewayOptions): SpotifyGateway {
  /** GETs a Web API URL, refreshing the token once on 401 and waiting out rate limits. */
  async function get(url: string): Promise<Response> {
    let token = await getAccessToken()
    let refreshed = false
    for (let rateLimited = 0; ; ) {
      const response = await fetch(url, { headers: { Authorization: `Bearer ${token}` } })
      if (response.status === 401) {
        if (refreshed) throw new SessionExpiredError()
        refreshed = true
        token = await getAccessToken({ forceRefresh: true })
        continue
      }
      if (response.status === 429) {
        const body = await response.json().catch(() => null)
        // Development Mode's quota: waiting a few seconds won't bring it back.
        if (body?.reason === 'QUOTA_EXCEEDED') throw new Error('Spotify quota exceeded')
        if (rateLimited >= MAX_RATE_LIMIT_RETRIES) throw new Error('Spotify rate limit: too many retries')
        rateLimited++
        await sleep(retryAfterMs(response))
        continue
      }
      return response
    }
  }

  async function getJson<T>(url: string): Promise<T> {
    const response = await get(url)
    if (!response.ok) throw new HttpError(response.status, url)
    return response.json() as Promise<T>
  }

  /** Every item across all pages, following `next`. */
  async function getAll<T>(firstUrl: string): Promise<T[]> {
    const all: T[] = []
    for (let url: string | null = firstUrl; url; ) {
      const paging: Paging<T> = await getJson<Paging<T>>(url)
      for (const item of paging.items) if (item) all.push(item)
      url = paging.next
    }
    return all
  }

  async function readTracks<T>(sourceId: string, url: string, toTrack: (entry: T) => ApiTrack | null) {
    try {
      const entries = await getAll<T>(url)
      return entries.flatMap((entry) => {
        const track = toTrack(entry)
        return track ? [mapTrack(track)] : []
      })
    } catch (error) {
      if (error instanceof HttpError && (error.status === 403 || error.status === 404)) {
        throw new SourceUnavailableError(sourceId)
      }
      throw error
    }
  }

  return {
    async listSources(): Promise<Source[]> {
      const [liked, playlists] = await Promise.all([
        getJson<Paging<ApiSavedTrack>>(`${API}/me/tracks?limit=1`),
        getAll<ApiPlaylist>(`${API}/me/playlists?limit=${PAGE_SIZE}`),
      ])
      const likedSongs: Source = {
        id: LIKED_SONGS_ID,
        name: 'Liked Songs',
        owner: 'You',
        trackCount: liked.total ?? 0,
        imageUrl: null,
      }
      return [likedSongs, ...playlists.map(mapPlaylist)]
    },

    getSourceTracks(sourceId: string): Promise<Track[]> {
      const market = 'market=from_token'
      if (sourceId === LIKED_SONGS_ID) {
        return readTracks<ApiSavedTrack>(sourceId, `${API}/me/tracks?limit=${PAGE_SIZE}&${market}`, (saved) =>
          playable(saved.track),
        )
      }
      return readTracks<ApiPlaylistEntry>(
        sourceId,
        `${API}/playlists/${encodeURIComponent(sourceId)}/items?limit=${PAGE_SIZE}&${market}&additional_types=track`,
        (entry) => (entry.is_local ? null : playable(entry.item ?? entry.track)),
      )
    },
  }
}

class HttpError extends Error {
  readonly status: number

  constructor(status: number, url: string) {
    super(`Spotify answered ${status} for ${url}`)
    this.name = 'HttpError'
    this.status = status
  }
}

/** The track, if it's a real track that can play: no episodes, local files or greyed-out items. */
function playable(item: ApiTrack | { type: string } | null | undefined): ApiTrack | null {
  if (!item || item.type !== 'track') return null
  const track = item as ApiTrack
  if (!track.id || track.is_local || track.is_playable === false) return null
  return track
}

function mapTrack(track: ApiTrack): Track {
  return {
    id: track.id!,
    name: track.name,
    artists: (track.artists ?? []).map((artist) => artist.name),
    durationMs: track.duration_ms,
    explicit: track.explicit,
    isrc: track.external_ids?.isrc ?? null,
  }
}

function mapPlaylist(playlist: ApiPlaylist): Source {
  return {
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner?.display_name ?? playlist.owner?.id ?? '',
    trackCount: playlist.items?.total ?? playlist.tracks?.total ?? 0,
    // Images come largest first; the list shows small covers.
    imageUrl: playlist.images?.at(-1)?.url ?? null,
  }
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000
}
