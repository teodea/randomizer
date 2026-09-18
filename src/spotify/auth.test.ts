import { describe, expect, it } from 'vitest'
import { createAuth, LoginError, SCOPES, type AuthOptions } from './auth'
import { SessionExpiredError } from './errors'

const CLIENT_ID = 'client-123'
const REDIRECT_URI = 'http://127.0.0.1:5173/randomizer/callback'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (key) => data.get(key) ?? null,
    key: (index) => [...data.keys()][index] ?? null,
    removeItem: (key) => void data.delete(key),
    setItem: (key, value) => void data.set(key, value),
  }
}

type Handler = (url: URL, init: RequestInit | undefined) => Response | Promise<Response>

/** A fake Spotify: accounts service and Web API, answering through `handler`. */
function fakeSpotify(handler: Handler) {
  const requests: { url: URL; init: RequestInit | undefined }[] = []
  const fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    requests.push({ url, init })
    return handler(url, init)
  }) as typeof globalThis.fetch
  return { fetch, requests }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

function tokenResponse(accessToken: string, refreshToken?: string) {
  return json({
    access_token: accessToken,
    token_type: 'Bearer',
    expires_in: 3600,
    scope: SCOPES.join(' '),
    ...(refreshToken ? { refresh_token: refreshToken } : {}),
  })
}

