import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TEMPORARY_PLAYLIST, isTemporaryPlaylist } from '../app/temporaryPlaylist'
import { createFakeGateway, type FakeSource } from '../spotify/fakeGateway'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Track } from '../spotify/types'
import { createFakeAuth, renderAt } from '../test-utils'

function track(id: string): Track {
  return { id, name: `Song ${id}`, artists: [`Artist ${id}`], durationMs: 200_000, explicit: false, isrc: null }
}

function fakeSource(id: string, name: string, size: number, extra: Partial<FakeSource> = {}): FakeSource {
  return {
    id,
    name,
    owner: 'Tester',
    imageUrl: null,
    tracks: Array.from({ length: size }, (_, i) => track(`${id}${i + 1}`)),
    ...extra,
  }
}

const leftover = () =>
  fakeSource('old-mix', TEMPORARY_PLAYLIST.name, 3, { description: TEMPORARY_PLAYLIST.description, ownedByUser: true })

/** Playlists that look like the app's own but aren't: same name without the marker, or someone else's. */
const lookalikes = () => [
  fakeSource('lookalike', TEMPORARY_PLAYLIST.name, 2, { ownedByUser: true }),
  fakeSource('shared', 'Shared mix', 2, { description: TEMPORARY_PLAYLIST.description }),
]

const library = () => [fakeSource('m', 'Morning', 6), fakeSource('e', 'Evening', 4), ...lookalikes()]

function renderSpotifyMixer(gateway: SpotifyGateway) {
  const { auth } = createFakeAuth({ loggedIn: true })
  const router = renderAt('/mix', { auth, createGateway: () => gateway })
  return { auth, router, user: userEvent.setup() }
}

async function sendMix(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
  await user.click(screen.getByRole('checkbox', { name: /evening/i }))
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await user.click(await screen.findByRole('button', { name: 'Play on Spotify' }))
  await screen.findByText(/playing your mix/i)
}

const ids = async (gateway: SpotifyGateway) => (await gateway.listSources()).map((source) => source.id)
const temporaryIds = async (gateway: SpotifyGateway) =>
  (await gateway.listSources()).filter(isTemporaryPlaylist).map((source) => source.id)

/** Everything in the library but the app's own playlist, tracks included. */
async function userPlaylists(gateway: SpotifyGateway) {
  const sources = (await gateway.listSources()).filter((source) => !isTemporaryPlaylist(source))
  return Promise.all(
    sources.map(async (source) => ({ ...source, tracks: await gateway.getSourceTracks(source.id) })),
  )
}

/** Remembers whether the user was still logged in each time a playlist was removed. */
function watchRemovals(gateway: SpotifyGateway, isLoggedIn: () => boolean) {
  const loggedInAtRemoval: boolean[] = []
  const watched: SpotifyGateway = {
    ...gateway,
    removePlaylist: (playlistId) => {
      loggedInAtRemoval.push(isLoggedIn())
      return gateway.removePlaylist(playlistId)
    },
  }
  return { watched, loggedInAtRemoval }
}

