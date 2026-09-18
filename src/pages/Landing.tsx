import { Link } from 'react-router'

export function Landing() {
  return (
    <main className="page">
      <h1>Randomizer</h1>
      <p className="lead">Mix tracks from several of your playlists into one shuffled queue.</p>

      <ol className="steps">
        <li>
          <strong>Pick your sources.</strong> Any mix of playlists you made, playlists you follow, and
          your Liked Songs.
        </li>
        <li>
          <strong>Choose how to mix.</strong> Keep a huge playlist from drowning out a small one, drop
          songs that appear twice, and keep the same artist from playing back to back.
        </li>
        <li>
          <strong>Press play.</strong> Randomizer puts the mix in one private, temporary playlist in
          your account and starts it. When you&rsquo;re done, it removes the playlist.
        </li>
      </ol>

      <section className="cta" aria-labelledby="demo-heading">
        <h2 id="demo-heading">Try it</h2>
        <p>
          <Link className="button button-primary" to="/demo">
            Try the demo
          </Link>
        </p>
        <p className="muted">Sample playlists, no account needed.</p>
      </section>

      <section className="cta" aria-labelledby="login-heading">
        <h2 id="login-heading">Log in</h2>
        <p>
          {/* Enabled once Spotify login is built. */}
          <button className="button" type="button" disabled aria-describedby="login-status">
            Log in with Spotify
          </button>
        </p>
        <p className="muted" id="login-status">
          Login isn&rsquo;t available yet.
        </p>
        <p>
          Login is limited to invited users. While an app like this is in development, Spotify lets
          at most five accounts use it. Not invited? The demo shows how mixing works.
        </p>
        <p>
          Before logging in, read the <Link to="/privacy">Privacy policy</Link> and the{' '}
          <Link to="/terms">Terms</Link>. In short: nothing is stored on any server.
        </p>
      </section>
    </main>
  )
}
