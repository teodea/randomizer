import { SessionExpiredError } from './errors'

const AUTHORIZE_URL = 'https://accounts.spotify.com/authorize'
const TOKEN_URL = 'https://accounts.spotify.com/api/token'
const ME_URL = 'https://api.spotify.com/v1/me'

/** The minimum Spotify needs to grant for Randomizer to work. See docs on each. */
export const SCOPES = [
  // Read the user's playlists, private and collaborative ones included, and their tracks.
  'playlist-read-private',
  'playlist-read-collaborative',
  // Read Liked Songs.
  'user-library-read',
  // Create and fill the private temporary playlist (creating one needs both modify scopes).
  'playlist-modify-private',
  'playlist-modify-public',
  // Remove the temporary playlist from the library.
  'user-library-modify',
  // Find a device and start the mix on it.
  'user-read-playback-state',
  'user-modify-playback-state',
]

/** Refresh this long before the access token actually expires. */
const EXPIRY_MARGIN_MS = 60_000

const SESSION_KEY = 'randomizer.session'
const PENDING_LOGIN_KEY = 'randomizer.login'

export type LoginFailure = 'denied' | 'not-invited' | 'failed'

/** Logging in didn't work; `reason` says why, so the user can be told. */
export class LoginError extends Error {
  readonly reason: LoginFailure

  constructor(reason: LoginFailure, message: string) {
    super(message)
    this.name = 'LoginError'
    this.reason = reason
  }
}

export interface Auth {
  isLoggedIn(): boolean
  /** Sends the browser to Spotify to log in; it comes back to the redirect URI. */
  beginLogin(): Promise<void>
  /** Finishes the login from the redirect URI's query string. Throws `LoginError`. */
  completeLogin(params: URLSearchParams): Promise<void>
  /** A valid access token, refreshed when needed. Throws `SessionExpiredError` when the user must log in again. */
  getAccessToken(options?: { forceRefresh?: boolean }): Promise<string>
  /** Forgets the session in this browser. */
  logout(): void
}

export interface AuthOptions {
  clientId: string
  redirectUri: string
  /** Where the session lives between reloads. */
  storage?: Storage
  /** Where the PKCE verifier and state wait while the user is on Spotify. */
  pendingStorage?: Storage
  fetch?: typeof globalThis.fetch
  now?: () => number
  redirect?: (url: string) => void
}

interface Session {
  accessToken: string
  refreshToken: string
  /** Epoch milliseconds. */
  expiresAt: number
}

interface PendingLogin {
  verifier: string
  state: string
}

interface TokenResponse {
  access_token: string
  refresh_token?: string
  expires_in: number
}

/**
 * Authorization Code with PKCE, entirely in the browser: the Client ID is the
 * only credential. The session (access and refresh token) is kept in `storage`
 * so it survives reloads.
 */
export function createAuth({
  clientId,
  redirectUri,
  storage = localStorage,
  pendingStorage = sessionStorage,
  fetch = globalThis.fetch.bind(globalThis),
  now = Date.now,
  redirect = (url) => window.location.assign(url),
}: AuthOptions): Auth {
  let refreshing: Promise<Session> | null = null

  function readSession(): Session | null {
    return readJson<Session>(storage, SESSION_KEY)
  }

  function saveSession(response: TokenResponse, previousRefreshToken?: string) {
    const refreshToken = response.refresh_token ?? previousRefreshToken
    if (!refreshToken) throw new Error('Spotify did not return a refresh token')
    const session: Session = {
      accessToken: response.access_token,
      refreshToken,
      expiresAt: now() + response.expires_in * 1000,
    }
    storage.setItem(SESSION_KEY, JSON.stringify(session))
    return session
  }

  async function requestToken(form: Record<string, string>): Promise<Response> {
    return fetch(TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ client_id: clientId, ...form }),
    })
  }

  async function refresh(session: Session): Promise<Session> {
    const response = await requestToken({ grant_type: 'refresh_token', refresh_token: session.refreshToken })
    if (!response.ok) {
      const body = await response.json().catch(() => null)
      // invalid_grant: the refresh token expired or the user revoked access. Retrying won't help.
      if (response.status === 400 && body?.error === 'invalid_grant') {
        logout()
        throw new SessionExpiredError()
      }
      throw new Error(`Token refresh failed with status ${response.status}`)
    }
    // Another tab may have logged out meanwhile; don't bring the session back.
    if (!readSession()) throw new SessionExpiredError()
    return saveSession(await response.json(), session.refreshToken)
  }

  function logout() {
    storage.removeItem(SESSION_KEY)
    pendingStorage.removeItem(PENDING_LOGIN_KEY)
  }

  return {
    isLoggedIn: () => readSession() !== null,

    async beginLogin() {
      const verifier = randomString(64)
      const state = randomString(16)
      pendingStorage.setItem(PENDING_LOGIN_KEY, JSON.stringify({ verifier, state } satisfies PendingLogin))
      const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        code_challenge_method: 'S256',
        code_challenge: await challengeFor(verifier),
        state,
        scope: SCOPES.join(' '),
      })
      redirect(`${AUTHORIZE_URL}?${params}`)
    },

    async completeLogin(params) {
      const pending = readJson<PendingLogin>(pendingStorage, PENDING_LOGIN_KEY)
      pendingStorage.removeItem(PENDING_LOGIN_KEY)
      if (!pending || params.get('state') !== pending.state) {
        throw new LoginError('failed', 'The login response did not match the login request')
      }
      const error = params.get('error')
      if (error === 'access_denied') throw new LoginError('denied', 'The user cancelled the login')
      const code = params.get('code')
      if (error || !code) throw new LoginError('failed', `Spotify returned an error: ${error ?? 'no code'}`)

      const response = await requestToken({
        grant_type: 'authorization_code',
        code,
        redirect_uri: redirectUri,
        code_verifier: pending.verifier,
      })
      if (!response.ok) throw new LoginError('failed', `Code exchange failed with status ${response.status}`)
      const session = saveSession(await response.json())

      // In Development Mode anyone can log in, but only allowlisted accounts can call the API.
      const me = await fetch(ME_URL, { headers: { Authorization: `Bearer ${session.accessToken}` } })
      if (me.status === 403) {
        logout()
        throw new LoginError('not-invited', 'This Spotify account is not on the invite list')
      }
      if (!me.ok) {
        logout()
        throw new LoginError('failed', `Reading the profile failed with status ${me.status}`)
      }
    },

    async getAccessToken({ forceRefresh = false } = {}) {
      const session = readSession()
      if (!session) throw new SessionExpiredError()
      if (!forceRefresh && session.expiresAt - now() > EXPIRY_MARGIN_MS) return session.accessToken
      // Parallel callers share one refresh: a rotated refresh token can only be used once.
      refreshing ??= refresh(session).finally(() => {
        refreshing = null
      })
      return (await refreshing).accessToken
    },

    logout,
  }
}

function readJson<T>(storage: Storage, key: string): T | null {
  const raw = storage.getItem(key)
  if (!raw) return null
  try {
    return JSON.parse(raw) as T
  } catch {
    storage.removeItem(key)
    return null
  }
}

/** URL-safe random string from the characters PKCE allows. */
function randomString(bytes: number): string {
  return base64Url(crypto.getRandomValues(new Uint8Array(bytes)))
}

async function challengeFor(verifier: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))
  return base64Url(new Uint8Array(digest))
}

function base64Url(bytes: Uint8Array): string {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '')
}
