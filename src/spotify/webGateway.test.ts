import { describe, expect, it } from 'vitest'
import { SessionExpiredError, SourceUnavailableError } from './errors'
import { LIKED_SONGS_ID, createWebGateway } from './webGateway'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

interface Sent {
  method: string
  url: URL
  body: unknown
}

type Route = (url: URL, token: string, sent: Sent) => Response | undefined

/** A fake Web API answering from `route`; anything unrouted is a 404. */
function setup(route: Route, { tokens = ['token-1', 'token-2'] } = {}) {
  const requests: URL[] = []
  const sent: Sent[] = []
  const waits: number[] = []
  const tokenRequests: { forceRefresh?: boolean }[] = []
  let token = 0
  const gateway = createWebGateway({
    getAccessToken: async (options = {}) => {
      tokenRequests.push(options)
      if (options.forceRefresh) token++
      return tokens[Math.min(token, tokens.length - 1)]
    },
    fetch: (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input))
      requests.push(url)
      const request: Sent = {
        method: init?.method ?? 'GET',
        url,
        body: typeof init?.body === 'string' ? JSON.parse(init.body) : undefined,
      }
      sent.push(request)
      const auth = new Headers(init?.headers).get('Authorization') ?? ''
      return route(url, auth.replace('Bearer ', ''), request) ?? json({ error: { status: 404 } }, 404)
    }) as typeof fetch,
    sleep: async (ms) => void waits.push(ms),
  })
  return { gateway, requests, sent, waits, tokenRequests }
}

function page<T>(url: URL, all: T[], size: number) {
  const offset = Number(url.searchParams.get('offset') ?? 0)
  const next = new URL(url)
  next.searchParams.set('offset', String(offset + size))
  return {
    items: all.slice(offset, offset + size),
    total: all.length,
    next: offset + size < all.length ? next.toString() : null,
  }
}

const playlist = (id: string, extra: object = {}) => ({
  id,
  name: `Playlist ${id}`,
  description: '',
  owner: { display_name: `Owner ${id}`, id: `user-${id}` },
  images: [
    { url: `https://img/${id}-640`, width: 640, height: 640 },
    { url: `https://img/${id}-60`, width: 60, height: 60 },
  ],
  items: { total: 10 },
  ...extra,
})

const track = (id: string, extra: object = {}) => ({
  type: 'track',
  id,
  name: `Song ${id}`,
  artists: [{ name: `Artist ${id}` }, { name: 'Guest' }],
  duration_ms: 180_000,
  explicit: false,
  external_ids: { isrc: `ISRC${id}` },
  is_local: false,
  ...extra,
})

describe('real Spotify gateway: sources', () => {
  it('lists Liked Songs first, then every playlist across pages', async () => {
    const playlists = Array.from({ length: 120 }, (_, i) => playlist(`p${i}`))
    const { gateway, requests } = setup((url) => {
      if (url.pathname === '/v1/me/playlists') return json(page(url, playlists, 50))
      if (url.pathname === '/v1/me/tracks') return json({ items: [], total: 321, next: null })
      if (url.pathname === '/v1/me') return json({ id: 'me' })
    })

    const sources = await gateway.listSources()

    expect(sources).toHaveLength(121)
    expect(sources[0]).toEqual({
      id: LIKED_SONGS_ID,
      name: 'Liked Songs',
      owner: 'You',
      trackCount: 321,
      imageUrl: null,
      description: null,
      ownedByUser: true,
    })
    expect(sources[1]).toEqual({
      id: 'p0',
      name: 'Playlist p0',
      owner: 'Owner p0',
      trackCount: 10,
      imageUrl: 'https://img/p0-60',
      description: null,
      ownedByUser: false,
    })
    expect(sources.at(-1)!.id).toBe('p119')
    expect(requests.filter((url) => url.pathname === '/v1/me/playlists')).toHaveLength(3)
  })

  it('copes with the older playlist shape, missing images and empty slots', async () => {
    const { gateway } = setup((url) => {
      if (url.pathname === '/v1/me/playlists')
        return json({
          items: [
            playlist('old', { items: undefined, tracks: { total: 7 }, images: null }),
            null,
            playlist('blank', { images: [] }),
          ],
          next: null,
        })
      if (url.pathname === '/v1/me/tracks') return json({ items: [], total: 0, next: null })
      if (url.pathname === '/v1/me') return json({ id: 'me' })
    })

    const sources = await gateway.listSources()

    expect(sources.map((source) => source.id)).toEqual([LIKED_SONGS_ID, 'old', 'blank'])
    expect(sources[1]).toMatchObject({ trackCount: 7, imageUrl: null })
    expect(sources[2].imageUrl).toBeNull()
  })

  it('says which playlists the user owns and keeps their descriptions', async () => {
    const { gateway } = setup((url) => {
      if (url.pathname === '/v1/me/playlists')
        return json({
          items: [
            playlist('mine', { owner: { display_name: 'Me', id: 'me' }, description: 'Made by me' }),
            playlist('theirs', { description: 'Made by them' }),
          ],
          next: null,
        })
      if (url.pathname === '/v1/me/tracks') return json({ items: [], total: 0, next: null })
      if (url.pathname === '/v1/me') return json({ id: 'me' })
    })

    const [, mine, theirs] = await gateway.listSources()

    expect(mine).toMatchObject({ ownedByUser: true, description: 'Made by me' })
    expect(theirs).toMatchObject({ ownedByUser: false, description: 'Made by them' })
  })
})

