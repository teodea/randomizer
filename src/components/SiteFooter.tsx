import { NavLink } from 'react-router'

export function SiteFooter() {
  return (
    <footer className="site-footer">
      <nav aria-label="Site">
        <NavLink to="/privacy">Privacy policy</NavLink>
        <NavLink to="/terms">Terms</NavLink>
        <a href="https://github.com/teodea/randomizer">Source code</a>
      </nav>
      <p>
        Randomizer is an independent project, not affiliated with or endorsed by Spotify. Spotify is a
        trademark of Spotify AB.
      </p>
    </footer>
  )
}
