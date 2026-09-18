import { Link } from 'react-router'

export function NotFound() {
  return (
    <main className="page">
      <h1>Page not found</h1>
      <p>There's nothing at this address.</p>
      <p>
        <Link to="/">Back to home</Link>
      </p>
    </main>
  )
}