describe('real Spotify gateway: tracks', () => {
  it('reads every page of a playlist, for the user’s market, mapping tracks for the mixer', async () => {
    const entries = Array.from({ length: 75 }, (_, i) => ({ is_local: false, item: track(`t${i}`) }))
    const { gateway, requests } = setup((url) =>
      url.pathname === '/v1/playlists/p1/items' ? json(page(url, entries, 50)) : undefined,
    )

    const tracks = await gateway.getSourceTracks('p1')

    expect(tracks).toHaveLength(75)
    expect(tracks[0]).toEqual({
      id: 't0',
      name: 'Song t0',
      artists: ['Artist t0', 'Guest'],
      durationMs: 180_000,
      explicit: false,
      isrc: 'ISRCt0',
    })
    expect(requests[0].searchParams.get('market')).toBe('from_token')
  })

  it('skips local files, episodes, unplayable and removed items', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/playlists/p1/items'
        ? json({
            items: [
              { is_local: false, item: track('keep') },
              { is_local: true, item: track('local', { id: null, is_local: true }) },
              { is_local: false, item: { type: 'episode', id: 'ep', name: 'Podcast' } },
              { is_local: false, item: track('greyed', { is_playable: false }) },
              { is_local: false, item: null },
              { is_local: false, track: track('legacy-shape', { external_ids: {} }) },
            ],
            next: null,
          })
        : undefined,
    )

    const tracks = await gateway.getSourceTracks('p1')

    expect(tracks.map((t) => t.id)).toEqual(['keep', 'legacy-shape'])
    expect(tracks[1].isrc).toBeNull()
  })

  it('reads Liked Songs from the library', async () => {
    const saved = Array.from({ length: 60 }, (_, i) => ({ added_at: '2026-01-01', track: track(`l${i}`) }))
    const { gateway } = setup((url) => (url.pathname === '/v1/me/tracks' ? json(page(url, saved, 50)) : undefined))

    const tracks = await gateway.getSourceTracks(LIKED_SONGS_ID)

    expect(tracks).toHaveLength(60)
    expect(tracks[59].id).toBe('l59')
  })

  it.each([403, 404])('reports a playlist Spotify answers with %i for as unavailable', async (status) => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/playlists/p1/items' ? json({ error: { status, message: 'Forbidden' } }, status) : undefined,
    )

    const attempt = gateway.getSourceTracks('p1')

    await expect(attempt).rejects.toBeInstanceOf(SourceUnavailableError)
    await expect(attempt).rejects.toMatchObject({ sourceId: 'p1' })
  })
})

const uris = ({ body }: Sent) => (body as { uris: string[] }).uris

