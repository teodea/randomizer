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
})
