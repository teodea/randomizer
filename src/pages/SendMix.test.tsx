import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { TEMPORARY_PLAYLIST, isTemporaryPlaylist } from '../app/temporaryPlaylist'
import { createFakeGateway, type FakeGatewayOptions, type FakeSource } from '../spotify/fakeGateway'
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

const library = () => [fakeSource('m', 'Morning', 6), fakeSource('e', 'Evening', 4)]

/** The logged-in mixer over `gateway`. */
function renderSpotifyMixer(gateway: SpotifyGateway) {
  const { auth } = createFakeAuth({ loggedIn: true })
  renderAt('/mix', { auth, createGateway: () => gateway })
  return userEvent.setup()
}

async function generateMix(user: ReturnType<typeof userEvent.setup>) {
  await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
  await user.click(screen.getByRole('checkbox', { name: /evening/i }))
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await screen.findByRole('list', { name: /mix/i })
}

const mixTrackNames = () =>
  within(screen.getByRole('list', { name: /mix/i }))
    .getAllByRole('listitem')
    .map((item) => item.textContent!.split(' — ')[0])

/**
 * The page lists only the first rows of a mix; Spotify holds all of it. So the
 * playlist is checked for completeness and the page for what it claims to show.
 */
function expectWrittenMatchesPage(written: string[]) {
  const shown = mixTrackNames()
  expect(written.slice(0, shown.length)).toEqual(shown)
}

async function temporaryPlaylists(gateway: SpotifyGateway) {
  return (await gateway.listSources()).filter(isTemporaryPlaylist)
}

async function trackNames(gateway: SpotifyGateway, playlistId: string) {
  return (await gateway.getSourceTracks(playlistId)).map((t) => t.name)
}

function fake(options: FakeGatewayOptions = {}, sources: FakeSource[] = library()) {
  return createFakeGateway(sources, options)
}

