import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAt } from '../test-utils'

describe('privacy policy', () => {
  it('is reachable without logging in', () => {
    renderAt('/privacy')
    expect(screen.getByRole('heading', { level: 1, name: 'Privacy policy' })).toBeInTheDocument()
  })

  it('covers what the app reads, storage, and how to disconnect', () => {
    renderAt('/privacy')
    for (const name of [
      'What Randomizer reads from Spotify',
      'Nothing is stored on a server',
      'What stays in your browser',
      'How to disconnect',
    ]) {
      expect(screen.getByRole('heading', { level: 2, name })).toBeInTheDocument()
    }
  })

  it('links to the Spotify page where access can be revoked', () => {
    renderAt('/privacy')
    expect(screen.getByRole('link', { name: /spotify\.com\/account\/apps/i })).toHaveAttribute(
      'href',
      'https://www.spotify.com/account/apps/',
    )
  })

  it('links to the terms and back home', () => {
    renderAt('/privacy')
    expect(screen.getByRole('link', { name: 'Terms' })).toHaveAttribute('href', '/terms')
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})

describe('terms', () => {
  it('is reachable without logging in', () => {
    renderAt('/terms')
    expect(screen.getByRole('heading', { level: 1, name: 'Terms' })).toBeInTheDocument()
  })

  it('links to the privacy policy and back home', () => {
    renderAt('/terms')
    expect(screen.getByRole('link', { name: 'Privacy policy' })).toHaveAttribute('href', '/privacy')
    expect(screen.getByRole('link', { name: /back to home/i })).toHaveAttribute('href', '/')
  })
})
