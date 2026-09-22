import { LegalPage } from '../components/LegalPage'

export function Privacy() {
  return (
    <LegalPage title="Privacy policy" effectiveDate="18 September 2026">
      <p className="lead">
        Randomizer runs entirely in your web browser. It reads your playlists to build a mix, puts the
        mix in one private playlist in your Spotify account, and keeps nothing on any server.
      </p>

      <h2>What Randomizer reads from Spotify</h2>
      <p>
        You log in on Spotify&rsquo;s own page, so Randomizer never sees your password. Spotify then
        asks you to grant Randomizer some permissions. It uses them only to build and play your mix,
        and reads:
      </p>
      <ul>
        <li>
          Your playlists (the ones you made, follow or collaborate on, including private ones) and the
          tracks in them.
        </li>
        <li>Your Liked Songs.</li>
        <li>Your Spotify user ID and display name, to show who is logged in.</li>
        <li>Your devices and what is playing, to start the mix on the device you are using.</li>
      </ul>
      <p>
        It also asks to create, change and remove playlists and to manage the items saved in your
        library. Randomizer only ever uses these on the one temporary playlist it creates. It does not
        read your email address.
      </p>

      <h2>What Randomizer changes in your account</h2>
      <p>
        When you build a mix, Randomizer creates one private playlist, labelled as temporary and made
        by Randomizer. Each new mix replaces its contents. It is removed when you press Clean up or log
        out. On Spotify, removing a playlist means unfollowing it: it leaves your library, but Spotify
        keeps the playlist itself, so anyone who already had its link could still open it. Randomizer
        never changes any other playlist.
      </p>

      <h2>Nothing is stored on a server</h2>
      <p>
        Randomizer has no server and no database. The site is a set of static files hosted on GitHub
        Pages, and your browser talks directly to Spotify. Your playlists, tracks and mixes are never
        sent anywhere else. There are no analytics, ads or trackers.
      </p>
      <p>
        Like any web host, GitHub may log basic request data such as your IP address. See the{' '}
        <a href="https://docs.github.com/en/site-policy/privacy-policies/github-general-privacy-statement">
          GitHub Privacy Statement
        </a>
        .
      </p>

      <h2>What stays in your browser</h2>
      <p>
        Randomizer keeps your Spotify login (the access and refresh tokens Spotify issues, never
        your password) in your browser&rsquo;s storage, so you stay logged in when you reload the
        page. It also keeps the identifiers of the last few playlists you mixed, so the list of
        playlists opens on the ones you use, and which theme you chose. Nothing else about a
        playlist is kept: its name, cover and tracks are read from Spotify on every visit and held
        in memory only while the page is open, and so is the current mix. Randomizer sets no
        cookies.
      </p>
      <p>
        Logging out erases your login and the list of playlists you last mixed. Your theme is a
        setting for this device rather than account data, so it stays.
      </p>

      <h2>How to disconnect</h2>
      <ol>
        <li>
          <strong>Log out in Randomizer.</strong> This removes the temporary playlist and erases what
          Randomizer kept in this browser.
        </li>
        <li>
          <strong>Revoke access in your Spotify account.</strong> Go to{' '}
          <a href="https://www.spotify.com/account/apps/">spotify.com/account/apps</a>, find Randomizer
          and choose Remove access. After that, Randomizer can no longer reach your account.
        </li>
      </ol>
      <p>
        If you clear your browser data instead of logging out, the temporary playlist stays in your
        account. You can delete it in Spotify like any other playlist.
      </p>

      <h2>Who can use it</h2>
      <p>
        Login is limited to accounts the owner has invited, at most five, as Spotify requires for apps
        in development. The demo uses sample data and never touches a Spotify account.
      </p>

      <h2>Changes and contact</h2>
      <p>
        If this policy changes, the date at the top changes too. For questions, open an issue on{' '}
        <a href="https://github.com/teodea/randomizer/issues">GitHub</a>.
      </p>
    </LegalPage>
  )
}