describe('real Spotify gateway: temporary playlist', () => {
  it('creates a private playlist in the user’s library', async () => {
    const { gateway, sent } = setup((url, _token, { method }) =>
      method === 'POST' && url.pathname === '/v1/me/playlists' ? json({ id: 'new-playlist' }, 201) : undefined,
    )

    const id = await gateway.createPlaylist({ name: 'Mix', description: 'Temporary' })

    expect(id).toBe('new-playlist')
    expect(sent[0].body).toEqual({ name: 'Mix', description: 'Temporary', public: false })
  })

  it('replaces the tracks in batches of 100, in order, reporting progress', async () => {
    const ids = Array.from({ length: 250 }, (_, i) => `t${i}`)
    const { gateway, sent } = setup((url) =>
      url.pathname === '/v1/playlists/tmp/items' ? json({ snapshot_id: 'snap' }, 201) : undefined,
    )
    const progress: number[] = []

    await gateway.replacePlaylistTracks('tmp', ids, (written) => progress.push(written))

    expect(sent.map(({ method }) => method)).toEqual(['PUT', 'POST', 'POST'])
    expect(sent.map((request) => uris(request).length)).toEqual([100, 100, 50])
    expect(sent.flatMap(uris)).toEqual(ids.map((id) => `spotify:track:${id}`))
    expect(progress).toEqual([100, 200, 250])
  })

  it('empties the playlist when there is nothing to write', async () => {
    const { gateway, sent } = setup((url) =>
      url.pathname === '/v1/playlists/tmp/items' ? json({ snapshot_id: 'snap' }) : undefined,
    )

    await gateway.replacePlaylistTracks('tmp', [])

    expect(sent).toEqual([expect.objectContaining({ method: 'PUT', body: { uris: [] } })])
  })

  it('finishes a large write through rate limits without giving up', async () => {
    const ids = Array.from({ length: 1000 }, (_, i) => `t${i}`)
    let calls = 0
    const { gateway, sent, waits } = setup((url) => {
      if (url.pathname !== '/v1/playlists/tmp/items') return undefined
      calls++
      return calls % 2 === 0
        ? json({ error: { status: 429 } }, 429, { 'Retry-After': '2' })
        : json({ snapshot_id: 'snap' }, 201)
    })

    await gateway.replacePlaylistTracks('tmp', ids)

    const accepted = sent.filter((_, index) => index % 2 === 0)
    expect(accepted.flatMap(uris)).toEqual(ids.map((id) => `spotify:track:${id}`))
    expect(waits).toEqual(Array(9).fill(2000))
  })

  it('plays the playlist in order from its first track', async () => {
    const { gateway, sent } = setup((url) =>
      url.pathname === '/v1/me/player/play' || url.pathname === '/v1/me/player/shuffle'
        ? new Response(null, { status: 204 })
        : undefined,
    )

    expect(await gateway.startPlayback('tmp')).toBe('started')
    expect(sent[0]).toMatchObject({
      method: 'PUT',
      body: { context_uri: 'spotify:playlist:tmp', offset: { position: 0 } },
    })
    expect(sent[1]).toMatchObject({ method: 'PUT' })
    expect(sent[1].url.pathname).toBe('/v1/me/player/shuffle')
    expect(sent[1].url.searchParams.get('state')).toBe('false')
  })

  it('still reports playback as started when shuffle can’t be turned off', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/me/player/play' ? new Response(null, { status: 204 }) : undefined,
    )

    expect(await gateway.startPlayback('tmp')).toBe('started')
  })

  it('reports when no device is active', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/me/player/play'
        ? json({ error: { status: 404, message: 'No active device found', reason: 'NO_ACTIVE_DEVICE' } }, 404)
        : undefined,
    )

    expect(await gateway.startPlayback('tmp')).toBe('no-device')
  })

  it('reports when playback needs Premium', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/me/player/play'
        ? json({ error: { status: 403, message: 'Premium required', reason: 'PREMIUM_REQUIRED' } }, 403)
        : undefined,
    )

    expect(await gateway.startPlayback('tmp')).toBe('premium-required')
  })

  it('fails when playback is refused for any other reason', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/me/player/play'
        ? json({ error: { status: 403, message: 'Restricted device', reason: 'UNKNOWN' } }, 403)
        : undefined,
    )

    await expect(gateway.startPlayback('tmp')).rejects.toThrow(/403/)
  })
})

