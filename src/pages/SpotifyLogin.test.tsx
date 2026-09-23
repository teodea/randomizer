import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { LoginError } from '../spotify/auth'
import { NotInvitedError, SessionExpiredError } from '../spotify/errors'
import { createFakeGateway, type FakeSource } from '../spotify/fakeGateway'
import { createFakeAuth, fakeServices, renderAt } from '../test-utils'

const library: FakeSource[] = [
  { id: 'liked-songs', name: 'Liked Songs', owner: 'You', imageUrl: null, tracks: [] },
  { id: 'p1', name: 'Road Trip', owner: 'Ada', imageUrl: 'https://img/p1', tracks: [] },
]

describe('logging in with Spotify', () => {
  it('sends a logged-out visitor to Spotify from the landing page', async () => {
    const { auth, calls } = createFakeAuth()
    renderAt('/', fakeServices(auth, library))

    await userEvent.click(screen.getByRole('button', { name: 'Log in with Spotify' }))

    expect(calls.beginLogin).toBe(1)
  })

  it('keeps login disabled when the build has no Client ID', () => {
    renderAt('/', { auth: null })

    expect(screen.getByRole('button', { name: 'Log in with Spotify' })).toBeDisabled()
  })

  it('finishes the login on the callback page and opens the user’s playlists', async () => {
    const { auth, calls } = createFakeAuth()
    const router = renderAt('/callback?code=abc&state=xyz', fakeServices(auth, library))

    expect(await screen.findByRole('checkbox', { name: /road trip/i })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/mix')
    expect(calls.completeLogin).toHaveLength(1)
    expect(calls.completeLogin[0].get('code')).toBe('abc')
  })

  it('sends a refused account to the invite-only page instead of back home', async () => {
    const { auth } = createFakeAuth({
      completeLogin: async () => {
        throw new LoginError('not-invited', 'nope')
      },
    })
    const router = renderAt('/callback?code=abc&state=xyz', fakeServices(auth, library))

    expect(await screen.findByRole('heading', { level: 1, name: /invite only/i })).toBeInTheDocument()
    expect(router.state.location.pathname).toBe('/invite-only')
  })

  it('offers the invite-only explanation to a login Spotify didn’t complete', async () => {
    const { auth } = createFakeAuth({
      completeLogin: async () => {
        throw new LoginError('denied', 'nope')
      },
    })
    renderAt('/callback?code=abc&state=xyz', fakeServices(auth, library))

    const notice = await screen.findByRole('alert')

    // Spotify sends the same answer for "I cancelled" and "you were turned
    // away", so the way out of the second has to be on offer here.
    expect(within(notice).getByRole('link', { name: /invite-only/i })).toHaveAttribute('href', '/invite-only')
  })

  it.each([
    ['denied', /didn.t go through/i],
    ['failed', /didn.t work/i],
  ] as const)('explains a %s login on the landing page', async (reason, message) => {
    const { auth } = createFakeAuth({
      completeLogin: async () => {
        throw new LoginError(reason, 'nope')
      },
    })
    const router = renderAt('/callback?code=abc&state=xyz', fakeServices(auth, library))

    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(router.state.location.pathname).toBe('/')
  })
})

describe('a logged-in user', () => {
  it('goes from the landing page to their real playlists, Liked Songs included', async () => {
    const { auth } = createFakeAuth({ loggedIn: true })
    renderAt('/', fakeServices(auth, library))

    await userEvent.click(screen.getByRole('link', { name: /choose your playlists/i }))

    expect(await screen.findByRole('checkbox', { name: /liked songs/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /road trip/i })).toBeInTheDocument()
    expect(screen.queryByText(/demo mode/i)).not.toBeInTheDocument()
  })

  it('logs out and cannot open the playlists any more', async () => {
    const { auth } = createFakeAuth({ loggedIn: true })
    const router = renderAt('/mix', fakeServices(auth, library))

    await userEvent.click(await screen.findByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Log in with Spotify' })).toBeEnabled()
    expect(auth.isLoggedIn()).toBe(false)
    expect(router.state.location.pathname).toBe('/')
    expect(screen.getByRole('status')).toHaveTextContent(/logged out/i)
  })

  it('is sent back to log in with a clear message when the session has expired', async () => {
    const { auth } = createFakeAuth({ loggedIn: true })
    const router = renderAt('/mix', {
      auth,
      createGateway: () => ({
        ...createFakeGateway([]),
        listSources: () => Promise.reject(new SessionExpiredError()),
        getSourceTracks: () => Promise.reject(new SessionExpiredError()),
      }),
    })

    expect(await screen.findByRole('alert')).toHaveTextContent(/session has expired/i)
    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(auth.isLoggedIn()).toBe(false)
  })

  it('is sent to the invite-only page, logged out, when the account is taken off the list', async () => {
    const { auth } = createFakeAuth({ loggedIn: true })
    const router = renderAt('/mix', {
      auth,
      createGateway: () => ({
        ...createFakeGateway([]),
        listSources: () => Promise.reject(new NotInvitedError()),
      }),
    })

    expect(await screen.findByRole('heading', { level: 1, name: /invite only/i })).toBeInTheDocument()
    await waitFor(() => expect(router.state.location.pathname).toBe('/invite-only'))
    expect(router.state.location.search).toBe('?removed')
    expect(auth.isLoggedIn()).toBe(false)
  })
})

describe('without a login', () => {
  it('sends a visitor who opens the playlists page to the landing page', () => {
    const { auth } = createFakeAuth()
    const router = renderAt('/mix', fakeServices(auth, library))

    expect(router.state.location.pathname).toBe('/')
  })
})
