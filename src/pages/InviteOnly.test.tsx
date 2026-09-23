import { screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { renderAt } from '../test-utils'

describe('the invite-only page', () => {
  it('can be read by typing its address, without being refused first', () => {
    renderAt('/invite-only')

    expect(screen.getByRole('heading', { level: 1, name: 'Invite only' })).toBeInTheDocument()
    expect(screen.getByText(/isn’t on Randomizer’s invite list/i)).toBeInTheDocument()
  })

  it('offers the demo and says who hands out invites', () => {
    renderAt('/invite-only')

    expect(screen.getByRole('link', { name: 'Try the demo' })).toHaveAttribute('href', '/demo')
    expect(screen.getByRole('link', { name: 'TeoDea' })).toHaveAttribute('href', 'https://github.com/teodea')
    expect(screen.getByText(/no form to fill in/i)).toBeInTheDocument()
  })

  it('keeps itself out of search results', () => {
    renderAt('/invite-only')

    expect(document.head.querySelector('meta[name="robots"]')).toHaveAttribute('content', 'noindex')
  })

  it('tells an account that lost access that it had access, and what is left behind', () => {
    renderAt('/invite-only?removed')

    expect(screen.getByText(/was on the invite list, and it isn’t now/i)).toBeInTheDocument()
    expect(screen.getByText(/Randomizer mix/)).toBeInTheDocument()
    expect(screen.getByText(/delete it yourself/i)).toBeInTheDocument()
  })

  it('says nothing about a leftover playlist to someone who was never in', () => {
    renderAt('/invite-only')

    expect(screen.queryByText(/Randomizer mix/)).not.toBeInTheDocument()
  })
})
