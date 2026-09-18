import { render, screen, within } from '@testing-library/react'
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

function fakeSource(id: string, name: string, size: number): FakeSource {
  return { id, name, owner: 'Tester', tracks: Array.from({ length: size }, (_, i) => track(`${id}${i + 1}`)) }
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
      listSources: () => fake.listSources(),
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

  describe('pool settings', () => {
    function poolGateway() {
      const shared = track('shared')
      return createFakeGateway([
        {
          id: 'm',
          name: 'Morning',
          owner: 'Tester',
          tracks: [shared, { ...track('intro'), durationMs: 30_000 }, { ...track('rude'), explicit: true }],
        },
        {
          id: 'e',
          name: 'Evening',
          owner: 'Tester',
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

    it('says so when no track matches the settings', async () => {
      const user = renderMixer(poolGateway())
      await selectBoth(user)

      await user.type(screen.getByRole('spinbutton', { name: /shorter than/i }), '20')
      await user.click(screen.getByRole('button', { name: /generate/i }))

      expect(await screen.findByText(/no tracks match/i)).toBeInTheDocument()
    })
  })
})
