import { SessionExpiredError, SourceUnavailableError } from './errors'
import type { PlaybackOutcome, PlaybackState, SpotifyGateway } from './gateway'
import type { Source, Track } from './types'

const API = 'https://api.spotify.com/v1'

/** Liked Songs isn't a playlist, so it gets an ID no Spotify playlist can have. */
export const LIKED_SONGS_ID = 'liked-songs'

/** The Web API's largest page for playlists, playlist items and saved tracks. */
const PAGE_SIZE = 50
/** The most tracks one request can add to, or remove from, a playlist. */
const WRITE_BATCH_SIZE = 100
/** How many times to wait out a rate limit before giving up. */
const MAX_RATE_LIMIT_RETRIES = 5

export interface WebGatewayOptions {
  getAccessToken: (options?: { forceRefresh?: boolean }) => Promise<string>
  fetch?: typeof globalThis.fetch
  sleep?: (ms: number) => Promise<void>
}

// The parts of the Web API's responses the app reads. The February 2026 changes
// renamed some fields; both names are accepted while Spotify serves either.

interface RequestOptions {
  method?: string
  /** Sent as JSON. */
  body?: unknown
}

interface Paging<T> {
  items: (T | null)[]
  total?: number
  next: string | null
}

interface ApiPlaylist {
  id: string
  name: string
  description?: string | null
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
  /** The track as the playlist lists it, when Spotify plays a copy available in the user's market. */
  linked_from?: { id?: string } | null
}

