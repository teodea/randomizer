import { screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { isTemporaryPlaylist } from '../app/temporaryPlaylist'
import { createFakeGateway, type FakeGateway, type FakeSource } from '../spotify/fakeGateway'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Track } from '../spotify/types'
import { createFakeAuth, renderAt } from '../test-utils'

function track(id: string): Track {
  return { id, name: `Song ${id}`, artists: [`Artist ${id}`], durationMs: 200_000, explicit: false, isrc: null }
}

function fakeSource(id: string, name: string, size: number): FakeSource {
  return {
    id,
    name,
    owner: 'Tester',
    imageUrl: null,
    tracks: Array.from({ length: size }, (_, i) => track(`${id}${i + 1}`)),
  }
}

const fake = () => createFakeGateway([fakeSource('m', 'Morning', 12), fakeSource('e', 'Evening', 12)])

function renderSpotifyMixer(gateway: SpotifyGateway) {
  const { auth } = createFakeAuth({ loggedIn: true })
  renderAt('/mix', { auth, createGateway: () => gateway })
  return userEvent.setup()
}

type User = ReturnType<typeof userEvent.setup>

async function selectSources(user: User, names: [RegExp, RegExp] = [/morning/i, /evening/i]) {
  await user.click(await screen.findByRole('checkbox', { name: names[0] }))
  await user.click(screen.getByRole('checkbox', { name: names[1] }))
}

async function generate(user: User) {
  await user.click(screen.getByRole('button', { name: /generate/i }))
  await screen.findByRole('list', { name: /mix/i })
}

/** Generates a mix and plays it, as far as the fake Spotify is concerned. */
async function playMix(user: User) {
  await selectSources(user)
  await generate(user)
  await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
  await screen.findByText(/playing your mix/i)
}

const mixItems = () => within(screen.getByRole('list', { name: /mix/i })).getAllByRole('listitem')
const mixTrackNames = () => mixItems().map((item) => item.textContent!.split(' — ')[0])

async function playlistTrackNames(gateway: FakeGateway) {
  const [temporary] = (await gateway.listSources()).filter(isTemporaryPlaylist)
  return (await gateway.getSourceTracks(temporary.id)).map((t) => t.name)
}

describe('reshuffling the rest of a playing mix', () => {
  it('keeps what has played and what is playing, and re-mixes the rest in the playlist', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await playMix(user)
    const before = await playlistTrackNames(gateway)
    gateway.playTrackAt(4)
    const playing = await gateway.getPlaybackState()

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    expect(await screen.findByText(/reshuffled the 19 tracks after the one playing now/i)).toBeInTheDocument()
    const after = await playlistTrackNames(gateway)
    expect(after.slice(0, 5)).toEqual(before.slice(0, 5))
    expect([...after.slice(5)].sort()).toEqual([...before.slice(5)].sort())
    expect(after.slice(5)).not.toEqual(before.slice(5))
    expect(mixTrackNames()).toEqual(after)
    expect(mixItems()[4]).toHaveAttribute('aria-current', 'true')
    // The same track is still playing, from the same playlist.
    expect(await gateway.getPlaybackState()).toEqual(playing)
  })

  it('can reshuffle again, from wherever playback has got to', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await playMix(user)
    gateway.playTrackAt(2)
    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))
    await screen.findByText(/reshuffled the 21 tracks/i)
    const first = await playlistTrackNames(gateway)
    gateway.playTrackAt(10)

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    expect(await screen.findByText(/reshuffled the 13 tracks/i)).toBeInTheDocument()
    expect((await playlistTrackNames(gateway)).slice(0, 11)).toEqual(first.slice(0, 11))
  })

  it('uses the settings the mix was built with, even if they have changed since', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await selectSources(user)
    await user.click(screen.getByRole('radio', { name: /balanced/i }))
    await user.click(screen.getByRole('radio', { name: /alternate/i }))
    await generate(user)
    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)
    await user.click(screen.getByRole('radio', { name: /random/i }))
    gateway.playTrackAt(3)

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    await screen.findByText(/reshuffled the 20 tracks/i)
    const sources = (await playlistTrackNames(gateway)).map((name) => name.match(/^Song (\w)/)![1])
    expect(sources.every((source, i) => i === 0 || source !== sources[i - 1])).toBe(true)
  })

  it('says so, and changes nothing, when the mix isn’t what is playing', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await playMix(user)
    const before = await playlistTrackNames(gateway)

    gateway.stopPlayback()
    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))
    expect(await screen.findByText(/your mix isn.t playing on spotify/i)).toBeInTheDocument()

    await gateway.startPlayback('m')
    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))
    expect(await screen.findByText(/your mix isn.t playing on spotify/i)).toBeInTheDocument()

    expect(await playlistTrackNames(gateway)).toEqual(before)
    expect(mixTrackNames()).toEqual(before)
  })

  it('says there is nothing left when the last track is playing', async () => {
    const gateway = fake()
    const user = renderSpotifyMixer(gateway)
    await playMix(user)
    gateway.playTrackAt(23)

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    expect(await screen.findByText(/last track of the mix is playing/i)).toBeInTheDocument()
  })

  it('reports a failed update and offers to write the whole mix again', async () => {
    const gateway = fake()
    const flaky: SpotifyGateway = {
      ...gateway,
      replacePlaylistTail: () => Promise.reject(new Error('Network down')),
    }
    const user = renderSpotifyMixer(flaky)
    await playMix(user)
    gateway.playTrackAt(1)

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t send the mix/i)
    await user.click(screen.getByRole('button', { name: 'Play on Spotify' }))
    await screen.findByText(/playing your mix/i)
    expect(await playlistTrackNames(gateway)).toEqual(mixTrackNames())
  })

  it('isn’t offered before the mix is on Spotify', async () => {
    const user = renderSpotifyMixer(fake())
    await selectSources(user)
    await generate(user)

    expect(screen.queryByRole('button', { name: /reshuffle the rest/i })).not.toBeInTheDocument()
  })
})

describe('reshuffling in demo mode', () => {
  async function demoMix() {
    renderAt('/demo')
    const user = userEvent.setup()
    await selectSources(user, [/late night drive/i, /sunday coffee/i])
    await generate(user)
    return user
  }

  it('simulates playback from the first track, one track at a time', async () => {
    const user = await demoMix()

    expect(screen.getByText(/simulated playback: track 1 of/i)).toBeInTheDocument()
    expect(mixItems()[0]).toHaveAttribute('aria-current', 'true')

    await user.click(screen.getByRole('button', { name: /next track/i }))

    expect(screen.getByText(/simulated playback: track 2 of/i)).toBeInTheDocument()
    expect(mixItems()[1]).toHaveAttribute('aria-current', 'true')
  })

  it('keeps the simulated position and what played before it, and re-mixes the rest', async () => {
    const user = await demoMix()
    await user.click(screen.getByRole('button', { name: /next track/i }))
    await user.click(screen.getByRole('button', { name: /next track/i }))
    const before = mixTrackNames()

    await user.click(screen.getByRole('button', { name: /reshuffle the rest/i }))

    const after = mixTrackNames()
    expect(await screen.findByText(new RegExp(`reshuffled the ${before.length - 3} tracks`, 'i'))).toBeInTheDocument()
    expect(after.slice(0, 3)).toEqual(before.slice(0, 3))
    expect([...after.slice(3)].sort()).toEqual([...before.slice(3)].sort())
    expect(after.slice(3)).not.toEqual(before.slice(3))
    expect(mixItems()[2]).toHaveAttribute('aria-current', 'true')
  })
})