describe('sending a mix to Spotify', () => {
  it('writes the mix into one private temporary playlist and starts playing it', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))

    expect(await screen.findByText(/playing your mix/i)).toBeInTheDocument()
    const created = await temporaryPlaylists(gateway)
    expect(created).toHaveLength(1)
    expect(created[0]).toMatchObject({ name: TEMPORARY_PLAYLIST.name, ownedByUser: true })
    expectWrittenMatchesPage(await trackNames(gateway, created[0].id))
    expect(gateway.nowPlaying()).toBe(created[0].id)
  })

  it('overwrites the same temporary playlist with the next mix', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await generateMix(user)
    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)
    const [first] = await temporaryPlaylists(gateway)

    await user.click(screen.getByRole('button', { name: /regenerate/i }))
    await user.click(await screen.findByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)

    const after = await temporaryPlaylists(gateway)
    expect(after).toHaveLength(1)
    expect(after[0].id).toBe(first.id)
    expectWrittenMatchesPage(await trackNames(gateway, first.id))
  })

  it('reuses a temporary playlist left from an earlier visit and hides it from the sources', async () => {
    const leftover = fakeSource('old-mix', TEMPORARY_PLAYLIST.name, 3, {
      description: TEMPORARY_PLAYLIST.description,
      ownedByUser: true,
    })
    const gateway = fake({}, [...library(), leftover])
    const user = renderSpotifyMixer(gateway)
    await screen.findByRole('checkbox', { name: /morning/i })
    expect(screen.queryByRole('checkbox', { name: new RegExp(TEMPORARY_PLAYLIST.name, 'i') })).not.toBeInTheDocument()

    await generateMix(user)
    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)

    const temporary = await temporaryPlaylists(gateway)
    expect(temporary.map((playlist) => playlist.id)).toEqual(['old-mix'])
    expectWrittenMatchesPage(await trackNames(gateway, 'old-mix'))
  })

  it('never takes a playlist the user doesn’t own, or one without the marker, for its own', async () => {
    const lookalike = fakeSource('lookalike', TEMPORARY_PLAYLIST.name, 2, { ownedByUser: true })
    const someoneElses = fakeSource('shared', 'Shared mix', 2, {
      description: TEMPORARY_PLAYLIST.description,
      ownedByUser: false,
    })
    const gateway = fake({}, [...library(), lookalike, someoneElses])
    const user = renderSpotifyMixer(gateway)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)

    expect(await trackNames(gateway, 'lookalike')).toEqual(['Song lookalike1', 'Song lookalike2'])
    expect(await trackNames(gateway, 'shared')).toEqual(['Song shared1', 'Song shared2'])
    expect(screen.getByRole('checkbox', { name: /shared mix/i })).toBeInTheDocument()
  })

  it('asks the user to open Spotify on a device when none is active, and can try again', async () => {
    const gateway = fake({ playback: 'no-device' })
    const user = renderSpotifyMixer(gateway)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))

    expect(await screen.findByText(/no spotify device is active/i)).toBeInTheDocument()
    const [playlist] = await temporaryPlaylists(gateway)
    expect(screen.getByRole('link', { name: 'Open Spotify' })).toHaveAttribute(
      'href',
      `https://open.spotify.com/playlist/${playlist.id}`,
    )

    gateway.setPlayback('started')
    await user.click(screen.getByRole('button', { name: 'Try again' }))
    expect(await screen.findByText(/playing your mix/i)).toBeInTheDocument()
    expect(gateway.nowPlaying()).toBe(playlist.id)
  })

  it('offers a link to the playlist when playback needs Premium', async () => {
    const gateway = fake({ playback: 'premium-required' })
    const user = renderSpotifyMixer(gateway)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))

    expect(await screen.findByText(/needs spotify premium/i)).toBeInTheDocument()
    const [playlist] = await temporaryPlaylists(gateway)
    expect(screen.getByRole('link', { name: 'Open Spotify' })).toHaveAttribute(
      'href',
      `https://open.spotify.com/playlist/${playlist.id}`,
    )
    expect(gateway.nowPlaying()).toBeNull()
  })

  it('shows progress while a large mix is written', async () => {
    const gateway = fake({}, [fakeSource('m', 'Morning', 150), fakeSource('e', 'Evening', 100)])
    let finishWrite = () => {}
    const slow: SpotifyGateway = {
      ...gateway,
      replacePlaylistTracks: async (playlistId, trackIds, onProgress) => {
        onProgress?.(100)
        await new Promise<void>((resolve) => (finishWrite = resolve))
        await gateway.replacePlaylistTracks(playlistId, trackIds, onProgress)
      },
    }
    const user = renderSpotifyMixer(slow)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))

    expect(await screen.findByText(/100 of 250 tracks/i)).toBeInTheDocument()
    expect(screen.getByRole('progressbar')).toHaveAttribute('value', '100')
    expect(screen.getByRole('button', { name: 'Play on Spotify' })).toBeDisabled()
    expect(screen.getByRole('button', { name: /regenerate/i })).toBeDisabled()

    finishWrite()
    expect(await screen.findByText(/playing your mix/i)).toBeInTheDocument()
  })

  it('reports a failed write and lets the user try again', async () => {
    const gateway = fake()
    let failNextWrite = true
    const flaky: SpotifyGateway = {
      ...gateway,
      replacePlaylistTracks: (...args) => {
        if (failNextWrite) {
          failNextWrite = false
          return Promise.reject(new Error('Network down'))
        }
        return gateway.replacePlaylistTracks(...args)
      },
    }
    const user = renderSpotifyMixer(flaky)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t send the mix/i)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    expect(await screen.findByText(/playing your mix/i)).toBeInTheDocument()
    expect(await temporaryPlaylists(gateway)).toHaveLength(1)
  })

  it('creates the playlist on the next try when creating it failed', async () => {
    const gateway = fake()
    let failNextCreate = true
    const flaky: SpotifyGateway = {
      ...gateway,
      createPlaylist: (details) => {
        if (failNextCreate) {
          failNextCreate = false
          return Promise.reject(new Error('Network down'))
        }
        return gateway.createPlaylist(details)
      },
    }
    const user = renderSpotifyMixer(flaky)
    await generateMix(user)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t send the mix/i)
    expect(await temporaryPlaylists(gateway)).toHaveLength(0)

    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    expect(await screen.findByText(/playing your mix/i)).toBeInTheDocument()
    expect(await temporaryPlaylists(gateway)).toHaveLength(1)
  })

  it('isn’t offered in demo mode', async () => {
    renderAt('/demo')
    const user = userEvent.setup()
    await user.click(await screen.findByRole('checkbox', { name: /late night drive/i }))
    await user.click(screen.getByRole('checkbox', { name: /sunday coffee/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByRole('list', { name: /mix/i })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Play on Spotify' })).not.toBeInTheDocument()
    expect(screen.getByText(/log in to play a mix on spotify/i)).toBeInTheDocument()
  })
})
