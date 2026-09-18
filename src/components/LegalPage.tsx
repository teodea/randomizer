import type { ReactNode } from 'react'
import { Link } from 'react-router'

interface LegalPageProps {
  title: string
  /** Human-readable date the current text took effect. */
  effectiveDate: string
  children: ReactNode
}

export function LegalPage({ title, effectiveDate, children }: LegalPageProps) {
  return (
    <>
      <title>{`${title} · Randomizer`}</title>
      <main className="page legal">
        <p>
          <Link to="/">← Back to home</Link>
        </p>
        <h1>{title}</h1>
        <p className="muted">Effective {effectiveDate}</p>
        {children}
      </main>
    </>
  )
}
