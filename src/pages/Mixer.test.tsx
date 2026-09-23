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
// Each row prints its running time; these tests are about which tracks are in the
// mix and in what order, so the time element is dropped before reading the row.
const mixOrder = () =>
  within(screen.getByRole('list', { name: /mix/i }))
    .getAllByRole('listitem')
    .map((item) => {
      const row = item.cloneNode(true) as HTMLElement
      row.querySelector('time')?.remove()
      return row.textContent
    })

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
    expect(first).toHaveLength(6)
    expect(first.every((line) => /^Song [me]/.test(line!))).toBe(true)
    expect(first.some((line) => line?.startsWith('Song w'))).toBe(false)

    await user.click(screen.getByRole('button', { name: /regenerate/i }))
    await screen.findByText('10 tracks')
    expect(mixOrder()).not.toEqual(first)
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
    // Balanced: the rail gives the small source the same share as the big one.
    const rail = within(screen.getByRole('list', { name: /source shares/i }))
    expect(rail.getAllByRole('listitem').map((item) => item.textContent)).toEqual(['1Morning50%', '2Evening50%'])
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

    it('uses every eligible track, with duplicates across sources removed, by default', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      expect(screen.getByRole('radio', { name: /all eligible tracks/i })).toBeChecked()
      expect(screen.getByRole('checkbox', { name: /remove duplicates/i })).toBeChecked()
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('6 tracks')).toBeInTheDocument()
      expect(mixOrder().filter((line) => line?.startsWith('Song shared'))).toHaveLength(1)
    })

    it('keeps duplicates when asked to', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('checkbox', { name: /remove duplicates/i }))
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('7 tracks')).toBeInTheDocument()
    })

    it('filters out explicit tracks and tracks outside the duration limits', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.click(screen.getByRole('checkbox', { name: /skip explicit/i }))
      await user.click(screen.getByText('Duration limits'))
      await user.type(screen.getByRole('spinbutton', { name: /shorter than/i }), '1')
      await user.type(screen.getByRole('spinbutton', { name: /longer than/i }), '8')
      // Folded away, the limits in force still show on the closed row.
      expect(screen.getByText('1–8 min')).toBeInTheDocument()
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText('3 tracks')).toBeInTheDocument()
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
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'e', 'm', 'e', 'm', 'e'])
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
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'm', 'e', 'e', 'm', 'm'])
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
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'e', 'm', 'e', 'm', 'e'])

      await user.click(screen.getByRole('checkbox', { name: /spread artists/i }))
      await user.click(screen.getByRole('button', { name: /regenerate/i }))
      await screen.findByText('8 tracks')
      expect(mixOrder().map(sourceOf)).toEqual(['m', 'm', 'e', 'e', 'm', 'm'])
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

  it('offers a way back to the top of the rack once it has been scrolled', async () => {
    // jsdom lays nothing out, so it has no scrollIntoView of its own.
    const scrolledIntoView: Element[] = []
    const original = Element.prototype.scrollIntoView
    Element.prototype.scrollIntoView = function (this: Element) {
      scrolledIntoView.push(this)
    }
    try {
      const user = renderMixer()
      const rack = (await screen.findByRole('checkbox', { name: /morning/i })).closest('ul')!
      expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()

      rack.scrollTop = 400
      fireEvent.scroll(rack)
      await user.click(screen.getByRole('button', { name: /back to top/i }))

      expect(rack.scrollTop).toBe(0)
      expect(scrolledIntoView).toEqual([screen.getByRole('region', { name: 'Sources' })])
      expect(screen.getByRole('heading', { name: 'Sources' })).toHaveFocus()

      // A browser reports the jump as a scroll; jsdom has to be told.
      fireEvent.scroll(rack)
      expect(screen.queryByRole('button', { name: /back to top/i })).not.toBeInTheDocument()
    } finally {
      Element.prototype.scrollIntoView = original
    }
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

  it('narrows the sources to the ones the user made, or the ones others made', async () => {
    const user = renderMixer(
      createFakeGateway([
        fakeSource('m', 'Morning', 6, { ownedByUser: true }),
        fakeSource('e', 'Evening', 4),
        fakeSource('w', 'Weekend', 3),
      ]),
    )

    await user.click(await screen.findByRole('checkbox', { name: /evening/i }))
    expect(screen.getByRole('radio', { name: /anyone/i })).toBeChecked()

    await user.click(screen.getByRole('radio', { name: /^me/i }))
    expect(screen.getByRole('checkbox', { name: /morning/i })).toBeInTheDocument()
    expect(screen.queryByRole('checkbox', { name: /evening/i })).not.toBeInTheDocument()
    expect(selection().getByText('Evening')).toBeInTheDocument()

    await user.click(screen.getByRole('radio', { name: /others/i }))
    expect(screen.queryByRole('checkbox', { name: /morning/i })).not.toBeInTheDocument()
    expect(screen.getByRole('checkbox', { name: /evening/i })).toBeChecked()
    expect(screen.getByRole('checkbox', { name: /weekend/i })).toBeInTheDocument()
  })

  it('lists the sources in library order, and sorts them by name or by size on request', async () => {
    // Nothing mixed before on this device, so the default ranking is the library's own order.
    localStorage.clear()
    const user = renderMixer(
      createFakeGateway([fakeSource('w', 'Weekend', 3), fakeSource('m', 'Morning', 6), fakeSource('e', 'evening', 4)]),
    )
    // Every spine carries its back-link to Spotify, so the links read the rack in order.
    const rack = async () =>
      (await screen.findAllByRole('link', { name: /^open .* on spotify$/i })).map((link) =>
        link.getAttribute('aria-label')!.replace(/^Open (.*) on Spotify$/, '$1'),
      )

    expect(await rack()).toEqual(['Weekend', 'Morning', 'evening'])
    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'Name, A–Z')
    expect(await rack()).toEqual(['evening', 'Morning', 'Weekend'])
    await user.selectOptions(screen.getByRole('combobox', { name: /sort/i }), 'Most tracks')
    expect(await rack()).toEqual(['Morning', 'evening', 'Weekend'])
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
    expect(screen.getByText(/hidden is unavailable/i)).toHaveAttribute('role', 'status')
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
