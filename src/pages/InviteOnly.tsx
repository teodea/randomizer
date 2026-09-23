import { Link, useSearchParams } from 'react-router'
import { TEMPORARY_PLAYLIST } from '../app/temporaryPlaylist'

/**
 * Where a refused login lands. Two people arrive here: one who was never on the
 * invite list, and one who was and isn't any more. The second was using the app
 * a minute ago, so the same words would read to them as a fault, not an answer.
 */
export function InviteOnly() {
  const removed = useSearchParams()[0].has('removed')

  return (
    <>
      <title>Invite only · Randomizer</title>
      {/* A page telling a visitor they're not on a list has no business in search results. */}
      <meta name="robots" content="noindex" />
      <main className="page">
        <p>
          <Link to="/">← Back to home</Link>
        </p>
        <h1>Invite only</h1>

        {removed ? (
          <>
            <p className="lead">
              Randomizer can&rsquo;t reach your Spotify account any more. It was on the invite list, and
              it isn&rsquo;t now.
            </p>
            <p>
              Nothing is broken and reloading won&rsquo;t help: the list is kept by the owner, and this
              account has been taken off it. You have been logged out here.
            </p>
            <p>
              One thing may be left behind. If Randomizer put a playlist called &ldquo;
              {TEMPORARY_PLAYLIST.name}&rdquo; in your library, it can no longer remove it for you. You
              can delete it yourself from Spotify, like any other playlist.
            </p>
          </>
        ) : (
          <>
            <p className="lead">
              This Spotify account isn&rsquo;t on Randomizer&rsquo;s invite list, so Spotify won&rsquo;t
              let the app read anything from it.
            </p>
            <p>
              The login itself worked &mdash; Spotify only refuses afterwards, which is why you got this
              far. Nothing of yours was read or saved, and you are already logged out here.
            </p>
          </>
        )}

        <section className="block" data-reveal="" aria-labelledby="why-heading">
          <h2 id="why-heading">Why there&rsquo;s a list at all</h2>
          <p>
            Randomizer runs in Spotify&rsquo;s development mode. In that mode Spotify allows at most
            five accounts in total to use the app, and the owner adds each one by hand. It isn&rsquo;t
            a waiting list, a queue or a paid tier: five is the whole number.
          </p>
        </section>

        <section className="block" data-reveal="" aria-labelledby="demo-heading">
          <h2 id="demo-heading">What you can do instead</h2>
          <p>
            <Link className="button button-primary" to="/demo">
              Try the demo
            </Link>
          </p>
          <p className="hint">
            Sample playlists, no account needed. The mixer is the real one: everything it does, it does
            there too.
          </p>
          <p className="hint">
            Invites are handed out by hand by <a href="https://github.com/teodea">TeoDea</a>, to people
            already known. There&rsquo;s no form to fill in and no address to write to: if you know
            TeoDea, ask. Otherwise the demo is the whole app, minus your own playlists.
          </p>
        </section>
      </main>
    </>
  )
}