async function sha256Base64Url(text: string) {
  const digest = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text)))
  return btoa(String.fromCharCode(...digest)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

const formOf = (init: RequestInit | undefined) => new URLSearchParams(String(init?.body))

/** Default fake: every code exchange succeeds, /me says the user is invited. */
const happySpotify: Handler = (url, init) => {
  if (url.pathname === '/api/token') {
    const form = formOf(init)
    return form.get('grant_type') === 'authorization_code'
      ? tokenResponse('access-1', 'refresh-1')
      : tokenResponse(`refreshed-from-${form.get('refresh_token')}`)
  }
  if (url.pathname === '/v1/me') return json({ id: 'user-1', display_name: 'Ada' })
  return json({ error: { status: 404 } }, 404)
}

function setup(handler: Handler = happySpotify, overrides: Partial<AuthOptions> = {}) {
  const spotify = fakeSpotify(handler)
  const storage = memoryStorage()
  const pendingStorage = memoryStorage()
  const redirects: string[] = []
  let clock = 1_000_000
  const options: AuthOptions = {
    clientId: CLIENT_ID,
    redirectUri: REDIRECT_URI,
    storage,
    pendingStorage,
    fetch: spotify.fetch,
    now: () => clock,
    redirect: (url) => redirects.push(url),
    ...overrides,
  }
  return {
    auth: createAuth(options),
    /** A fresh instance over the same storage, as after a page reload. */
    reload: () => createAuth(options),
    spotify,
    storage,
    redirects,
    advance: (ms: number) => {
      clock += ms
    },
  }
}

/** Runs the whole login: redirect to Spotify, then come back with a code. */
async function logIn(context: ReturnType<typeof setup>) {
  await context.auth.beginLogin()
  const authorize = new URL(context.redirects.at(-1)!)
  await context.auth.completeLogin(new URLSearchParams({ code: 'the-code', state: authorize.searchParams.get('state')! }))
  return authorize
}

describe('Spotify login with PKCE', () => {
  it('sends the user to Spotify with the Client ID, a S256 challenge, a state and the minimum scopes', async () => {
    const context = setup()
    await context.auth.beginLogin()

    const authorize = new URL(context.redirects[0])
    expect(authorize.origin + authorize.pathname).toBe('https://accounts.spotify.com/authorize')
    const params = authorize.searchParams
    expect(params.get('client_id')).toBe(CLIENT_ID)
    expect(params.get('response_type')).toBe('code')
    expect(params.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(params.get('code_challenge_method')).toBe('S256')
    expect(params.get('code_challenge')).toMatch(/^[A-Za-z0-9_-]{43}$/)
    expect(params.get('state')).toMatch(/^[A-Za-z0-9_-]{16,}$/)
    expect(params.get('scope')!.split(' ').sort()).toEqual(
      [
        'playlist-read-private',
        'playlist-read-collaborative',
        'user-library-read',
        'playlist-modify-private',
        'playlist-modify-public',
        'user-library-modify',
        'user-read-playback-state',
        'user-modify-playback-state',
      ].sort(),
    )
  })

  it('exchanges the code with the matching verifier and no secret, then stays logged in across reloads', async () => {
    const context = setup()
    expect(context.auth.isLoggedIn()).toBe(false)

    const authorize = await logIn(context)

    const exchange = context.spotify.requests.find((request) => request.url.pathname === '/api/token')!
    const form = formOf(exchange.init)
    expect(exchange.init?.method).toBe('POST')
    expect(form.get('grant_type')).toBe('authorization_code')
    expect(form.get('code')).toBe('the-code')
    expect(form.get('redirect_uri')).toBe(REDIRECT_URI)
    expect(form.get('client_id')).toBe(CLIENT_ID)
    expect(form.has('client_secret')).toBe(false)
    expect(await sha256Base64Url(form.get('code_verifier')!)).toBe(authorize.searchParams.get('code_challenge'))

    const reloaded = context.reload()
    expect(reloaded.isLoggedIn()).toBe(true)
    expect(await reloaded.getAccessToken()).toBe('access-1')
  })

  it('rejects a callback whose state does not match the one it sent', async () => {
    const context = setup()
    await context.auth.beginLogin()

    const attempt = context.auth.completeLogin(new URLSearchParams({ code: 'the-code', state: 'forged' }))

    await expect(attempt).rejects.toMatchObject({ reason: 'failed' })
    expect(context.spotify.requests).toHaveLength(0)
    expect(context.auth.isLoggedIn()).toBe(false)
  })

  it('reports a login the user cancelled on Spotify', async () => {
    const context = setup()
    await context.auth.beginLogin()
    const state = new URL(context.redirects[0]).searchParams.get('state')!

    const attempt = context.auth.completeLogin(new URLSearchParams({ error: 'access_denied', state }))

    await expect(attempt).rejects.toBeInstanceOf(LoginError)
    await expect(attempt).rejects.toMatchObject({ reason: 'denied' })
  })

  it('reports an account that is not on the invite list, and does not keep its session', async () => {
    const context = setup((url, init) =>
      url.pathname === '/v1/me'
        ? json({ error: { status: 403, message: 'User not registered in the Developer Dashboard' } }, 403)
        : happySpotify(url, init),
    )

    await expect(logIn(context)).rejects.toMatchObject({ reason: 'not-invited' })
    expect(context.auth.isLoggedIn()).toBe(false)
    expect(context.storage.length).toBe(0)
  })
})

describe('Spotify session', () => {
  it('refreshes the access token shortly before it expires, keeping the refresh token Spotify did not replace', async () => {
    const context = setup()
    await logIn(context)

    context.advance(3_550_000)
    expect(await context.auth.getAccessToken()).toBe('refreshed-from-refresh-1')

    const refresh = formOf(context.spotify.requests.at(-1)!.init)
    expect(refresh.get('grant_type')).toBe('refresh_token')
    expect(refresh.get('client_id')).toBe(CLIENT_ID)

    context.advance(3_600_000)
    expect(await context.reload().getAccessToken()).toBe('refreshed-from-refresh-1')
  })

  it('stores a new refresh token when Spotify rotates it', async () => {
    const context = setup((url, init) =>
      url.pathname === '/api/token' && formOf(init).get('grant_type') === 'refresh_token'
        ? tokenResponse('access-2', 'refresh-2')
        : happySpotify(url, init),
    )
    await logIn(context)

    expect(await context.auth.getAccessToken({ forceRefresh: true })).toBe('access-2')
    context.advance(3_600_000)
    await context.auth.getAccessToken()

    expect(formOf(context.spotify.requests.at(-1)!.init).get('refresh_token')).toBe('refresh-2')
  })

  it('refreshes only once when several requests need a token at the same time', async () => {
    const context = setup()
    await logIn(context)
    context.advance(3_600_000)

    const tokens = await Promise.all([1, 2, 3].map(() => context.auth.getAccessToken()))

    expect(new Set(tokens).size).toBe(1)
    const refreshes = context.spotify.requests.filter((request) => formOf(request.init).get('grant_type') === 'refresh_token')
    expect(refreshes).toHaveLength(1)
  })

  it('ends the session when Spotify rejects the refresh token', async () => {
    const context = setup((url, init) =>
      url.pathname === '/api/token' && formOf(init).get('grant_type') === 'refresh_token'
        ? json({ error: 'invalid_grant', error_description: 'Refresh token revoked' }, 400)
        : happySpotify(url, init),
    )
    await logIn(context)
    context.advance(3_600_000)

    await expect(context.auth.getAccessToken()).rejects.toBeInstanceOf(SessionExpiredError)
    expect(context.auth.isLoggedIn()).toBe(false)
  })

  it('keeps the session when a refresh fails for another reason', async () => {
    const context = setup((url, init) =>
      url.pathname === '/api/token' && formOf(init).get('grant_type') === 'refresh_token'
        ? json({ error: 'server_error' }, 503)
        : happySpotify(url, init),
    )
    await logIn(context)
    context.advance(3_600_000)

    await expect(context.auth.getAccessToken()).rejects.not.toBeInstanceOf(SessionExpiredError)
    expect(context.auth.isLoggedIn()).toBe(true)
  })

  it('has no token to give when nobody is logged in', async () => {
    await expect(setup().auth.getAccessToken()).rejects.toBeInstanceOf(SessionExpiredError)
  })

  it('forgets the session on logout', async () => {
    const context = setup()
    await logIn(context)

    context.auth.logout()

    expect(context.auth.isLoggedIn()).toBe(false)
    expect(context.reload().isLoggedIn()).toBe(false)
    expect(context.storage.length).toBe(0)
  })
})