describe('cleaning up the temporary playlist', () => {
  it('removes the playlist the mix was sent to, and only that one', async () => {
    const gateway = createFakeGateway(library())
    const before = await userPlaylists(gateway)
    const { user } = renderSpotifyMixer(gateway)
    await sendMix(user)
    expect(await temporaryIds(gateway)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Clean up' }))

    expect(await screen.findByText(/removed .*randomizer mix.* from your library/i)).toBeInTheDocument()
    expect(await temporaryIds(gateway)).toEqual([])
    expect(await userPlaylists(gateway)).toEqual(before)
    expect(screen.queryByRole('button', { name: 'Clean up' })).not.toBeInTheDocument()
    expect(screen.queryByText(/playing your mix/i)).not.toBeInTheDocument()
  })

  it('creates a fresh playlist for the next mix after cleaning up', async () => {
    const gateway = createFakeGateway(library())
    const { user } = renderSpotifyMixer(gateway)
    await sendMix(user)
    const [first] = await temporaryIds(gateway)
    await user.click(screen.getByRole('button', { name: 'Clean up' }))
    await screen.findByText(/removed .* from your library/i)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)

    const after = await temporaryIds(gateway)
    expect(after).toHaveLength(1)
    expect(after[0]).not.toBe(first)
  })

  it('reports a failed clean up and lets the user try again', async () => {
    const gateway = createFakeGateway(library())
    let failNext = true
    const flaky: SpotifyGateway = {
      ...gateway,
      removePlaylist: (playlistId) => {
        if (failNext) {
          failNext = false
          return Promise.reject(new Error('Network down'))
        }
        return gateway.removePlaylist(playlistId)
      },
    }
    const { user } = renderSpotifyMixer(flaky)
    await sendMix(user)

    await user.click(screen.getByRole('button', { name: 'Clean up' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t remove/i)
    expect(await temporaryIds(gateway)).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Clean up' }))
    await screen.findByText(/removed .* from your library/i)
    expect(await temporaryIds(gateway)).toEqual([])
  })

  it('isn’t offered in demo mode', async () => {
    renderAt('/demo')
    await screen.findByRole('checkbox', { name: /late night drive/i })
    expect(screen.queryByRole('button', { name: 'Clean up' })).not.toBeInTheDocument()
  })
})

describe('a temporary playlist left from an earlier visit', () => {
  it('is found on start and removed when the user accepts', async () => {
    const gateway = createFakeGateway([...library(), leftover()])
    const before = await userPlaylists(gateway)
    const { user } = renderSpotifyMixer(gateway)

    const offer = await screen.findByRole('region', { name: /earlier mix/i })
    expect(offer).toHaveTextContent(/still in your library/i)
    await user.click(within(offer).getByRole('button', { name: 'Remove it' }))

    expect(await screen.findByText(/removed .* from your library/i)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: /earlier mix/i })).not.toBeInTheDocument()
    expect(await ids(gateway)).not.toContain('old-mix')
    expect(await userPlaylists(gateway)).toEqual(before)
  })

  it('is no longer offered for removal once a mix is sent to it', async () => {
    const gateway = createFakeGateway([...library(), leftover()])
    const { user } = renderSpotifyMixer(gateway)
    await screen.findByRole('region', { name: /earlier mix/i })

    await sendMix(user)

    expect(screen.queryByRole('region', { name: /earlier mix/i })).not.toBeInTheDocument()
    expect(await temporaryIds(gateway)).toEqual(['old-mix'])
    expect(screen.getByRole('button', { name: 'Clean up' })).toBeInTheDocument()
  })

  it('isn’t offered when only lookalike playlists are in the library', async () => {
    const gateway = createFakeGateway(library())
    renderSpotifyMixer(gateway)

    await screen.findByRole('checkbox', { name: /morning/i })

    expect(screen.queryByRole('region', { name: /earlier mix/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Clean up' })).not.toBeInTheDocument()
  })
})

describe('logging out', () => {
  it('removes the temporary playlist before ending the session', async () => {
    const gateway = createFakeGateway(library())
    const before = await userPlaylists(gateway)
    const { auth } = createFakeAuth({ loggedIn: true })
    const { watched, loggedInAtRemoval } = watchRemovals(gateway, auth.isLoggedIn)
    const router = renderAt('/mix', { auth, createGateway: () => watched })
    const user = userEvent.setup()
    await sendMix(user)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(loggedInAtRemoval).toEqual([true])
    expect(auth.isLoggedIn()).toBe(false)
    expect(await temporaryIds(gateway)).toEqual([])
    expect(await userPlaylists(gateway)).toEqual(before)
  })

  it('removes a leftover temporary playlist the user never answered about', async () => {
    const gateway = createFakeGateway([...library(), leftover()])
    const { auth, router, user } = renderSpotifyMixer(gateway)
    await screen.findByRole('region', { name: /earlier mix/i })

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(auth.isLoggedIn()).toBe(false)
    expect(await ids(gateway)).not.toContain('old-mix')
  })

  it('finds and removes the temporary playlist when the library hasn’t loaded yet', async () => {
    const gateway = createFakeGateway([...library(), leftover()])
    let firstList = true
    const slow: SpotifyGateway = {
      ...gateway,
      // The page's own load never finishes; logging out has to look the playlist up itself.
      listSources: () => {
        if (!firstList) return gateway.listSources()
        firstList = false
        return new Promise(() => {})
      },
    }
    const { auth, router, user } = renderSpotifyMixer(slow)
    await screen.findByText(/loading playlists/i)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    await waitFor(() => expect(router.state.location.pathname).toBe('/'))
    expect(auth.isLoggedIn()).toBe(false)
    expect(await ids(gateway)).not.toContain('old-mix')
    expect(await ids(gateway)).toContain('lookalike')
  })

  it('still logs out when the playlist can’t be removed', async () => {
    const gateway = createFakeGateway(library())
    const failing: SpotifyGateway = { ...gateway, removePlaylist: () => Promise.reject(new Error('Network down')) }
    const { auth, router, user } = renderSpotifyMixer(failing)
    await sendMix(user)

    await user.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Log in with Spotify' })).toBeEnabled()
    expect(router.state.location.pathname).toBe('/')
    expect(auth.isLoggedIn()).toBe(false)
    expect(screen.getByRole('status')).toHaveTextContent(/logged out/i)
  })

  it('from the landing page finds and removes the temporary playlist first', async () => {
    const gateway = createFakeGateway([...library(), leftover()])
    const before = await userPlaylists(gateway)
    const { auth } = createFakeAuth({ loggedIn: true })
    const { watched, loggedInAtRemoval } = watchRemovals(gateway, auth.isLoggedIn)
    renderAt('/', { auth, createGateway: () => watched })

    await userEvent.click(screen.getByRole('button', { name: 'Log out' }))

    expect(await screen.findByRole('button', { name: 'Log in with Spotify' })).toBeEnabled()
    expect(loggedInAtRemoval).toEqual([true])
    expect(auth.isLoggedIn()).toBe(false)
    expect(await temporaryIds(gateway)).toEqual([])
    expect(await userPlaylists(gateway)).toEqual(before)
  })
})