describe('real Spotify gateway: reshuffling', () => {
  it('reads what is playing and from which playlist', async () => {
    const { gateway, requests } = setup((url) =>
      url.pathname === '/v1/me/player'
        ? json({ is_playing: true, context: { type: 'playlist', uri: 'spotify:playlist:tmp' }, item: track('t7') })
        : undefined,
    )

    expect(await gateway.getPlaybackState()).toEqual({ playlistId: 'tmp', trackId: 't7' })
    expect(requests[0].searchParams.get('market')).toBe('from_token')
  })

  it('names the track as it is in the playlist when Spotify plays a relinked copy', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/me/player'
        ? json({
            context: { type: 'playlist', uri: 'spotify:playlist:tmp' },
            item: track('regional', { linked_from: { id: 'original' } }),
          })
        : undefined,
    )

    expect(await gateway.getPlaybackState()).toEqual({ playlistId: 'tmp', trackId: 'original' })
  })

  it('reports nothing playing, or something not from a playlist', async () => {
    const nothing = setup((url) => (url.pathname === '/v1/me/player' ? new Response(null, { status: 204 }) : undefined))
    const album = setup((url) =>
      url.pathname === '/v1/me/player'
        ? json({ context: { type: 'album', uri: 'spotify:album:x' }, item: { type: 'episode', id: 'e1' } })
        : undefined,
    )

    expect(await nothing.gateway.getPlaybackState()).toBeNull()
    expect(await album.gateway.getPlaybackState()).toEqual({ playlistId: null, trackId: null })
  })

  it('swaps only the tracks after the kept ones, so the kept ones stay in place', async () => {
    const { gateway, sent } = setup((url) =>
      url.pathname === '/v1/playlists/tmp/items' ? json({ snapshot_id: 'snap' }) : undefined,
    )
    const rest = Array.from({ length: 150 }, (_, i) => `r${i}`)
    const progress: number[] = []

    await gateway.replacePlaylistTail('tmp', ['k1', 'k2'], rest, [...rest].reverse(), (written) =>
      progress.push(written),
    )

    expect(sent.map(({ method }) => method)).toEqual(['DELETE', 'DELETE', 'POST', 'POST'])
    const removed = sent.slice(0, 2).flatMap(({ body }) => (body as { items: { uri: string }[] }).items)
    expect(removed.map(({ uri }) => uri)).toEqual(rest.map((id) => `spotify:track:${id}`))
    expect(sent.slice(2).flatMap(uris)).toEqual([...rest].reverse().map((id) => `spotify:track:${id}`))
    expect(progress).toEqual([100, 150])
  })

  it('rewrites the whole playlist when a track to move also plays earlier', async () => {
    // Removing a track by URI removes every copy of it, the kept one included.
    const { gateway, sent } = setup((url) =>
      url.pathname === '/v1/playlists/tmp/items' ? json({ snapshot_id: 'snap' }) : undefined,
    )
    const progress: number[] = []

    await gateway.replacePlaylistTail('tmp', ['k1', 'r1'], ['r1', 'r2'], ['r2', 'r1'], (written) =>
      progress.push(written),
    )

    expect(sent.map(({ method }) => method)).toEqual(['PUT'])
    expect(uris(sent[0])).toEqual(['k1', 'r1', 'r2', 'r1'].map((id) => `spotify:track:${id}`))
    expect(progress).toEqual([2])
  })
})

describe('real Spotify gateway: HTTP', () => {
  it('waits for Retry-After and tries again when rate limited', async () => {
    let calls = 0
    const { gateway, waits } = setup((url) => {
      if (url.pathname !== '/v1/playlists/p1/items') return undefined
      calls++
      return calls === 1
        ? json({ error: { status: 429 } }, 429, { 'Retry-After': '3' })
        : json({ items: [{ is_local: false, item: track('a') }], next: null })
    })

    expect(await gateway.getSourceTracks('p1')).toHaveLength(1)
    expect(waits).toEqual([3000])
  })

  it('gives up straight away when the Development Mode quota is used up', async () => {
    const { gateway, waits } = setup((url) =>
      url.pathname === '/v1/playlists/p1/items'
        ? json({ error: { status: 429, message: 'Quota exceeded' }, reason: 'QUOTA_EXCEEDED' }, 429, { 'Retry-After': '3' })
        : undefined,
    )

    await expect(gateway.getSourceTracks('p1')).rejects.toThrow(/quota/i)
    expect(waits).toEqual([])
  })

  it('refreshes the token once when Spotify says it is no longer valid', async () => {
    const { gateway, tokenRequests } = setup((url, token) => {
      if (url.pathname !== '/v1/playlists/p1/items') return undefined
      return token === 'token-1'
        ? json({ error: { status: 401, message: 'The access token expired' } }, 401)
        : json({ items: [{ is_local: false, item: track('a') }], next: null })
    })

    expect(await gateway.getSourceTracks('p1')).toHaveLength(1)
    expect(tokenRequests.filter((request) => request.forceRefresh)).toHaveLength(1)
  })

  it('treats a token Spotify keeps rejecting as an expired session', async () => {
    const { gateway } = setup((url) =>
      url.pathname === '/v1/playlists/p1/items' ? json({ error: { status: 401 } }, 401) : undefined,
    )

    await expect(gateway.getSourceTracks('p1')).rejects.toBeInstanceOf(SessionExpiredError)
  })
})
