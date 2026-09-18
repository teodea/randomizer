import { screen } from '@testing-library/react'
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
