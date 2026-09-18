import { fireEvent, render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { MemoryRouter } from 'react-router'
import { describe, expect, it } from 'vitest'
import { createFakeGateway, type FakeSource } from '../spotify/fakeGateway'
import type { SpotifyGateway } from '../spotify/gateway'
import type { Track } from '../spotify/types'
import { Mixer } from './Mixer'

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

function renderMixer(
  gateway: SpotifyGateway = createFakeGateway([
    fakeSource('m', 'Morning', 6),
    fakeSource('e', 'Evening', 4),
    fakeSource('w', 'Weekend', 3),
  ]),
) {
  let seed = 0
  render(
    <MemoryRouter>
      <Mixer gateway={gateway} newSeed={() => ++seed} />
    </MemoryRouter>,
  )
  return userEvent.setup()
}

const selection = () => within(screen.getByRole('region', { name: /selected/i }))
const mixOrder = () =>
  within(screen.getByRole('list', { name: /mix/i }))
    .getAllByRole('listitem')
    .map((item) => item.textContent)

describe('Mixer', () => {
  it('lists the sources from the gateway', async () => {
    renderMixer()

    expect(await screen.findByRole('checkbox', { name: /morning/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /evening/i })).toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /weekend/i })).toBeInTheDocument()
  })

  it('shows the current selection as sources are selected and removed', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /weekend/i }))
    expect(selection().getByText('Morning')).toBeInTheDocument()
    expect(selection().getByText('Weekend')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /morning/i }))
    expect(selection().queryByText('Morning')).not.toBeInTheDocument()

    await user.click(selection().getByRole('button', { name: /remove weekend/i }))
    expect(selection().queryByText('Weekend')).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /weekend/i })).not.toBeChecked()
  })

  it('needs at least two sources to generate a mix', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()

    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    expect(screen.getByRole('button', { name: /generate/i })).toBeEnabled()
  })

  it('generates a mix of every track from the selected sources, and regenerates it in a new order', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByText('10 tracks')).toBeInTheDocument()
    const first = mixOrder()
    expect(first).toHaveLength(10)
    expect(first).toContain('Song m1 — Artist m1')
    expect(first).toContain('Song e4 — Artist e4')
    expect(first.some((line) => line?.startsWith('Song w'))).toBe(false)

    await user.click(screen.getByRole('button', { name: /regenerate/i }))
    await screen.findByText('10 tracks')
    const second = mixOrder()
    expect([...second].sort()).toEqual([...first].sort())
    expect(second).not.toEqual(first)
  })

  it('reports a failed track read and lets the user try again', async () => {
    const fake = createFakeGateway([fakeSource('m', 'Morning', 2), fakeSource('e', 'Evening', 2)])
    let failNextRead = true
    const user = renderMixer({
      ...fake,
      getSourceTracks: (id) => {
        if (failNextRead) {
          failNextRead = false
          return Promise.reject(new Error('Network down'))
        }
        return fake.getSourceTracks(id)
      },
    })

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(await screen.findByRole('alert')).toHaveTextContent(/couldn.t read the tracks/i)

    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(await screen.findByText('4 tracks')).toBeInTheDocument()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('applies custom weights: a source at 100% fills the mix until it runs out', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('radio', { name: /custom/i }))
    fireEvent.change(screen.getByRole('slider', { name: /morning/i }), { target: { value: '100' } })
    await user.click(screen.getByRole('button', { name: /generate/i }))

    await screen.findByText('10 tracks')
    const order = mixOrder()
    expect(order.slice(0, 6).every((line) => line?.startsWith('Song m'))).toBe(true)
    expect(order.slice(6).every((line) => line?.startsWith('Song e'))).toBe(true)
  })

  it('keeps custom weights adding up to 100%', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('checkbox', { name: /weekend/i }))
    await user.click(screen.getByRole('radio', { name: /custom/i }))
    const slider = (name: RegExp) => screen.getByRole('slider', { name })

    expect([slider(/morning/i), slider(/evening/i), slider(/weekend/i)].map((s) => Number(s.getAttribute('value')))
      .reduce((a, b) => a + b)).toBe(100)

    fireEvent.change(slider(/morning/i), { target: { value: '60' } })

    expect(slider(/morning/i)).toHaveValue('60')
    expect(slider(/evening/i)).toHaveValue('20')
    expect(slider(/weekend/i)).toHaveValue('20')
    expect(screen.getByText('20%', { selector: 'output[for="weight-e"]' })).toBeInTheDocument()
  })

  it('applies balanced weighting: a small source is not drowned out by a big one', async () => {
    const user = renderMixer(createFakeGateway([fakeSource('m', 'Morning', 40), fakeSource('e', 'Evening', 4)]))

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('radio', { name: /balanced/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))

    await screen.findByText('44 tracks')
    // Balanced: Evening is drawn about half the time until its 4 tracks are gone.
    expect(mixOrder().slice(0, 20).filter((line) => line?.startsWith('Song e'))).toHaveLength(4)
  })

  it('uses uniform weighting by default', async () => {
    renderMixer()

    expect(await screen.findByRole('radio', { name: /uniform/i })).toBeChecked()
    expect(screen.queryByRole('slider')).not.toBeInTheDocument()
  })

  describe('pool settings', () => {
    function poolGateway() {
      const shared = track('shared')
      return createFakeGateway([
        {
          id: 'm',
          name: 'Morning',
          owner: 'Tester',
          imageUrl: null,
          tracks: [shared, { ...track('intro'), durationMs: 30_000 }, { ...track('rude'), explicit: true }],
        },
        {
          id: 'e',
          name: 'Evening',
          owner: 'Tester',
          imageUrl: null,
          tracks: [shared, { ...track('epic'), durationMs: 600_000 }, track('e1'), track('e2')],
        },
      ])
    }

    async function selectBoth(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
      await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    }

    it('uses every track, duplicates included, by default', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      expect(screen.getByRole('radio', { name: /all eligible tracks/i })).toBeChecked()
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('7 tracks')).toBeInTheDocument()
    })

    it('removes duplicates across sources', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('checkbox', { name: /remove duplicates/i }))
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('6 tracks')).toBeInTheDocument()
      expect(mixOrder().filter((line) => line?.startsWith('Song shared'))).toHaveLength(1)
    })

    it('filters out explicit tracks and tracks outside the duration limits', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('checkbox', { name: /skip explicit/i }))
      await user.type(screen.getByRole('spinbutton', { name: /shorter than/i }), '1')
      await user.type(screen.getByRole('spinbutton', { name: /longer than/i }), '8')
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('4 tracks')).toBeInTheDocument()
      expect(mixOrder().join(' ')).not.toMatch(/Song (intro|epic|rude)/)
    })

    it('limits the mix to a fixed number of tracks', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('radio', { name: /fixed number/i }))
      const count = screen.getByRole('spinbutton', { name: /number of tracks/i })
      await user.clear(count)
      await user.type(count, '3')
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('3 tracks')).toBeInTheDocument()
      expect(mixOrder()).toHaveLength(3)
    })

    it('needs a valid number of tracks for a fixed length', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('radio', { name: /fixed number/i }))
      await user.clear(screen.getByRole('spinbutton', { name: /number of tracks/i }))

      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
    })

    it('needs the shortest duration to be no longer than the longest', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.type(screen.getByRole('spinbutton', { name: /shorter than/i }), '5')
      await user.type(screen.getByRole('spinbutton', { name: /longer than/i }), '2')

      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
    })

    it('says so when no track matches the settings', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.type(screen.getByRole('spinbutton', { name: /shorter than/i }), '20')
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText(/no tracks match/i)).toBeInTheDocument()
    })
  })

  describe('order', () => {
    const sourceOf = (line: string | null) => line?.match(/^Song (\w)/)?.[1]

    async function selectTwo(user: ReturnType<typeof userEvent.setup>) {
      await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
      await user.click(screen.getByRole('checkbox', { name: /evening/i }))
      await user.click(screen.getByRole('radio', { name: /balanced/i }))
    }

    it('plays tracks in random order, spreading artists, by default', async () => {
      renderMixer()

      expect(await screen.findByRole('radio', { name: /random/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /spread artists/i })).toBeChecked()
      expect(screen.queryByRole('spinbutton', { name: /block size/i })).not.toBeInTheDocument()
    })

    it('alternates the sources', async () => {
      const user = renderMixer()
      await selectTwo(user)

      await user.click(screen.getByRole('radio', { name: /alternate/i }))
      await user.click(screen.getByRole('button', { name: /generate/i }))

      await screen.findByText('10 tracks')
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'e', 'm', 'e', 'm', 'e', 'm', 'e', 'm', 'm'])
    })

    it('plays blocks of the chosen size', async () => {
      const user = renderMixer()
      await selectTwo(user)

      await user.click(screen.getByRole('radio', { name: /blocks/i }))
      const size = screen.getByRole('spinbutton', { name: /block size/i })
      await user.clear(size)
      await user.type(size, '2')
      await user.click(screen.getByRole('button', { name: /generate/i }))

      await screen.findByText('10 tracks')
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'm', 'e', 'e', 'm', 'm', 'e', 'e', 'm', 'm'])
    })

    it('needs a whole block size of at least 1', async () => {
      const user = renderMixer()
      await selectTwo(user)

      await user.click(screen.getByRole('radio', { name: /blocks/i }))
      await user.clear(screen.getByRole('spinbutton', { name: /block size/i }))

      expect(screen.getByRole('button', { name: /generate/i })).toBeDisabled()
    })

    it('keeps the same artist from playing back-to-back, unless turned off', async () => {
      const byArtist = (id: string, artist: string, size: number): FakeSource => ({
        ...fakeSource(id, id === 'm' ? 'Morning' : 'Evening', 0),
        tracks: Array.from({ length: size }, (_, i) => ({ ...track(`${id}${i + 1}`), artists: [artist] })),
      })
      const user = renderMixer(createFakeGateway([byArtist('m', 'Solo', 4), byArtist('e', 'Duo', 4)]))
      await selectTwo(user)
      await user.click(screen.getByRole('radio', { name: /blocks/i }))
      const size = screen.getByRole('spinbutton', { name: /block size/i })
      await user.clear(size)
      await user.type(size, '2')

      await user.click(screen.getByRole('button', { name: /generate/i }))
      await screen.findByText('8 tracks')
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'e', 'm', 'e', 'm', 'e', 'm', 'e'])

      await user.click(screen.getByRole('checkbox', { name: /spread artists/i }))
      await user.click(screen.getByRole('button', { name: /regenerate/i }))
      await screen.findByText('8 tracks')
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'm', 'e', 'e', 'm', 'm', 'e', 'e'])
    })
  })

  it('shows each source with its cover, owner and track count', async () => {
    renderMixer(
      createFakeGateway([
        fakeSource('m', 'Morning', 6, { owner: 'Ada', imageUrl: 'https://img.example/m.jpg' }),
        fakeSource('e', 'Evening', 1),
      ]),
    )

    const morning = (await screen.findByRole('checkbox', { name: /morning/i })).closest('li')!
    expect(within(morning).getByRole('presentation')).toHaveAttribute('src', 'https://img.example/m.jpg')
    expect(morning).toHaveTextContent('Ada · 6 tracks')
    expect(screen.getByRole('checkbox', { name: /evening/i }).closest('li')).toHaveTextContent('1 track')
  })

  it('filters the sources by name, keeping the selection', async () => {
    const user = renderMixer()

    await user.click(await screen.findByRole('checkbox', { name: /weekend/i }))
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'MOR')

    expect(screen.getByRole('checkbox', { name: /morning/i })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /evening/i })).not.toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /weekend/i })).not.toBeInTheDocument()
    expect(selection().getByText('Weekend')).toBeInTheDocument()

    await user.clear(screen.getByRole('searchbox', { name: /search/i }))
    await user.type(screen.getByRole('searchbox', { name: /search/i }), 'zzz')
    expect(screen.getByText(/no playlists match/i)).toBeInTheDocument()
  })

  it('marks a source whose tracks cannot be read as unavailable and mixes the rest', async () => {
    const user = renderMixer(
      createFakeGateway([
        fakeSource('m', 'Morning', 3),
        fakeSource('e', 'Evening', 2),
        fakeSource('h', 'Hidden', 4, { unavailable: true }),
      ]),
    )

    await user.click(await screen.findByRole('checkbox', { name: /morning/i }))
    await user.click(screen.getByRole('checkbox', { name: /evening/i }))
    await user.click(screen.getByRole('checkbox', { name: /hidden/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByText('5 tracks')).toBeInTheDocument()
    expect(screen.getByRole('status')).toHaveTextContent(/hidden is unavailable/i)
    const hidden = screen.getByRole('checkbox', { name: /hidden/i })
    expect(hidden).toBeDisabled()
    expect(hidden).not.toBeChecked()
    expect(hidden.closest('li')).toHaveTextContent(/unavailable/i)
    expect(selection().queryByText('Hidden')).not.toBeInTheDocument()
  })

  it('does not build a mix when every selected source is unavailable', async () => {
    const user = renderMixer(
      createFakeGateway([
        fakeSource('a', 'Alpha', 3, { unavailable: true }),
        fakeSource('b', 'Beta', 2, { unavailable: true }),
        fakeSource('c', 'Gamma', 2),
      ]),
    )

    await user.click(await screen.findByRole('checkbox', { name: /alpha/i }))
    await user.click(screen.getByRole('checkbox', { name: /beta/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))

    expect(await screen.findByRole('status')).toHaveTextContent(/alpha and beta are unavailable/i)
    expect(screen.queryByRole('list', { name: /mix/i })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /gamma/i })).toBeEnabled()
  })
})
