import { screen, within } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAt } from '../test-utils'

describe('landing page', () => {
  it('explains what the app does', () => {
    renderAt('/')
    expect(screen.getByRole('heading', { level: 1, name: 'Randomizer' })).toBeInTheDocument()
    expect(screen.getByText(/several of your playlists/i)).toBeInTheDocument()
  })

  it('offers the demo without logging in', () => {
    renderAt('/')
    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo')
  })

  it('offers Spotify login and says it is invite-only', () => {
    renderAt('/')
    expect(screen.getByRole('button', { name: 'Log in with Spotify' })).toBeInTheDocument()
    expect(screen.getByText(/invited users/i)).toBeInTheDocument()
  })

  it('links to the privacy policy and terms next to the login', () => {
    renderAt('/')
    const login = screen.getByRole('region', { name: 'Log in' })
    expect(within(login).getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(within(login).getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
  })

  it('says the app is not affiliated with Spotify', () => {
    renderAt('/')
    expect(screen.getByText(/not affiliated with/i)).toBeInTheDocument()
  })
})
