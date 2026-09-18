import { describe, expect, it } from 'vitest'
import { SessionExpiredError, SourceUnavailableError } from './errors'
import { LIKED_SONGS_ID, createWebGateway } from './webGateway'

const json = (body: unknown, status = 200, headers: Record<string, string> = {}) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } })

type Route = (url: URL, token: string) => Response | undefined

/** A fake Web API answering from `route`; anything unrouted is a 404. */
function setup(route: Route, { tokens = ['token-1', 'token-2'] } = {}) {
  const requests: URL[] = []
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
      const auth = new Headers(init?.headers).get('Authorization') ?? ''
      return route(url, auth.replace('Bearer ', '')) ?? json({ error: { status: 404 } }, 404)
    }) as typeof fetch,
    sleep: async (ms) => void waits.push(ms),
  })
  return { gateway, requests, waits, tokenRequests }
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
  owner: { display_name: `Owner ${id}` },
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
    })

    const sources = await gateway.listSources()

    expect(sources).toHaveLength(121)
    expect(sources[0]).toEqual({ id: LIKED_SONGS_ID, name: 'Liked Songs', owner: 'You', trackCount: 321, imageUrl: null })
    expect(sources[1]).toEqual({ id: 'p0', name: 'Playlist p0', owner: 'Owner p0', trackCount: 10, imageUrl: 'https://img/p0-60' })
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
    })

    const sources = await gateway.listSources()

    expect(sources.map((source) => source.id)).toEqual([LIKED_SONGS_ID, 'old', 'blank'])
    expect(sources[1]).toMatchObject({ trackCount: 7, imageUrl: null })
    expect(sources[2].imageUrl).toBeNull()
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