interface ApiPlaybackState {
  context?: { type?: string; uri?: string } | null
  item?: ApiTrack | { type: string; id?: string } | null
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
  /** Calls a Web API URL, refreshing the token once on 401 and waiting out rate limits. */
  async function request(url: string, { method = 'GET', body }: RequestOptions = {}) {
    let token = await getAccessToken()
    let refreshed = false
    for (let rateLimited = 0; ; ) {
      const headers: Record<string, string> = { Authorization: `Bearer ${token}` }
      if (body !== undefined) headers['Content-Type'] = 'application/json'
      const response = await fetch(url, {
        method,
        headers,
        body: body === undefined ? undefined : JSON.stringify(body),
      })
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

  /** Like `request`, but any answer other than a success is an `HttpError`. */
  async function requestOk(url: string, options?: RequestOptions): Promise<Response> {
    const response = await request(url, options)
    if (!response.ok) throw new HttpError(response.status, url)
    return response
  }

  async function getJson<T>(url: string): Promise<T> {
    return (await requestOk(url)).json() as Promise<T>
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

  async function replacePlaylistTracks(
    playlistId: string,
    trackIds: string[],
    onProgress?: (written: number) => void,
  ): Promise<void> {
    const url = playlistItemsUrl(playlistId)
    const uris = trackIds.map(trackUri)
    // PUT replaces everything with the first batch; POST appends the rest.
    await requestOk(url, { method: 'PUT', body: { uris: uris.slice(0, WRITE_BATCH_SIZE) } })
    onProgress?.(Math.min(WRITE_BATCH_SIZE, uris.length))
    for (let start = WRITE_BATCH_SIZE; start < uris.length; start += WRITE_BATCH_SIZE) {
      const batch = uris.slice(start, start + WRITE_BATCH_SIZE)
      await requestOk(url, { method: 'POST', body: { uris: batch } })
      onProgress?.(start + batch.length)
    }
  }

  return {
    async listSources(): Promise<Source[]> {
      const [me, liked, playlists] = await Promise.all([
        // Playlists name their owner by `id`, so that's what to compare, not `account_id`.
        getJson<{ id: string }>(`${API}/me`),
        getJson<Paging<ApiSavedTrack>>(`${API}/me/tracks?limit=1`),
        getAll<ApiPlaylist>(`${API}/me/playlists?limit=${PAGE_SIZE}`),
      ])
      const likedSongs: Source = {
        id: LIKED_SONGS_ID,
        name: 'Liked Songs',
        owner: 'You',
        trackCount: liked.total ?? 0,
        imageUrl: null,
        description: null,
        ownedByUser: true,
      }
      return [likedSongs, ...playlists.map((playlist) => mapPlaylist(playlist, me.id))]
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

    async createPlaylist({ name, description }) {
      // New playlists are public unless told otherwise.
      const response = await requestOk(`${API}/me/playlists`, {
        method: 'POST',
        body: { name, description, public: false },
      })
      const playlist: { id: string } = await response.json()
      return playlist.id
    },

    replacePlaylistTracks,

    async replacePlaylistTail(playlistId, kept, currentTail, nextTail, onProgress) {
      // Removing a track by URI removes every copy of it. If a kept track would go too, rewrite it all.
      const keptIds = new Set(kept)
      if (currentTail.some((id) => keptIds.has(id))) {
        await replacePlaylistTracks(playlistId, [...kept, ...nextTail], (written) =>
          onProgress?.(Math.max(0, written - kept.length)),
        )
        return
      }
      const url = playlistItemsUrl(playlistId)
      const removed = [...new Set(currentTail)].map(trackUri)
      for (let start = 0; start < removed.length; start += WRITE_BATCH_SIZE) {
        const items = removed.slice(start, start + WRITE_BATCH_SIZE).map((uri) => ({ uri }))
        await requestOk(url, { method: 'DELETE', body: { items } })
      }
      const added = nextTail.map(trackUri)
      for (let start = 0; start < added.length; start += WRITE_BATCH_SIZE) {
        const batch = added.slice(start, start + WRITE_BATCH_SIZE)
        await requestOk(url, { method: 'POST', body: { uris: batch } })
        onProgress?.(start + batch.length)
      }
    },

    async startPlayback(playlistId): Promise<PlaybackOutcome> {
      const url = `${API}/me/player/play`
      const response = await request(url, {
        method: 'PUT',
        body: { context_uri: `spotify:playlist:${playlistId}`, offset: { position: 0 } },
      })
      if (response.status === 404) return 'no-device'
      if (response.status === 403) {
        const body = await response.json().catch(() => null)
        if (body?.error?.reason === 'PREMIUM_REQUIRED') return 'premium-required'
      }
      if (!response.ok) throw new HttpError(response.status, url)
      // With shuffle on, Spotify would scramble the mix's order. Playback has started either way.
      await request(`${API}/me/player/shuffle?state=false`, { method: 'PUT' }).catch(() => undefined)
      return 'started'
    },

    async getPlaybackState(): Promise<PlaybackState | null> {
      const response = await requestOk(`${API}/me/player?market=from_token`)
      // 204: nothing is playing on any device.
      if (response.status === 204) return null
      const state: ApiPlaybackState | null = await response.json().catch(() => null)
      if (!state) return null
      const context = state.context?.type === 'playlist' ? state.context.uri : undefined
      const item = state.item?.type === 'track' ? (state.item as ApiTrack) : null
      return {
        playlistId: context?.split(':').at(-1) ?? null,
        trackId: item ? (item.linked_from?.id ?? item.id) : null,
      }
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

function mapPlaylist(playlist: ApiPlaylist, userId: string): Source {
  return {
    id: playlist.id,
    name: playlist.name,
    owner: playlist.owner?.display_name ?? playlist.owner?.id ?? '',
    trackCount: playlist.items?.total ?? playlist.tracks?.total ?? 0,
    // Images come largest first; the list shows small covers.
    imageUrl: playlist.images?.at(-1)?.url ?? null,
    description: playlist.description || null,
    ownedByUser: playlist.owner?.id === userId,
  }
}

function playlistItemsUrl(playlistId: string): string {
  return `${API}/playlists/${encodeURIComponent(playlistId)}/items`
}

function trackUri(trackId: string): string {
  return `spotify:track:${trackId}`
}

function retryAfterMs(response: Response): number {
  const seconds = Number(response.headers.get('Retry-After'))
  return Number.isFinite(seconds) && seconds > 0 ? seconds * 1000 : 1000
}
