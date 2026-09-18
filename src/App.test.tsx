import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { renderAt } from './test-utils'

describe('routing', () => {
  it('shows the landing page at the root', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Randomizer' })).toBeInTheDocument()
  })

  it('shows a not-found page with a way home for unknown paths', () => {
    renderAt('/does/not/exist')
    expect(screen.getByRole('heading', { name: /page not found/i })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})

describe('demo mode', () => {
  it('opens the mixer with sample playlists from the landing page, without logging in', async () => {
    const user = userEvent.setup()
    renderAt('/')

    await user.click(screen.getByRole('link', { name: /try the demo/i }))

    expect(screen.getByRole('heading', { level: 1, name: /build a mix/i })).toBeInTheDocument()
    expect((await screen.findAllByRole('checkbox')).length).toBeGreaterThanOrEqual(2)
  })

  it('removes songs that appear in more than one sample playlist', async () => {
    const user = userEvent.setup()
    renderAt('/demo')

    await user.click(await screen.findByRole('checkbox', { name: /late night drive/i }))
    await user.click(screen.getByRole('checkbox', { name: /sunday coffee/i }))
    await user.click(screen.getByRole('button', { name: /generate/i }))
    expect(await screen.findByText('19 tracks')).toBeInTheDocument()

    await user.click(screen.getByRole('checkbox', { name: /remove duplicates/i }))
    await user.click(screen.getByRole('button', { name: /regenerate/i }))
    expect(await screen.findByText('18 tracks')).toBeInTheDocument()
  })
})
