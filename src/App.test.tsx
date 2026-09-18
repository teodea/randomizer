import { render, screen } from '@testing-library/react'
import { createMemoryRouter, RouterProvider } from 'react-router'
import { describe, expect, it } from 'vitest'
import { routes } from './routes'

function renderAt(path: string) {
  const router = createMemoryRouter(routes, { initialEntries: [path] })
  render(<RouterProvider router={router} />)
}

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
