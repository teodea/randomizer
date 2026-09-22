import { useState } from 'react'
import { Link, useLocation } from 'react-router'
import { useServices, type Notice } from '../app/services'
import { removeTemporaryPlaylist } from '../app/temporaryPlaylist'

const NOTICES: Record<Notice, { text: string; urgent: boolean }> = {
  expired: { text: 'Your Spotify session has expired. Log in again to continue.', urgent: true },
  'not-invited': {
    text: 'Randomizer is invite-only, and this Spotify account isn’t on the invite list. Spotify only lets the accounts the owner has added use an app like this. The demo works without an account.',
    urgent: true,
  },
  denied: { text: 'You cancelled the login on Spotify. Log in again whenever you like.', urgent: true },
  failed: { text: 'The login didn’t work. Please try again.', urgent: true },
  'logged-out': {
    text: 'You’re logged out. Randomizer no longer has access to your Spotify account on this device.',
    urgent: false,
  },
}

export function Landing() {
  const { auth, createGateway } = useServices()
  const notice = (useLocation().state as { notice?: Notice } | null)?.notice
  const [loggedIn, setLoggedIn] = useState(() => auth?.isLoggedIn() ?? false)
  const [redirecting, setRedirecting] = useState(false)
  const [loginFailed, setLoginFailed] = useState(false)
  const [loggingOut, setLoggingOut] = useState(false)

  async function logIn() {
    if (!auth) return
    setRedirecting(true)
    setLoginFailed(false)
    try {
      await auth.beginLogin()
    } catch {
      setRedirecting(false)
      setLoginFailed(true)
    }
  }

  /** Nothing is left behind: the temporary playlist goes first, then the session. */
  async function logOut() {
    if (!auth) return
    setLoggingOut(true)
    // If removing fails, the next visit finds the playlist and offers to remove it.
    await removeTemporaryPlaylist(createGateway(auth)).catch(() => undefined)
    auth.logout()
    setLoggedIn(false)
    setLoggingOut(false)
  }

  return (
    <main className="page">
      {notice && NOTICES[notice] && (
        <p
          className="notice"
          data-label={NOTICES[notice].urgent ? 'Notice' : 'Signed out'}
          role={NOTICES[notice].urgent ? 'alert' : 'status'}
        >
          {NOTICES[notice].text}
        </p>
      )}
      <h1>Randomizer</h1>
      <p className="lead">Mix tracks from several of your playlists into one shuffled queue.</p>

      <ol className="steps">
        <li>
          <span>
            <strong>Pick your sources.</strong> Any mix of playlists you made, playlists you follow, and
            your Liked Songs.
          </span>
        </li>
        <li>
          <span>
            <strong>Choose how to mix.</strong> Keep a huge playlist from drowning out a small one, drop
            songs that appear twice, and keep the same artist from playing back to back.
          </span>
        </li>
        <li>
          <span>
            <strong>Press play.</strong> Randomizer puts the mix in one private, temporary playlist in
            your account and starts it. When you&rsquo;re done, it removes the playlist.
          </span>
        </li>
      </ol>

      <section className="block" aria-labelledby="demo-heading">
        <h2 id="demo-heading">Try it</h2>
        <p>
          <Link className="button" to="/demo">
            Try the demo
          </Link>
        </p>
        <p className="hint">Sample playlists, no account needed.</p>
      </section>

      <section className="block" aria-labelledby="login-heading">
        <h2 id="login-heading">Log in</h2>
        {loggedIn ? (
          <p className="actions">
            <Link className="button button-primary" to="/mix">
              Choose your playlists
            </Link>
            <button className="button" type="button" disabled={loggingOut} onClick={logOut}>
              Log out
            </button>
          </p>
        ) : (
          <>
            <p>
              <button
                className="button button-primary"
                type="button"
                disabled={!auth || redirecting}
                aria-describedby={auth ? undefined : 'login-status'}
                onClick={logIn}
              >
                Log in with Spotify
              </button>
            </p>
            {!auth && (
              <p className="hint" id="login-status">
                Login isn&rsquo;t configured for this build.
              </p>
            )}
            {loginFailed && (
              <p className="notice" data-label="Login" role="alert">
                Couldn&rsquo;t start the login. Please try again.
              </p>
            )}
          </>
        )}
        <p className="hint">
          Login is limited to invited users. While an app like this is in development, Spotify lets
          at most five accounts use it. Not invited? The demo shows how mixing works.
        </p>
        <p className="hint">
          Before logging in, read the <Link to="/privacy">Privacy policy</Link> and the{' '}
          <Link to="/terms">Terms</Link>. In short: nothing is stored on any server.
        </p>
      </section>
    </main>
  )
}
